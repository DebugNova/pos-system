# Pay-First Order Flow — Implementation Spec

> **Goal:** Change the order lifecycle so that **payment happens before the kitchen sees the order**. Tables and KOTs are only committed once billing is complete. Every state transition is written to the audit log.

**Status:** Ready for implementation
**Owner:** Kaustab
**Backend:** None yet (all state in Zustand + localStorage). Must remain compatible with future Supabase migration.
**Scope:** Phase 1 — frontend-only, no backend work.

---

## 1. Current Flow (the problem we are fixing)

```
New Order
  → addOrder() creates order with status "new"
  → table marked "occupied"
  → order appears in Kitchen Display immediately
  → navigate to Kitchen view
  → kitchen: new → preparing → ready
  → order appears in Billing
  → take payment → status "completed" → table freed
```

**Why this is wrong:** Kitchen starts cooking before the customer has paid. If the customer walks out or cancels, food is wasted. The table is also locked prematurely and cannot be reassigned.

Relevant code today:
- [components/pos/new-order.tsx:158-208](components/pos/new-order.tsx#L158-L208) — `handlePlaceOrder` / `handleSendToKitchen` both create orders with `status: "new"` and navigate to `kitchen`.
- [lib/store.ts:451-474](lib/store.ts#L451-L474) — `addOrder` immediately marks the table `"occupied"`.
- [components/pos/billing.tsx:70-72](components/pos/billing.tsx#L70-L72) — Billing filters on `status === "ready" || "preparing"` (i.e. already cooking).
- [components/pos/kitchen-display.tsx:103-124](components/pos/kitchen-display.tsx#L103-L124) — KDS transitions `new → preparing → ready → completed`.

---

## 2. New Flow

```
┌──────────────────────────────────────────────────────────────┐
│ 1. NEW ORDER                                                 │
│    Add items, pick type, pick table (dine-in)                │
└──────────────────────┬───────────────────────────────────────┘
                       │ "Proceed to Payment"
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. ORDER CREATED                                             │
│    order.status = "awaiting-payment"                         │
│    table.status = "waiting-payment"   (soft-lock)            │
│    Audit: order_created                                      │
│    → Auto-navigate to Billing, auto-select this order        │
│    ✘ NOT visible in Kitchen Display                          │
└──────────────────────┬───────────────────────────────────────┘
                       │
            ┌──────────┴──────────┐
            │                     │
     Payment success         Payment cancelled / voided
            │                     │
            ▼                     ▼
┌──────────────────────┐  ┌────────────────────────────────┐
│ 3a. PAYMENT DONE     │  │ 3b. CANCELLED                  │
│  status → "new"      │  │  status → "cancelled"          │
│  table → "occupied"  │  │  table → "available"           │
│  Print receipt       │  │  Audit: void                   │
│  Audit:              │  │  ✘ Never entered kitchen       │
│   payment_recorded   │  └────────────────────────────────┘
│   order_sent_to_kitchen
│  → Visible in KDS    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. KITCHEN — Prepare                                         │
│    KDS: new → preparing → ready                              │
│    Audit: status_changed (each transition)                   │
└──────────────────────┬───────────────────────────────────────┘
                       │ "Mark Served" (Ready column)
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. SERVED — Order complete                                   │
│    status → "completed"                                      │
│    table → "available"                                       │
│    Audit: order_served, order_completed                      │
│    → Shows in Order History                                  │
└──────────────────────────────────────────────────────────────┘
```

### State transition table

| Stage | `Order.status` | `Table.status` | Audit entry |
|---|---|---|---|
| Cart only | — | `available` | — |
| Order placed | `awaiting-payment` **(NEW)** | `waiting-payment` | `order_created` |
| Payment cancelled / voided | `cancelled` | `available` | `void` |
| Payment complete | `new` | `occupied` | `payment_recorded` + `order_sent_to_kitchen` |
| Kitchen starts | `preparing` | `occupied` | `status_changed` |
| Food ready | `ready` | `occupied` | `status_changed` |
| Served to customer | `completed` | `available` | `order_served` |
| Refunded (post-payment) | `cancelled` | `available` | `refund` |

---

## 3. Design Decisions (locked in)

All open questions from the earlier planning pass are resolved. Implementers — do not re-litigate these.

1. **Table lock on order placement** — The table is soft-reserved as `waiting-payment` the **moment** the order is placed. If payment is cancelled/voided/fails, the table returns to `available`.
2. **Served step** — Explicit **"Mark Served"** button on the Ready column in KDS. Ready does not auto-complete. Staff must physically serve the food and then tap.
3. **Aggregator bypass** — Swiggy/Zomato orders are already pre-paid. They **skip** the awaiting-payment path entirely and go straight to KDS with `status: "new"`. See §3.9.
4. **Edit after payment** — Once payment is complete and the order is in the kitchen, edits are restricted:
   - **Add items**: allowed → generates a **supplementary KOT** and a **supplementary bill** the customer pays separately (standard cafe/restaurant behavior).
   - **Remove / modify existing items**: **blocked** for everyone (food may already be on the stove).
   - **Admin override**: Admin role can force-remove items, which triggers a **partial refund** flow and writes an audit entry.
   - Before payment (`awaiting-payment` state): anything goes, fully editable.
5. **Receipt print timing** — Receipt is printed **right after payment completes**, before the food reaches the kitchen. The customer walks away with their bill in hand; the food follows. Every step from order creation to served is written to the audit log.

---

## 4. Files to Change

### 4.1 `lib/data.ts`
Add `"awaiting-payment"` to the `OrderStatus` union at [lib/data.ts:85](lib/data.ts#L85):

```ts
export type OrderStatus =
  | "awaiting-payment"   // NEW — placed, unpaid, NOT visible to kitchen
  | "new"                // paid, visible in KDS, not yet started
  | "preparing"
  | "ready"
  | "completed"          // served + closed
  | "cancelled";
```

Add new audit action types to the `AuditEntry.action` union at [lib/data.ts:163](lib/data.ts#L163):

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

`Table.status` already includes `"waiting-payment"` — no change needed.

### 4.2 `lib/store.ts`

**`addOrder`** — modify to create with the new status and soft-lock the table:
- Change default `status` from `"new"` to `"awaiting-payment"`.
- For dine-in orders, set the table to `"waiting-payment"` instead of `"occupied"`.
- Audit entry is already written (`order_created`) — keep it.
- Return the new order id so New Order can select it in Billing.

**`confirmPaymentAndSendToKitchen(orderId)` — NEW action.** Called by Billing on successful payment. Must be atomic (single `set` call where possible):
1. Set order status → `"new"`.
2. If dine-in, set table status → `"occupied"`.
3. Write audit: `payment_recorded` (with method, amount, transaction id).
4. Write audit: `order_sent_to_kitchen`.
5. Enqueue `order.update` mutation for offline sync.

**`cancelAwaitingPaymentOrder(orderId, reason?)` — NEW action.** Called when a customer walks away or payment is voided pre-kitchen:
1. Set order status → `"cancelled"`.
2. If dine-in, release table → `"available"`.
3. Write audit: `void` (with reason if provided).
4. Enqueue `order.delete` (or `order.update` with cancelled status) mutation.

**`markOrderServed(orderId)` — NEW action.** Called by KDS "Mark Served" button:
1. Set order status → `"completed"`.
2. Release table → `"available"`.
3. Write audit: `order_served`.
4. Enqueue mutation.

**`updateOrderStatus`** — update the existing action to also write a `status_changed` audit entry on every transition (today it only writes for `completed`). Keep the existing auto-release-table-on-completed logic.

**`saveEditOrder`** — must handle the pay-first edit rules (§4.7). Do not allow it to accidentally push an `awaiting-payment` order into the kitchen by changing its status.

**Store state additions:**
```ts
pendingBillingOrderId: string | null;      // set by New Order, consumed by Billing
setPendingBillingOrderId: (id: string | null) => void;
```

### 4.3 `components/pos/new-order.tsx`

- **Collapse the two buttons** (`handleSendToKitchen` and `handlePlaceOrder`) into one: **"Proceed to Payment"**. Delete `handleSendToKitchen` entirely.
- After `addOrder(...)`:
  1. Store the new order id via `setPendingBillingOrderId(newId)`.
  2. Navigate to `billing` view (not `kitchen`).
- **Keyboard shortcut:** `Ctrl+Enter` → Proceed to Payment. Remove the `Ctrl+Shift+Enter` variant at [components/pos/new-order.tsx:254-259](components/pos/new-order.tsx#L254-L259) — there's only one path now.
- Update the main CTA label, disabled-state copy, and any hint text to match: "Proceed to Payment" instead of "Send to Kitchen" / "Place Order".

### 4.4 `components/pos/billing.tsx`

- **Change the filter** at [components/pos/billing.tsx:70-72](components/pos/billing.tsx#L70-L72):
  ```ts
  const pendingPaymentOrders = orders.filter(
    (o) => o.status === "awaiting-payment"
  );
  ```
  Ready/preparing orders are already paid — they belong to Kitchen, not Billing.
- **On mount**, read `pendingBillingOrderId` from the store. If set, auto-select that order and clear the flag.
- **`handleCompleteBilling`** — replace `updateOrderStatus(id, "completed")` with the new `confirmPaymentAndSendToKitchen(id)` action. Payment success means "sent to kitchen", not "all done".
- **Print the receipt automatically** on payment success (before the Done button resolves), respecting `settings.printCustomerCopy`. The receipt must include the order id, items, totals, payment method, cashier name, and timestamp — already wired in [receipt-template.tsx](components/pos/receipt-template.tsx).
- **Cancel / Void path** — if the user backs out of billing without paying (e.g. customer walks away), offer a "Void Order" button that calls `cancelAwaitingPaymentOrder(orderId)` and clears the selection. This is the mechanism that releases the `waiting-payment` table back to `available`.
- **Refund flow** — unchanged. Refund still applies to completed orders only.

### 4.5 `components/pos/kitchen-display.tsx`

- Filter is already correct (`new / preparing / ready`) and now only contains paid orders — no filter change needed.
- **Rename the Ready-column action**: the button that today fires `updateOrderStatus(id, "completed")` at [kitchen-display.tsx:124](components/pos/kitchen-display.tsx#L124) must call the new `markOrderServed(id)` action instead, and its label must read **"Mark Served"** (not "Complete" / "Done").
- Keep `new → preparing` and `preparing → ready` buttons, but route them through `updateOrderStatus` so every transition writes a `status_changed` audit entry.

### 4.6 `components/pos/table-management.tsx`

- Relabel the `waiting-payment` status from "Payment" to **"Awaiting Payment"** at [table-management.tsx:36](components/pos/table-management.tsx#L36) and update the explanatory text at [table-management.tsx:163](components/pos/table-management.tsx#L163) to match.
- Tables in `waiting-payment` state should be **clickable** and take the user back into Billing for that order (set `pendingBillingOrderId` and navigate to `billing`). This lets a server reopen a pending bill if they stepped away.
- `waiting-payment` tables count as unavailable in the New Order table-picker — already handled by the `isOccupied` check at [new-order.tsx:303](components/pos/new-order.tsx#L303) which treats both `occupied` and `waiting-payment` as unavailable.

### 4.7 Edit-after-payment rules (applies to `new-order.tsx` + `billing.tsx` + `store.ts`)

Editing behavior depends on the order's current status:

| State | Who can edit | What they can do |
|---|---|---|
| `awaiting-payment` (pre-payment) | Anyone with order-create permission | Anything — add, remove, modify items, change table, change type |
| `new`, `preparing`, `ready` (post-payment, in kitchen) | Cashier, Admin | **Add** items only → generates a supplementary KOT + supplementary bill. Supplementary items enter the kitchen with a visual `+ADD` marker |
| `new`, `preparing`, `ready` (post-payment, in kitchen) | Admin only | Force-remove items → triggers partial refund for removed items, writes `refund` audit entry |
| `completed` | Admin only | View-only, refund only |
| `cancelled` | No one | View-only |

Implementation:
- `startEditOrder` — when the loaded order is post-payment, mark the cart as a "supplementary" cart. Existing items are shown as locked (read-only), and only newly added items can be modified/removed.
- `saveEditOrder` — if supplementary, do NOT overwrite `order.items`. Instead, append the new items, create a supplementary bill (`supplementaryTotal`), and leave the original order status untouched (so the kitchen keeps cooking).
- Audit: `order_edited` with a `metadata: { mode: "supplementary", addedItems: [...] }` payload.

> **Data model addition:** Add an optional `supplementaryBills?: { items: OrderItem[]; total: number; paidAt?: Date; payment?: PaymentRecord }[]` field to `Order` in [lib/data.ts](lib/data.ts). Each supplementary round is its own sub-bill.

### 4.8 `components/pos/order-history.tsx`

- Filter out `status === "awaiting-payment"` — they aren't finalized orders, they're in-progress.
- Show `cancelled` orders with clear visual treatment so voided orders are still traceable.
- For completed orders, surface any `supplementaryBills` as nested rows.

### 4.9 `components/pos/dashboard.tsx`

- Add a new stat card: **"Awaiting Payment: N"** showing the count of `awaiting-payment` orders. Clicking it navigates to Billing.
- "Today's Sales" must only count `status === "completed"` orders (verify current behavior).
- "Pending Orders" should count orders in `new / preparing / ready` only — not `awaiting-payment`.

### 4.10 `components/pos/aggregator-inbox.tsx`

- **Aggregator orders are pre-paid.** When a Swiggy or Zomato order is accepted, it must go straight to KDS with `status: "new"`, **bypassing** the `awaiting-payment` path entirely.
- Verify the accept-order handler:
  - Does NOT call the pay-first flow.
  - Calls `addOrder` with `status: "new"` directly, OR calls a dedicated `addAggregatorOrder` action that skips the billing stop.
  - Writes audit: `order_created` + `payment_recorded` (platform paid) + `order_sent_to_kitchen`.

### 4.11 `CLAUDE.md`

Update the "Order Flow" section to reflect the new canonical flow:

```
Select type → Choose table/customer → Add items + modifiers
  → Proceed to Payment → Take payment → Print receipt
  → Send to Kitchen (KOT) → Prepare → Ready → Mark Served → Close
```

### 4.12 `docs/remaining_work.md`

Cross off any items related to "payment before kitchen" or "table locking before payment" if they exist in the gap list.

---

## 5. Audit Logging Requirements

Every transition below **must** write an audit entry via `addAuditEntry`. This is non-negotiable — the user has explicitly asked that every step be "saved and noted".

| Event | Action | Details to include |
|---|---|---|
| Order placed (pre-payment) | `order_created` | order id, total, type, table, createdBy |
| Order voided pre-payment | `void` | order id, reason (if provided), userId |
| Payment recorded | `payment_recorded` | order id, method, amount, transactionId, cashier |
| Order sent to kitchen | `order_sent_to_kitchen` | order id, table, sentBy |
| Kitchen status change (new→preparing→ready) | `status_changed` | order id, fromStatus, toStatus, userId |
| Order served | `order_served` | order id, table, servedBy |
| Supplementary bill added | `order_edited` | order id, metadata: `{mode: "supplementary", addedItems}` |
| Admin force-remove item post-payment | `refund` | order id, item, amount refunded |
| Refund post-completion | `refund` | existing |
| Discount applied | `discount` | existing |

Each entry is automatically pushed to the sync queue by the existing audit plumbing in [lib/store.ts:163-174](lib/store.ts#L163-L174) — no extra work needed there.

---

## 6. Implementation Order

Do the work in this order. Each step should compile and run on its own.

1. **Types** — add `"awaiting-payment"` to `OrderStatus` and the new audit action types in `lib/data.ts`. Add the optional `supplementaryBills` field to `Order`.
2. **Store** — modify `addOrder`, add `confirmPaymentAndSendToKitchen`, `cancelAwaitingPaymentOrder`, `markOrderServed`. Wire `status_changed` audit into `updateOrderStatus`. Add `pendingBillingOrderId` state + setter.
3. **New Order screen** — collapse buttons, rename CTA to "Proceed to Payment", set `pendingBillingOrderId`, navigate to billing.
4. **Billing screen** — flip filter to `awaiting-payment`, consume `pendingBillingOrderId` on mount, call `confirmPaymentAndSendToKitchen` on success, add Void Order button, auto-print receipt after payment.
5. **Kitchen Display** — rename Ready action to "Mark Served" and wire to `markOrderServed`.
6. **Table Management** — relabel `waiting-payment`, make `waiting-payment` tables clickable to jump back into billing.
7. **Edit-after-payment** — implement supplementary-cart mode in `startEditOrder` / `saveEditOrder` and the permission gates from §4.7.
8. **Order History** — filter out `awaiting-payment`, nest `supplementaryBills`.
9. **Dashboard** — add "Awaiting Payment" stat card.
10. **Aggregator Inbox** — verify pre-paid bypass; fix if currently routing through `awaiting-payment`.
11. **CLAUDE.md + docs/remaining_work.md** — documentation updates.
12. **Manual test pass** — run the full matrix in §7.

---

## 7. Manual Test Matrix

Run every row after implementation. All audit entries should appear in the audit log after each scenario.

| # | Scenario | Expected result |
|---|---|---|
| 1 | Create dine-in order for Table T1, click "Proceed to Payment" | T1 → `waiting-payment` (labeled "Awaiting Payment"). Order appears in Billing, **not** in KDS. Audit: `order_created`. Auto-selected in Billing. |
| 2 | Complete cash payment on the T1 order | Receipt auto-prints. Order → `new`, T1 → `occupied`. Order now appears in KDS. Audit: `payment_recorded`, `order_sent_to_kitchen`. |
| 3 | KDS: new → preparing → ready → Mark Served | Each transition writes `status_changed`. "Mark Served" writes `order_served`. Order → `completed`, T1 → `available`. Order appears in History. |
| 4 | Place dine-in order, then click "Void Order" in Billing (customer walked away) | Order → `cancelled`, T1 → `available`. Audit: `void`. Nothing ever appeared in KDS. |
| 5 | Takeaway order through the full flow | Same as #1-3 but no table transitions. |
| 6 | Accept a Swiggy order from the Aggregator Inbox | Order bypasses Billing, goes directly to KDS as `new`. Audit: `order_created`, `payment_recorded`, `order_sent_to_kitchen`. |
| 7 | While T1 is `waiting-payment`, try to pick T1 for a new order | T1 is shown as unavailable in the picker. Cannot double-book. |
| 8 | Click a `waiting-payment` table in Table Management | Jumps into Billing with that table's order selected. |
| 9 | Refund a completed order | Existing refund flow works. Audit: `refund`. |
| 10 | Reload the page at each state (`awaiting-payment`, `new`, `preparing`, `ready`, `completed`) | State survives via localStorage. |
| 11 | Offline: place order, pay, serve, reload | All mutations queued and replay cleanly. |
| 12 | Post-payment edit (add a coffee) as Cashier | Order receives a supplementary KOT. Supplementary bill shown. Original order status untouched. Audit: `order_edited` with `mode: "supplementary"`. |
| 13 | Post-payment edit (remove an item) as Cashier | Blocked — UI shows item as locked. |
| 14 | Post-payment edit (remove an item) as Admin | Allowed. Triggers partial refund. Audit: `refund`. |
| 15 | Dashboard check | "Awaiting Payment" counter reflects pending bills. "Today's Sales" only counts `completed`. |

---

## 8. Supabase Notes (Phase 3, not now)

- `orders.status` enum must be extended with `awaiting-payment`.
- `confirmPaymentAndSendToKitchen` should become a Supabase **RPC / edge function** that wraps: insert payment row, update order status, update table status, insert audit rows — all in one transaction.
- Realtime subscription for KDS should listen on `orders` where `status in ('new','preparing','ready')`. `awaiting-payment` orders never flash on a KDS subscriber's screen by construction.
- Supplementary bills should live in a child table (`order_supplementary_bills`) keyed by `order_id`.
- Audit entries should be written inside the same RPC transaction so we can never have a payment without its audit row.

---

## 9. Non-Goals

The following are **explicitly out of scope** for this change:

- Splitting a bill across multiple customers before payment (existing split-bill flow is for post-payment).
- Partial payment / deposit / "pay later" — full payment is required to send to kitchen.
- Auto-completing `ready` orders after a timer.
- Reordering the KDS columns or changing the kanban layout.
- Any Supabase work (Phase 3).
- Swiggy/Zomato webhook integration (Phase 3).
