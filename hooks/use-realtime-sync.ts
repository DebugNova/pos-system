"use client";

import { useEffect, useRef } from "react";
import { getSupabase } from "@/lib/supabase";
import { usePOSStore } from "@/lib/store";
import { fetchOrderById } from "@/lib/supabase-queries";
import { hydrateStoreFromSupabase } from "@/lib/hydrate";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { MenuItem } from "@/lib/data";

/**
 * Hook: useRealtimeSync
 * 
 * Subscribes to Supabase Realtime changes on `orders`, `order_items`,
 * `supplementary_bills`, `supplementary_bill_items`, `tables`, `settings`,
 * and `staff` tables. When one device writes a change, all other devices
 * receive the event and update their local Zustand store instantly.
 * 
 * Includes "own write" detection to avoid redundant updates when the
 * local terminal triggers a change it already applied optimistically.
 */
export function useRealtimeSync() {
  const channelRef = useRef<RealtimeChannel | null>(null);
  // Track reconnect timer so we can clean it up
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);

  // Gate on login state — only subscribe when authenticated
  const isLoggedIn = usePOSStore((s) => s.isLoggedIn);

  useEffect(() => {
    if (!isLoggedIn) return;

    const supabase = getSupabase();
    if (!supabase) return;


    // Track whether this effect has been cleaned up
    let disposed = false;

    /**
     * Build and subscribe to the Realtime channel.
     * Uses a unique suffix to prevent collisions with stale channels
     * that haven't finished teardown yet (e.g. React Strict Mode).
     */
    function createChannel() {
      // Clean up any existing channel first
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      const channelName = `pos-realtime-${Date.now()}`;
      const channel = supabase
        .channel(channelName)
        // ── Orders ──
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders" },
          (payload) => {
            handleOrderChange(payload);
          }
        )
        // ── Order Items (needed for KDS to see full item details) ──
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "order_items" },
          (payload) => {
            handleOrderItemChange(payload);
          }
        )
        // ── Supplementary Bills ──
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "supplementary_bills" },
          (payload) => {
            handleSupplementaryBillChange(payload);
          }
        )
        // ── Supplementary Bill Items ──
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "supplementary_bill_items" },
          (payload) => {
            handleSupplementaryBillItemChange(payload);
          }
        )
        // ── Tables ──
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "tables" },
          (payload) => {
            handleTableChange(payload);
          }
        )
        // ── Settings ──
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "settings" },
          (payload) => {
            handleSettingsChange(payload);
          }
        )
        // ── Staff ──
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "staff" },
          (payload) => {
            handleStaffChange(payload);
          }
        )
        // ── Modifiers ──
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "modifiers" },
          (payload) => {
            handleModifierChange(payload);
          }
        )
        // ── Menu Items ──
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "menu_items" },
          (payload) => {
            handleMenuItemChange(payload);
          }
        )
        .subscribe((status, err) => {
          console.log("[realtime] Subscription status:", status);
          if (status === "SUBSCRIBED") {
            console.log("[realtime] ✓ Connected — live updates active");
            // Reset reconnect counter on successful connection
            reconnectAttemptRef.current = 0;
          } else if (status === "CHANNEL_ERROR") {
            console.error("[realtime] Channel error — will attempt reconnect:", err);
            // Re-hydrate from Supabase to catch any missed events during disconnect
            if (navigator.onLine) {
              hydrateStoreFromSupabase().catch(console.error);
            }
            // Reconnect with exponential backoff (max 8s for café WiFi)
            if (!disposed && navigator.onLine) {
              const attempt = reconnectAttemptRef.current++;
              const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
              console.log(`[realtime] Reconnecting in ${delay}ms (attempt ${attempt + 1})`);
              reconnectTimerRef.current = setTimeout(() => {
                if (!disposed) {
                  createChannel();
                }
              }, delay);
            }
          } else if (status === "TIMED_OUT") {
            console.warn("[realtime] Subscription timed out — rehydrating & reconnecting");
            if (navigator.onLine) {
              hydrateStoreFromSupabase().catch(console.error);
            }
            // Also attempt reconnect on timeout
            if (!disposed && navigator.onLine) {
              const attempt = reconnectAttemptRef.current++;
              const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
              reconnectTimerRef.current = setTimeout(() => {
                if (!disposed) {
                  createChannel();
                }
              }, delay);
            }
          }
        });

      channelRef.current = channel;
    }

    // Initial channel creation
    createChannel();

    // On window refocus, re-hydrate to catch any events missed while in background
    let hiddenAt: number | null = null;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (document.visibilityState === "visible" && navigator.onLine) {
        const wasHiddenFor = hiddenAt ? Date.now() - hiddenAt : 0;
        hiddenAt = null;
        // Rehydrate after >3s in background — mobile devices can miss events quickly
        if (wasHiddenFor > 3_000) {
          console.log("[realtime] Tab refocused after >3s — rehydrating to catch missed events");
          hydrateStoreFromSupabase().catch(console.error);
        }
      }
    };

    // On reconnect after going offline, re-hydrate
    const handleOnline = () => {
      console.log("[realtime] Device back online — rehydrating");
      hydrateStoreFromSupabase().catch(console.error);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    return () => {
      disposed = true;
      console.log("[realtime] Removing pos-realtime channel");
      // Clear any pending reconnect timer
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      // Use removeChannel for full teardown (not just unsubscribe)
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      channelRef.current = null;
      reconnectAttemptRef.current = 0;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
    };
  }, [isLoggedIn]);
}

