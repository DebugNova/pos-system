# Edit Order Functionality — Audit Report

**Date:** 2026-04-17
**Audited by:** Claude Code (Opus 4.6)
**Project:** SUHASHI Cafe POS
**Supabase Project ID:** `ycrwtvtdsbjbhdqyuptq` (ap-south-1)

---

## IMPORTANT: Production Safety Notice

This system is **LIVE in production** — the client is actively using it to run their cafe. **Do NOT clear data, reset tables, run destructive migrations, or break any existing functionality.** All fixes must be additive and backward-compatible. The core order flow (create → pay → kitchen → serve → complete), real-time sync, KDS, and multi-device sync are all working perfectly. Only the "edit order" pathways have bugs.

---

## Executive Summary

The edit order feature has **6 bugs** (3 critical, 3 medium). The core problem: edits update local Zustand state correctly but **fail to sync certain changes to Supabase**. This means some edit data is lost on page reload, invisible to other devices, and can cause financial discrepancies.

**Everything else works perfectly.** The normal order lifecycle, kitchen display, real-time sync, payments, and multi-device coordination are all solid.

---

## How Edit Order Works (Background)

There are two edit modes, determined automatically by order status:

| Mode | When | What happens |
|------|------|-------------|
| **Pre-payment edit** | Order is `awaiting-payment` | Full edit — items can be added/removed/changed, table/type/notes can change. The entire `items` array and `total` are replaced. |
| **Supplementary edit** | Order is `new`, `preparing`, or `ready` (already paid/in kitchen) | Add-only — original items are locked (displayed but not editable). New items create a separate `supplementary_bill` record linked to the order. |

**Code locations:**
- `startEditOrder(orderId)` — `lib/store.ts` line 526 — detects mode, loads cart
- `saveEditOrder()` — `lib/store.ts` line 565 — saves changes (branches at line 572)
- Supplementary bill DB write — `lib/supabase-queries.ts` line 119 (`insertSupplementaryBill`)
- Order-to-DB mapper — `lib/supabase-queries.ts` line 712 (`mapLocalOrderToDb`)

**Sync architecture (for context):**
Every critical action in the app uses a dual-path sync:
1. **Mutation queue** (`enqueueMutation`) → IndexedDB → replayed by `lib/sync.ts` → calls `supabase-queries.ts` functions
2. **Direct write-through** → fire-and-forget Supabase call for instant Realtime broadcast

The edit flow is **missing both paths** in several places.

---

## Bug #1 — CRITICAL: Pre-payment edit does not sync items or total to Supabase

### Location
`lib/store.ts` lines 640–699 (the `else` branch of `saveEditOrder`, after the supplementary `return`)

### What the code does
1. Computes `newTotal` from the cart (line 640)
2. Creates `newItems` array with fresh IDs `oi-${Date.now()}-${index}` (line 644)
3. Replaces `order.items` and `order.total` in Zustand local state (line 658–671)
4. Handles table changes if needed (line 683–690)
5. Writes an audit entry (line 692)
6. Calls `setPendingBillingOrderId()` to redirect to billing (line 699)

### What's missing
- **No `enqueueMutation()` call** — the sync queue never learns about the new items or total
- **No direct write-through** — Supabase is never called
- The old `order_items` rows remain in the `order_items` table untouched
- The `orders.total` column in Supabase still holds the original value

### What happens next in the flow
After the edit, the user goes to billing → pays → `confirmPaymentAndSendToKitchen` fires. This pushes a merged payload to Supabase containing: `status`, `payment`, `paidAt`, `paidBy`, `subtotal` (set from local `o.total`, which IS the edited total), `discount`, `taxRate`, `taxAmount`, `grandTotal`. So the financial columns (`subtotal`, `grand_total`) in the `orders` table ARE correct. But:
- `orders.total` = **stale** (original pre-edit value)
- `order_items` rows = **stale** (original pre-edit items)

### Impact
- On page reload or on any other device, the order shows the **original items** (wrong) but the **correct grand total** (right)
- Order history shows wrong item list
- Receipts printed after reload show wrong items
- Item-level reports/analytics would be inaccurate

### Evidence from Supabase DB
Order `ord-1776254348274` was edited **5 times** (confirmed in `audit_log`), but its `order_items` still have IDs `oi-1776254348274-0` and `oi-1776254348274-1` — timestamps matching the original order creation, proving the edits never reached the DB.

