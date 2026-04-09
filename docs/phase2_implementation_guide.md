# Phase 2 Implementation Guide — PWA & Offline Support

> For: AI Agent (Claude Code)
> Project: SUHASHI Cafe POS
> Date: 2026-04-09
> Scope: Make SUHASHI POS installable on iPad as a Progressive Web App, runnable offline, and resilient to network drops. All client-side. No backend required.
> Backend plan: Phase 3 will migrate to **Supabase**. Design the offline queue with that in mind — every queued mutation should be replayable as a Supabase write later, so use stable string UUIDs and ISO 8601 timestamps.

---

## Pre-Work Checklist

Before starting ANY task:
- [ ] Confirm Phase 1 is complete — all 15 tasks done, `npm run build` passes cleanly
- [ ] Verify `lib/store.ts` has `STORE_VERSION` >= 3 (Phase 1 added settings, payments, audit log, shifts)
- [ ] Read `app/layout.tsx` — current `metadata` block is where the manifest link goes
- [ ] Read `next.config.mjs` — service worker integration may need config tweaks
- [ ] Take a fresh git checkpoint before touching service workers — they cache aggressively and can wedge dev workflows if misconfigured
- [ ] After EVERY task, run `npm run build` AND test in an incognito window (service workers persist across reloads in normal windows)

---

## Why This Phase Exists

A cafe POS that dies when WiFi blinks is unusable. iPad-first means we need:
1. **Install to home screen** — full-screen, no browser chrome, looks like a native app
2. **Open offline** — the app shell loads even without network
3. **Order without network** — taking an order should never fail because of connectivity
4. **Sync when back online** — queued orders flush automatically once network returns

Phase 2 has 3 task families (manifest, service worker, offline queue), broken into 8 concrete tasks below.

---

## Task 16: Create the Web App Manifest

**Goal:** Add `manifest.json` so iPad/Android can "Add to Home Screen" and the app launches in standalone mode (no browser UI).

**Current state:**
- No `manifest.json` in `public/`
- `app/layout.tsx` has icon metadata but no `manifest` link
- App opens only inside Safari with browser chrome visible

**What to do:**

1. **Create `public/manifest.json`:**
   ```json
   {
     "name": "SUHASHI Cafe POS",
     "short_name": "SUHASHI",
     "description": "Touch-first Point of Sale for SUHASHI Cafe",
     "start_url": "/",
     "scope": "/",
     "display": "standalone",
     "orientation": "landscape",
     "background_color": "#0a0a0a",
     "theme_color": "#0a0a0a",
     "categories": ["business", "food", "productivity"],
     "icons": [
       {
         "src": "/icons/icon-192.png",
         "sizes": "192x192",
         "type": "image/png",
         "purpose": "any"
       },
       {
         "src": "/icons/icon-512.png",
         "sizes": "512x512",
         "type": "image/png",
         "purpose": "any"
       },
       {
         "src": "/icons/icon-maskable-512.png",
         "sizes": "512x512",
         "type": "image/png",
         "purpose": "maskable"
       }
     ]
   }
   ```

2. **Generate the icon set** (place in `public/icons/`):
   - `icon-192.png` — 192×192, opaque background
   - `icon-512.png` — 512×512, opaque background
   - `icon-maskable-512.png` — 512×512 with safe-zone padding (~10% inset) for Android adaptive icons
   - You can generate from `public/logo.png` using any tool. If logo isn't square, pad with brand background color (`#0a0a0a`).

3. **Reference the manifest in `app/layout.tsx`:**
   ```ts
   export const metadata: Metadata = {
     // ... existing fields ...
     manifest: '/manifest.json',
     appleWebApp: {
       capable: true,
       statusBarStyle: 'black-translucent',
       title: 'SUHASHI POS',
     },
     themeColor: '#0a0a0a',
   }
   ```

