import { usePOSStore } from "./store";
import type { QueuedMutation } from "./data";
import { getSupabase } from "./supabase";
import {
  upsertOrder,
  updateOrderInDb,
  deleteOrderFromDb,
  updateTableInDb,
  upsertTable,
  deleteTableFromDb,
  insertAuditEntry,
  upsertShift,
  updateSettingsInDb,
  upsertStaff,
  deleteStaff,
  upsertMenuItem,
  deleteMenuItemFromDb,
  upsertModifier,
  deleteModifierFromDb,
  replaceOrderItems,
  insertSupplementaryBill,
  updateSupplementaryBillPayment,
} from "./supabase-queries";

function formatError(error: unknown): {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
} {
  if (!error) return { message: "Unknown error" };
  if (error instanceof Error) return { message: error.message };
  if (typeof error === "object") {
    const e = error as Record<string, unknown>;
    const message =
      (e.message as string) ||
      (e.error_description as string) ||
      (e.error as string) ||
      JSON.stringify(e) ||
      "Unknown error";
    return {
      message,
      code: e.code as string | undefined,
      details: e.details as string | undefined,
      hint: e.hint as string | undefined,
    };
  }
  return { message: String(error) };
}

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
      const info = formatError(error);

      // Postgres 23505 = unique_violation. The row already exists, so the
      // mutation's desired end state is achieved — treat as synced and move
      // on instead of blocking the queue forever. This happens when a write
      // succeeded server-side but we never got to mark it synced locally
      // (network blip after the insert, page reload mid-flight, etc.).
      if (info.code === "23505") {
        console.warn(
          `[sync] Mutation ${m.id} (${m.kind}) already applied server-side, marking synced.`
        );
        usePOSStore.getState().markMutationSynced(m.id);
        continue;
      }

      console.error(
        `[sync] Failed to sync mutation ${m.id} (${m.kind}):`,
        info.message,
        { code: info.code, details: info.details, hint: info.hint, payload: m.payload }
      );
      usePOSStore.getState().markMutationFailed(m.id, info.message);

      // Retry backoff: wait attempts * 2 seconds before stopping
      // (the next sync cycle will retry)
      break; // Stop on first error to preserve ordering
    }
  }

  usePOSStore.setState({
    isSyncing: false,
    lastSyncedAt: new Date().toISOString()
  });

  // Clean up stale synced mutations to prevent localStorage bloat
  usePOSStore.getState().clearSyncedMutations();
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

    case "menu.upsert":
      await upsertMenuItem(m.payload.item as any);
      break;

    case "menu.delete":
      await deleteMenuItemFromDb(m.payload.id as string);
      break;

    case "modifier.upsert":
      await upsertModifier(m.payload.modifier as any);
      break;

    case "modifier.delete":
      await deleteModifierFromDb(m.payload.id as string);
      break;

    case "table.upsert":
      await upsertTable(m.payload.table as any);
      break;

    case "table.delete":
      await deleteTableFromDb(m.payload.id as string);
      break;

    case "order.full-edit": {
      const id = m.payload.id as string;
      const changes = m.payload.changes as Record<string, any> | undefined;
      const items = m.payload.items as any[] | undefined;
      if (changes && Object.keys(changes).length > 0) {
        await updateOrderInDb(id, changes);
      }
      if (items) {
        await replaceOrderItems(id, items as any);
      }
      break;
    }

    case "supplementary-bill.create":
      await insertSupplementaryBill(
        m.payload.orderId as string,
        m.payload.bill as any
      );
      break;

    case "supplementary-bill.payment":
      await updateSupplementaryBillPayment(
        m.payload.billId as string,
        m.payload.payment,
        m.payload.paidAt as string
      );
      break;

    default:
      console.warn("[sync] Unknown mutation kind:", m.kind);
  }
}