### Fix required
In `saveEditOrder()` pre-payment branch (after line 699), add:
1. A new `supabase-queries.ts` function: `replaceOrderItems(orderId, newItems)` that DELETEs old `order_items` WHERE `order_id = orderId`, then INSERTs the new items
2. A direct write-through calling `updateOrderInDb(orderId, { total: newTotal, type, tableId, customerName, customerPhone, orderNotes })` + `replaceOrderItems(orderId, newItems)`
3. An `enqueueMutation("order.full-edit", { id: orderId, order: fullOrderData })` as offline fallback
4. A corresponding handler in `lib/sync.ts` `sendMutation()` for the new `order.full-edit` kind

---

## Bug #2 — CRITICAL: Supplementary bill payment status never syncs to Supabase (double-billing risk)

### Location
`components/pos/billing.tsx` lines 213–226 (the `else` branch handling supplementary payment)

### What the code does
When a supplementary bill is paid in the billing screen:
```js
// billing.tsx line 214-218
const updatedBills = order.supplementaryBills.map(b =>
  b.payment ? b : { ...b, payment, paidAt: new Date() }
);
updateOrder(selectedOrder, {
  supplementaryBills: updatedBills,   // bills now have payment info
  grandTotal: (order.grandTotal || order.total) + grandTotal
});
```

### The broken chain
1. `updateOrder()` (store.ts line 866) calls `enqueueMutation("order.update", { id, changes: data })` and `updateOrderInDb(orderId, data)`
2. `updateOrderInDb` calls `mapLocalOrderToDb(changes)` (supabase-queries.ts line 163)
3. `mapLocalOrderToDb` (line 712–739) maps field-by-field: `grandTotal` → `grand_total` ✅, but **`supplementaryBills` is not in the mapper** — it's silently dropped ❌
4. Result: `orders.grand_total` IS updated in Supabase, but `supplementary_bills.payment` and `supplementary_bills.paid_at` remain `null`

### Double-billing scenario
1. User pays supplementary bill → `grand_total` in Supabase updated to (original + supp) ✅, but `supplementary_bills.payment` stays `null` ❌
2. Page reloads → order hydrated from Supabase → supplementary bill appears as "Unpaid"
3. Billing screen shows it again (filter at line 90: `o.supplementaryBills.some(b => !b.payment)`)
4. User pays it again → `grandTotal: (alreadyUpdatedGrandTotal) + suppTotal` → **double-counted!**

### Evidence from Supabase DB
Order `ord-1776259131285`: status=`completed`, main payment=75 (UPI), `grand_total=75.00`. Its supplementary bill `3c9507ee...` (total=45.00, item: "Brown butter chocolate chip cookie") has `payment=null`, `paid_at=null`. If this supp bill was paid, the payment was lost. If it wasn't paid, the order was completed with an unpaid bill (see Bug #6 note).

### Fix required
1. Add a new function in `supabase-queries.ts`:
   ```ts
   export async function updateSupplementaryBillPayment(
     billId: string,
     payment: any,
     paidAt: Date
   ): Promise<void> {
     const supabase = getSupabase();
     await supabase.from("supplementary_bills")
       .update({ payment, paid_at: paidAt.toISOString() })
       .eq("id", billId);
   }
   ```
2. In `billing.tsx` supplementary payment path (line 213–226), after `updateOrder`, call `updateSupplementaryBillPayment` for each newly-paid bill as a direct write-through
3. Add an `enqueueMutation("supplementary-bill.payment", { billId, payment, paidAt })` as offline fallback
4. Add the corresponding handler in `lib/sync.ts` `sendMutation()`

---

## Bug #3 — CRITICAL: Supplementary bill creation has no sync queue fallback

### Location
`lib/store.ts` lines 626–634

### What the code does
```js
if (get().supabaseEnabled) {
  import("./supabase-queries").then(({ insertSupplementaryBill }) => {
    insertSupplementaryBill(editingOrderId, newBill).catch(err => {
      console.warn("[store] Direct write failed for supplementary bill, will sync later:", err);
    });
  });
}
```

### What's missing
- **No `enqueueMutation()` call** — the sync queue has no record of this write
- The `console.warn` says "will sync later" but there is **nothing queued to sync later**
- If the direct write fails (offline, network blip, auth expired), the supplementary bill exists only in local Zustand state and localStorage
- On page reload, the bill is lost because Supabase never received it

### Why this matters
Every other critical write in the app (orders, tables, payments, status changes) has the dual-path safety net. This is the only write path that relies solely on a direct write with no fallback.