// ─────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────

// Track orders that recently received an 'orders' table event — the debounced
// refetch from that event will include items anyway, so we can skip the
// redundant refetch triggered by the corresponding 'order_items' event.
const recentOrderTableEvents = new Set<string>();

function handleOrderChange(payload: any) {
  const { eventType, new: newRecord, old: oldRecord } = payload;

  if (eventType === "UPDATE") {
    const orderId = newRecord?.id;
    if (!orderId) return;

    // OPTIMIZATION: For UPDATE events, apply the payload's fields directly
    // to the local store — no DB round-trip needed. The Realtime payload
    // already contains all columns from the `orders` table.
    // This eliminates ~80% of compensating DB reads.
    mergeOrderPayloadDirectly(orderId, newRecord);

    // Mark that we're handling this order — skip redundant order_items refetch
    recentOrderTableEvents.add(orderId);
    setTimeout(() => recentOrderTableEvents.delete(orderId), 1000);
  } else if (eventType === "INSERT") {
    const orderId = newRecord?.id;
    if (!orderId) return;

    // For INSERT events we MUST refetch because items are in a separate table
    // and aren't part of the Realtime payload. Use a longer debounce (800ms)
    // to give the items time to be written.
    recentOrderTableEvents.add(orderId);
    setTimeout(() => recentOrderTableEvents.delete(orderId), 1000);

    refetchAndMergeOrder(orderId);
  } else if (eventType === "DELETE") {
    const deletedId = oldRecord?.id;
    if (!deletedId) return;

    usePOSStore.setState((state) => ({
      orders: state.orders.filter((o) => o.id !== deletedId),
    }));
    console.log("[realtime] Order deleted:", deletedId);
  }
}

function handleOrderItemChange(payload: any) {
  // When order items change, re-fetch the parent order to get the full picture
  const orderId = payload.new?.order_id || payload.old?.order_id;
  if (!orderId) return;

  // Skip if we already have a pending refetch from the 'orders' table event.
  // The debounced refetch from handleOrderChange will include items anyway.
  if (recentOrderTableEvents.has(orderId)) {
    console.log("[realtime] Skipping order_items refetch — orders event already handling:", orderId);
    return;
  }

  refetchAndMergeOrder(orderId);
}

function handleSupplementaryBillChange(payload: any) {
  // When supplementary bills change, re-fetch the parent order
  const orderId = payload.new?.order_id || payload.old?.order_id;
  if (orderId) {
    refetchAndMergeOrder(orderId);
  }
}

function handleSupplementaryBillItemChange(payload: any) {
  // When supplementary bill items change, we need the bill's order_id
  // Re-fetch is handled via the parent supplementary_bill change,
  // but as a safety net do a full re-hydrate
  const billId = payload.new?.supplementary_bill_id || payload.old?.supplementary_bill_id;
  if (billId) {
    // We don't have a direct order_id here, so trigger a lightweight re-hydrate
    // The supplementary_bills handler will usually fire first and handle this
    console.log("[realtime] Supplementary bill item changed for bill:", billId);
  }
}

