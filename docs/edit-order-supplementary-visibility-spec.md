# Edit Order — Supplementary Bill Visibility & Full Editability

**Status:** Open
**Priority:** High — user-visible data gap during re-edits, leads to loss of control over ~70%+ of the order in typical supp-bill scenarios
**Owner:** Any AI agent picking this up (Claude Code / Antigravity / etc.)
**Date raised:** 2026-04-17
**Branch baseline:** `main` @ de04183 + post-fix commits (see `docs/post-fix-audit-report.md`)

---

## 1. TL;DR

When a paid order already has one or more supplementary bills attached, and the owner/cashier clicks **Edit** from the Billing screen (or any other entry point into `startEditOrder`), **only the original order's line items are loaded into the edit cart**. All existing supplementary-bill items are invisible and non-editable from the edit panel, even though the Billing summary and receipts show them as part of the order total.

Reproducible case captured in the screenshots the user attached:

- Order `ORD-1776404839406` (customer "Trial", Table 2): grand total **₹480**.
  - Main order: 1× Americano = ₹130
  - Supplementary bill #1: 5 items (Cappuccino, Brown butter chocolate chip cookie, Blueberry lamington, Lemon white chocolate lamington, Hot Chocolate) = ₹350
  - Shown on Billing screen with `+ADD` badges for the 5 supp items — correct.
- User clicks **Edit** → lands on New Order in supplementary edit mode → **cart shows only the Americano (₹130)**. The 5 supp items cannot be viewed, quantity-adjusted, removed, or have modifiers changed from this screen.

**Desired:** the edit panel must show the *complete* order (main items + every item from every supp bill), with all of it editable (quantity, modifiers, variant, remove) with proper permissioning, and every mutation must round-trip correctly to Supabase and to every dependent view (Billing, Order History, Reports, Receipts, KOT, KDS).

---

## 2. Why this matters

- **Visibility gap:** the operator genuinely cannot see what they are editing. In the test case, 73% of the order (₹350 of ₹480) is hidden from the edit surface.
- **Operational bug:** the most common reason to re-edit a paid order is that a customer wants to correct an add-on (wrong modifier, wrong quantity, remove an item that was rung up by mistake). Today that correction cannot be made without data-manager surgery.
- **Trust:** the billing/history views already show these items. Hiding them in edit makes the app feel broken / inconsistent.
- **Audit & finance:** without editability, supp-bill corrections get worked around with *new* supp bills or voids, which pollutes the audit log, the sales reports, and the SQL views (`v_daily_sales`, `v_top_items`).

---

## 3. Where the bug lives

### 3.1 `lib/store.ts` — `startEditOrder` (≈ line 526)

```ts
startEditOrder: (orderId) => {
  const order = get().orders.find((o) => o.id === orderId);
  if (!order || order.status === "completed" || order.status === "cancelled") return;

  let editMode: POSState["editMode"] = "pre-payment";
  let lockedItemIds: string[] = [];

  if (order.status === "new" || order.status === "preparing" || order.status === "ready") {
    editMode = "supplementary";
    lockedItemIds = order.items.map((i) => i.id);   // ← only main items get locked
  }

  // Load order items into cart  ← only main order items
  const cartItems: CartItem[] = order.items.map((item) => ({ ... }));

  set({ editingOrderId: orderId, cart: cartItems, ..., lockedItemIds });
},
```

**Root cause:** `order.supplementaryBills[*].items` are never pulled into `cartItems`. The cart only reflects `order.items`.

### 3.2 `lib/store.ts` — `saveEditOrder` supplementary branch (≈ line 572)

Assumes the only thing that can happen in supp mode is *adding* brand-new items. It appends a **new** supplementary bill record on every save:

```ts
supplementaryBills: [...(order.supplementaryBills || []), newBill]
```

It does not support: editing an existing supp-bill item, removing an existing supp-bill item, changing the qty/modifiers of an existing supp-bill item, or merging/splitting supp bills.

### 3.3 `components/pos/new-order.tsx` — edit UI

The edit panel iterates `cart` (see the `editingOrder` / `editMode === "supplementary"` code path around the `Lock` badge and the "Remove Item (Owner)" button). Since the cart only has main-order items, the UI never has the supp items to render.

