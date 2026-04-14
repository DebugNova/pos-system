# Realtime Sync Fix Plan

> **Status:** Diagnosis complete — ready to implement  
> **Problem:** Orders placed on Admin PC do not appear on Kitchen (phone) or Barista devices. Pay Later sends order to kitchen locally but other devices see nothing.

---

## Root Causes (ordered by likelihood)

### Root Cause 1 — `sessionStorage` kills sessions on mobile (CRITICAL)

**File:** `lib/supabase.ts` line 14

```ts
storage: typeof window !== "undefined" ? window.sessionStorage : undefined,
```

`sessionStorage` is **tab-local and process-local**. On iOS Safari and Android Chrome, when the browser suspends a background tab (which happens within ~30 seconds on low-memory devices), `sessionStorage` is wiped. When the Kitchen operator's phone wakes up:

- The Supabase JWT (access token + refresh token) is gone
- `getSupabase()` has no session → all authenticated queries return null/empty
- `fetchOrderById(orderId)` returns `null` → order is never added to the store
- The Realtime channel subscription continues receiving events, but because the auth token is gone, Supabase's RLS blocks the actual data rows from being returned
- The mutation queue in `sync.ts` line 145 checks `if (!session) throw new Error("No active session")` → **entire queue stalls forever** until the user re-logs

**Fix:** Change `sessionStorage` → `localStorage` in `lib/supabase.ts`.  
This is a café POS on dedicated devices — persisting the session token is appropriate.

---

### Root Cause 2 — Every Realtime event triggers a compensating DB read (CRITICAL for performance + correctness)

**File:** `hooks/use-realtime-sync.ts` lines 255–298

The current flow for any order change:
```
DB write → Realtime event fires → IGNORE the payload data → call fetchOrderById (400ms debounce + full DB query) → update state
```

This is problematic in two ways:

**Performance:** Every single status change on any device fires a `SELECT * FROM orders JOIN order_items JOIN supplementary_bills WHERE id = ?` query. With 3 devices and 20 orders in flight, a busy service could fire 60+ DB reads per minute — burning through the free plan's connection pool fast.

**Correctness (race condition):** The Realtime `INSERT` event on `orders` fires the moment the order row is written. But `upsertOrder` writes items in a second separate query right after. If `fetchOrderById` runs within those few milliseconds, it returns an order with zero items. The 400ms debounce helps but does **not guarantee** items are written before the refetch.

**Fix:** For `UPDATE` events on the `orders` table, apply the payload's `new` record directly to the local store (no DB round-trip). The Realtime payload already contains all order columns. Only call `fetchOrderById` for:
1. `INSERT` events (new orders — need to fetch items too, but with a longer debounce of 800ms)
2. Events from `supplementary_bills` / `supplementary_bill_items` (need a re-join)

This eliminates ~80% of compensating DB reads.

---

### Root Cause 3 — Mutation queue retries too slowly (HIGH)

**File:** `lib/hydrate.ts` line 109

```ts
const syncInterval = setInterval(() => { syncPendingMutations() }, 30_000);
```

If the direct write-through fails (network blip, expired token, RLS error), the fallback queue only retries **every 30 seconds**. For a live POS this is unacceptable — the Kitchen sees nothing for 30 seconds.

**Fix:** Reduce interval to **8 seconds**. The mutation queue deduplicates by orderId so rapid retries don't double-write. The free plan allows 500K Edge Function calls/month; the `sendMutation` path calls REST APIs, not Edge Functions, so cost is minimal.

---

### Root Cause 4 — `supabaseEnabled` gate blocks writes during slow hydration (HIGH)

**File:** `lib/store.ts` line 238, `lib/hydrate.ts` line 84

```ts
supabaseEnabled: false,  // store initial state
// ...
usePOSStore.setState({ supabaseEnabled: true }); // only set AFTER hydration succeeds
```

On a slow mobile connection, `hydrateStoreFromSupabase()` may take 2–5 seconds. During that window `supabaseEnabled = false`, so:
- All direct write-throughs in `sendToKitchenPayLater`, `confirmPaymentAndSendToKitchen`, etc. are **skipped**
- The mutation is queued, but only replays after 30 seconds (now 8 seconds after Fix 3)
- Other devices see nothing until the queue replays

**Fix:** Enable `supabaseEnabled = true` immediately when the Supabase client is initialized (i.e., at store creation or as soon as `isLoggedIn` becomes true), not gated on hydration. Hydration is for reading data; writes should proceed independently.

---

### Root Cause 5 — Re-hydration threshold is 10 seconds (MEDIUM)

**File:** `hooks/use-realtime-sync.ts` lines 202–208

```ts
if (wasHiddenFor > 10_000) {
  hydrateStoreFromSupabase().catch(console.error);
}
```

A device that was in background for **9 seconds** (e.g., the barista checks WhatsApp quickly) misses any updates during that window and never re-syncs. On a busy service with orders flying in every few seconds, this creates stale state.

**Fix:** Lower threshold to **3 seconds** (or remove the guard entirely and just debounce the hydration call to prevent spam).