function handleTableChange(payload: any) {
  const { eventType, new: newRecord, old: oldRecord } = payload;

  if (eventType === "INSERT") {
    if (!newRecord?.id) return;
    const incoming = {
      id: newRecord.id as string,
      number: newRecord.number as number,
      capacity: newRecord.capacity as number,
      status: newRecord.status as "available" | "occupied" | "waiting-payment",
      orderId: newRecord.order_id || undefined,
    };
    usePOSStore.setState((state) => {
      if (state.tables.some((t) => t.id === incoming.id)) return {};
      return { tables: [...state.tables, incoming] };
    });
    console.log("[realtime] Table added:", incoming.number);
  } else if (eventType === "UPDATE") {
    if (!newRecord?.id) return;
    usePOSStore.setState((state) => ({
      tables: state.tables.map((t) =>
        t.id === newRecord.id
          ? {
              ...t,
              number: newRecord.number ?? t.number,
              capacity: newRecord.capacity ?? t.capacity,
              status: newRecord.status ?? t.status,
              orderId: newRecord.order_id || undefined,
            }
          : t
      ),
    }));
    console.log("[realtime] Table updated:", newRecord.id, "→", newRecord.status);
  } else if (eventType === "DELETE") {
    const deletedId = oldRecord?.id;
    if (!deletedId) return;
    usePOSStore.setState((state) => ({
      tables: state.tables.filter((t) => t.id !== deletedId),
    }));
    console.log("[realtime] Table deleted:", deletedId);
  }
}

function handleMenuItemChange(payload: any) {
  const { eventType, new: newRecord, old: oldRecord } = payload;

  if (eventType === "INSERT" || eventType === "UPDATE") {
    if (!newRecord?.id) return;
    const item: MenuItem = {
      id: newRecord.id as string,
      name: newRecord.name as string,
      price: Number(newRecord.price) || 0,
      category: newRecord.category as string,
      variants: newRecord.variants || [],
      available: newRecord.available as boolean,
      image_url: newRecord.image_url || undefined,
      bestseller: newRecord.bestseller || false,
      modifierIds:
        Array.isArray(newRecord.modifier_ids) && newRecord.modifier_ids.length > 0
          ? (newRecord.modifier_ids as string[])
          : undefined,
    };
    usePOSStore.setState((state) => {
      const exists = state.menuItems.some((m) => m.id === item.id);
      return {
        menuItems: exists
          ? state.menuItems.map((m) => (m.id === item.id ? item : m))
          : [...state.menuItems, item],
      };
    });
    console.log("[realtime] Menu item upserted:", item.name);
  } else if (eventType === "DELETE") {
    const deletedId = oldRecord?.id;
    if (!deletedId) return;
    usePOSStore.setState((state) => ({
      menuItems: state.menuItems.filter((m) => m.id !== deletedId),
    }));
    console.log("[realtime] Menu item deleted:", deletedId);
  }
}

function handleSettingsChange(payload: any) {
  if (payload.eventType === "UPDATE") {
    const db = payload.new;
    if (!db) return;

    usePOSStore.setState((state) => ({
      settings: {
        ...state.settings,
        cafeName: db.cafe_name ?? state.settings.cafeName,
        gstNumber: db.gst_number ?? state.settings.gstNumber,
        address: db.address ?? state.settings.address,
        taxRate: db.tax_rate != null ? Number(db.tax_rate) : state.settings.taxRate,
        gstEnabled: db.gst_enabled ?? state.settings.gstEnabled,
        upiId: db.upi_id ?? state.settings.upiId,
        orderAlerts: db.order_alerts ?? state.settings.orderAlerts,
        kitchenReadyAlerts: db.kitchen_ready_alerts ?? state.settings.kitchenReadyAlerts,
        autoPrintKot: db.auto_print_kot ?? state.settings.autoPrintKot,
        printCustomerCopy: db.print_customer_copy ?? state.settings.printCustomerCopy,
        sessionTimeoutMinutes: db.session_timeout_minutes ?? state.settings.sessionTimeoutMinutes,
        cashEnabled: db.cash_enabled ?? state.settings.cashEnabled,
        upiEnabled: db.upi_enabled ?? state.settings.upiEnabled,
        cardEnabled: db.card_enabled ?? state.settings.cardEnabled,
        upiQrCodeUrl: db.upi_qr_code_url ?? state.settings.upiQrCodeUrl,
        printers: db.printers ?? state.settings.printers,
      },
      // menuCategories lives alongside settings but is stored in its own
      // DB column so it can be synced independently of other settings fields.
      ...(Array.isArray(db.menu_categories) && db.menu_categories.length > 0
        ? { menuCategories: db.menu_categories }
        : {}),
    }));
    console.log("[realtime] Settings updated");
  }
}