4. **Add iPad/iOS-specific meta tags** in `app/layout.tsx`'s `<head>` (Next 15 supports these via metadata, but add explicit `<meta>` tags via the `viewport` export if needed):
   ```ts
   export const viewport: Viewport = {
     themeColor: '#0a0a0a',
     width: 'device-width',
     initialScale: 1,
     maximumScale: 1,
     userScalable: false,
     viewportFit: 'cover',
   }
   ```
   - `maximumScale: 1` and `userScalable: false` prevent accidental pinch-zoom during fast tapping
   - `viewportFit: 'cover'` lets the app extend behind iPad notches/home bars

5. **Add splash screen images for iOS** (optional but polish): generate Apple splash PNGs for common iPad sizes and link via `<link rel="apple-touch-startup-image" ...>` tags in a custom `head` block.

**Verification:**
- `npm run build && npm start` → open in Chrome → DevTools → Application → Manifest → no errors, all icons load
- On iPad Safari: Share → Add to Home Screen → icon appears, opens in standalone mode (no Safari toolbar)
- Lighthouse PWA audit shows manifest as valid

---

## Task 17: Add Service Worker (App Shell Caching)

**Goal:** Cache the app shell (HTML, CSS, JS, fonts, icons) so the POS opens instantly even when offline.

**Current state:**
- No service worker registered
- App is fully online-dependent — closing Safari without network = white screen on next open

**Decision: which library?**

Use **`@serwist/next`** (the maintained successor to `next-pwa`). It's the only well-supported PWA layer for the Next.js App Router today. Avoid `next-pwa` — it's unmaintained and has known issues with App Router.

**What to do:**

1. **Install:**
   ```bash
   npm install @serwist/next serwist
   npm install -D @serwist/webpack-plugin
   ```

2. **Update `next.config.mjs`:**
   ```js
   import withSerwistInit from "@serwist/next";

   const withSerwist = withSerwistInit({
     swSrc: "app/sw.ts",
     swDest: "public/sw.js",
     cacheOnNavigation: true,
     reloadOnOnline: true,
     disable: process.env.NODE_ENV === "development", // critical — never cache in dev
   });

   const nextConfig = {
     // ... existing config ...
   };

   export default withSerwist(nextConfig);
   ```

3. **Create `app/sw.ts`** (the service worker entry point):
   ```ts
   import { defaultCache } from "@serwist/next/worker";
   import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
   import { Serwist } from "serwist";

   declare global {
     interface WorkerGlobalScope extends SerwistGlobalConfig {
       __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
     }
   }

   declare const self: ServiceWorkerGlobalScope;

   const serwist = new Serwist({
     precacheEntries: self.__SW_MANIFEST,
     skipWaiting: true,
     clientsClaim: true,
     navigationPreload: true,
     runtimeCaching: defaultCache,
   });

   serwist.addEventListeners();
   ```

4. **Update `tsconfig.json`** to include the worker file:
   ```json
   {
     "compilerOptions": {
       "lib": ["dom", "dom.iterable", "esnext", "webworker"],
       // ...
     },
     "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", "app/sw.ts"],
     "exclude": ["node_modules"]
   }
   ```

5. **Add a service worker registration check in `app/page.tsx`** (or a small `components/sw-register.tsx`):
   - Show a toast when a new SW version is waiting: "Update available — refresh to apply"
   - Use `navigator.serviceWorker.controller` and `updatefound` events
   - Don't auto-reload — staff might be mid-order

