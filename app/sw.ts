import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig, RuntimeCaching } from "serwist";
import { Serwist, CacheFirst, ExpirationPlugin } from "serwist";
import { replayMutationsFromIDB } from "../lib/sync-idb";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const menuImageCache: RuntimeCaching = {
  matcher: ({ url }) => url.pathname.startsWith("/menu/"),
  handler: new CacheFirst({
    cacheName: "menu-images",
    plugins: [
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  }),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [menuImageCache, ...defaultCache],
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("sync", (event: any) => {
  if (event.tag === "sync-mutations") {
    event.waitUntil(
      (async () => {
        try {
          // Replay directly from IndexedDB — works even with no open pages
          await replayMutationsFromIDB();
          console.log("[sw] Background sync: all mutations replayed from IDB");
        } catch (err) {
          console.error("[sw] Background sync replay failed:", err);
        }

        // Notify any open clients to reconcile their in-memory Zustand state
        const clients = await self.clients.matchAll();
        clients.forEach((client) => {
          client.postMessage({ type: "SYNC_MUTATIONS" });
        });
      })()
    );
  }
});

serwist.addEventListeners();