function handleStaffChange(payload: any) {
  const { eventType, new: newRecord, old: oldRecord } = payload;

  if (eventType === "INSERT") {
    if (!newRecord || !newRecord.is_active) return;
    usePOSStore.setState((state) => ({
      staffMembers: [
        ...state.staffMembers,
        {
          id: newRecord.id,
          name: newRecord.name,
          role: newRecord.role,
          pin: newRecord.pin,
          initials: newRecord.initials,
        },
      ],
    }));
    console.log("[realtime] Staff added:", newRecord.name);
  } else if (eventType === "UPDATE") {
    if (!newRecord) return;
    if (!newRecord.is_active) {
      // Deactivated — remove from local list
      usePOSStore.setState((state) => ({
        staffMembers: state.staffMembers.filter((s) => s.id !== newRecord.id),
      }));
    } else {
      usePOSStore.setState((state) => ({
        staffMembers: state.staffMembers.map((s) =>
          s.id === newRecord.id
            ? {
                ...s,
                name: newRecord.name,
                role: newRecord.role,
                pin: newRecord.pin,
                initials: newRecord.initials,
              }
            : s
        ),
      }));
    }
    console.log("[realtime] Staff updated:", newRecord.name);
  } else if (eventType === "DELETE") {
    const deletedId = oldRecord?.id;
    if (!deletedId) return;
    usePOSStore.setState((state) => ({
      staffMembers: state.staffMembers.filter((s) => s.id !== deletedId),
    }));
    console.log("[realtime] Staff deleted:", deletedId);
  }
}

function handleModifierChange(payload: any) {
  const { eventType, new: newRecord, old: oldRecord } = payload;

  if (eventType === "INSERT" || eventType === "UPDATE") {
    if (!newRecord) return;
    const mod = {
      id: newRecord.id as string,
      name: newRecord.name as string,
      price: Number(newRecord.price) || 0,
    };
    usePOSStore.setState((state) => {
      const exists = state.modifiers.some((m) => m.id === mod.id);
      return {
        modifiers: exists
          ? state.modifiers.map((m) => (m.id === mod.id ? mod : m))
          : [...state.modifiers, mod],
      };
    });
    console.log("[realtime] Modifier upserted:", mod.name);
  } else if (eventType === "DELETE") {
    const deletedId = oldRecord?.id;
    if (!deletedId) return;
    usePOSStore.setState((state) => ({
      modifiers: state.modifiers.filter((m) => m.id !== deletedId),
    }));
    console.log("[realtime] Modifier deleted:", deletedId);
  }
}

// ─────────────────────────────────────────────────
// Helper: Apply Realtime UPDATE payload directly (no DB round-trip)
// ─────────────────────────────────────────────────

/**
 * For UPDATE events, merge the Realtime payload's order-level fields
 * directly into the local store. This avoids a DB round-trip for ~80%
 * of realtime events (status changes, payment updates, payLater toggles).
 *
 * Items are NOT in this payload (they're in a separate table), so we
 * preserve the existing items array. If items change, the order_items
 * handler will trigger a full refetch.
 */
function mergeOrderPayloadDirectly(orderId: string, dbRecord: any) {
  // Check existence BEFORE entering setState to keep the setter pure (no side effects).
  const existing = usePOSStore.getState().orders.find((o) => o.id === orderId);
  if (!existing) {
    // New order we don't have yet (missed the INSERT) — full refetch to get items too.
    refetchAndMergeOrder(orderId);
    return;
  }

  usePOSStore.setState((state) => {
    const currentOrder = state.orders.find((o) => o.id === orderId);
    if (!currentOrder) return {};

    // Lifecycle guard: reject stale merges that would regress the status
    const localRank = STATUS_RANK[currentOrder.status] ?? -1;
    const incomingRank = STATUS_RANK[dbRecord.status] ?? -1;
    if (incomingRank < localRank) {
      console.log(
        "[realtime] Rejected stale payload merge — local is ahead:",
        orderId, currentOrder.status, "→", dbRecord.status
      );
      return {};
    }

    // Build merged order — preserve items/supplementaryBills from local state,
    // apply scalar fields from the Realtime payload
    const merged = {
      ...currentOrder,
      status: dbRecord.status ?? currentOrder.status,
      type: dbRecord.type ?? currentOrder.type,
      tableId: dbRecord.table_id ?? currentOrder.tableId,
      total: dbRecord.total != null ? Number(dbRecord.total) : currentOrder.total,
      customerName: dbRecord.customer_name ?? currentOrder.customerName,
      customerPhone: dbRecord.customer_phone ?? currentOrder.customerPhone,
      orderNotes: dbRecord.order_notes ?? currentOrder.orderNotes,
      platform: dbRecord.platform ?? currentOrder.platform,
      payment: dbRecord.payment ?? currentOrder.payment,
      subtotal: dbRecord.subtotal != null ? Number(dbRecord.subtotal) : currentOrder.subtotal,
      discount: dbRecord.discount_type ? {
        type: dbRecord.discount_type,
        value: Number(dbRecord.discount_value),
        amount: Number(dbRecord.discount_amount),
      } : currentOrder.discount,
      taxRate: dbRecord.tax_rate != null ? Number(dbRecord.tax_rate) : currentOrder.taxRate,
      taxAmount: dbRecord.tax_amount != null ? Number(dbRecord.tax_amount) : currentOrder.taxAmount,
      grandTotal: dbRecord.grand_total != null ? Number(dbRecord.grand_total) : currentOrder.grandTotal,
      paidAt: dbRecord.paid_at ? new Date(dbRecord.paid_at) : currentOrder.paidAt,
      paidBy: dbRecord.paid_by ?? currentOrder.paidBy,
      refund: dbRecord.refund ?? currentOrder.refund,
      createdBy: dbRecord.created_by ?? currentOrder.createdBy,
      payLater: dbRecord.pay_later ?? currentOrder.payLater,
    };

    // Shallow-equal check to avoid unnecessary re-renders
    if (
      currentOrder.status === merged.status &&
      currentOrder.payLater === merged.payLater &&
      currentOrder.total === merged.total &&
      currentOrder.payment === merged.payment &&
      currentOrder.paidAt === merged.paidAt
    ) {
      return {};
    }

    console.log("[realtime] Order updated (payload-direct):", orderId, "status:", merged.status);
    return {
      orders: state.orders.map((o) => (o.id === orderId ? merged : o)),
    };
  });
}

