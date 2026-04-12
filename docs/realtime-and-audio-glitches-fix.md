# Realtime Sync & Audio Alert Glitches — Full Analysis & Fix Plan

**Date:** 2026-04-12
**Scope:** Cross-device kitchen sync latency/flicker on PC, and the billing/kitchen beep that plays multiple times or stutters.
**Severity:** Medium — functional but visibly/audibly glitchy on receiving terminals.

---

## 1. Symptoms (as reported)

1. **Kitchen glitches on PC only.**
   - When a dine-in order is placed on the iPad and the cashier hits **Pay Later** (or **Proceed to Payment** → full pay), the order appears **instantly** on the iPad's Kitchen Display, but on the PC Kitchen Display there is a brief flicker/stutter before the card is stable.
2. **Notification beep stutters / plays multiple times.**
   - The billing beep (when a new order lands in billing) and the kitchen beep (when a paid order lands in the KDS) sometimes play more than once, or sound distorted.

Everything else works: orders end up in Supabase correctly, tables lock/unlock correctly, and the UI shows the right data once things settle.

---

## 2. Root Causes

### 2.1 Order + items arrive as separate Realtime events (causes the PC flicker)

**File:** [lib/supabase-queries.ts:51-72](lib/supabase-queries.ts#L51-L72) — `upsertOrder`

`upsertOrder` writes the order row first, then the items in a second call:

```ts
await supabase.from("orders").upsert(mapLocalOrderToDb(orderData), ...)
// ← at this point Supabase already broadcasts an INSERT for the order
await supabase.from("order_items").upsert(dbItems, ...)
// ← now it broadcasts INSERTs for each item, potentially milliseconds later
```

**On the source device (iPad):** no problem — the full order is already in the Zustand store optimistically, so the UI paints instantly and the Realtime echoes are ignored by the `recentOwnWrites` guard.

**On the receiving device (PC):**

- The `orders` INSERT arrives first and fires [hooks/use-realtime-sync.ts:76](hooks/use-realtime-sync.ts#L76) → `handleOrderChange` → `refetchAndMergeOrder(orderId)` with a **150 ms debounce**.
- `order_items` INSERTs arrive one-by-one and each resets the same debounce timer.
- **Happy path:** all events arrive inside the 150 ms window → one refetch → clean merge.
- **Glitch path:** On slower network / PC (Windows 11 + PC Wi-Fi has more jitter than a phone on LTE), the gap between the `orders` event and the first `order_items` event can exceed 150 ms. The refetch fires with only the **parent row** available in the DB or with partial items, the KDS card paints with 0 items for a frame, then a second refetch fires when the items finally arrive. That's the flicker.

This is the primary reason the PC "glitches" while the iPad does not.

---

### 2.2 `handleOrderItemChange` doesn't check own-writes

**File:** [hooks/use-realtime-sync.ts:245-252](hooks/use-realtime-sync.ts#L245-L252)

```ts
function handleOrderItemChange(payload: any) {
  const orderId = newRecord?.order_id || payload.old?.order_id;
  if (orderId) {
    refetchAndMergeOrder(orderId);   // no recentOwnWrites check
  }
}
```

On the source device, the order was marked as an "own write" in `handleOrderChange`, so the parent row echo is skipped. But the item-row echoes still trigger `refetchAndMergeOrder`, which re-fetches the full order from Supabase and **overwrites the optimistic local copy** with whatever happens to be in the DB at that instant.

**Consequence on the source device:** if the user has already advanced the order's status (e.g. clicked Proceed → paid → now `new`) before the echo arrives, the refetch may return the older `awaiting-payment` state and snap the UI backwards for one frame. That's a second source of "glitching".

---

### 2.3 Billing/kitchen beep is count-based, not event-based

**File:** [components/pos/sidebar.tsx:48-124](components/pos/sidebar.tsx#L48-L124)

```ts
const pendingBillsCount = orders.filter(o =>
  o.status === "awaiting-payment" ||
  o.status === "served-unpaid" ||
  (o.supplementaryBills && o.supplementaryBills.some(b => !b.payment))
).length;

useEffect(() => {
  if (prevPendingCountRef.current !== null && pendingBillsCount > prevPendingCountRef.current) {
    // play beep
  }
  prevPendingCountRef.current = pendingBillsCount;
}, [pendingBillsCount, mounted]);
```

This design has four problems:

1. **Any** increase in the count plays the beep, including transitions that are not "new arrivals":
   - An order that goes `completed → refunded → awaiting-payment`, a supplementary bill being added, a hydration fill-in after a tab refocus, etc.
2. **Hydration side-effects.** `hydrateStoreFromSupabase()` is called on login, `online` event, channel error, channel timeout, visibility change, and every 5 minutes in the background. Each run replaces `orders` wholesale. If the previous snapshot had fewer pending orders than the fresh one (very common after a tab comes back from being idle), the ref drifts and **a spurious beep fires just because we refocused**.
3. **Own writes beep too.** When the cashier on this terminal creates an order, the count goes 0 → 1 and their own device beeps at them — no need, they just clicked the button.
4. **React re-renders cause false ticks.** Because `pendingBillsCount` is recomputed by `orders.filter(...)` on every render, even a no-op `setState` that keeps the count the same can still cause the effect to re-run. It won't beep (because the comparison is against `prevRef`), but combined with hydration drift the ref can lock into a higher watermark and then fire multiple beeps in a single flow.

The kitchen beep effect at [sidebar.tsx:87-124](components/pos/sidebar.tsx#L87-L124) has the same structure and the same bugs.

---

### 2.4 New `AudioContext` created per beep, never closed

Both beep effects do:

```ts
const ctx = new AudioContextClass();
const osc = ctx.createOscillator();
// ... start / stop
// no ctx.close()
```

Chromium/WebKit limit the number of live `AudioContext` instances per page (Chrome's practical limit is ~6 before it stops creating them; Safari is stricter). After enough beeps in a session the browser starts dropping them, which is heard as **distorted / stuttery audio** — exactly what the user called "glitching sound". Creating many live contexts is the classic cause of exactly this symptom.

Fix is to reuse **one** module-level `AudioContext`, or call `ctx.close()` after the last oscillator stops.

---

### 2.5 Dead code: `playNewOrderSound` in the KDS

**File:** [components/pos/kitchen-display.tsx:86-117](components/pos/kitchen-display.tsx#L86-L117)

`playNewOrderSound` is defined but never called. The beep that the user hears on the kitchen screen actually comes from the sidebar's `pendingKitchenCount` effect, not the KDS. The dead function is confusing and should either be wired into the KDS's own new-order detection ([kitchen-display.tsx:157-186](components/pos/kitchen-display.tsx#L157-L186)) or deleted. Keeping it as dead code increases the risk that someone accidentally hooks it up and you end up with **two** places playing a beep for the same event.

---

### 2.6 Reconnect cascade amplifies the above

**File:** [hooks/use-realtime-sync.ts:128-167](hooks/use-realtime-sync.ts#L128-L167)

On `CHANNEL_ERROR` or `TIMED_OUT` the hook both **rehydrates the store** and **reconnects with exponential backoff**, and it repeats this for as long as the channel is unhappy. In practice, a single flaky reconnect can:

1. Replace the orders array (hydrate) → count drifts → spurious sidebar beep.
2. Reconnect → another full subscription handshake → any Realtime event delivered during the gap is re-delivered → refetch.
3. Both the orders INSERT and the order_items INSERTs get reprocessed → another refetch → a second merge → a second potential flicker.

---

### 2.7 Minor data inconsistency found in Supabase

While auditing, I queried the live orders table and found one record that shouldn't exist in this shape:

| id | status | pay_later | paid_at |
|---|---|---|---|
| `ord-1775919287936` | `served-unpaid` | `false` | `2026-04-12 01:12:56` |

`served-unpaid` should always imply `pay_later = true` and `paid_at IS NULL`. This order has `pay_later = false` AND a `paid_at` set, which is only possible if `confirmPaymentForServedOrder` partially applied and then something (stale mutation replay, or a rehydrate merge while the queued mutation was still pending) reverted `status` back to `served-unpaid` without rolling back `pay_later`/`paid_at`.

This is not what the user complained about, but it is the same family of bug: **the mutation queue and the direct write-through can race each other**. When `confirmPaymentForServedOrder` runs:

- It calls `enqueueMutation("order.update", { ... })` (queued).
- It also calls `updateOrderInDb(...)` directly.

If the device was briefly offline, the queue may hold a stale copy of the change and replay it out of order when it comes back online, or a subsequent action may replay on top of it. See §3.7 for the fix.

---

## 3. Fixes

Below are the fixes in priority order. Items 3.1 – 3.4 directly address the user's reported symptoms.

### 3.1 Fix the PC flicker: wait for items before merging (hard fix)

**File:** [hooks/use-realtime-sync.ts](hooks/use-realtime-sync.ts)

Two changes:

**A. Increase the refetch debounce from 150 ms → 400 ms.** This is the single highest-leverage change. 400 ms is still imperceptible as "latency" (the visible delay between paying on the iPad and seeing the order on the PC will stay well under half a second), but it comfortably absorbs the gap between Supabase's `orders` INSERT broadcast and the subsequent `order_items` broadcasts.

```ts
// hooks/use-realtime-sync.ts
const REFETCH_DEBOUNCE_MS = 400;   // was 150

async function refetchAndMergeOrder(orderId: string) {
  if (pendingRefetches.has(orderId)) {
    clearTimeout(pendingRefetches.get(orderId)!);
  }
  const timer = setTimeout(async () => {
    pendingRefetches.delete(orderId);
    try {
      const updatedOrder = await fetchOrderById(orderId);
      if (!updatedOrder) return;
      usePOSStore.setState((state) => {
        const existing = state.orders.find((o) => o.id === orderId);
        // Skip merge if shallow-equal — avoids unnecessary re-renders and false sidebar ticks
        if (existing && ordersShallowEqual(existing, updatedOrder)) return {};
        const exists = !!existing;
        return {
          orders: exists
            ? state.orders.map((o) => (o.id === orderId ? updatedOrder : o))
            : [updatedOrder, ...state.orders],
        };
      });
    } catch (err) {
      console.error("[realtime] Failed to refetch order:", orderId, err);
    }
  }, REFETCH_DEBOUNCE_MS);
  pendingRefetches.set(orderId, timer);
}

function ordersShallowEqual(a: Order, b: Order): boolean {
  return (
    a.status === b.status &&
    a.payLater === b.payLater &&
    a.total === b.total &&
    a.items.length === b.items.length &&
    (a.supplementaryBills?.length ?? 0) === (b.supplementaryBills?.length ?? 0)
  );
}
```

**B. Gate `handleOrderItemChange` on own-writes** so the source device stops re-fetching its own items:

```ts
function handleOrderItemChange(payload: any, ownWrites: Set<string>) {
  const orderId = payload.new?.order_id || payload.old?.order_id;
  if (!orderId) return;
  if (ownWrites.has(orderId)) return;   // ← new
  refetchAndMergeOrder(orderId);
}
```

And update the subscription to pass `recentOwnWritesRef.current` into it, same as for `handleOrderChange`.

**Why this fixes the flicker:**
- Receiving device: all of `orders` + `order_items` events collapse into one refetch after the gap has settled.
- Source device: no redundant refetches overwrite the optimistic state.
- `ordersShallowEqual` stops the store from pushing a new object reference when nothing meaningful changed, which also prevents sidebar from spuriously re-running its effects.

---

### 3.2 Fix the beeps: event-based, not count-based

**File:** [components/pos/sidebar.tsx](components/pos/sidebar.tsx)

Replace the count-ref pattern with an **ID-set** pattern so a beep only fires for genuinely new IDs (same approach the KDS already uses at [kitchen-display.tsx:129-186](components/pos/kitchen-display.tsx#L129-L186)):

```ts
// sidebar.tsx
const prevBillingIdsRef = useRef<Set<string> | null>(null);
const prevKitchenIdsRef = useRef<Set<string> | null>(null);

const billingIds = useMemo(
  () =>
    new Set(
      orders
        .filter(
          (o) =>
            o.status === "awaiting-payment" ||
            o.status === "served-unpaid" ||
            (o.supplementaryBills && o.supplementaryBills.some((b) => !b.payment))
        )
        .map((o) => o.id)
    ),
  [orders]
);

const kitchenIds = useMemo(
  () => new Set(orders.filter((o) => o.status === "new").map((o) => o.id)),
  [orders]
);

useEffect(() => {
  if (!mounted) return;
  // First run after login: seed only, don't beep
  if (prevBillingIdsRef.current === null) {
    prevBillingIdsRef.current = billingIds;
    return;
  }
  const prev = prevBillingIdsRef.current;
  const hasTrulyNew = [...billingIds].some((id) => !prev.has(id));
  if (hasTrulyNew) playBillingBeep();
  prevBillingIdsRef.current = billingIds;
}, [billingIds, mounted]);

// same structure for kitchenIds
```

Then (optional, but recommended): **don't beep for orders that this terminal just created**. Expose a `__posRecentOwnOrders` set from the store (mirroring `__posMarkOwnWrite`), and skip any ID present in it when diffing.

**Why this fixes the audio "plays multiple times":**
- Hydration / rehydration can no longer cause ghost beeps. The ID set contains the same IDs before and after a rehydrate, so the diff is empty.
- Reconnect cascades produce zero false positives.
- Own-write detection keeps the source device quiet — only the **other** terminals beep, which is the desired UX.

---

### 3.3 Fix the beep distortion: reuse one `AudioContext`

**File:** [components/pos/sidebar.tsx](components/pos/sidebar.tsx)

Pull the context out to module scope and lazy-init it once:

```ts
// top of sidebar.tsx (outside the component)
let sharedAudioCtx: AudioContext | null = null;
function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (sharedAudioCtx) {
    if (sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  }
  try {
    const Cls = window.AudioContext || (window as any).webkitAudioContext;
    sharedAudioCtx = new Cls();
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

function playBillingBeep() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  gain.gain.setValueAtTime(0.05, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
  osc.start();
  osc.stop(ctx.currentTime + 0.16);
}

function playKitchenBeep() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime;

  const osc1 = ctx.createOscillator();
  const g1 = ctx.createGain();
  osc1.connect(g1); g1.connect(ctx.destination);
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(880, t);
  g1.gain.setValueAtTime(0.05, t);
  g1.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  osc1.start(t); osc1.stop(t + 0.5);

  const osc2 = ctx.createOscillator();
  const g2 = ctx.createGain();
  osc2.connect(g2); g2.connect(ctx.destination);
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(1175, t + 0.15);
  g2.gain.setValueAtTime(0.05, t + 0.15);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
  osc2.start(t + 0.15); osc2.stop(t + 0.65);
}
```

Note the exponential gain target is `0.001`, not `0.01` — `exponentialRampToValueAtTime` must not target a true zero and 0.001 is indistinguishable from silence.

---

### 3.4 Delete dead code in `kitchen-display.tsx`

**File:** [components/pos/kitchen-display.tsx:86-117](components/pos/kitchen-display.tsx#L86-L117)

Delete the `playNewOrderSound` function. The sidebar now owns audio. This prevents future accidental duplication.

The existing `newOrderFlash` visual effect at [kitchen-display.tsx:157-186](components/pos/kitchen-display.tsx#L157-L186) should stay — it's the visual "NEW!" badge and it's working correctly.

---

### 3.5 Debounce `hydrateStoreFromSupabase` to avoid re-entrancy

**File:** [lib/hydrate.ts](lib/hydrate.ts)

Right now `hydrateStoreFromSupabase` can be called from multiple triggers (login, `online`, `visibilitychange`, `CHANNEL_ERROR`, `TIMED_OUT`, the 5-minute background interval) and they can overlap. Wrap it in a single-flight guard:

```ts
let hydratePromise: Promise<void> | null = null;
export async function hydrateStoreFromSupabase(): Promise<void> {
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    try {
      /* existing body */
    } finally {
      hydratePromise = null;
    }
  })();
  return hydratePromise;
}
```

This doesn't fix a user-visible bug directly, but it makes everything else more predictable and reduces the frequency of redundant full-store replacements that can trip other effects.

---

### 3.6 Only rehydrate on visibility change if the page was hidden long enough

**File:** [hooks/use-realtime-sync.ts:176-181](hooks/use-realtime-sync.ts#L176-L181)

```ts
let hiddenAt: number | null = null;
const handleVisibilityChange = () => {
  if (document.visibilityState === "hidden") {
    hiddenAt = Date.now();
    return;
  }
  if (document.visibilityState === "visible" && navigator.onLine) {
    const wasHiddenFor = hiddenAt ? Date.now() - hiddenAt : 0;
    hiddenAt = null;
    // Only rehydrate if we were actually gone for >10s — ignore quick tab swaps
    if (wasHiddenFor > 10_000) {
      hydrateStoreFromSupabase().catch(console.error);
    }
  }
};
```

This eliminates most of the hydration noise the user experiences during normal use.

---

### 3.7 Clean up the stale `ord-1775919287936` record and harden `confirmPaymentForServedOrder`

**Immediate (one-off):** run this to repair the stale record manually:

```sql
UPDATE orders
   SET status = 'completed'
 WHERE id = 'ord-1775919287936'
   AND status = 'served-unpaid'
   AND pay_later = false
   AND paid_at IS NOT NULL;
```

**Code hardening:** the mutation queue and the direct write both issue an update for the same order, and they can interleave. Two small guards:

1. In `confirmPaymentForServedOrder` (store.ts), send the **full** target state in the direct write, not just the diff, so any reorder ends at the same destination:

   ```ts
   updateOrderInDb(orderId, {
     status: "completed",
     payment,
     paidAt: paidAtISO,
     paidBy: userName,
     payLater: false,
   });
   ```
   (It already does this — but double-check that the mutation queue replay uses the same `changes` object and not an older cached version.)

2. In `enqueueMutation`, if a subsequent mutation supersedes a queued one for the same `orderId`, drop the older one. See [lib/sync.ts](lib/sync.ts) — add a dedup pass keyed by `orderId` that keeps only the latest `order.update`.

---

## 4. Verification plan

After applying the fixes:

1. **Cross-device kitchen sync (the main user-reported bug)**
   - Open the POS on the iPad and the PC side by side, both logged in.
   - On the iPad, create a dine-in order (e.g. Table 4) with two items and hit **Proceed to Payment → Pay Later**.
   - Watch the PC Kitchen Display. The card should appear once, with **all items populated on first paint**. No empty-card flicker, no double re-render.
   - Repeat the same flow for **Proceed to Payment → Cash** (full payment, not Pay Later). Same expectation.

2. **Kitchen → preparing → ready flow**
   - On the iPad, click **Accept** on the new card. The PC should move the card from New → Preparing in one animation, with no flicker.

3. **Billing beep**
   - On the PC, switch to any view that shows the sidebar.
   - On the iPad, create 3 orders in quick succession via New Order → Proceed to Payment. Each should cause **exactly one** billing beep on the PC. None on the iPad (which made the order).

4. **Kitchen beep**
   - On the iPad, take one of those pending-payment orders through to payment. The PC should emit **exactly one** kitchen beep per paid order. The iPad should stay silent for its own payment (optional, from §3.2 own-write skip).

5. **Audio quality over long sessions**
   - Fire ~20 beeps back-to-back (create and pay 20 orders). The sound quality of the 20th beep must be identical to the 1st. No rasp, no dropped notes.

6. **Hydration no-ops don't beep**
   - Switch the PC's browser tab away for 30 seconds, then back. No beep.
   - Toggle airplane mode off and back on to force a reconnect. No beep for the hydration that follows, only for any genuinely new orders created while offline.

7. **Stale record cleanup**
   - Re-run the query from §2.7 and confirm `ord-1775919287936` is now `status = 'completed'`.

8. `npm run build` — must pass.

---

## 5. Files touched

| File | Change |
|---|---|
| [hooks/use-realtime-sync.ts](hooks/use-realtime-sync.ts) | Increase debounce to 400 ms; add shallow-equal skip; own-write guard on `handleOrderItemChange`; hidden-duration gate on visibility refetch |
| [components/pos/sidebar.tsx](components/pos/sidebar.tsx) | Convert beep effects from count-ref to ID-set; lazy-init a shared `AudioContext`; optional own-write skip |
| [components/pos/kitchen-display.tsx](components/pos/kitchen-display.tsx) | Delete unused `playNewOrderSound` |
| [lib/hydrate.ts](lib/hydrate.ts) | Single-flight guard on `hydrateStoreFromSupabase` |
| [lib/sync.ts](lib/sync.ts) | Dedup superseded `order.update` mutations by `orderId` |
| One-off SQL | Repair `ord-1775919287936` in the `orders` table |

## 6. What is NOT being changed

- The **pay-first flow itself** is correct. `awaiting-payment → new → preparing → ready → completed` is sound and the store actions gate transitions properly.
- The **direct write-through pattern** is the right shape. It's what gives the iPad its instant UX. We're just making the receiving side more tolerant of event ordering and making the notification layer less eager.
- **RLS, Edge Functions, Auth** — nothing in the auth / security path is contributing to these symptoms; those layers are fine.
- **Realtime publications** — already enabled on `orders`, `order_items`, `supplementary_bills`, `supplementary_bill_items`, `tables`, `settings`, `staff`. Verified via `pg_publication_tables` for publication `supabase_realtime`.
