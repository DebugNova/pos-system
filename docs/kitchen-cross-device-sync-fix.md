---
title: Kitchen status changes don't propagate to other terminals within 10s
status: Open
severity: High — breaks core multi-terminal promise
area: Realtime sync (orders lifecycle)
owner: Any AI agent picking this up
---

# The bug in plain words

Scenario the user reported:

1. Cashier on **PC** creates an order, proceeds to payment, picks **Pay Later**.
2. Order enters the kitchen (`status = new`, `payLater = true`). Both PC and **phone** (KDS role) see it — good.
3. Kitchen on **phone** taps **Start Prep**. Phone flips the order to `preparing`.
4. The **PC does NOT** move the order to the Preparing column. It stays stuck in "New" on the PC even though the phone is clearly ahead.

Same symptom applies to any rapid status transition right after a terminal has touched an order: `new → preparing → ready → served`. Whoever wrote to Supabase first effectively goes "deaf" to that order's Realtime events for ~10 seconds.

# Why it happens — exact code

The culprit is the **own-write dedupe** in [hooks/use-realtime-sync.ts](../hooks/use-realtime-sync.ts).

- [use-realtime-sync.ts:34-39](../hooks/use-realtime-sync.ts#L34-L39) — `markOwnWrite(orderId)` adds the order id to a `Set` and clears it **10 seconds later**.
- [use-realtime-sync.ts:250-254](../hooks/use-realtime-sync.ts#L250-L254) — inside `handleOrderChange`, **any** incoming Realtime event whose `orderId` is in that set is silently dropped:
  ```ts
  if (ownWrites.has(orderId)) {
    console.log("[realtime] Skipping own write for order", orderId);
    return;
  }
  ```
- [use-realtime-sync.ts:279](../hooks/use-realtime-sync.ts#L279) — `handleOrderItemChange` has the same skip.

The store marks own-writes every time it performs a direct Supabase update on an order:

- [store.ts:849-851](../lib/store.ts#L849-L851) — `updateOrderStatus`
- [store.ts:926-928](../lib/store.ts#L926-L928) — `confirmPaymentAndSendToKitchen`
- [store.ts:998-1000](../lib/store.ts#L998-L1000) — `sendToKitchenPayLater`
- Also in `markOrderServed` and other direct-write actions.

## The actual feedback-loop sequence

Time `T=0s` — PC calls `sendToKitchenPayLater` (or `confirmPaymentAndSendToKitchen`).
  - PC optimistically sets local state to `new`.
  - PC marks `ownWrites.add(orderId)` — entry will be deleted at `T=10s`.
  - PC writes to Supabase.
  - PC receives its own `UPDATE` echo → sees id in `ownWrites` → **correctly** skips. Good so far.

Time `T=3s` — phone (KDS) taps **Start Prep** → writes `status=preparing` to Supabase.

Time `T=3.1s` — Supabase broadcasts the `UPDATE` to **all** subscribers, including the PC.
  - PC receives the event.
  - `ownWrites.has(orderId)` is **still true** (cleared at `T=10s`).
  - PC drops the event at [use-realtime-sync.ts:251](../hooks/use-realtime-sync.ts#L251). **No refetch, no state merge.**
  - PC stays on `new`. User sees a stuck column.

The 10-second window doesn't distinguish "an echo of my write" from "a brand-new event from a different terminal that happens to concern the same order id". Both get thrown away.

# Why own-write filtering was added in the first place

To stop the PC from refetching an order it just wrote to. That's a real concern — but it's already solved by two other mechanisms:

1. **Shallow-equal short-circuit** — [use-realtime-sync.ts:494-497](../hooks/use-realtime-sync.ts#L494-L497). If the refetched order matches local state, the merge is a no-op.
2. **Lifecycle rank guard** — [use-realtime-sync.ts:460-514](../hooks/use-realtime-sync.ts#L460-L514). `STATUS_RANK` rejects any realtime echo that would regress the status (`preparing → new` etc.).

So the own-write filter is **redundant protection**. Its only job today is saving one extra `fetchOrderById` round-trip for an order the terminal just wrote — and in exchange it silently breaks cross-terminal sync. Bad trade.

# The fix (minimal, safe, free-tier friendly)

## Change 1 — stop filtering cross-terminal events by id alone

In [hooks/use-realtime-sync.ts](../hooks/use-realtime-sync.ts), replace the broad id-based skip with an exact echo detector. Two acceptable approaches; pick **Option A** unless there's a measurable latency win from B.

### Option A — remove the skip entirely (recommended)

Delete these blocks:

- [use-realtime-sync.ts:250-254](../hooks/use-realtime-sync.ts#L250-L254) (inside `handleOrderChange`)
- [use-realtime-sync.ts:279](../hooks/use-realtime-sync.ts#L279) (inside `handleOrderItemChange`)

Also delete (they become dead code):

- `recentOwnWritesRef` declaration [use-realtime-sync.ts:24](../hooks/use-realtime-sync.ts#L24)
- `markOwnWrite` callback [use-realtime-sync.ts:34-39](../hooks/use-realtime-sync.ts#L34-L39)
- The two handler args `ownWrites` and the exposure on `window.__posMarkOwnWrite` [use-realtime-sync.ts:51-53](../hooks/use-realtime-sync.ts#L51-L53) and the cleanup at [use-realtime-sync.ts:227-229](../hooks/use-realtime-sync.ts#L227-L229).

In [lib/store.ts](../lib/store.ts), delete every call to `window.__posMarkOwnWrite(orderId)` — they become no-ops:

- Inside `updateOrder` direct-write path
- [store.ts:849-851](../lib/store.ts#L849-L851) — `updateOrderStatus`
- [store.ts:926-928](../lib/store.ts#L926-L928) — `confirmPaymentAndSendToKitchen`
- [store.ts:998-1000](../lib/store.ts#L998-L1000) — `sendToKitchenPayLater`
- Any other site. Grep for `__posMarkOwnWrite` to find them all.

**Why this is safe on the free tier:** each cross-device realtime event triggers at most one `fetchOrderById` per 400 ms (the existing debounce at [use-realtime-sync.ts:447-449](../hooks/use-realtime-sync.ts#L447-L449)). For a single cashier + single kitchen terminal the extra reads are negligible — a few dozen `SELECT` calls per shift, well inside Supabase's free 500K Edge invocations / 2 GB bandwidth budget. Reads against `orders`+`order_items` are cheap.

### Option B — keep the skip but key it by (orderId, status)

If the reviewer insists on suppressing the self-echo to save reads, change the own-write set from `Set<string>` to `Set<string>` keyed by `${orderId}:${newStatus}`:

```ts
// in use-realtime-sync.ts
const recentOwnWritesRef = useRef<Set<string>>(new Set());

const markOwnWrite = useCallback((orderId: string, status: string) => {
  const key = `${orderId}:${status}`;
  recentOwnWritesRef.current.add(key);
  setTimeout(() => recentOwnWritesRef.current.delete(key), 4000); // 4s is plenty
}, []);
```

In `handleOrderChange`:

```ts
const incomingKey = `${orderId}:${newRecord.status}`;
if (ownWrites.has(incomingKey)) {
  console.log("[realtime] Skipping own echo", incomingKey);
  return;
}
```

In `handleOrderItemChange`, drop the own-write skip entirely — item rows don't carry a status, so we can't key them exactly, and the debounce + shallow-equal in `refetchAndMergeOrder` already make redundant refetches cheap.

Update every `window.__posMarkOwnWrite(orderId)` call in [lib/store.ts](../lib/store.ts) to pass the status being written: `window.__posMarkOwnWrite(orderId, "new")`, `"preparing"`, `"ready"`, etc.

**Shorten the window to 4 s** — that's comfortably longer than the direct-write round-trip + realtime fan-out (~500 ms in practice) but short enough that a human can't meaningfully interleave two writes on the same status value.

## Change 2 — no backend / Supabase changes

This bug is **entirely client-side**. Do **not**:

- Modify any migration, RLS policy, or table schema.
- Add new tables, views, or Edge Functions.
- Change the Realtime publication membership.
- Add any polling loop.

The `supabase_realtime` publication already includes `orders`, `order_items`, `tables`, `settings`, `staff`, `supplementary_bills`, `supplementary_bill_items` per [docs/realtime-and-audio-glitches-fix.md:497](./realtime-and-audio-glitches-fix.md#L497). Nothing on the backend needs to move.

# How to verify the fix

Manual test — the exact scenario the user reported:

1. Open the app on PC as **Cashier** (or Admin).
2. Open the app on phone (or a second browser window) as **Kitchen**.
3. PC: create a new order with 1–2 items → proceed to payment → **Pay Later**. Order lands in KDS on both devices within ~1 s.
4. Phone: tap **Start Prep** on the order.
5. **PC must move the order from "New" → "Preparing" within ~1 s** without any manual refresh. This is the regression check.
6. Phone: tap **Ready**. PC must move it to the "Ready" column.
7. Phone: tap **Mark Served**. On PC the order must disappear from KDS (status `completed` or `served-unpaid` for pay-later).
8. Repeat with the roles swapped (phone cashier, PC kitchen) to make sure the fix is symmetric.

Also re-run these regression checks to make sure removing the dedupe doesn't reintroduce the feedback loops it was guarding against:

- Rapid double-tap **Start Prep** on the same order from the same device → only one "Preparing" card, no flicker.
- Offline: disconnect network, tap **Start Prep**, reconnect → order syncs correctly, no duplicated audit entries.
- KDS "NEW!" flash badge still only fires for genuinely-new orders (the `advancedIdsRef` guard at [kitchen-display.tsx:127-139](../components/pos/kitchen-display.tsx#L127-L139) is independent of this change and will continue to work).

Automated: `npm run build` — must pass with no type errors.

# Out of scope (don't touch)

- The audio alert / `BellRing` logic in `kitchen-display.tsx`.
- The `ordersShallowEqual` / `STATUS_RANK` logic — keep both, they're doing real work.
- `use-realtime-sync.ts` reconnect backoff.
- The visibility-change rehydrate path.
- The mutation queue in `lib/sync.ts` — the direct write-through path is what drives cross-terminal latency, and that path is fine.

# Done when

- Phone → PC and PC → phone status transitions land in under ~1 s without any manual refresh, across the full lifecycle (`new → preparing → ready → served`).
- `grep -R "__posMarkOwnWrite" .` returns **zero** matches (Option A), or every call site passes a status string (Option B).
- `npm run build` is clean.
- No Supabase migration was run; no new rows exist in `migrations/`.
