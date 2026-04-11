"use client";

import { useEffect, useRef, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import { usePOSStore } from "@/lib/store";
import { fetchOrderById } from "@/lib/supabase-queries";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Hook: useRealtimeSync
 * 
 * Subscribes to Supabase Realtime changes on `orders`, `tables`, `settings`,
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
   * Clears after 2 seconds — enough time for the Realtime event to arrive.
   */
  const markOwnWrite = useCallback((orderId: string) => {
    recentOwnWritesRef.current.add(orderId);
    setTimeout(() => {
      recentOwnWritesRef.current.delete(orderId);
    }, 2000);
  }, []);

  useEffect(() => {
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
      .subscribe((status) => {
        console.log("[realtime] Subscription status:", status);
      });

    channelRef.current = channel;

    return () => {
      console.log("[realtime] Unsubscribing from pos-realtime channel");
      channel.unsubscribe();
      channelRef.current = null;
      if (typeof window !== "undefined") {
        delete (window as any).__posMarkOwnWrite;
      }
    };
  }, [markOwnWrite]);
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

async function refetchAndMergeOrder(orderId: string) {
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
}