### Fix required
1. Add `enqueueMutation("supplementary-bill.create", { orderId: editingOrderId, bill: newBill })` right after line 634
2. Add the handler in `lib/sync.ts` that calls `insertSupplementaryBill(orderId, bill)`
3. Mark the mutation as synced if the direct write succeeds (same pattern as other actions)

---

## Bug #4 — MEDIUM: Receipt template missing supplementary bill items

### Location
`components/pos/receipt-template.tsx` — entire file

### Issue
The receipt renders only `order.items` (lines 68–86). There is **zero** handling of `order.supplementaryBills`. Supplementary items don't appear on printed receipts.

### Fix required
Add a "Supplementary Items" section after the main items table, rendering each bill's items. Reference `components/pos/order-history.tsx` lines 396–430 for the pattern (it already renders supplementary bills correctly with headers and item lists).

---

## Bug #5 — MEDIUM: KOT template missing supplementary bill items

### Location
`components/pos/kot-template.tsx` — entire file

### Issue
No reference to `supplementaryBills` anywhere. When a supplementary bill is created for an in-progress order, the printed KOT doesn't include the new items.

**Note:** The KDS screen (`kitchen-display.tsx` lines 555–577) **does** correctly show supplementary items with an "ADD" badge. This bug is only in the print template.

### Fix required
Add supplementary items to the KOT print layout, clearly marked as "ADD-ON" items so the kitchen can distinguish them from the original order.

---

## Bug #6 — MEDIUM: Orders can be completed with unpaid supplementary bills

### Location
`lib/store.ts` `markOrderServed()` (around line 1225)

### Issue
`markOrderServed` flips the order to `completed` without checking if all supplementary bills are paid. An order with unpaid supplementary bills can be completed and archived, leaving revenue uncollected.

### Evidence
Order `ord-1776259131285` is `completed` but has a supplementary bill with `payment=null`.

### Fix required
Add a guard in `markOrderServed`: if `order.supplementaryBills?.some(b => !b.payment)`, either block completion or show a warning. This is a business logic decision — ask the client whether they want a hard block or a soft warning.

---

## What's Working Correctly (Do NOT touch)

| Area | Status | Notes |
|------|--------|-------|
| Normal order lifecycle | PERFECT | create → pay → kitchen → serve → complete |
| `confirmPaymentAndSendToKitchen` | PERFECT | Dual-path sync, merged payload, all financial fields |
| Realtime multi-device sync | PERFECT | Orders, tables, KDS all sync instantly |
| Kitchen Display (KDS) | PERFECT | FIFO, urgency, supplementary "ADD" badges all work |
| `startEditOrder` mode detection | OK | Correctly chooses pre-payment vs supplementary |
| Supplementary bill INSERT to Supabase | OK | `insertSupplementaryBill` works (when online) |
| Supplementary bill display in KDS | OK | Shows "ADD" badge with warning styling |
| Supplementary bill display in Order History | OK | Nested bills with Paid/Unpaid badges |
| Billing supplementary detection | OK | Correctly filters orders with unpaid supp bills |
| Audit logging for edits | OK | Both modes write audit entries |
| Offline mutation queue (for everything except edits) | OK | IndexedDB-backed, reliable |
| Local state updates for edits | OK | Zustand updates are all correct |

---

## Supabase DB Evidence (snapshot from 2026-04-17)

