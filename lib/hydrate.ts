import { usePOSStore } from "./store";
import { fetchOrdersByStatus, fetchTables, fetchMenuItems, fetchStaff, fetchSettings, fetchModifiers } from "./supabase-queries";
import { syncPendingMutations } from "./sync";

/**
 * Hydrate the Zustand store from Supabase.
 * Called after a successful login or session restore.
 * Supabase is the source of truth — localStorage is the offline cache.
 * 
 * On failure (offline or network issue), the app silently falls back
 * to whatever is in localStorage from the last session.
 */
let hydratePromise: Promise<void> | null = null;
export async function hydrateStoreFromSupabase(): Promise<void> {
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    try {
      // Only fetch ACTIVE orders — completed/cancelled orders stay in localStorage
      // and are only needed for reports (which use server-side PostgreSQL views).
      const activeStatuses = ["awaiting-payment", "new", "preparing", "ready", "served-unpaid"];
      const [orders, tables, menuItems, staffMembers, settings, modifiers] = await Promise.all([
        fetchOrdersByStatus(activeStatuses),
        fetchTables(),
        fetchMenuItems(),
        fetchStaff(),
        fetchSettings(),
        fetchModifiers(),
      ]);

      const state = usePOSStore.getState();

      // Merge active orders from Supabase with completed/cancelled orders from localStorage.
      // We only fetched active statuses, so we must preserve terminal-status orders locally.
      let mergedOrders = state.orders;
      if (orders.length > 0 || state.orders.length > 0) {
        const terminalOrders = state.orders.filter(
          (o) => o.status === "completed" || o.status === "cancelled"
        );
        // Replace all active orders with the server's version, keep terminal ones from local
        const activeOrderIds = new Set(orders.map((o) => o.id));
        const keptTerminal = terminalOrders.filter((o) => !activeOrderIds.has(o.id));
        mergedOrders = [...orders, ...keptTerminal];
      }

      // Only overwrite if we got data — preserve local data if DB is empty
      usePOSStore.setState({
        orders: mergedOrders,
        tables: tables.length > 0 ? tables : state.tables,
        menuItems: menuItems.length > 0 ? menuItems : state.menuItems,
        staffMembers: staffMembers.length > 0 ? staffMembers.map(s => ({
          id: s.id,
          name: s.name,
          role: s.role,
          pin: s.pin,
          initials: s.initials,
        })) : state.staffMembers,
        settings: settings ? { ...state.settings, ...settings } : state.settings,
        modifiers: modifiers.length > 0 ? modifiers : state.modifiers,
      });

      console.log("[hydrate] Store hydrated from Supabase", {
        orders: orders.length,
        tables: tables.length,
        menuItems: menuItems.length,
        staffMembers: staffMembers.length,
      });

      // Task 14: Enable direct Supabase write-through now that hydration succeeded
      usePOSStore.setState({ supabaseEnabled: true });
    } catch (error) {
      console.error("[hydrate] Failed to hydrate from Supabase:", error);
      // Keep existing localStorage data — offline-first behavior
    } finally {
      hydratePromise = null;
    }
  })();
  return hydratePromise;
}

/**
 * Start the background sync loop.
 * Runs every 30 seconds to drain the mutation queue.
 * 
 * Full re-hydration is NOT on a timer — Realtime subscriptions provide
 * live cross-device sync.  Re-hydration only happens on:
 *   • visibility change (tab refocus after >10s) — see use-realtime-sync.ts
 *   • reconnect after going offline
 *   • Realtime channel error/timeout
 * 
 * Returns a cleanup function to clear the intervals.
 */
export function startBackgroundSync(): () => void {
  // Drain mutation queue every 30 seconds
  const syncInterval = setInterval(() => {
    if (navigator.onLine) {
      syncPendingMutations().catch(console.error);
    }
  }, 30_000);

  // Also drain any pending mutations right away
  if (navigator.onLine) {
    syncPendingMutations().catch(console.error);
  }

  // Sync on reconnect
  const handleOnline = () => {
    console.log("[hydrate] Back online — syncing mutations & rehydrating");
    syncPendingMutations().catch(console.error);
    if (usePOSStore.getState().isLoggedIn) {
      hydrateStoreFromSupabase().catch(console.error);
    }
  };

  window.addEventListener("online", handleOnline);

  return () => {
    clearInterval(syncInterval);
    window.removeEventListener("online", handleOnline);
  };
}
