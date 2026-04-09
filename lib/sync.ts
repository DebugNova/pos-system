import { usePOSStore } from "./store";
import type { QueuedMutation } from "./data";

export async function syncPendingMutations(): Promise<void> {
  const store = usePOSStore.getState();
  if (!navigator.onLine || store.isSyncing) return;

  const pendingMutations = store.syncQueue
    .filter(m => m.status === "pending" || m.status === "failed")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  if (pendingMutations.length === 0) return;

  // Mark as syncing
  usePOSStore.setState({ isSyncing: true });

  for (const m of pendingMutations) {
    try {
      // Mark as currently syncing individual
      usePOSStore.setState(state => ({
        syncQueue: state.syncQueue.map(qm =>
          qm.id === m.id ? { ...qm, status: "syncing" as const } : qm
        )
      }));

      await sendMutation(m);

      // Successfully synced
      usePOSStore.getState().markMutationSynced(m.id);
    } catch (error) {
      console.error(`Failed to sync mutation ${m.id}`, error);
      usePOSStore.getState().markMutationFailed(m.id, String(error));
      break; // Stop on first error to preserve order
    }
  }

  usePOSStore.setState({
    isSyncing: false,
    lastSyncedAt: new Date().toISOString()
  });
}

export async function sendMutation(m: QueuedMutation): Promise<void> {
  // Phase 2: stub — log and resolve after 200ms
  // Phase 3: POST to Supabase via supabase-js, mapped per kind
  await new Promise(r => setTimeout(r, 200));
  console.log("[sync] would send", m.kind, m.id, m.payload);
}
