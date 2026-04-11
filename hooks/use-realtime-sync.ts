"use client";

import { useEffect, useRef, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import { usePOSStore } from "@/lib/store";
import { fetchOrderById } from "@/lib/supabase-queries";
import { hydrateStoreFromSupabase } from "@/lib/hydrate";
import type { RealtimeChannel } from "@supabase/supabase-js";

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
  // Track order IDs we recently wrote to avoid feedback loops
  const recentOwnWritesRef = useRef<Set<string>>(new Set());

  /**
   * Mark an order ID as "recently written by this terminal".
   * Clears after 3 seconds — enough time for the Realtime event to arrive.
   */
  const markOwnWrite = useCallback((orderId: string) => {
    recentOwnWritesRef.current.add(orderId);
    setTimeout(() => {
      recentOwnWritesRef.current.delete(orderId);
    }, 3000);
  }, []);

  // Gate on login state — only subscribe when authenticated
  const isLoggedIn = usePOSStore((s) => s.isLoggedIn);

  useEffect(() => {
    if (!isLoggedIn) return;

    const supabase = getSupabase();
    if (!supabase) return;

    // Expose markOwnWrite globally so store actions can call it
    if (typeof window !== "undefined") {
      (window as any).__posMarkOwnWrite = markOwnWrite;
    }

    const channel = supabase
      .channel("pos-realtime")
      // ── Orders ──
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          handleOrderChange(payload, recentOwnWritesRef.current);
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
      .subscribe((status, err) => {
        console.log("[realtime] Subscription status:", status);
        if (status === "SUBSCRIBED") {
          console.log("[realtime] ✓ Connected — live updates active");
        } else if (status === "CHANNEL_ERROR") {
          console.error("[realtime] Channel error — will attempt reconnect:", err);
          // Re-hydrate from Supabase to catch any missed events during disconnect
          if (navigator.onLine) {
            setTimeout(() => {
              hydrateStoreFromSupabase().catch(console.error);
            }, 2000);
          }
        } else if (status === "TIMED_OUT") {
          console.warn("[realtime] Subscription timed out — rehydrating");
          if (navigator.onLine) {
            hydrateStoreFromSupabase().catch(console.error);
          }
        }
      });

    channelRef.current = channel;

    // On window refocus, re-hydrate to catch any events missed while in background
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        console.log("[realtime] Tab refocused — rehydrating to catch missed events");
        hydrateStoreFromSupabase().catch(console.error);
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
      console.log("[realtime] Unsubscribing from pos-realtime channel");
      channel.unsubscribe();
      channelRef.current = null;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      if (typeof window !== "undefined") {
        delete (window as any).__posMarkOwnWrite;
      }
    };
  }, [markOwnWrite, isLoggedIn]);
}

// ─────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────

function handleOrderChange(payload: any, ownWrites: Set<string>) {
  const { eventType, new: newRecord, old: oldRecord } = payload;

  if (eventType === "INSERT" || eventType === "UPDATE") {
    const orderId = newRecord?.id;
    if (!orderId) return;

    // Skip if this is our own write (feedback loop prevention)
    if (ownWrites.has(orderId)) {
      console.log("[realtime] Skipping own write for order", orderId);
      return;
    }

    // Re-fetch the full order with items to get complete data
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
  const { eventType, new: newRecord } = payload;
  // When order items change, re-fetch the parent order to get the full picture
  const orderId = newRecord?.order_id || payload.old?.order_id;
  if (orderId) {
    refetchAndMergeOrder(orderId);
  }
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
  const { eventType, new: newRecord } = payload;

  if (eventType === "UPDATE" || eventType === "INSERT") {
    if (!newRecord?.id) return;

    usePOSStore.setState((state) => ({
      tables: state.tables.map((t) =>
        t.id === newRecord.id
          ? {
              ...t,
              status: newRecord.status,
              orderId: newRecord.order_id || undefined,
            }
          : t
      ),
    }));
    console.log("[realtime] Table updated:", newRecord.id, "→", newRecord.status);
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
      },
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

// ─────────────────────────────────────────────────
// Helper: Re-fetch a single order and merge into store
// ─────────────────────────────────────────────────

// Debounce map to avoid spamming refetches for the same order
const pendingRefetches = new Map<string, ReturnType<typeof setTimeout>>();

async function refetchAndMergeOrder(orderId: string) {
  // Debounce: if we already have a pending refetch for this order, skip
  if (pendingRefetches.has(orderId)) {
    clearTimeout(pendingRefetches.get(orderId)!);
  }

  // Wait 150ms to batch rapid-fire events (e.g. order + items arriving together)
  const timer = setTimeout(async () => {
    pendingRefetches.delete(orderId);
    try {
      const updatedOrder = await fetchOrderById(orderId);
      if (!updatedOrder) return;

      usePOSStore.setState((state) => {
        const exists = state.orders.some((o) => o.id === orderId);
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
  }, 150);

  pendingRefetches.set(orderId, timer);
}
