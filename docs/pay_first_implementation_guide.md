# Pay-First Flow Implementation Guide — Task by Task

> For: AI Agent (Claude Code)
> Project: SUHASHI Cafe POS
> Date: 2026-04-10
> Scope: Frontend-only. No backend. Rewire the order lifecycle so the **kitchen never sees an order until payment is complete**.
> Spec source: [docs/pay-first-flow.md](pay-first-flow.md) — read that first; this guide is the executable breakdown.
> Backend plan: Phase 3 migrates this flow to Supabase RPCs (see §8 of the spec). Keep data models flat, use string UUIDs, ISO 8601 dates.

---

## Why This Work Exists

Today's flow creates an order, locks the table, and pushes it to the kitchen **before** the customer has paid. Consequences:

- Food gets cooked for customers who walk out → waste.
- Tables are locked prematurely and cannot be reassigned if the customer cancels.
- There is no financial gate between "order placed" and "kitchen committed".

The new flow inserts a **payment stop** between "order placed" and "kitchen sees it". Tables are *soft-locked* as `waiting-payment` the moment the order is placed, and only flip to `occupied` once payment succeeds. Aggregator (Swiggy/Zomato) orders are pre-paid and bypass this stop entirely.

**New canonical flow:**
```
Select type → Choose table/customer → Add items + modifiers
  → Proceed to Payment → Take payment → Print receipt
  → Send to Kitchen (KOT) → Prepare → Ready → Mark Served → Close
```

**New status lifecycle:**
```
awaiting-payment → new → preparing → ready → completed
                ↘ cancelled (at any pre-served stage)
```

---

## Pre-Work Checklist

Before starting ANY task:
- [ ] Run `npm run build` to confirm the project compiles cleanly.
- [ ] Read [lib/store.ts](../lib/store.ts), [lib/data.ts](../lib/data.ts) — understand the current `addOrder`, `updateOrderStatus`, `auditLog`, and `CartItem` / `OrderItem` shapes.
- [ ] Read [docs/pay-first-flow.md](pay-first-flow.md) end-to-end. Section 3 (Design Decisions) is **locked** — do not re-litigate.
- [ ] Bump `STORE_VERSION` when changing the persisted state shape (new fields on `Order`, new top-level state like `pendingBillingOrderId`).
- [ ] Update `partialize` when adding persisted fields.
- [ ] Handle Date serialization in `onRehydrateStorage` for any new Date fields (`paidAt` on supplementary bills, etc.).
- [ ] After every task, run `npm run build`.
- [ ] After Tasks 1–6, run the scenarios in §7 of the spec. Do not defer manual testing to the end.

---

## Task 1: Extend Types (`OrderStatus`, `AuditEntry.action`, `Order.supplementaryBills`)

**Goal:** Introduce the new `awaiting-payment` status, the new audit action types, and a slot for supplementary bills. This is a pure type change — nothing should break at runtime yet.

**Current state:**
- [lib/data.ts](../lib/data.ts) — `OrderStatus` is `"new" | "preparing" | "ready" | "completed" | "cancelled"`. No `awaiting-payment`.
- `AuditEntry.action` union is missing `order_sent_to_kitchen`, `order_served`, `payment_recorded`, `status_changed`.
- `Order` has no `supplementaryBills` field.
- `Table.status` already includes `"waiting-payment"` — no change needed.

**What to do:**

1. **Extend `OrderStatus`** in [lib/data.ts](../lib/data.ts):
   ```ts
   export type OrderStatus =
     | "awaiting-payment"   // NEW — placed, unpaid, NOT visible to kitchen
     | "new"                // paid, visible in KDS, not yet started
     | "preparing"
     | "ready"
     | "completed"          // served + closed
     | "cancelled";
   ```

2. **Extend `AuditEntry.action`** to include the four new actions:
   ```ts
   action:
     | "login" | "logout"
     | "refund" | "void" | "discount"
     | "order_created" | "order_edited"
     | "order_sent_to_kitchen"   // NEW
     | "order_served"            // NEW
     | "payment_recorded"        // NEW
     | "status_changed"          // NEW
     | "data_clear" | "data_import"
     | "settings_changed"
     | "staff_added" | "staff_deleted";
   ```

3. **Add the `supplementaryBills` field** to the `Order` interface (optional):
   ```ts
   export interface Order {
     // ... existing fields ...
     supplementaryBills?: {
       id: string;
       items: OrderItem[];
       total: number;
       createdAt: Date;
       paidAt?: Date;
       payment?: PaymentRecord;
     }[];
   }
   ```