### Orders with supplementary bills
| Order ID | Status | Total | Grand Total | Supp Bill Total | Supp Payment |
|----------|--------|-------|-------------|-----------------|-------------|
| `ord-1776266911511` | served-unpaid | 160.00 | null | 160.00 | null |
| `ord-1776259131285` | completed | 75.00 | 75.00 | 45.00 | **null (Bug #2 or #6)** |

### Pre-payment edited orders (audit confirms edits, DB items unchanged)
| Order ID | Edit Count | DB Item IDs | Conclusion |
|----------|-----------|-------------|------------|
| `ord-1776254348274` | 5 | `oi-1776254348274-0`, `-1` | Items never synced (Bug #1) |
| `ord-1776265487546` | 1 | `oi-1776265487546-0`, `-1` | Items never synced (Bug #1) |
| `ord-1776260501215` | 1 | `oi-1776260501215-0`, `-1` | Items never synced (Bug #1) |

---

## Fix Priority Order

| Priority | Bug | Risk | Effort |
|----------|-----|------|--------|
| 1 | **#2** — Supp bill payment sync | Double-billing risk | Small (new query function + 2 call sites) |
| 2 | **#1** — Pre-payment edit sync | Wrong items on reload | Medium (new query function + sync handler) |
| 3 | **#3** — Supp bill creation fallback | Data loss offline | Small (add enqueueMutation + sync handler) |
| 4 | **#4** — Receipt supp items | Customer-facing | Small (template addition) |
| 5 | **#5** — KOT supp items | Kitchen workflow | Small (template addition) |
| 6 | **#6** — Complete with unpaid bills | Revenue leakage | Small (guard in markOrderServed) |

---

## Files That Need Changes

| File | Changes Needed |
|------|---------------|
| `lib/store.ts` | Bug #1: Add sync to `saveEditOrder` pre-payment path. Bug #3: Add `enqueueMutation` for supp bill creation. Bug #6: Add guard to `markOrderServed`. |
| `lib/supabase-queries.ts` | Bug #1: Add `replaceOrderItems()`. Bug #2: Add `updateSupplementaryBillPayment()`. |
| `lib/sync.ts` | Bug #1: Handle `order.full-edit`. Bug #2: Handle `supplementary-bill.payment`. Bug #3: Handle `supplementary-bill.create`. |
| `lib/data.ts` | Add new `MutationKind` types: `order.full-edit`, `supplementary-bill.create`, `supplementary-bill.payment` |
| `components/pos/billing.tsx` | Bug #2: Call `updateSupplementaryBillPayment` after payment. |
| `components/pos/receipt-template.tsx` | Bug #4: Render supplementary bill items. |
| `components/pos/kot-template.tsx` | Bug #5: Render supplementary bill items. |

---

## Detailed Fix Plan

### Step 1: Add new Supabase query functions (`lib/supabase-queries.ts`)

```ts
// Bug #1: Replace all order_items for an order
export async function replaceOrderItems(orderId: string, newItems: OrderItem[]): Promise<void> {
  const supabase = getSupabase();
  // Delete old items
  await supabase.from("order_items").delete().eq("order_id", orderId);
  // Insert new items
  if (newItems.length > 0) {
    const dbItems = newItems.map(item => ({ ...mapLocalItemToDb(item), order_id: orderId }));
    await supabase.from("order_items").upsert(dbItems, { onConflict: "id" });
  }
}

// Bug #2: Update supplementary bill payment
export async function updateSupplementaryBillPayment(
  billId: string, payment: any, paidAt: Date
): Promise<void> {
  const supabase = getSupabase();
  await supabase.from("supplementary_bills")
    .update({ payment, paid_at: paidAt.toISOString() })
    .eq("id", billId);
}
```

### Step 2: Add sync to `saveEditOrder` pre-payment path (`lib/store.ts`)
After the `set()` call (line 681), add direct write-through + mutation queue entry for the order fields AND item replacement.

### Step 3: Add sync to supplementary bill payment (`components/pos/billing.tsx`)
After `updateOrder` on line 218, iterate over the newly-paid bills and call `updateSupplementaryBillPayment` for each.

### Step 4: Add `enqueueMutation` to supplementary bill creation (`lib/store.ts`)
After line 634, add `get().enqueueMutation("supplementary-bill.create", { orderId, bill: newBill })`.

### Step 5: Add sync handlers (`lib/sync.ts`)
Handle the three new mutation kinds in `sendMutation()`.

### Step 6: Add new MutationKind types (`lib/data.ts`)
Add `"order.full-edit"`, `"supplementary-bill.create"`, `"supplementary-bill.payment"` to the `MutationKind` type.

### Step 7: Update receipt and KOT templates
Add supplementary bill rendering to both print templates.

### Step 8: Add guard to `markOrderServed` (`lib/store.ts`)
Check for unpaid supplementary bills before allowing completion.

### Step 9: Run `npm run build` and verify no type errors.

---

## Testing Checklist (after fixes)

- [ ] Create order → edit items pre-payment → pay → reload → items match edit
- [ ] Create order → edit items pre-payment → check other device → items match
- [ ] Create order → pay → add supplementary bill → check Supabase `supplementary_bills` table → row exists
- [ ] Pay supplementary bill → check Supabase `supplementary_bills.payment` → not null
- [ ] Pay supplementary bill → reload → bill does NOT reappear in billing screen
- [ ] Go offline → add supplementary bill → go online → sync runs → bill appears in Supabase
- [ ] Print receipt for order with supplementary bill → supplementary items visible
- [ ] Print KOT for order with supplementary bill → new items visible
- [ ] Try to mark order as served with unpaid supplementary bill → warning/block appears
- [ ] Normal order flow (no edits) still works exactly as before
- [ ] KDS still shows all orders correctly
- [ ] Multi-device sync still works
