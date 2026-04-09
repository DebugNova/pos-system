/**
 * IndexedDB-backed sync queue for Background Sync.
 * 
 * This module mirrors pending mutations into IndexedDB so the service worker
 * can replay them even when no client pages are open. The primary queue
 * remains in Zustand/localStorage — this is a secondary store for the SW.
 * 
 * Phase 3: When Supabase arrives, the `replayMutationsFromIDB` function 
 * will be updated to POST directly to Supabase instead of resolving as a stub.
 */

const DB_NAME = "suhashi-sync";
const DB_VERSION = 1;
const STORE_NAME = "pending-mutations";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("by-created", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface IDBMutation {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

/**
 * Write a mutation to IndexedDB. Called from the Zustand store's
 * enqueueMutation action alongside the in-memory queue.
 */
export async function writeMutationToIDB(mutation: IDBMutation): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(mutation);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.error("[sync-idb] Failed to write mutation to IDB:", err);
  }
}

/**
 * Remove a mutation from IndexedDB after it has been synced.
 * Called from markMutationSynced in the store.
 */
export async function removeMutationFromIDB(id: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.error("[sync-idb] Failed to remove mutation from IDB:", err);
  }
}

/**
 * Get all pending mutations from IndexedDB, sorted by createdAt.
 * Used by the service worker's background sync handler.
 */
export async function getAllPendingMutations(): Promise<IDBMutation[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const index = tx.objectStore(STORE_NAME).index("by-created");
    const request = index.getAll();
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close();
        resolve(request.result as IDBMutation[]);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (err) {
    console.error("[sync-idb] Failed to read mutations from IDB:", err);
    return [];
  }
}

/**
 * Clear all mutations from IndexedDB.
 * Used after a successful full sync.
 */
export async function clearAllMutationsFromIDB(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.error("[sync-idb] Failed to clear mutations from IDB:", err);
  }
}

/**
 * Replay all pending mutations from IndexedDB.
 * This is called from the service worker's sync event handler
 * when the browser regains connectivity.
 * 
 * Phase 3: Replace the stub with actual Supabase API calls per kind.
 */
export async function replayMutationsFromIDB(): Promise<void> {
  const mutations = await getAllPendingMutations();
  if (mutations.length === 0) return;

  console.log(`[sync-idb] Replaying ${mutations.length} mutations from IDB`);

  for (const m of mutations) {
    try {
      // Phase 2 stub: log and resolve after 200ms
      // Phase 3: POST to Supabase via fetch(), mapped per kind
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
      console.log("[sync-idb] Replayed", m.kind, m.id, m.payload);

      // Remove after successful sync
      await removeMutationFromIDB(m.id);
    } catch (err) {
      console.error(`[sync-idb] Failed to replay mutation ${m.id}:`, err);
      // Stop on first error to preserve ordering
      throw err;
    }
  }

  console.log("[sync-idb] All mutations replayed successfully");
}