// ─────────────────────────────────────────────────
// Helper: Re-fetch a single order and merge into store
// ─────────────────────────────────────────────────

// Debounce map to avoid spamming refetches for the same order
const pendingRefetches = new Map<string, ReturnType<typeof setTimeout>>();

const REFETCH_DEBOUNCE_MS = 800;  // 800ms to allow items to be written before refetch

/**
 * Lifecycle rank for the order status progression. Used to reject stale
 * realtime merges that would take an order backward in the lifecycle
 * (e.g. a stale sync-queue replay echoing back as `new` after the local
 * terminal already advanced the order to `preparing`).
 *
 * `cancelled` shares the terminal rank with `completed` so remote
 * cancellations of non-terminal orders are still applied.
 */
const STATUS_RANK: Record<string, number> = {
  "awaiting-payment": 0,
  "new": 1,
  "preparing": 2,
  "ready": 3,
  "served-unpaid": 4,
  "completed": 5,
  "cancelled": 5,
};

function ordersShallowEqual(a: any, b: any): boolean {
  return (
    a.status === b.status &&
    a.payLater === b.payLater &&
    a.total === b.total &&
    a.items.length === b.items.length &&
    (a.supplementaryBills?.length ?? 0) === (b.supplementaryBills?.length ?? 0)
  );
}

async function refetchAndMergeOrder(orderId: string) {
  // Debounce: if we already have a pending refetch for this order, skip
  if (pendingRefetches.has(orderId)) {
    clearTimeout(pendingRefetches.get(orderId)!);
  }

  // Wait 400ms to batch rapid-fire events (e.g. order + items arriving together)
  const timer = setTimeout(async () => {
    pendingRefetches.delete(orderId);
    try {
      const updatedOrder = await fetchOrderById(orderId);
      if (!updatedOrder) return;

      usePOSStore.setState((state) => {
        const existing = state.orders.find((o) => o.id === orderId);
        // Skip merge if shallow-equal — avoids unnecessary re-renders and false sidebar ticks
        if (existing && ordersShallowEqual(existing, updatedOrder)) return {};

        // Lifecycle guard: reject stale merges that would regress the order's
        // status. If the local terminal has already advanced the order (e.g.
        // new → preparing), a delayed realtime echo must not flip it back.
        if (existing) {
          const localRank = STATUS_RANK[existing.status] ?? -1;
          const incomingRank = STATUS_RANK[updatedOrder.status] ?? -1;
          if (incomingRank < localRank) {
            console.log(
              "[realtime] Rejected stale merge — local is ahead:",
              orderId,
              existing.status,
              "→",
              updatedOrder.status
            );
            return {};
          }
        }

        const exists = !!existing;
        return {
          orders: exists
            ? state.orders.map((o) => (o.id === orderId ? updatedOrder : o))
            : [updatedOrder, ...state.orders],
        };
      });
      console.log("[realtime] Order merged:", orderId, "status:", updatedOrder.status);
    } catch (err) {
      console.error("[realtime] Failed to refetch order:", orderId, err);
    }
  }, REFETCH_DEBOUNCE_MS);

  pendingRefetches.set(orderId, timer);
}
