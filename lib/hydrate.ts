import { usePOSStore } from "./store";
import { fetchOrders, fetchTables, fetchMenuItems, fetchStaff, fetchSettings } from "./supabase-queries";
import { syncPendingMutations } from "./sync";

/**
 * Hydrate the Zustand store from Supabase.
 * Called after a successful login or session restore.
 * Supabase is the source of truth — localStorage is the offline cache.
 * 
 * On failure (offline or network issue), the app silently falls back
 * to whatever is in localStorage from the last session.
 */
export async function hydrateStoreFromSupabase(): Promise<void> {
  try {
    const [orders, tables, menuItems, staffMembers, settings] = await Promise.all([
      fetchOrders(500),
      fetchTables(),
      fetchMenuItems(),
      fetchStaff(),
      fetchSettings(),
    ]);

    const state = usePOSStore.getState();

    // Only overwrite if we got data — preserve local data if DB is empty
    usePOSStore.setState({
      orders: orders.length > 0 ? orders : state.orders,
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
  }
}

/**
 * Start the background sync loop.
 * Runs every 30 seconds to drain the mutation queue + every 5 minutes
 * to re-hydrate from Supabase (catch changes made by other terminals).
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

  // Re-hydrate from Supabase every 5 minutes
  const hydrateInterval = setInterval(() => {
    if (navigator.onLine && usePOSStore.getState().isLoggedIn) {
      hydrateStoreFromSupabase().catch(console.error);
    }
  }, 5 * 60_000);

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
    clearInterval(hydrateInterval);
    window.removeEventListener("online", handleOnline);
  };
}
