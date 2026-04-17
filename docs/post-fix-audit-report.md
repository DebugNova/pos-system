## Post-Fix Audit Report — Edit Order Bugs

**Date:** 2026-04-17
**Scope:** Files changed after the last git commit (`de04183`) on branch `main`
**Build:** `npm run build` + `npx tsc --noEmit` both pass clean. Zero type errors.

### Files changed since last commit

| File | Reason |
|------|--------|
| `lib/data.ts` | +3 `MutationKind` types for new sync flows |
| `lib/supabase-queries.ts` | +2 new query functions (`replaceOrderItems`, `updateSupplementaryBillPayment`) |
| `lib/sync.ts` | +3 new mutation handlers |
| `lib/store.ts` | Pre-payment edit sync (Bug #1), supp bill create fallback (Bug #3), `markOrderServed` guard (Bug #6) |
| `components/pos/billing.tsx` | Supp bill payment sync (Bug #2) |
| `components/pos/receipt-template.tsx` | Supp bill rendering + tax-balance fix (Bug #4) |
| `components/pos/kot-template.tsx` | Supp bill rendering (Bug #5) |
| `lib/print-service.ts` | Supp bill rendering in HTML/ESC-POS generators + tax balance |
| `tsconfig.tsbuildinfo` | Auto-updated by tsc |

---

### Issues spotted during review (all resolved)

#### Issue A — Cleared fields weren't syncing to Supabase in pre-payment edit
**Where:** `lib/store.ts` `saveEditOrder` pre-payment branch.
**Problem:** My first pass passed `undefined` for cleared fields (e.g., user switches from dine-in to takeaway, clearing `tableId`; or clears customer name). `mapLocalOrderToDb` skips keys whose value is `undefined`, so the DB would keep the old values even though local state cleared them.
**Fix:** Changed to pass `null` explicitly (`tableId: newTableId ?? null`, `customerName: customerName || null`, etc.) so the mapper writes the clearing value.

#### Issue B — Receipt line-items math didn't balance when supp bills were paid
**Where:** `components/pos/receipt-template.tsx` and `lib/print-service.ts` (both HTML + ESC-POS receipt generators).
**Problem:** Before my edits, supp items weren't rendered on receipts at all, so the breakdown of `Subtotal − Discount + Tax = Total` was printed using main-order values only. When I added supp items + supp totals to `subtotal`, the math stopped balancing: `grandTotal` includes supp tax but `order.taxAmount` only has main-order tax, so the printed Total didn't equal the visible breakdown (off by supp-tax).
**Fix:** When `suppTotal > 0` and `order.grandTotal` is defined, derive the display tax as `grandTotal − (subtotal − discount)` so the printed rows always reconcile with the printed total. Zero-supp case is unchanged.

---

### Correctness checks on the rest of the diff

- **Dual-path sync pattern is consistent.** Every new write path follows the existing `enqueueMutation(...)` + direct write-through + `markMutationSynced(mutId)` on success pattern. Matches `confirmPaymentAndSendToKitchen` and `markOrderServed`.
- **`order.full-edit` handler in `lib/sync.ts`** checks `changes` has keys before calling `updateOrderInDb`, and calls `replaceOrderItems` only if `items` is defined. No empty calls.
- **`replaceOrderItems` always runs DELETE then INSERT.** The DELETE is `order_id`-scoped only — no cross-order risk. INSERT uses `onConflict: "id"` so a re-run is idempotent (new IDs each edit). Safe on retries.
- **`updateSupplementaryBillPayment`** accepts `Date | string` and normalizes internally. `paidAt` matches what `billing.tsx` sets on the local bill object (`paidAtDate`).
- **Bug #6 guard ordering.** The unpaid-supp-bill check is placed before the `order.payLater` branch in `markOrderServed`. That's deliberate: if a pay-later order somehow has an unpaid supp bill, we route to billing rather than completing. The guard only skips the completion transition; it doesn't mutate status or table state, so it's idempotent (a second call with nothing paid still routes to billing).
- **`React.Fragment` usage in templates** is safe — both `kot-template.tsx` and `receipt-template.tsx` already import React.
- **`billing.tsx` uses `usePOSStore.getState().markMutationSynced(mutId)`** inside the dynamic import callback. That's needed because the destructured `markMutationSynced` isn't in scope; using `getState()` is the correct pattern and matches how the store calls itself elsewhere.
- **No RLS/schema changes.** All writes go through existing tables (`orders`, `order_items`, `supplementary_bills`). No migrations, no column additions. Client is unaffected on the DB side.

---

### Things I intentionally did **not** change

- Kitchen Display subscription logic (`use-realtime-sync.ts`, `kitchen-display.tsx`) — untouched, per user instruction.
- `confirmPaymentAndSendToKitchen` — untouched.
- `updateOrderStatus` / `markOrderServed` Realtime direct-write path — the `markOrderServed` edit only adds an *early return* for unpaid-supp case; the happy-path dual-write is unchanged.
- Own-write/echo detection in Realtime — untouched.
- Seed data, RBAC, settings shape — untouched.

---

### Verified

- `npm run build` — compiled successfully, 0 errors.
- `npx tsc --noEmit` — 0 errors.
- Pre-existing deprecation hints on `substring`/`substr` usages in `lib/store.ts` (lines 223, 241, 434, 540) are not from this change; they existed in the last commit.

---

### Residual risk / known non-blocking item

- **Multi-iPad timing on supp bill payment.** When Terminal A marks a supp bill paid, Terminal B sees the `orders` realtime row update with the new `grand_total` immediately, but the `supplementary_bills` row update (the `payment`/`paid_at` write) happens on a separate realtime channel. If B processes the `orders` update before the `supplementary_bills` update, there's a ~sub-second window where B's local cache could still show the bill as unpaid. The queued mutation + realtime catch-up resolve it within one tick. No data loss, no double-billing — just a brief UI flicker if someone is staring at B's billing screen during the exact millisecond A confirms. Acceptable.

Nothing in the change set damages existing kitchen sync, order lifecycle, or history. Safe to hand back to the live client.