### 3.4 Data mapping — `lib/supabase-queries.ts`

- `mapLocalOrderToDb` **intentionally ignores** `supplementaryBills` (comment is already in the file).
- `insertSupplementaryBill` creates a new `supplementary_bills` row + its `supplementary_bill_items` rows, but there is **no `updateSupplementaryBill`, `replaceSupplementaryBillItems`, or `deleteSupplementaryBill` helper**. Those need to be added.
- `replaceOrderItems` exists (used by pre-payment full-edit) — model this on it.

### 3.5 Sync — `lib/sync.ts`

`MutationKind` already has `supplementary-bill.create` and `supplementary-bill.payment` (added in the post-fix patch). You will need to add:

- `supplementary-bill.update` (for qty/modifier changes on existing items or changing the bill total)
- `supplementary-bill.replace-items` (bulk replace of items within a bill)
- `supplementary-bill.delete` (if bill becomes empty after removals)

Match the dual-path pattern already used by `order.full-edit`: **enqueue mutation + direct write-through + `markMutationSynced` on success**.

---

## 4. Desired behavior (contract)

### 4.1 Entering edit

`startEditOrder(orderId)` must build the cart as:

1. All `order.items` → `CartItem` with `originalItemId = item.id`, `origin: "main"`.
2. For each bill in `order.supplementaryBills` (in chronological order):
   - Every item in `bill.items` → `CartItem` with `originalItemId = item.id`, `origin: "supp"`, `supplementaryBillId: bill.id`, `supplementaryBillPaid: !!bill.payment`.
3. `lockedItemIds` (pre-existing concept) is populated with the IDs of every item that existed *before this edit session* — main + supp. Owners can still remove via the existing "Remove Item (Owner)" confirm dialog.
4. New items added during this edit session have no `originalItemId` → fully unlocked.

### 4.2 Edit mode selection

Keep the existing 2-mode model, but extend it:

| Order status | `editMode` | Behavior |
|---|---|---|
| `awaiting-payment`, `served-unpaid` | `pre-payment` | Full edit: can modify/remove any main item. No supp bills exist yet at this stage in practice. |
| `new`, `preparing`, `ready`, `completed` | `supplementary` | Main items + all existing supp items are visible. Paid items are locked by default (require owner unlock). Unpaid supp items are freely editable because they haven't been charged yet. New adds go into a *new* supp bill unless the cashier explicitly chooses to amend an existing *unpaid* supp bill. |

Note: `completed` is currently blocked from edits. You can leave that as-is for the first pass, but consider a future extension where admin-only "refund + re-edit" is allowed. Not in scope for this fix.

### 4.3 Saving

`saveEditOrder` (supplementary branch) must diff the cart against the pre-edit snapshot and emit the right writes:

1. **Main-order items diff** — only allowed for owner/admin when a paid supp item is being changed? Actually no: main items belong to the *paid* original bill. Removing/modifying them post-payment requires a refund flow. Keep main items **read-only** in supplementary mode *unless the order is `served-unpaid`*. Show a clear visual state for "owner can force-remove" as today.
2. **Existing supp-bill item diff** — three change types:
   - **Removed** → delete from `supplementary_bill_items`. If the parent bill has zero items left, delete the bill row too. If the bill was already `payment != null`, removal must be blocked with a refund flow note (not in scope). If unpaid, free to remove.
   - **Modified** (qty/modifiers/variant/notes) → update row. Recompute `bill.total`. Update the `supplementary_bills.total` column.
   - **Added** (new items with no `originalItemId`) → go into a *new* supp bill (current behavior) OR into the most-recent unpaid bill if one exists and the cashier toggles "append to existing". Simpler first pass: always create a new supp bill for net-new items, matching today's behavior.
3. **Grand total recomputation** — `order.grandTotal` = main total − discount + tax + Σ(all supp bill totals including tax). Make sure `order.grand_total` is written to Supabase after supp changes, and Terminal B receives a coherent realtime sequence (supp updates **before** the orders-row update — mirror the pattern in `billing.tsx` handlePayment that was added in the last patch).

### 4.4 Audit