6. **Configure caching strategies** (in `app/sw.ts`'s `runtimeCaching`):
   - **App shell (HTML/JS/CSS):** `StaleWhileRevalidate` — fast load, background update
   - **Google Fonts:** `CacheFirst` with 1-year expiration
   - **Images (`/icons/`, `/logo.png`, menu images):** `CacheFirst` with 30-day expiration, max 100 entries
   - **API routes (future Phase 3):** `NetworkFirst` with 5-second timeout fallback to cache
   - The default `defaultCache` from `@serwist/next/worker` already covers most of this — only override if needed

7. **Add a "You're offline" indicator in the sidebar:**
   - Use `navigator.onLine` and `online`/`offline` window events
   - Small badge near the user info: green dot = online, amber dot = offline
   - Hook: `hooks/use-online-status.ts`

**Verification:**
- Build + start → DevTools → Application → Service Workers → `sw.js` registered and active
- DevTools → Network → check "Offline" → reload page → app shell still loads
- DevTools → Application → Cache Storage → see precached entries
- Hard-refresh after a code change → toast appears: "Update available"

**Common pitfalls:**
- Service workers persist across reloads — if you wedge the cache during dev, manually unregister via DevTools → Application → Service Workers → Unregister
- The `disable` flag in dev is non-negotiable. Never run a service worker in `next dev` or HMR will break.
- iOS Safari has stricter SW quotas — keep cache budgets modest

---

## Task 18: Build the Offline Mutation Queue

**Goal:** When the network is down, mutations (create order, update order, refund, etc.) are recorded locally and replayed when connectivity returns. In Phase 2 there's no real backend yet — but build the queue infrastructure now so Phase 3's Supabase migration just plugs in a network sender.

**Current state:**
- All store actions write to Zustand → localStorage. Already "offline" by accident.
- No concept of "pending sync" — once Phase 3 lands, every mutation needs to round-trip to Supabase.

**Why build this in Phase 2?** The offline queue's data shape, replay logic, and conflict resolution rules are the hard part. Get them right with a fake "sender" now, then swap in Supabase later.

**What to do:**

1. **Define the queue model in `lib/data.ts`:**
   ```ts
   export type MutationKind =
     | "order.create"
     | "order.update"
     | "order.delete"
     | "order.refund"
     | "payment.record"
     | "table.update"
     | "shift.start"
     | "shift.end"
     | "audit.append";

   export interface QueuedMutation {
     id: string;                    // crypto.randomUUID()
     kind: MutationKind;
     payload: Record<string, unknown>;
     createdAt: string;             // ISO 8601 — important for ordering during replay
     attempts: number;
     lastAttemptAt?: string;
     lastError?: string;
     status: "pending" | "syncing" | "synced" | "failed";
   }
   ```

2. **Add queue state to `lib/store.ts`:**
   ```ts
   syncQueue: QueuedMutation[];
   isOnline: boolean;
   isSyncing: boolean;
   lastSyncedAt: string | null;

   enqueueMutation: (kind: MutationKind, payload: Record<string, unknown>) => void;
   markMutationSynced: (id: string) => void;
   markMutationFailed: (id: string, error: string) => void;
   clearSyncedMutations: () => void;
   ```

3. **Persist `syncQueue` and `lastSyncedAt`** in `partialize`. Bump `STORE_VERSION` to 4. Include in `exportData`/`importData`.

4. **Wire enqueue calls into existing store actions:**
   - `addOrder` → also `enqueueMutation("order.create", { order })`
   - `updateOrder` → `enqueueMutation("order.update", { id, changes })`
   - `recordPayment` (added in Phase 1 Task 3) → `enqueueMutation("payment.record", { ... })`
   - `processRefund` → `enqueueMutation("order.refund", { ... })`
   - `addAuditEntry` → `enqueueMutation("audit.append", { entry })`
   - **Important:** the existing local writes to Zustand stay as-is. The queue is *additive* — local state is the source of truth in Phase 2. Phase 3 will reverse this.

5. **Create `lib/sync.ts` — the replay engine:**
   ```ts
   export async function syncPendingMutations(): Promise<void> {
     // 1. Read pending mutations from store, sorted by createdAt ASC
     // 2. For each: mark "syncing", call sendMutation(m), then mark "synced" or "failed"
     // 3. Stop on first failure (preserve order) — retry later
     // 4. Update lastSyncedAt
   }

   async function sendMutation(m: QueuedMutation): Promise<void> {
     // Phase 2: stub — log and resolve after 200ms
     // Phase 3: POST to Supabase via supabase-js, mapped per kind
     await new Promise(r => setTimeout(r, 200));
     console.log("[sync] would send", m.kind, m.id);
   }
   ```
   - Keep `sendMutation` swappable. Export it. Phase 3 replaces the body without touching callers.

6. **Create `hooks/use-online-status.ts`:**
   ```ts
   export function useOnlineStatus() {
     // Track navigator.onLine
     // Listen for "online" / "offline" events
     // On transition to online: setTimeout 1s → call syncPendingMutations()
     // Update store.isOnline
   }
   ```

7. **Use the hook once globally** in `app/page.tsx` (next to the session timeout hook from Phase 1 Task 14).

8. **Add a sync status UI:**
   - Small pill in the sidebar (or top bar) showing pending mutation count
   - States: `Synced` (green) · `Syncing N…` (spinner) · `N pending` (amber, click to retry) · `Offline · N queued` (red)
   - Click to open a tiny dialog showing the queue (Admin only) — useful for debugging

9. **Add manual "Retry sync" button** in Settings → Advanced (Admin only).

10. **Cleanup policy:** synced mutations older than 7 days should be purged. Add `clearSyncedMutations()` and call it on app start.

**Verification:**
- Create an order while online → queue shows "1 synced" briefly, then 0 pending
- DevTools → Network → Offline → create another order → queue shows "1 pending · offline"
- Create 3 more → queue shows "4 pending"
- Toggle back online → queue drains in order, sync indicator updates
- Refresh during offline state → queued mutations persist, still drain when online
- Audit log shows the order creations (Phase 1 Task 12)

**Phase 3 swap notes:** When Supabase lands, only `lib/sync.ts`'s `sendMutation` body changes. Each `MutationKind` maps to a Supabase table operation. Conflict resolution for updates: last-write-wins by `createdAt`, with the audit log as the immutable trail.

---

## Task 19: Offline-Aware UI Affordances

**Goal:** The UI should never silently fail when offline. Staff must know what's queued and what isn't.

**What to do:**

1. **Disable network-only features when offline:**
   - Aggregator Inbox "Refresh" button → disabled with tooltip "Offline — cannot fetch new orders"
   - Any future Supabase-backed report → grey out or show cached badge
   - Login screen: show "Offline mode — using saved staff credentials" if `!navigator.onLine`

2. **Show a banner** at the top of the app when offline:
   - Subtle, non-blocking, dismissible
   - "You're working offline. Orders will sync when connection returns."
   - Use the `useOnlineStatus` hook from Task 18

3. **Toast on transitions:**
   - "Connection lost — working offline" (warning)
   - "Back online — syncing 4 orders…" (info)
   - "All changes synced" (success)

4. **Receipt printing (Phase 1 Task 6) works offline already** — confirm by testing. Print uses `window.print()` which is browser-local.

**Verification:**
- Toggle offline → banner appears, aggregator refresh disabled
- Toggle online → toast → banner disappears
- All other POS features remain usable offline

---

## Task 20: Cache the Menu Image Assets

**Goal:** Menu item images should load offline from the service worker cache.

**Current state:**
- `public/menu/` exists (mentioned in directory listing) — likely contains menu images
- Service worker from Task 17 already caches `/icons/` and runtime images, but verify menu images are covered

**What to do:**

1. **Update `app/sw.ts` runtime caching** to explicitly cache `/menu/*`:
   ```ts
   {
     matcher: ({ url }) => url.pathname.startsWith("/menu/"),
     handler: new CacheFirst({
       cacheName: "menu-images",
       plugins: [
         new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }),
       ],
     }),
   }
   ```
   (Adjust to Serwist's `runtimeCaching` format — check `defaultCache` first; it may already cover this.)

2. **Precache critical first-load menu images** by listing them in the manifest entries (if they're imported via `next/image` from JSX, Next will fingerprint them and Serwist will pick them up automatically).

3. **Add fallback image** at `public/menu/_fallback.png` — used when an image isn't in cache and network is unavailable. Reference it in the menu rendering: `onError={(e) => e.currentTarget.src = '/menu/_fallback.png'}`.

**Verification:**
- Browse menu while online → all images load
- Go offline → reload → all previously-viewed menu images still load from cache
- Unviewed images show fallback

---

## Task 21: PWA Install Prompt

**Goal:** Show a custom "Install SUHASHI POS" prompt to staff on supported browsers, instead of waiting for them to dig through Safari's share menu.

**What to do:**

1. **Listen for `beforeinstallprompt` event** (Chrome/Edge/Android — iOS Safari does NOT support this, so iPad needs the manual flow).

2. **Create `components/pos/install-prompt.tsx`:**
   - Captures the prompt event
   - Shows a small banner or settings card: "Install SUHASHI POS for the best experience"
   - On click: calls `prompt.prompt()` and tracks the user choice
   - Hides forever after dismissed (store flag in Zustand: `settings.installPromptDismissed`)

3. **For iPad/iOS:** show a one-time tutorial dialog on first launch with screenshots of:
   - Tap the Share button in Safari
   - Tap "Add to Home Screen"
   - Tap "Add"
   - Trigger only when `!window.matchMedia('(display-mode: standalone)').matches` and on iOS user agent

4. **Detect standalone mode:**
   ```ts
   const isStandalone = window.matchMedia('(display-mode: standalone)').matches
     || (window.navigator as any).standalone === true;
   ```
   - Hide all install prompts when already standalone

5. **Add an "Install App" button in Settings → General** for users who dismissed the prompt and want to install later (admin or any role).

**Verification:**
- Open on Chrome desktop → install banner appears → click → Chrome native install dialog → installs
- Open on iPad Safari → first-launch tutorial appears with screenshot instructions
- Already installed (standalone) → no prompts anywhere

---

## Task 22: PWA Update Flow

**Goal:** When you ship a new version, installed POS instances pick up the update gracefully without losing in-progress work.

**What to do:**

1. **Use the SW `updatefound` event** (registration code from Task 17):
   ```ts
   navigator.serviceWorker.ready.then((registration) => {
     registration.addEventListener("updatefound", () => {
       const newWorker = registration.installing;
       newWorker?.addEventListener("statechange", () => {
         if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
           // New version available
           showUpdateToast();
         }
       });
     });
   });
   ```

2. **Show a non-blocking toast:** "A new version is available. Update?" with two buttons:
   - **Update now** → `registration.waiting?.postMessage({ type: 'SKIP_WAITING' })` then reload
   - **Later** → dismiss; show again on next app open

3. **In `app/sw.ts`** add the SKIP_WAITING listener:
   ```ts
   self.addEventListener("message", (event) => {
     if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
   });
   ```
   (Serwist's defaults already enable `skipWaiting: true`, but explicit message-based control gives staff a chance to finish their order first.)

4. **On reload after update**, show a toast: "Updated to version X.Y.Z" — pull version from `package.json`.

5. **Don't auto-reload during an active order** — check `cart.length > 0` and defer the update toast until the cart is empty.

**Verification:**
- Build → start → install prompt → install
- Make a code change → rebuild → reload → toast appears → click Update → new version loads
- Make a code change while items are in the cart → no toast shown until cart is cleared

---

## Task 23: Background Sync (Optional Enhancement)

**Goal:** Use the Background Sync API so the OS replays queued mutations even when the POS app is closed.

**What to do:**

1. **Register a sync tag** when a mutation is enqueued (Task 18):
   ```ts
   if ("serviceWorker" in navigator && "SyncManager" in window) {
     const reg = await navigator.serviceWorker.ready;
     await (reg as any).sync.register("sync-mutations");
   }
   ```

2. **Handle the sync event in `app/sw.ts`:**
   ```ts
   self.addEventListener("sync", (event: any) => {
     if (event.tag === "sync-mutations") {
       event.waitUntil(replayQueueFromIndexedDB());
     }
   });
   ```

3. **Caveat:** Background Sync is **not supported on iOS Safari** (as of 2026). Treat this as a Chrome/Android enhancement only. iPad will sync when the app is opened — Task 18 already handles that path.

4. **Keep this task gated behind feature detection.** It's a nice-to-have, not critical.

**Verification:**
- Chrome desktop → DevTools → Application → Background Services → Background Sync → see registered tag
- Close the tab → reopen later → mutations have been synced

---

## Implementation Order (Recommended)

```
Task 16  (Manifest)               ← Foundation, no dependencies
Task 17  (Service worker)         ← Needs the manifest to be useful
Task 18  (Offline queue)          ← Independent of SW, but pairs with it
Task 19  (Offline UI affordances) ← Depends on Task 18 (online status)
Task 20  (Cache menu images)      ← Depends on Task 17
Task 21  (Install prompt)         ← Depends on Task 16 (manifest must be valid)
Task 22  (Update flow)            ← Depends on Task 17
Task 23  (Background sync)        ← Optional polish, depends on Task 18
```

---

## Global Rules for Phase 2

1. **Never run a service worker in `next dev`.** Always disable via the `disable: process.env.NODE_ENV === "development"` flag. SW + HMR = pain.
2. **Test in incognito** to avoid stale SW state during development.
3. **Always feature-detect.** `if ("serviceWorker" in navigator)`, `if ("SyncManager" in window)`. iPad Safari is missing several APIs Chrome has.
4. **iPad Safari is the primary target.** Test there before considering any task done. Chrome desktop is for development convenience only.
5. **Bump `STORE_VERSION`** when adding the sync queue (Task 18 → version 4).
6. **Design for Phase 3 swap.** The `sendMutation` function in `lib/sync.ts` is the only thing that should change when Supabase arrives. Don't bake fetch URLs into store actions.
7. **Never auto-reload during user activity.** SW updates wait until the cart is empty.
8. **No sensitive data in cache.** PINs, payment transaction IDs, audit log → fine in localStorage (already there). But never put them in a `Cache Storage` entry that ships with the SW precache manifest.
9. **Run `npm run build` after every task.** Service workers compile differently from app code; build errors there don't always show in dev.
10. **Lighthouse PWA score** should reach ≥ 90 by end of phase. Check after Task 17 and Task 21.

---

## Files That Will Be Modified

| File | Tasks |
|------|-------|
| `app/layout.tsx` | 16, 21 |
| `app/page.tsx` | 17, 18, 19, 22 |
| `next.config.mjs` | 17 |
| `tsconfig.json` | 17 |
| `lib/data.ts` | 18 |
| `lib/store.ts` | 18 |
| `components/pos/sidebar.tsx` | 18, 19 |
| `components/pos/settings.tsx` | 21 |
| `components/pos/aggregator-inbox.tsx` | 19 |

## New Files to Create

| File | Task |
|------|------|
| `public/manifest.json` | 16 |
| `public/icons/icon-192.png` | 16 |
| `public/icons/icon-512.png` | 16 |
| `public/icons/icon-maskable-512.png` | 16 |
| `public/menu/_fallback.png` | 20 |
| `app/sw.ts` | 17 |
| `components/sw-register.tsx` | 17, 22 |
| `components/pos/install-prompt.tsx` | 21 |
| `components/pos/sync-status.tsx` | 18, 19 |
| `components/pos/offline-banner.tsx` | 19 |
| `hooks/use-online-status.ts` | 18 |
| `lib/sync.ts` | 18 |

---

## Verification Checklist (End of Phase 2)

- [ ] Lighthouse PWA audit ≥ 90
- [ ] Manifest valid in Chrome DevTools → Application → Manifest
- [ ] Service worker registered and controlling the page in production build
- [ ] App shell loads with network disabled (DevTools → Offline)
- [ ] iPad Safari "Add to Home Screen" produces a standalone-mode app
- [ ] Creating an order while offline succeeds and queues
- [ ] Returning online drains the queue in order
- [ ] Sync queue persists across refresh
- [ ] Update flow shows toast on new SW version
- [ ] Update is deferred when cart has items
- [ ] No service worker active in `next dev`
- [ ] All Phase 1 features still work (regression check: orders, billing, KDS, reports)

---

*This guide covers Phase 2 completely — 8 tasks bringing SUHASHI POS from a browser-only frontend to an installable, offline-capable PWA. Phase 3 (Supabase backend) will plug into the offline queue's `sendMutation` hook without rewriting the consumer code.*
