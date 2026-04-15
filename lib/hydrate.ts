import { usePOSStore } from "./store";
import { fetchOrdersByStatus, fetchRecentCompletedOrders, fetchTables, fetchMenuItems, fetchStaff, fetchSettings, fetchModifiers, upsertMenuItem } from "./supabase-queries";
import { syncPendingMutations } from "./sync";

// ─────────────────────────────────────────────────────────────────────────────
// Lightweight active-order poll — bulletproof fallback when Realtime is broken
// ─────────────────────────────────────────────────────────────────────────────

const ACTIVE_STATUSES = ["awaiting-payment", "new", "preparing", "ready", "served-unpaid"];

let pollInFlight = false;

/**
 * Fetch only active orders from Supabase and merge them into the store.
 * Much cheaper than a full hydrateStoreFromSupabase (no menu/staff/settings).
 * Called every 10 seconds as a safety net when Realtime events are missed.
 */
async function pollActiveOrders(): Promise<void> {
  if (pollInFlight || !navigator.onLine) return;
  pollInFlight = true;
  try {
    const orders = await fetchOrdersByStatus(ACTIVE_STATUSES);
    usePOSStore.setState((state) => {
      // Keep terminal-status orders from local cache; replace active orders from server
      const terminalOrders = state.orders.filter(
        (o) => o.status === "completed" || o.status === "cancelled"
      );
      const activeOrderIds = new Set(orders.map((o) => o.id));
      const keptTerminal = terminalOrders.filter((o) => !activeOrderIds.has(o.id));
      const merged = [...orders, ...keptTerminal];

      // Skip re-render if nothing changed (compare by id+status+itemCount)
      const changed =
        merged.length !== state.orders.length ||
        merged.some((incoming) => {
          const existing = state.orders.find((o) => o.id === incoming.id);
          return (
            !existing ||
            existing.status !== incoming.status ||
            existing.items.length !== incoming.items.length ||
            (existing.supplementaryBills?.length ?? 0) !== (incoming.supplementaryBills?.length ?? 0)
          );
        });

      return changed ? { orders: merged } : {};
    });
  } catch {
    // Silent fail — polling is best-effort; Realtime or next poll will catch up
  } finally {
    pollInFlight = false;
  }
}

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
    // Enable direct writes immediately — don't wait for hydration to finish.
    // Hydration is for READING data; writes should proceed independently.
    usePOSStore.setState({ supabaseEnabled: true });
    try {
      // Fetch active orders + recent completed/cancelled orders (last 48h).
      // Completed orders are needed for History and Reports views to work
      // on cold-start devices that weren't running when payments happened.
      const activeStatuses = ["awaiting-payment", "new", "preparing", "ready", "served-unpaid"];
      const [activeOrders, recentCompleted, tables, menuItems, staffMembers, settings, modifiers] = await Promise.all([
        fetchOrdersByStatus(activeStatuses),
        fetchRecentCompletedOrders(48),
        fetchTables(),
        fetchMenuItems(),
        fetchStaff(),
        fetchSettings(),
        fetchModifiers(),
      ]);

      const state = usePOSStore.getState();

      // Merge: server active orders + server completed orders + any local-only
      // completed orders that are older than 48h (not in recentCompleted).
      const serverOrderIds = new Set([
        ...activeOrders.map((o) => o.id),
        ...recentCompleted.map((o) => o.id),
      ]);
      // Keep local completed orders that the server didn't return (older than 48h)
      const olderLocalCompleted = state.orders.filter(
        (o) => (o.status === "completed" || o.status === "cancelled") && !serverOrderIds.has(o.id)
      );
      const mergedOrders = [...activeOrders, ...recentCompleted, ...olderLocalCompleted];

      // If DB has no menu items, seed local items into Supabase so future
      // hydrations pick them up (one-time migration for new projects).
      let finalMenuItems = state.menuItems;
      if (menuItems.length === 0 && state.menuItems.length > 0) {
        console.log("[hydrate] menu_items table empty — seeding", state.menuItems.length, "items to Supabase");
        await Promise.all(state.menuItems.map((item) => upsertMenuItem(item).catch(console.error)));
        finalMenuItems = state.menuItems; // keep local (DB now has them)
      } else if (menuItems.length > 0) {
        // DB has items — use DB as source of truth but keep any locally-added
        // items that haven't synced yet (id not present in DB result).
        const dbIds = new Set(menuItems.map((m) => m.id));
        const localOnly = state.menuItems.filter((m) => !dbIds.has(m.id));
        finalMenuItems = [...menuItems, ...localOnly];
      }

      // Only overwrite if we got data — preserve local data if DB is empty
      usePOSStore.setState({
        orders: mergedOrders,
        tables: tables.length > 0 ? tables : state.tables,
        menuItems: finalMenuItems,
        staffMembers: staffMembers.length > 0 ? staffMembers.map(s => ({
          id: s.id,
          name: s.name,
          role: s.role,
          pin: s.pin,
          initials: s.initials,
        })) : state.staffMembers,
        settings: settings ? { ...state.settings, ...settings } : state.settings,
        // menuCategories is stored in settings.menu_categories DB column but surfaced
        // as a top-level store field.  Hydrate it here if the DB row has data.
        ...(settings?.menuCategories ? { menuCategories: settings.menuCategories } : {}),
        modifiers: modifiers.length > 0 ? modifiers : state.modifiers,
      });

      console.log("[hydrate] Store hydrated from Supabase", {
        activeOrders: activeOrders.length,
        recentCompleted: recentCompleted.length,
        tables: tables.length,
        menuItems: menuItems.length,
        staffMembers: staffMembers.length,
      });

      // supabaseEnabled already set at the top of this function
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
 * Runs every 8 seconds to drain the mutation queue.
 *
 * Full re-hydration is NOT on a timer — Realtime subscriptions provide
 * live cross-device sync. Re-hydration only happens on:
 *   • visibility change (tab refocus after >3s) — see use-realtime-sync.ts
 *   • reconnect after going offline
 *   • Realtime channel error/timeout
 *
 * Returns a cleanup function to clear the intervals.
 */
export function startBackgroundSync(): () => void {
  // Drain mutation queue every 8 seconds for faster fallback on direct-write failures.
  // The dedup logic in sync.ts prevents double-writes, so rapid retries are safe.
  const syncInterval = setInterval(() => {
    if (navigator.onLine) {
      syncPendingMutations().catch(console.error);
    }
  }, 8_000);

  // Poll active orders every 10 seconds — bulletproof fallback for when the
  // Supabase Realtime WebSocket is dead (iOS background, flaky WiFi, etc.).
  // Only fetches active-status orders (not menu/staff/settings) so it's very
  // lightweight: ~1–2 KB per poll, negligible on the free tier.
  const pollInterval = setInterval(() => {
    if (navigator.onLine && document.visibilityState === "visible") {
      pollActiveOrders().catch(console.error);
    }
  }, 10_000);

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
    clearInterval(pollInterval);
    window.removeEventListener("online", handleOnline);
  };
}