4. **Do NOT touch `Table.status`** — `"waiting-payment"` already exists.

5. **Bump `STORE_VERSION`** in [lib/store.ts](../lib/store.ts). Add a migration branch in `onRehydrateStorage` that handles old persisted orders without `supplementaryBills` (they'll simply be `undefined` — no data change needed, but bump the version so the migration path is logged).

**Verification:**
- `npm run build` passes with no type errors.
- Any existing switch/case on `OrderStatus` that doesn't handle `"awaiting-payment"` surfaces as an exhaustiveness warning or build error — note those files; they will be touched in later tasks.
- Persisted orders from the pre-existing app still load without crashing.

---

## Task 2: Rewrite Store Actions (`addOrder`, `confirmPaymentAndSendToKitchen`, `cancelAwaitingPaymentOrder`, `markOrderServed`, `updateOrderStatus`)

**Goal:** The store becomes the single source of truth for the new lifecycle. Every state transition is atomic and writes an audit entry.

**Current state:**
- [lib/store.ts:451-474](../lib/store.ts#L451-L474) — `addOrder` creates orders with `status: "new"` and immediately marks the table `"occupied"`.
- `updateOrderStatus` only writes an audit entry on `completed` — other transitions are silent.
- No `confirmPaymentAndSendToKitchen`, `cancelAwaitingPaymentOrder`, or `markOrderServed` actions.
- No `pendingBillingOrderId` state to hand off a just-placed order from New Order to Billing.

**What to do:**

1. **Modify `addOrder`:**
   - Default `status` → `"awaiting-payment"`.
   - For dine-in orders, set the picked table to `"waiting-payment"` (NOT `"occupied"`).
   - Keep the existing `order_created` audit entry.
   - **Return the new order id** so callers (New Order) can stash it in `pendingBillingOrderId`.

2. **Add `pendingBillingOrderId` state:**
   ```ts
   pendingBillingOrderId: string | null;
   setPendingBillingOrderId: (id: string | null) => void;
   ```
   Add it to `partialize` only if you want it to survive a hard reload mid-handoff — recommended: **yes**, so a reload between New Order and Billing still auto-selects the order.

3. **Add `confirmPaymentAndSendToKitchen(orderId, payment)` — NEW action.** Called by Billing on successful payment. Must be atomic (single `set` call where possible):
   1. Set order `status` → `"new"`.
   2. Write `payment` (PaymentRecord from Task 3 of Phase 1), `paidAt`, `paidBy`, `subtotal`, `taxRate`, `taxAmount`, `grandTotal` onto the order.
   3. If dine-in, set the order's table `status` → `"occupied"`.
   4. Write audit: `payment_recorded` (`details`: method, amount, txn id, cashier).
   5. Write audit: `order_sent_to_kitchen` (`details`: order id, table, sentBy).

4. **Add `cancelAwaitingPaymentOrder(orderId, reason?)` — NEW action.** Called when a customer walks away / Billing's Void button is pressed:
   1. Set order `status` → `"cancelled"`.
   2. If dine-in, release the table → `"available"`.
   3. Write audit: `void` (`details`: reason if provided, userId).
   4. Do **not** remove the order from `orders` — keep it for history & audit.

5. **Add `markOrderServed(orderId)` — NEW action.** Called by KDS "Mark Served":
   1. Set order `status` → `"completed"`.
   2. Release the table → `"available"`.
   3. Write audit: `order_served` (`details`: order id, table, servedBy).
   4. Preserve the existing auto-release-table-on-completed behavior if any — `markOrderServed` should be the only path to `completed` going forward.

6. **Patch `updateOrderStatus`:**
   - On every transition, write a `status_changed` audit entry with `metadata: { fromStatus, toStatus }`.
   - **Remove the `completed` transition path** from `updateOrderStatus` — that now lives in `markOrderServed`. `updateOrderStatus` should only handle `new → preparing` and `preparing → ready`. Attempting to move an order to `"completed"` via `updateOrderStatus` should be a no-op or a dev-time warning.
   - Attempting to move from `"awaiting-payment"` to anything other than `"new"` (via `confirmPaymentAndSendToKitchen`) or `"cancelled"` (via `cancelAwaitingPaymentOrder`) should also be a no-op.

7. **`saveEditOrder` safety:** ensure it cannot accidentally flip an `awaiting-payment` order into the kitchen by overwriting `status`. If the loaded order is `awaiting-payment`, editing must preserve that status. (Full supplementary-cart logic lands in Task 7.)

**Verification:**
- Place an order via the existing New Order button → inspect the store in devtools → order is `"awaiting-payment"`, table is `"waiting-payment"`.
- Call `confirmPaymentAndSendToKitchen` from the devtools console → order flips to `"new"`, table to `"occupied"`, two audit entries appear (`payment_recorded`, `order_sent_to_kitchen`).
- Call `cancelAwaitingPaymentOrder` on another placed order → order `"cancelled"`, table `"available"`, `void` audit entry.
- Every KDS status change now writes a `status_changed` audit entry.

---

## Task 3: New Order Screen — Collapse to "Proceed to Payment"

**Goal:** Remove the "Send to Kitchen" / "Place Order" dichotomy. There is one CTA now: **Proceed to Payment**. After placing the order, navigate to Billing (not Kitchen).

**Current state:**
- [components/pos/new-order.tsx:158-208](../components/pos/new-order.tsx#L158-L208) — `handlePlaceOrder` and `handleSendToKitchen` both exist, both create an order with `status: "new"`, both navigate to `kitchen`.
- [components/pos/new-order.tsx:254-259](../components/pos/new-order.tsx#L254-L259) — `Ctrl+Shift+Enter` variant shortcut exists alongside `Ctrl+Enter`.
- The main CTA label says "Send to Kitchen" or similar.

**What to do:**

1. **Delete `handleSendToKitchen` entirely.** There is only one path.

2. **Rename and simplify `handlePlaceOrder` → `handleProceedToPayment`:**
   - Calls `addOrder(...)` (which now returns the new order id and creates with `awaiting-payment`).
   - Calls `setPendingBillingOrderId(newId)`.
   - Navigates to the `billing` view (NOT `kitchen`).
   - Clears the cart.

3. **Collapse keyboard shortcuts:** keep `Ctrl+Enter` → `handleProceedToPayment`. Remove `Ctrl+Shift+Enter`.

4. **Update all UI copy:**
   - Main CTA label → **"Proceed to Payment"**.
   - Disabled-state copy (empty cart, no table, etc.) → "Add items to proceed to payment", "Select a table to proceed", etc.
   - Any hint text about sending to kitchen → remove or rewrite.

5. **Aggregator orders in New Order screen:** if there's any path to create a Swiggy/Zomato order from this screen (unlikely — they come from the inbox), leave it unchanged. Aggregator handling is Task 10.

**Verification:**
- Build an order in New Order → click "Proceed to Payment" → you land on Billing, the order is auto-selected, the order is NOT in KDS.
- `Ctrl+Enter` fires the same flow.
- The picked table shows as "Awaiting Payment" in Table Management.

---

## Task 4: Billing Screen — New Filter, Auto-Select, Confirm-on-Pay, Void Button, Auto-Print

**Goal:** Billing is now the payment gate. It shows only `awaiting-payment` orders, auto-selects the one just placed, commits payment through the new atomic store action, prints the receipt automatically, and exposes a Void button for walk-aways.

**Current state:**
- [components/pos/billing.tsx:70-72](../components/pos/billing.tsx#L70-L72) — filter is `status === "ready" || "preparing"` (already-cooking orders).
- `handleCompleteBilling` calls `updateOrderStatus(id, "completed")`.
- There is no auto-select on mount.
- There is no Void button.
- Receipt printing (Phase 1 Task 6) exists via `receipt-template.tsx` but is manual.

**What to do:**

1. **Flip the filter:**
   ```ts
   const pendingPaymentOrders = orders.filter(
     (o) => o.status === "awaiting-payment"
   );
   ```
   Rename any UI labels from "Ready for Billing" / "Preparing" → "Awaiting Payment".

2. **Auto-select on mount:**
   - In a `useEffect`, read `pendingBillingOrderId` from the store.
   - If set, call `setSelectedOrder(order)` and then `setPendingBillingOrderId(null)` to clear the handoff.
   - If the id no longer corresponds to an `awaiting-payment` order (e.g. someone voided it from another screen), just clear the flag silently.

3. **Rewire `handleCompleteBilling`:**
   - Build the `PaymentRecord` (from Phase 1 Task 3 — method, amount, txn id, split details) as today.
   - Replace `updateOrderStatus(id, "completed")` with `confirmPaymentAndSendToKitchen(id, paymentRecord)`.
   - On success, auto-print the customer receipt (step 4 below), then navigate to Dashboard or clear the selection.

4. **Auto-print receipt on payment success:**
   - After `confirmPaymentAndSendToKitchen` resolves, if `settings.printCustomerCopy` is true, call the existing print utility (from Phase 1 Task 6) with the receipt template.
   - The receipt must include: order id, items, subtotal, discount, tax, grand total, payment method, txn id, cashier name, timestamp — already wired in [components/pos/receipt-template.tsx](../components/pos/receipt-template.tsx).

5. **Add a "Void Order" button** on the billing panel, visible only when an `awaiting-payment` order is selected:
   - On click, open an AlertDialog (confirmation, with optional reason textarea).
   - On confirm, call `cancelAwaitingPaymentOrder(orderId, reason)`.
   - Clear the selection and show a toast.
   - This is the mechanism that releases the `waiting-payment` table back to `available`.

6. **Refund flow — unchanged.** Refund still applies to `completed` orders only, and it lives in Order History, not Billing. Do not re-route it.

**Verification:**
- Placing an order from New Order auto-lands on Billing with the order selected.
- Completing payment flips the order to `"new"`, the table to `"occupied"`, auto-prints the receipt, and the order now appears in KDS.
- Clicking Void on an `awaiting-payment` order cancels it and frees the table. The order never reaches KDS.
- Reloading the page mid-billing-handoff (after `pendingBillingOrderId` is set but before payment) still auto-selects the order.

---

## Task 5: Kitchen Display — Rename Ready Action to "Mark Served"

**Goal:** KDS's Ready-column action must call the new `markOrderServed` action with the explicit label **"Mark Served"**. Every other KDS transition writes a `status_changed` audit entry via the patched `updateOrderStatus`.

**Current state:**
- [components/pos/kitchen-display.tsx:103-124](../components/pos/kitchen-display.tsx#L103-L124) — the Ready-column button calls `updateOrderStatus(id, "completed")`.
- Button label is likely "Complete" or "Done".
- The KDS filter is already `new | preparing | ready` — **do not change it**. With Task 2 + 3 in place, `awaiting-payment` orders never reach the KDS by construction.

**What to do:**

1. **Rename the Ready-column button** to **"Mark Served"**. Do not use "Complete", "Done", or "Close".

2. **Rewire the button handler** from `updateOrderStatus(id, "completed")` to `markOrderServed(id)`.

3. **Leave `new → preparing` and `preparing → ready` buttons as-is** — they still call `updateOrderStatus`, which now writes a `status_changed` audit entry for every transition (Task 2).

4. **Do NOT add `"awaiting-payment"` to any KDS filter or column.** This is called out explicitly in CLAUDE.md.

5. **Optional polish:** if the KDS shows a column count like "Ready (3)", the new label for the action button should read "Mark Served" regardless of the column header.

**Verification:**
- Run through the full flow: place → pay → KDS shows the order in "New" → click to Preparing → click to Ready → click "Mark Served" → order moves to Order History as `completed`, table is freed.
- Audit log shows: `order_created`, `payment_recorded`, `order_sent_to_kitchen`, `status_changed (new→preparing)`, `status_changed (preparing→ready)`, `order_served`.
- No `awaiting-payment` order ever appears on the KDS.

---

## Task 6: Table Management — Relabel & Make Waiting-Payment Tables Clickable

**Goal:** `waiting-payment` tables are labeled clearly as "Awaiting Payment", and tapping one jumps straight back into Billing for that order — so a server who stepped away can resume the bill.

**Current state:**
- [components/pos/table-management.tsx:36](../components/pos/table-management.tsx#L36) — `waiting-payment` is labeled "Payment".
- [components/pos/table-management.tsx:163](../components/pos/table-management.tsx#L163) — explanatory text / legend uses the same short label.
- Clicking a `waiting-payment` table currently does nothing (or treats it like an occupied table).
- [components/pos/new-order.tsx:303](../components/pos/new-order.tsx#L303) — the table picker already treats `waiting-payment` as unavailable (via `isOccupied`). **Leave that alone.**

**What to do:**

1. **Relabel** `waiting-payment` from "Payment" → **"Awaiting Payment"** in the status label and any legend/explanatory text.

2. **Make `waiting-payment` tables clickable:**
   - On click, find the order whose `tableId` matches and whose `status === "awaiting-payment"`.
   - Call `setPendingBillingOrderId(order.id)`.
   - Navigate to `billing`.
   - If no such order exists (shouldn't happen — data corruption), show a toast and leave the table state alone (don't auto-heal it here; surface the bug instead).

3. **Keep the visual treatment distinct** — `waiting-payment` tables should look different from `occupied` ones (e.g. amber/pending tint vs red/committed). Do not reuse the same color.

4. **Do not modify the `isOccupied` check** in New Order's table picker — it already correctly excludes `waiting-payment` tables.

**Verification:**
- A `waiting-payment` table is labeled "Awaiting Payment" and visually distinct from `occupied`.
- Clicking it jumps to Billing with the order auto-selected.
- That same table cannot be picked for a new order in New Order.

---

## Task 7: Edit-After-Payment — Supplementary Cart Mode

**Goal:** Post-payment edits are tightly scoped. Adding items creates a supplementary bill + supplementary KOT. Removing items is admin-only and triggers a partial refund. Pre-payment edits are unchanged (fully editable).

This is the most complex task in the guide. Read §4.7 of the spec carefully before starting.

**Current state:**
- `startEditOrder` / `saveEditOrder` in [lib/store.ts](../lib/store.ts) load and save the entire `order.items` array wholesale, with no notion of "locked" pre-existing items.
- The cart UI in New Order has no concept of supplementary mode.
- There is no supplementary bill rendering in Billing or Order History.

**What to do:**

1. **Supplementary mode flag in the store:**
   ```ts
   editMode: "none" | "pre-payment" | "supplementary";
   lockedItemIds: string[];   // for supplementary mode — original items that cannot be modified
   ```
   `startEditOrder` sets the mode based on the loaded order's status:
   - `awaiting-payment` → `"pre-payment"` (full edit, existing behavior).
   - `new | preparing | ready` → `"supplementary"` (cart loads with all original items marked locked).
   - `completed | cancelled` → refuse to enter edit mode (read-only).

2. **Cart UI updates in New Order:**
   - In `"supplementary"` mode, render locked items with a lock icon and disabled +/- quantity controls.
   - Only newly-added items (not present in `lockedItemIds`) can be modified or removed.
   - Show a visible banner: "Adding items to existing order #{orderId}. Original items are locked. Customer will be charged a supplementary bill."
   - The CTA changes to **"Add Supplementary Bill"** (not "Proceed to Payment" — the supplementary bill is paid separately, but for the first implementation pass it can still route through Billing with a supplementary total).

3. **`saveEditOrder` in supplementary mode:**
   - Do NOT overwrite `order.items`.
   - Compute the new items (items in the current cart that are NOT in `lockedItemIds`).
   - Append a new entry to `order.supplementaryBills`:
     ```ts
     {
       id: crypto.randomUUID(),
       items: newItems,
       total: computedTotal,
       createdAt: new Date(),
     }
     ```
   - **Do NOT change `order.status`.** The kitchen keeps cooking the original.
   - Write audit: `order_edited` with `metadata: { mode: "supplementary", addedItems: [...] }`.
   - Route the user to Billing (or an inline mini-billing) to collect payment for the supplementary bill. On payment success, set `paidAt` and `payment` on the supplementary bill entry and write `payment_recorded`.
   - Dispatch the supplementary items to the kitchen — they should render on KDS with a visible `+ADD` marker tied to the parent order. (Simplest implementation: render them as additional line items in the same KDS card, visually flagged.)

4. **Admin force-remove (post-payment):**
   - Gate behind `currentUser.role === "Admin"`.
   - Add a "Remove Item (Admin)" button next to each locked item in supplementary mode — visible only to Admin.
   - On click, open an AlertDialog confirming the partial refund.
   - On confirm:
     - Remove the item from `order.items`.
     - Compute the refund amount (item price × qty, plus proportional tax).
     - Call the existing refund flow (or write directly to `order.refund`) and write an audit entry: `refund` with `metadata: { reason: "admin_force_remove", itemId, amount }`.

5. **Permission gates (§4.7 table):**
   | State | Can edit | Can remove items | Can add items |
   |---|---|---|---|
   | `awaiting-payment` | Anyone w/ order-create | Yes | Yes |
   | `new / preparing / ready` | Cashier, Admin | Admin only (→ refund) | Yes (→ supplementary) |
   | `completed` | Admin only | No | No (refund-only flow) |
   | `cancelled` | No one | — | — |

6. **Billing display:** when showing an order, also list any supplementary bills with their own totals and payment status.

**Verification:**
- Pre-payment edit: load an `awaiting-payment` order → cart is fully editable → saving overwrites `order.items`. No supplementary bill created.
- Post-payment edit as Cashier: load a `preparing` order → original items are locked → add a new item → save → `order.items` is unchanged, `supplementaryBills` has a new entry, audit shows `order_edited` with `mode: "supplementary"`.
- Post-payment edit as Cashier: try to remove a locked item → the control is disabled.
- Post-payment edit as Admin: remove a locked item → partial refund processed, audit shows `refund`.
- KDS shows supplementary items flagged on the original order's card.

---

## Task 8: Order History — Filter Out Awaiting-Payment, Show Cancelled, Nest Supplementary Bills

**Goal:** Order History is the archive of *finalized* orders. In-progress `awaiting-payment` orders should not clutter it. Cancelled orders stay visible for traceability. Supplementary bills are shown nested under their parent order.

**Current state:**
- [components/pos/order-history.tsx](../components/pos/order-history.tsx) likely shows all orders regardless of status.
- No nesting of supplementary bills.
- Cancelled orders may or may not be surfaced clearly.

**What to do:**

1. **Filter out `awaiting-payment` orders** — they live in Billing, not History. If a status filter UI exists, remove `awaiting-payment` from the available options.

2. **Keep `cancelled` orders visible** with a distinct visual treatment (red badge, struck-through style, or a "Voided" label). A cashier should be able to see that a void happened, who did it, and when.

3. **Nest `supplementaryBills`:**
   - In the order detail panel (or expanded row), render each supplementary bill as a sub-row with its own items, total, and payment status.
   - Show the total as: `Original Total + Supplementary Totals = Grand Total`.

4. **Refund indicator:** if `order.refund` exists (Phase 1 Task 4), show the refund amount and reason.

5. **Audit drill-down (optional):** clicking an order can surface its audit trail (all entries where `orderId === order.id`). Useful for debugging the pay-first flow.

**Verification:**
- `awaiting-payment` orders never appear in Order History.
- A voided order appears with a clear "Voided" label.
- A completed order with two supplementary bills shows all three totals nested.
- Refunded orders show the refund info.

---

## Task 9: Dashboard — Awaiting Payment Stat Card

**Goal:** The Dashboard gets a new at-a-glance card for orders waiting to be paid. Existing stats are audited to make sure they reflect the new status lifecycle.

**Current state:**
- [components/pos/dashboard.tsx](../components/pos/dashboard.tsx) likely has cards for "Today's Sales", "Pending Orders", "Active Tables", etc.
- "Today's Sales" should already filter on `completed` but may be double-counting.
- "Pending Orders" may currently include `new | preparing | ready` — and must NOT include `awaiting-payment` once that status exists.

**What to do:**

1. **Add "Awaiting Payment" stat card:**
   - Count = `orders.filter(o => o.status === "awaiting-payment").length`.
   - Visual: amber/pending color, coin/wallet icon.
   - Click → navigate to Billing.
   - If count is 0, show "0" with a muted style (don't hide the card).

2. **Audit "Today's Sales":**
   - Must count only `orders.filter(o => o.status === "completed" && isToday(o.createdAt))`.
   - Use `grandTotal` (from Phase 1 Task 3), not `total`.
   - Should NOT include `cancelled` or `refunded` orders. If refunded, subtract the refund amount.

3. **Audit "Pending Orders":**
   - Must count `new | preparing | ready` only.
   - Must NOT include `awaiting-payment` (those are financial-pending, not kitchen-pending).

4. **Audit "Active Tables":**
   - Should count `occupied + waiting-payment` — both represent tables that can't be reassigned.
   - If the dashboard distinguishes them, great. If not, combining them is fine as long as the count is accurate.

**Verification:**
- Place 2 orders without paying → "Awaiting Payment" card shows 2.
- Pay one → it flips to 1, "Pending Orders" flips up by 1.
- Mark the paid one served → "Today's Sales" increments by its grand total, "Pending Orders" flips back down.
- Clicking "Awaiting Payment" jumps to Billing.

---

## Task 10: Aggregator Inbox — Verify Pre-Paid Bypass

**Goal:** Aggregator (Swiggy/Zomato) orders are already pre-paid by the platform. They must bypass the `awaiting-payment` gate entirely and land directly on the KDS with `status: "new"`.

**Current state:**
- [components/pos/aggregator-inbox.tsx](../components/pos/aggregator-inbox.tsx) has an accept handler that creates orders.
- Before Task 2, this handler likely calls `addOrder` — which now defaults to `awaiting-payment`. **That would break aggregator orders.** This task fixes it.

**What to do:**

1. **Audit the existing accept handler.** If it calls `addOrder(...)` with no status override, it will now create `awaiting-payment` orders — wrong.

2. **Option A (preferred):** extend `addOrder` to accept an optional `initialStatus` parameter:
   ```ts
   addOrder: (order: NewOrderInput, opts?: { initialStatus?: OrderStatus; skipTableLock?: boolean }) => string;
   ```
   Aggregator inbox calls it with `initialStatus: "new"` and `skipTableLock: true`.

3. **Option B:** create a dedicated `addAggregatorOrder` store action that:
   - Creates the order with `status: "new"`.
   - Does NOT touch tables (aggregator orders are takeaway/delivery).
   - Writes audits: `order_created`, `payment_recorded` (method: "platform", payer: "swiggy" | "zomato"), `order_sent_to_kitchen`.

4. **Wire the aggregator inbox's accept button** to use the chosen path.

5. **Verify the reject flow** writes a `void` audit entry.

**Verification:**
- Accept a Swiggy order from the inbox → it appears immediately on KDS as `new`, NOT in Billing.
- Audit log shows the three entries: `order_created`, `payment_recorded`, `order_sent_to_kitchen`.
- Rejecting an order writes a `void` entry and removes it from the inbox.

---

## Task 11: Documentation — Update CLAUDE.md and remaining_work.md

**Goal:** Keep the codebase's source-of-truth docs in sync with the new flow.

**Current state:**
- [CLAUDE.md](../CLAUDE.md) already has a "Pay-First Order Flow" section marked `[TODO]` and a "Notes for AI Agents" entry calling out the KDS filter rule. These are mostly right but should be moved from `[TODO]` to `[DONE]` after implementation.
- [docs/remaining_work.md](remaining_work.md) may have gap-list items covering "payment before kitchen" or "table locking before payment".

**What to do:**

1. **Update CLAUDE.md:**
   - Flip `[TODO]` → `[DONE]` on the "Pay-First Order Flow" bullet in "Key Features Still Needed".
   - Confirm the "Order Flow" section already reflects the new canonical flow (it does as of 2026-04-10).
   - Confirm the "Pay-first flow" note under "Notes for AI Agents" is still accurate.

2. **Update `docs/remaining_work.md`:**
   - Cross off any items related to "payment before kitchen", "soft-locked table", "supplementary KOT", "mark served button", or "awaiting-payment status".
   - If any item describes a piece of this flow that remains unimplemented (e.g. supplementary KOT marker on KDS cards), leave it open.

3. **Optional:** link to [docs/pay-first-flow.md](pay-first-flow.md) and this guide from `remaining_work.md` for future agents.

**Verification:**
- A future agent reading CLAUDE.md knows the pay-first flow is live.
- `remaining_work.md` no longer double-tracks items that this guide has closed out.

---

## Task 12: Manual Test Pass

**Goal:** Run through the full §7 test matrix from the spec. This is not optional — some scenarios can only be caught end-to-end (e.g. page reload mid-handoff, void releases the table).

**What to do:**

Execute every row from [docs/pay-first-flow.md §7](pay-first-flow.md) and confirm:

1. Dine-in order → Proceed to Payment → T1 = Awaiting Payment, order in Billing only, audit: `order_created`, auto-selected in Billing.
2. Cash payment → receipt auto-prints, order = `new`, T1 = `occupied`, order in KDS, audit: `payment_recorded` + `order_sent_to_kitchen`.
3. KDS: new → preparing → ready → Mark Served. Audit: `status_changed` ×2 then `order_served`. Order in History, T1 = `available`.
4. Place order → Void Order in Billing. Order = `cancelled`, T1 = `available`, audit: `void`. Never in KDS.
5. Takeaway through full flow — same as 1–3 minus table transitions.
6. Accept Swiggy from inbox → straight to KDS as `new`. Audit: `order_created` + `payment_recorded` + `order_sent_to_kitchen`.
7. Pick T1 for a new order while T1 is `waiting-payment` → T1 is unavailable.
8. Click a `waiting-payment` table in Table Management → jumps to Billing with that order selected.
9. Refund a completed order → existing flow works, audit: `refund`.
10. Reload the page at each state — state survives via localStorage.
11. Offline: place, pay, serve, reload — mutations replay cleanly (Phase 2 offline queue).
12. Post-payment edit (Cashier adds a coffee) → supplementary KOT, supplementary bill, original status untouched, audit: `order_edited` with `mode: "supplementary"`.
13. Post-payment edit (Cashier removes item) → blocked, locked UI.
14. Post-payment edit (Admin removes item) → partial refund, audit: `refund`.
15. Dashboard: "Awaiting Payment" reflects pending bills, "Today's Sales" only counts `completed`.

**Bug-fix policy:** if a test fails, fix it in the task it belongs to (e.g. if #8 fails, reopen Task 6). Do not batch fixes into a "miscellaneous" task.

---

## Implementation Order (Recommended)

Follow this order. Each step compiles and runs on its own.

```
Task 1  (Extend types)                 ← Foundation, no runtime change
Task 2  (Store actions)                ← Atomic lifecycle logic + pendingBillingOrderId
Task 3  (New Order → Proceed to Payment) ← Entry point of the new flow
Task 4  (Billing — filter, auto-select, confirm, void, print) ← Payment gate
Task 5  (KDS — Mark Served)            ← Exit to completed
Task 6  (Table Management — relabel + clickable) ← UX polish, unblocks resume-bill
Task 10 (Aggregator Inbox bypass)      ← Do early — Task 2 breaks aggregator orders by default
Task 9  (Dashboard — Awaiting Payment card) ← Small, additive
Task 8  (Order History — filter + nest supplementary) ← Depends on Task 7 data shape
Task 7  (Supplementary cart mode)      ← Complex; last of the runtime work
Task 11 (Docs — CLAUDE.md, remaining_work.md) ← After code lands
Task 12 (Manual test matrix)           ← Final gate
```

**Critical dependency:** Task 10 must be done immediately after Task 2. Otherwise aggregator orders will silently start landing in `awaiting-payment` and break the Swiggy/Zomato flow until Task 10 is complete.

---

## Global Rules for All Tasks

1. **Never create a second Zustand store** — everything stays in `usePOSStore`.
2. **Bump `STORE_VERSION`** when changing persisted state shape.
3. **Update `partialize`** when adding new persisted fields (`pendingBillingOrderId`, `supplementaryBills` via `orders`, etc.).
4. **Handle Date serialization in `onRehydrateStorage`** for any new Date fields inside `supplementaryBills`.
5. **Every state transition writes an audit entry.** Non-negotiable. See §5 of the spec.
6. **Do NOT add `awaiting-payment` to any KDS filter.** Called out in CLAUDE.md.
7. **Use `sonner` toast for feedback** — not `alert()`.
8. **Use shadcn/ui primitives** (`AlertDialog` for voids and admin force-removes).
9. **Respect RBAC** — supplementary-remove is Admin-only. Use `getPermissions(currentUser.role)`.
10. **Run `npm run build` after every task.**
11. **Design data models for Supabase migration** — string UUIDs, ISO 8601 dates, flat relational structure. `supplementaryBills` will become a child table in Phase 3.
12. **Do not re-litigate decisions in §3 of the spec.** Table lock timing, Mark Served button, aggregator bypass, edit rules, and receipt timing are all locked.

---

## Files That Will Be Modified

| File | Tasks |
|------|-------|
| [lib/data.ts](../lib/data.ts) | 1 |
| [lib/store.ts](../lib/store.ts) | 1, 2, 7, 10 |
| [components/pos/new-order.tsx](../components/pos/new-order.tsx) | 3, 7 |
| [components/pos/billing.tsx](../components/pos/billing.tsx) | 4, 7 |
| [components/pos/kitchen-display.tsx](../components/pos/kitchen-display.tsx) | 5, 7 |
| [components/pos/table-management.tsx](../components/pos/table-management.tsx) | 6 |
| [components/pos/order-history.tsx](../components/pos/order-history.tsx) | 8 |
| [components/pos/dashboard.tsx](../components/pos/dashboard.tsx) | 9 |
| [components/pos/aggregator-inbox.tsx](../components/pos/aggregator-inbox.tsx) | 10 |
| [CLAUDE.md](../CLAUDE.md) | 11 |
| [docs/remaining_work.md](remaining_work.md) | 11 |

## New Files to Create

None. The entire pay-first flow is a rewiring of existing files — no new components needed. (If supplementary-cart UI grows too large, a `components/pos/supplementary-cart-banner.tsx` sub-component is acceptable.)

---

## Non-Goals (do not implement)

Explicitly out of scope, per §9 of the spec:

- Split-bill-before-payment (existing split-bill is post-payment).
- Partial payment / deposits / "pay later".
- Auto-completing `ready` orders after a timer.
- Reordering or redesigning the KDS kanban columns.
- Supabase / backend work (Phase 3).
- Swiggy/Zomato webhook integration (Phase 3).

---

*This guide turns [docs/pay-first-flow.md](pay-first-flow.md) into 12 executable tasks. After all 12 land and the manual test matrix passes, the pay-first flow is complete — bringing the POS's financial integrity up to real-cafe standards. The next milestone after this is Phase 3 (Supabase migration).*
