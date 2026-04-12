import { usePOSStore } from "./store";
import type { QueuedMutation } from "./data";
import { getSupabase } from "./supabase";
import {
  upsertOrder,
  updateOrderInDb,
  deleteOrderFromDb,
  updateTableInDb,
  insertAuditEntry,
  upsertShift,
  updateSettingsInDb,
  upsertStaff,
  deleteStaff,
} from "./supabase-queries";

/**
 * Drain the in-memory sync queue, sending each pending mutation to Supabase.
 * Stops on the first failure to preserve mutation ordering.
 */
export async function syncPendingMutations(): Promise<void> {
  const store = usePOSStore.getState();
  if (!navigator.onLine || store.isSyncing) return;

  let pendingMutations = store.syncQueue
    .filter(m => m.status === "pending" || m.status === "failed")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Dedup order.update mutations
  const latestUpdates = new Map<string, string>(); // orderId -> mutationId
  for (const m of pendingMutations) {
    if (m.kind === "order.update" && m.payload?.id) {
      latestUpdates.set(m.payload.id as string, m.id);
    }
  }

  pendingMutations = pendingMutations.filter((m) => {
    if (m.kind === "order.update" && m.payload?.id) {
      const isLatest = latestUpdates.get(m.payload.id as string) === m.id;
      if (!isLatest) {
        // Mark the superseded one as synced so it gets cleaned up
        usePOSStore.getState().markMutationSynced(m.id);
      }
      return isLatest;
    }
    return true;
  });

  if (pendingMutations.length === 0) return;

  // Mark as syncing
  usePOSStore.setState({ isSyncing: true });

  for (const m of pendingMutations) {
    try {
      // Mark individual mutation as currently syncing
      usePOSStore.setState(state => ({
        syncQueue: state.syncQueue.map(qm =>
          qm.id === m.id ? { ...qm, status: "syncing" as const } : qm
        )
      }));

      await sendMutation(m);

      // Successfully synced
      usePOSStore.getState().markMutationSynced(m.id);
    } catch (error) {
      console.error(`[sync] Failed to sync mutation ${m.id}:`, error);
      usePOSStore.getState().markMutationFailed(m.id, String(error));

      // Retry backoff: wait attempts * 2 seconds before stopping
      // (the next sync cycle will retry)
      break; // Stop on first error to preserve ordering
    }
  }

  usePOSStore.setState({
    isSyncing: false,
    lastSyncedAt: new Date().toISOString()
  });
}

/**
 * Send a single mutation to Supabase.
 * Maps the mutation kind to the appropriate supabase-queries function.
 */
export async function sendMutation(m: QueuedMutation): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase client not initialized");

  // Check we have a valid session
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.warn("[sync] No active session, skipping mutation", m.id);
    throw new Error("No active session");
  }

  switch (m.kind) {
    case "order.create":
      await upsertOrder(m.payload.order);
      break;

    case "order.update":
      await updateOrderInDb(m.payload.id as string, m.payload.changes as Record<string, any>);
      break;

    case "order.delete":
      await deleteOrderFromDb(m.payload.id as string);
      break;

    case "order.refund":
      await updateOrderInDb(m.payload.id as string, {
        refund: m.payload.refund,
        status: m.payload.status,
      });
      break;

    case "payment.record":
      await updateOrderInDb(m.payload.orderId as string, {
        payment: m.payload.payment,
        paidAt: m.payload.paidAt,
        paidBy: m.payload.paidBy,
        status: m.payload.status,
      });
      break;

    case "table.update":
      await updateTableInDb(m.payload.id as string, m.payload);
      break;

    case "shift.start":
    case "shift.end":
      await upsertShift(m.payload.shift);
      break;

    case "audit.append":
      await insertAuditEntry(m.payload.entry);
      break;

    case "settings.update":
      await updateSettingsInDb(m.payload.changes as Record<string, unknown>);
      break;

    case "staff.upsert":
      await upsertStaff(m.payload.staff);
      break;

    case "staff.delete":
      await deleteStaff(m.payload.id as string);
      break;

    default:
      console.warn("[sync] Unknown mutation kind:", m.kind);
  }
}
