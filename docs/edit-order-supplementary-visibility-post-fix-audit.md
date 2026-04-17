# Edit Order — Supplementary Visibility: Post-Fix Audit

**Date:** 2026-04-17
**Spec:** `docs/edit-order-supplementary-visibility-spec.md`
**Status:** Implemented

---

## Summary

Fixed the bug where clicking **Edit** on an order with supplementary bills only loaded the main order items into the edit cart. Now all items (main + every supp bill's items) are loaded, visible, and appropriately editable.

---

## Files Changed

### 1. `lib/data.ts`
- Added 3 new `MutationKind` values: `supplementary-bill.update`, `supplementary-bill.replace-items`, `supplementary-bill.delete`

### 2. `lib/store.ts`
- Extended `CartItem` with `origin`, `supplementaryBillId`, `supplementaryBillPaid` fields
- Rewrote `startEditOrder` to load all items (main + paid supp locked, unpaid supp unlocked)
- Rewrote `saveEditOrder` supplementary branch with full diff logic (add/modify/remove)
- Relaxed `cart.length === 0` check for supplementary mode

### 3. `lib/supabase-queries.ts`
- Added `updateSupplementaryBillTotal`, `replaceSupplementaryBillItems`, `deleteSupplementaryBill`

### 4. `lib/sync.ts`
- Added 3 new case handlers for the new mutation kinds

### 5. `components/pos/new-order.tsx`
- Added section headers (Original Order, Supp Bill #N, New Items)
- Fixed item state logic (isNewlyAdded, isUnpaidSupp, isPaidSupp)
- Blocked paid supp item removal with toast
- Updated Save button label and disabled logic

## Files NOT Changed

- `hooks/use-realtime-sync.ts`, `components/pos/kitchen-display.tsx`, `components/pos/billing.tsx`
- No SQL migrations, no schema changes, no STORE_VERSION bump

## Verification

- `npx tsc --noEmit`: Clean
- `npm run build`: Clean
- RLS policies on `supplementary_bills` and `supplementary_bill_items`: All operations allowed