Every change must write an `audit_log` entry:

- `action: "order_edited"`, `metadata.mode: "supplementary"`, `metadata.changes: { added: [...], removed: [...], modified: [...] }`
- Removal of a *paid* item (owner force) → separate entry `action: "supp_item_refund"` with the item and reason.

### 4.5 Downstream views

All of these read from `orders` + `order_items` + `supplementary_bills` + `supplementary_bill_items` (or local mirrors). After the fix, verify each:

- **Billing** (`components/pos/billing.tsx`) — unpaid-supp list, grand-total recompute, split bill, auto-print.
- **Order History** (`components/pos/order-history.tsx`) — nested supp bill rendering; refund/void flow.
- **Reports** (`components/pos/reports.tsx`) — SQL views `v_daily_sales`, `v_top_items`, `v_payment_breakdown`, `v_staff_performance`. Confirm the views aggregate over `order_items` + `supplementary_bill_items`. If a view is main-order only, fix the view (migration needed — flag it).
- **Receipts** (`components/pos/receipt-template.tsx`, `lib/print-service.ts` HTML + ESC/POS) — already render supp items after the last patch; sanity-check after a mid-edit.
- **KOT** (`components/pos/kot-template.tsx`, `lib/print-service.ts`) — each supp-bill add should still reprint a KOT for the *new* items (today's behavior). Make sure an *edit* of an existing unpaid supp bill reprints a "KOT — REVISED" with the diff. Decide policy with Kaustab if unclear; a safe default is: reprint the full updated supp bill KOT stamped `REVISED`.
- **KDS** (`components/pos/kitchen-display.tsx`) — KDS must keep working. Do not add `awaiting-payment` to the filter. If a supp-bill edit happens on an order that is currently `preparing` on the KDS, the KDS view of that order should update in place (realtime). Verify after the fix.

### 4.6 Offline

All mutations must enqueue to the IndexedDB-backed sync queue and replay on reconnect. No exceptions.

---

## 5. Data-model touchpoints

No new tables needed. Existing schema already supports this; we are just not using it fully.

- `orders(id, …, grand_total, tax_amount, …)` — update `grand_total` after supp changes.
- `order_items(id, order_id, …)` — unchanged unless you add "remove main item with refund" (out of scope).
- `supplementary_bills(id, order_id, total, created_at, payment, paid_at, …)` — UPDATE `total`, UPDATE `payment`/`paid_at` (already handled), DELETE on empty.
- `supplementary_bill_items(id, supplementary_bill_id, …)` — INSERT / UPDATE / DELETE row-level.

RLS: existing policies on these tables rely on `user_role` in JWT claims. No change. Confirm that `DELETE` on `supplementary_bill_items` / `supplementary_bills` is allowed for `Admin`, `Cashier` (and `Owner` via `Admin` equivalence). Add policies if missing. **Do not loosen RLS — check first, then add only what's minimally required.**

---

## 6. Implementation plan

Do this in this order. Each step is safe on its own and keeps the app working.

### Step 1 — extend `CartItem` type

In `lib/data.ts`, add optional fields:

```ts
export interface CartItem {
  ...existing...
  origin?: "main" | "supp";
  supplementaryBillId?: string;   // only when origin === "supp"
  supplementaryBillPaid?: boolean; // UI lock hint; do not trust client-side for auth
}
```

Bump `STORE_VERSION` in `lib/store.ts`.

### Step 2 — rewrite `startEditOrder` in `lib/store.ts`

Build cart from main items + every supp bill's items. Populate `lockedItemIds` with the IDs of all pre-existing items. Populate the new `CartItem` fields.

### Step 3 — UI changes in `components/pos/new-order.tsx`

- Render cart items grouped: "Original order" section (main items) and one section per existing supp bill ("Supplementary Bill #1 — Paid" / "Unpaid").
- For **paid** items (both main and paid-supp): show lock badge, allow owner-only remove via existing dialog. Do NOT allow qty/modifier edits on paid items (would require refund flow — out of scope).
- For **unpaid supp** items: allow full edit (qty, variant, modifiers, notes, remove).
- For **new additions**: unchanged — they go into a fresh supp bill on save.
- Update the header banner to reflect presence of paid vs unpaid supp bills.

### Step 4 — data-access helpers in `lib/supabase-queries.ts`

Add:

```ts
export async function updateSupplementaryBillTotal(billId: string, total: number): Promise<void>;
export async function replaceSupplementaryBillItems(billId: string, items: OrderItem[]): Promise<void>;
export async function deleteSupplementaryBill(billId: string): Promise<void>;
```

Model `replaceSupplementaryBillItems` on the existing `replaceOrderItems` (DELETE then UPSERT, `onConflict: "id"`, `order_id`-scoped — here `supplementary_bill_id`-scoped).

### Step 5 — extend `MutationKind` in `lib/data.ts`

```ts
| "supplementary-bill.update"          // total change
| "supplementary-bill.replace-items"   // bulk items replace
| "supplementary-bill.delete"          // remove empty bill
```

### Step 6 — handlers in `lib/sync.ts`

One handler per new `MutationKind`, calling the corresponding Supabase query fn. Mirror the existing error handling (throw on failure, leave in queue; success → removed by caller's `markMutationSynced`).

### Step 7 — rewrite `saveEditOrder` supplementary branch in `lib/store.ts`

Diff logic:

```ts
type Change =
  | { type: "add"; item: OrderItem }        // goes to new supp bill
  | { type: "remove"; billId: string; itemId: string }
  | { type: "modify"; billId: string; item: OrderItem };

// Build changes by comparing pre-edit snapshot (taken at startEditOrder time) vs final cart.
// Block illegal changes client-side (paid item modify without owner force).
// Group removes/modifies by billId. For each affected bill:
//   - compute new items list
//   - compute new bill.total
//   - if items.length === 0 → delete bill
//   - else → replaceSupplementaryBillItems + updateSupplementaryBillTotal
// If there are adds → create new supp bill via existing insertSupplementaryBill path.
// Recompute order.grandTotal and write it last (same sequencing pattern as billing handlePayment).
```

Emit one audit entry per logical action.

### Step 8 — verify downstream views

Hand-test (or better, scripted via the existing Supabase project):

- [ ] Billing — edit an order mid-flight with a paid supp, remove an unpaid supp item, save, confirm billing queue reflects new total.
- [ ] Order History — expand the order, confirm the supp bills show the edited contents.
- [ ] Reports — run a mid-day report before and after; confirm `v_top_items` doesn't double-count.
- [ ] Receipts / KOT — reprint after edit; confirm math balances (supp-tax fix already applied).
- [ ] KDS — confirm in-flight orders still transition correctly and don't get stuck.
- [ ] Multi-iPad — Terminal A edits, Terminal B sees the change within a tick; the fix must not introduce flicker (sequence supp writes before orders-row write, as already done for payment).

### Step 9 — build

```bash
npm run build
npx tsc --noEmit
```

Both must pass clean. Zero `any` leaks into public types.

---

## 7. Edge cases to explicitly handle

1. **Order with zero main items** after edit — blocked; main items can't be deleted in supp mode.
2. **Supp bill becomes empty** after removals — DELETE the bill row.
3. **Paid supp item remove (owner force)** — for now, block with a toast "Refund flow required — not yet supported". Don't silently drop revenue.
4. **Editing an order that is currently `preparing` on the KDS** — the KDS must reflect the change in realtime. KOT reprint with `REVISED` stamp.
5. **Two terminals editing the same order simultaneously** — last writer wins (current app behavior). Consider a soft-lock in a future patch; not in scope.
6. **Offline edit** — mutations queue; on reconnect, replay in insertion order. Verify `replaceSupplementaryBillItems` is idempotent (same pattern as `replaceOrderItems` — it is, if DELETE+UPSERT is used).
7. **Modifier edits on an unpaid supp item** — changes `bill.total`; must re-enqueue `supplementary-bill.update` with new total.
8. **`grand_total` drift** — always recompute from scratch on save: `main_total − discount + tax + Σ supp.total`. Never increment from previous value.

---

## 8. Non-goals (explicit)

- Refund flow for paid supp items. Out of scope. Block with a clear error.
- Partial refunds. Out of scope.
- Splitting a supp bill across multiple payments. Out of scope.
- "Undo edit" (snapshot/restore). Out of scope.
- Schema migrations. The existing schema is sufficient. Do **not** add columns.

---

## 9. Risk register

| Risk | Mitigation |
|---|---|
| KDS regression (user explicitly said "don't break kitchen sync") | Do not touch `use-realtime-sync.ts`, `kitchen-display.tsx`. Verify in-flight orders still transition after edit. |
| Double-writes to `supplementary_bills` due to realtime echo | Keep own-write detection intact (existing mechanism in the realtime hook). |
| Losing queued mutations on version bump | Bumping `STORE_VERSION` triggers Zustand migration — make sure the migration function preserves `syncQueue`. Check existing migration functions in `lib/store.ts`. |
| RLS denying DELETE on supp items for some roles | Check Supabase dashboard → `supplementary_bills` / `supplementary_bill_items` policies. Extend only if needed; never use service_role from the client. |
| Realtime event reorder between `supplementary_bills` and `orders` channels | Mirror the sequencing pattern already applied in `billing.tsx` handlePayment — write supp changes first, then orders.grand_total. |

---

## 10. Acceptance criteria (what "done" looks like)

- [ ] Clicking **Edit** on an order with existing supp bills loads the full item list — main items + every supp-bill item — into the edit cart.
- [ ] Paid items are visually locked but owner-removable (existing behavior, extended to supp).
- [ ] Unpaid supp items are fully editable (qty, variant, modifiers, notes, remove).
- [ ] Saving the edit correctly persists to Supabase: `supplementary_bills` and `supplementary_bill_items` rows are INSERTed / UPDATEd / DELETEd as appropriate, and `orders.grand_total` reflects the new total.
- [ ] Billing screen, Order History, Reports, Receipts, KOT, and KDS all reflect the edited state immediately on the same terminal and within one tick on another terminal.
- [ ] No regressions: pre-payment edits still work; confirmPayment → KDS still works; pay-later + supp payments still work.
- [ ] `npm run build` and `npx tsc --noEmit` both pass clean.
- [ ] An audit log entry exists for every save, capturing adds/removes/modifies.
- [ ] Offline edit works: queue persists, replays cleanly on reconnect.
- [ ] Manual multi-iPad smoke test: Terminal A edits, Terminal B reflects the change without a visible flicker.

---

## 11. Files likely to change

- `lib/data.ts` — `CartItem` field additions, `MutationKind` additions. Bump `STORE_VERSION`.
- `lib/store.ts` — `startEditOrder`, `saveEditOrder` supplementary branch, migration fn.
- `lib/supabase-queries.ts` — new helpers (`updateSupplementaryBillTotal`, `replaceSupplementaryBillItems`, `deleteSupplementaryBill`).
- `lib/sync.ts` — new mutation handlers.
- `components/pos/new-order.tsx` — cart rendering (grouped sections, lock states, per-bill headers).
- Possibly `components/pos/billing.tsx` — no changes expected; verify grand-total computation path is still correct.
- `docs/edit-order-supplementary-visibility-spec.md` — this file. Update the status header when work starts and when it merges.

Files that should **not** change:

- `hooks/use-realtime-sync.ts`
- `components/pos/kitchen-display.tsx`
- Anything in `app/sw.ts` / `public/sw.js`
- Any Supabase schema (unless an RLS gap is discovered; flag it before changing)

---

## 12. Notes for the implementing agent

- Read `CLAUDE.md` first. The dual-path sync pattern and the "don't touch KDS" rule are load-bearing.
- Read `docs/edit-order-audit-report.md` and `docs/post-fix-audit-report.md` for the most recent context on supp-bill payment handling — the timing pattern used there is the template for Step 7.
- The client is live in production. Prefer additive changes. Do not run destructive SQL. Do not touch the `service_role` key.
- If you find an ambiguity during implementation, **stop and ask** rather than guessing. The user (Kaustab) has emphasized "don't break anything".
- When you land the fix, append a short "Post-fix audit" section to this file (or a sibling `docs/edit-order-supplementary-visibility-post-fix-audit.md`) listing every file you touched and any surprises you caught during review.