---

### Root Cause 6 — Realtime reconnect backoff goes up to 30 seconds (MEDIUM)

**File:** `hooks/use-realtime-sync.ts` lines 159–167

```ts
const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
```

After a channel error (e.g., brief WiFi dropout), the reconnect can take up to 30 seconds. For a café POS where WiFi is usually stable, this is too conservative.

**Fix:** Cap the maximum reconnect backoff at **8 seconds** instead of 30 seconds.

---

### Root Cause 7 — `markOwnWrite` is dead code that wastes CPU (LOW)

**File:** `lib/store.ts` (multiple lines), `hooks/use-realtime-sync.ts` line 252

The `__posMarkOwnWrite` function is called in every store action but `handleOrderChange` deliberately ignores the `_ownWrites` parameter (prefixed with `_` = unused). This was removed intentionally to fix cross-terminal echo issues, but the calls in the store remain. This is noise — the `Set.add()` + `setTimeout(() => Set.delete())` runs for every mutation unnecessarily.

**Fix:** Remove all `(window as any).__posMarkOwnWrite` calls from `lib/store.ts` and remove the `markOwnWrite`/`recentOwnWritesRef` from `use-realtime-sync.ts`. Clean up the dead code.

---

## Summary Table

| # | File | Issue | Impact | Fix |
|---|------|-------|--------|-----|
| 1 | `lib/supabase.ts:14` | `sessionStorage` wipes session on mobile sleep | **CRITICAL** — entire sync dies | Change to `localStorage` |
| 2 | `hooks/use-realtime-sync.ts:255` | Compensating DB read for every event | **CRITICAL** — race condition + quota waste | Use payload for UPDATE, only refetch for INSERT |
| 3 | `lib/hydrate.ts:109` | 30s mutation retry interval | HIGH — 30s lag on fallback | Change to 8s |
| 4 | `lib/store.ts:238` | `supabaseEnabled` false during slow hydration | HIGH — direct writes skipped | Set true at login, not after hydration |
| 5 | `hooks/use-realtime-sync.ts:204` | 10s re-hydrate threshold | MEDIUM — stale state after brief background | Lower to 3s |
| 6 | `hooks/use-realtime-sync.ts:161` | 30s max reconnect backoff | MEDIUM — long blind window after WiFi blip | Cap at 8s |
| 7 | `lib/store.ts` (many lines) | Dead `markOwnWrite` calls | LOW — noise/CPU waste | Remove dead code |

---

## Implementation Order

When you're ready to implement, do these in this exact order:

1. **Fix 1 first** — `sessionStorage` → `localStorage` in `lib/supabase.ts`. One-line change. Fixes the session-death issue that kills all sync on mobile.
2. **Fix 4 next** — Remove `supabaseEnabled` gate (set to `true` at login). Fixes the write-skipping window.
3. **Fix 3** — Reduce mutation retry to 8s. Faster fallback for any missed writes.
4. **Fix 2** — Optimize Realtime handlers to use payload for UPDATE events. Fixes race condition + reduces DB load.
5. **Fix 5 + 6** — Lower re-hydrate threshold + reconnect backoff.
6. **Fix 7 last** — Dead code cleanup.

---

## Quick Debugging Checklist (before implementing fixes)

Open **browser DevTools → Console** on each device and look for:

- `[realtime] ✓ Connected — live updates active` → channel is subscribed
- `[realtime] Channel error` → subscription failed
- `[realtime] Order merged: ord-xxx` → events are being received and applied
- `[store] Direct write failed` → direct write is failing (confirms Fix 1 or 4 is needed)
- `[sync] No active session` → session is dead (confirms Fix 1 is critical)

If you see `Channel error` on Kitchen/Barista devices but `Connected` on Admin, Fix 1 (session) is almost certainly the cause.

---

## Free Plan Optimization Notes

After these fixes the app will be significantly more efficient on the free plan:

| Metric | Before | After |
|--------|--------|-------|
| DB queries per order status change | 1 (per device subscribed) | 0 for UPDATEs, 1 for INSERTs |
| DB queries for a 3-device sync on Pay Later | 3 compensating reads | 0 (payload used directly) |
| Max sync lag on direct-write failure | 30 seconds | 8 seconds |
| Max Realtime reconnect time | 30 seconds | 8 seconds |

The free plan allows **500MB DB**, **2GB bandwidth**, and **500 concurrent realtime connections**. The main bottleneck is bandwidth. Eliminating compensating reads (Fix 2) is the biggest win here.

---

## Files to Change

| File | Lines Changed | Change Type |
|------|--------------|-------------|
| `lib/supabase.ts` | line 14 | `sessionStorage` → `localStorage` |
| `lib/store.ts` | line 238 + `supabaseEnabled` gate logic | Remove `supabaseEnabled` guard on direct writes |
| `lib/hydrate.ts` | line 109 | 30s → 8s interval |
| `hooks/use-realtime-sync.ts` | lines 252, 35–40, 162, 204, 255–298 | Payload-based UPDATE handling + threshold fixes + dead code removal |
