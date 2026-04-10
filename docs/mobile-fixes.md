# Mobile Responsiveness — Bug-by-Bug Fix Guide

> **Scope:** Fix every mobile UI/UX issue across all screens so the app works flawlessly on phones (320px–430px) and small tablets.  
> **Rule:** CSS/layout changes only — do NOT modify store logic, order flow, RBAC, or business logic.  
> **Priority:** Issues are ordered by severity — fix top-to-bottom.

---

## Issue 1 — Cart "Proceed to Payment" button hidden behind bottom nav

**Severity:** Critical (blocks checkout on mobile)  
**Screen:** New Order → Cart panel  
**File:** `components/pos/new-order.tsx`

**Problem:** The cart sheet is `h-[85vh]` and `fixed inset-x-0 bottom-0`. The cart summary (subtotal/tax/total + "Proceed to Payment" button) sits at the very bottom of this sheet. The mobile bottom nav bar (`h-14`, ~56px) overlaps it, making the payment button untappable or completely hidden.

**Fix:**
1. Add `pb-16` (64px) to the cart summary footer `<div className="border-t border-border p-4">` — change to `p-4 pb-20 md:pb-4`. This gives breathing room above the bottom nav.
2. Alternatively, change the cart sheet from `bottom-0` to `bottom-14` on mobile so it sits above the nav bar. Update:
   ```
   // Current
   "fixed inset-x-0 bottom-0 h-[85vh]"
   // Change to
   "fixed inset-x-0 bottom-14 md:bottom-0 h-[80vh] md:h-auto"
   ```
3. On desktop (md+), the cart is a relative side panel — no change needed there.

---

## Issue 2 — Cart floating button overlaps bottom nav bar

**Severity:** Critical (blocks cart access on mobile)  
**Screen:** New Order (when cart has items, before opening cart sheet)  
**File:** `components/pos/new-order.tsx`

**Problem:** The floating "Cart (N items)" button has `bottom-6` (24px from bottom). The bottom nav bar is `h-14` (56px). This means the button sits BEHIND the nav bar, partially or fully hidden.

**Fix:**  
Change the floating button container positioning:
```
// Current (line ~505)
"md:hidden fixed bottom-6 left-4 right-4 z-30"
// Change to
"md:hidden fixed bottom-20 left-4 right-4 z-30"
```
`bottom-20` = 80px, which clears the 56px nav + gives 24px breathing room. The `z-30` is already lower than the nav's `z-50`, so stacking is correct.

---

## Issue 3 — Order type buttons show only icons on small phones (no labels)

**Severity:** High (confusing UX — user can't tell Dine In from Takeaway)  
**Screen:** New Order → top bar  
**File:** `components/pos/new-order.tsx`

**Problem:** The label `<span className="hidden sm:inline">{type.label}</span>` hides text below 640px. On phones (375px), users see only 4 identical-looking icons with no text.

**Fix:**  
Option A — Always show labels but use shorter text on mobile:
```jsx
<span className="text-[11px] sm:text-sm">{type.label}</span>
```
Remove the `hidden sm:inline` class entirely.

Option B — Show abbreviated labels on mobile:
```jsx
<span className="sm:hidden text-[10px]">{type.id === "dine-in" ? "Dine" : type.id === "takeaway" ? "Take" : type.id === "delivery" ? "Deliver" : "Online"}</span>
<span className="hidden sm:inline">{type.label}</span>
```

**Recommended:** Option A is simpler and the labels are short enough to fit in 4 equal-width buttons on a 375px screen.

Also reduce the button gap and height for mobile:
```
// Current
"flex items-center gap-2 border-b border-border h-20 lg:h-24 px-3 lg:px-4"
// Change to
"flex items-center gap-1.5 sm:gap-2 border-b border-border h-14 sm:h-20 lg:h-24 px-2 sm:px-3 lg:px-4"
```

And the buttons themselves:
```
// Current
"flex-1 gap-1.5 h-12 text-sm lg:h-14 lg:gap-2 lg:text-base"
// Change to
"flex-1 gap-1 sm:gap-1.5 h-10 sm:h-12 text-xs sm:text-sm lg:h-14 lg:gap-2 lg:text-base"
```

---

## Issue 4 — "Customize" button invisible on touch devices

**Severity:** High (feature completely inaccessible on mobile)  
**Screen:** New Order → Menu item cards  
**File:** `components/pos/new-order.tsx`

**Problem:** The "Customize" button on menu cards has `opacity-0 group-hover:opacity-100`. On touch devices there is no hover, so this button is permanently invisible. Users can only add items at base price — they can never customize from the card.

**Fix:**  
Remove the hover-gated visibility on mobile. Change:
```
// Current
"h-7 text-[11px] sm:text-xs opacity-0 group-hover:opacity-100 transition-opacity"
// Change to
"h-7 text-[11px] sm:text-xs opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
```
This makes it always visible on mobile, hover-revealed on desktop.

Similarly, the hidden plus-circle icon has `opacity-0 ... hidden` — either remove it entirely or make it touch-accessible.

---

## Issue 5 — Cart sheet top area clipped/overlapping

**Severity:** High  
**Screen:** New Order → Mobile cart (when opened)  
**File:** `components/pos/new-order.tsx`

**Problem:** When the mobile cart sheet slides up, the `CardHeader` area (containing "Current Order", order type badge, table badge) overlaps with or gets clipped by the top of the viewport. The sheet is `h-[85vh]` from bottom-0, meaning the top sits at 15vh from top — this can be too close to the status bar on small phones.

**Fix:**
1. Add a visible drag handle at the top of the mobile cart sheet for clear affordance:
   ```jsx
   <div className="md:hidden flex justify-center pt-2 pb-1">
     <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
   </div>
   ```
2. Reduce sheet height from `h-[85vh]` to `h-[75vh]` on mobile to ensure the header is fully visible:
   ```
   "fixed inset-x-0 bottom-14 md:bottom-0 h-[75vh] md:h-auto"
   ```
3. Ensure the `CardHeader` has enough top padding: `pt-2 sm:pt-3`.

---

## Issue 6 — Table card order ID text wraps badly on small screens

**Severity:** Medium  
**Screen:** Table Management  
**File:** `components/pos/table-management.tsx`

**Problem:** Order IDs like `ORD-1775801179148` are very long strings that wrap awkwardly inside the table card's order info area at `grid-cols-2` on phones, pushing the layout.

**Fix:**
1. Truncate the order ID display with `truncate max-w-[100px]` or show only the last 4 digits on mobile:
   ```jsx
   <span className="text-xs text-muted-foreground truncate max-w-[80px] sm:max-w-none">
     {order.id.toUpperCase()}
   </span>
   ```
2. Alternatively, use a shortened format: `ORD-...9148` on mobile.

---

## Issue 7 — Table card "New Order" button too small and cut off

**Severity:** Medium  
**Screen:** Table Management → Available tables  
**File:** `components/pos/table-management.tsx`

**Problem:** The `<Button size="sm">+ New Order</Button>` on available table cards is small and can get clipped at the card bottom on cramped 2-column layouts.

**Fix:**
```
// Current
"mt-3 w-full gap-1.5 border-success/50 text-success hover:bg-success/10"
// Change to
"mt-3 w-full gap-1.5 h-10 sm:h-auto border-success/50 text-success hover:bg-success/10 active:bg-success/20"
```
Ensure `h-10` (40px) minimum for touch targets.

---

## Issue 8 — Table card dropdown trigger too small for touch

**Severity:** Medium  
**Screen:** Table Management → Occupied tables  
**File:** `components/pos/table-management.tsx`

**Problem:** The 3-dot menu trigger is `h-8 w-8` (32px), below the 44px minimum touch target.

**Fix:**
```
// Current
<Button variant="ghost" size="icon" className="h-8 w-8">
// Change to  
<Button variant="ghost" size="icon" className="h-10 w-10 sm:h-8 sm:w-8">
```

---

## Issue 9 — Billing page: back button missing on mobile after selecting order

**Severity:** High (user gets stuck on payment screen)  
**Screen:** Billing  
**File:** `components/pos/billing.tsx`

**Problem:** Billing uses a master-detail layout: order list on left, payment form on right. On mobile, when an order is selected, the list is `hidden` and only the payment form shows. But there is no visible back button to return to the list.

**Fix:**
Add a back button at the top of the payment section on mobile:
```jsx
<div className="flex md:hidden items-center gap-2 border-b border-border p-3">
  <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setSelectedOrder(null)}>
    <ArrowLeft className="h-5 w-5" />
  </Button>
  <span className="font-semibold text-foreground">Back to Orders</span>
</div>
```
Place this inside the payment section `<div>` (the one with `!selectedOrder ? "hidden md:flex" : "flex"`), at the very top before the order content.

---

## Issue 10 — Billing payment method grid too cramped on mobile

**Severity:** Medium  
**Screen:** Billing → Payment form  
**File:** `components/pos/billing.tsx`

**Problem:** Payment method buttons (Cash, UPI, Card, Split) are in a grid that may be too tight on 375px screens.

**Fix:**
Ensure the grid is `grid-cols-2 gap-2 sm:gap-3` on mobile. Each payment button should have `min-h-[60px]` for comfortable touch.

---

## Issue 11 — Kitchen Display columns stacked vertically on mobile (too long to scroll)

**Severity:** Medium  
**Screen:** Kitchen Display  
**File:** `components/pos/kitchen-display.tsx`

**Problem:** The KDS shows 3 kanban columns (New / Preparing / Ready) stacked vertically on mobile. With multiple orders, this creates a very long scroll. Users can't see the "Ready" column without scrolling past everything.

**Fix:**
Convert to a tab-based interface on mobile:
1. On mobile (`md:hidden`), show the existing filter buttons as tab selectors (New / Preparing / Ready) at the top.
2. Only render the currently selected column's orders below.
3. On tablet/desktop (`hidden md:flex`), keep the existing side-by-side columns.

This way, mobile users see one column at a time with easy tab switching.

---

## Issue 12 — Dashboard stats grid: 5th card orphaned on mobile

**Severity:** Low  
**Screen:** Dashboard  
**File:** `components/pos/dashboard.tsx`

**Problem:** Stats grid is `grid-cols-2 lg:grid-cols-5`. With 5 cards at 2 columns, the 5th card sits alone in its row, spanning half width. This looks unbalanced.

**Fix:**
Add `md:grid-cols-3` so on mid-sized screens it's 3+2, and ensure the last row card stretches:
```
"grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5 lg:gap-6"
```
Alternatively, make the first card span 2 columns on mobile with `col-span-2 sm:col-span-1` to balance the layout.

---

## Issue 13 — Main content area doesn't account for bottom nav height

**Severity:** High (content hidden behind bottom nav across ALL screens)  
**Screen:** All screens on mobile  
**File:** `app/page.tsx`

**Problem:** The main content area has `pb-14 md:pb-0` which adds 56px bottom padding on mobile. However, some components have their own internal scrolling (like new-order.tsx with `h-full`) and don't inherit this padding, causing content to be hidden behind the nav.

**Fix:**
1. Verify `pb-14 md:pb-0` on `<main>` is consistently applied (currently it is in page.tsx line 70 — good).
2. For full-height components that use `h-full` (new-order, billing, kitchen-display), ensure their internal scroll containers stop before the bottom nav. Add `pb-14 md:pb-0` to the innermost scrollable container if needed.
3. Specifically for `new-order.tsx`, the menu grid `<div className="flex-1 overflow-y-auto p-3 lg:p-4 min-h-0">` needs:
   ```
   "flex-1 overflow-y-auto p-3 pb-16 md:pb-3 lg:p-4 min-h-0"
   ```

---

## Issue 14 — Dialogs/modals extend beyond viewport on phones

**Severity:** Medium  
**Screen:** All screens with dialogs (Modifier, Move Table, Merge, Split Bill, etc.)  
**File:** Multiple components

**Problem:** Some `DialogContent` elements don't have mobile-safe constraints, causing them to extend beyond the viewport or be un-scrollable.

**Fix:**
Apply to ALL `DialogContent` components:
```
className="w-[95vw] max-w-lg sm:max-w-md max-h-[85vh] overflow-y-auto"
```

Files to update:
- `new-order.tsx` — Modifier dialog (line ~829): add `w-[95vw] max-w-lg sm:max-w-md max-h-[85vh] overflow-y-auto`
- `new-order.tsx` — Item notes editing dialog
- `table-management.tsx` — Move dialog (already has these, verify)
- `table-management.tsx` — Merge dialog (already has these, verify)
- `table-management.tsx` — Order detail dialog
- `billing.tsx` — Void dialog
- `split-bill-dialog.tsx` — main dialog content
- `settings.tsx` — any sub-dialogs

---

## Issue 15 — Order History filters don't wrap on mobile

**Severity:** Medium  
**Screen:** Order History  
**File:** `components/pos/order-history.tsx`

**Problem:** Filter dropdowns (status, type, date) are in a horizontal row. On mobile they may overflow horizontally or become too cramped.

**Fix:**
1. Make the filter container `flex flex-wrap gap-2`.
2. Make each `SelectTrigger` `w-full sm:w-[160px]` (full width on mobile, fixed on desktop).
3. Stack filters vertically on mobile: wrap them in a `grid grid-cols-1 sm:grid-cols-3 gap-2` instead of flex-row.

---

## Issue 16 — Settings tabs overflow horizontally on mobile

**Severity:** Medium  
**Screen:** Settings  
**File:** `components/pos/settings.tsx`

**Problem:** The `TabsList` contains many tabs (Profile, Tax, Menu, Staff, Printers, Integrations, Audit). On mobile, they either overflow or become too small to read.

**Fix:**
Make the `TabsList` horizontally scrollable:
```jsx
<TabsList className="flex w-full overflow-x-auto flex-nowrap gap-1 justify-start">
```
Each tab trigger should have `shrink-0` to prevent compression. Add `snap-x snap-mandatory` for nice scroll snapping.

---

## Issue 17 — Aggregator Inbox cards too wide on mobile

**Severity:** Medium  
**Screen:** Aggregator Inbox  
**File:** `components/pos/aggregator-inbox.tsx`

**Problem:** If the grid is `lg:grid-cols-3` without a mobile fallback, cards may be full-width (1 column) but with excessive internal padding or poorly laid-out internal content.

**Fix:**
Ensure grid is:
```
"grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
```
For the accept/reject action buttons, ensure they're full-width and `h-12` minimum on mobile for easy tapping.

---

## Issue 18 — Split Bill dialog layout broken on mobile

**Severity:** Medium  
**Screen:** Split Bill (from Table Management or Billing)  
**File:** `components/pos/split-bill-dialog.tsx`

**Problem:** The split bill dialog uses `grid grid-cols-2 gap-6` which forces a 2-column layout even on phones where each column would be ~170px wide — too narrow for item lists.

**Fix:**
```
// Current
"grid grid-cols-2 gap-6"
// Change to
"grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6"
```
Also reduce the scroll area height: `h-[200px] sm:h-[300px]`.

---

## Issue 19 — Reports date picker popover too wide on mobile

**Severity:** Low  
**Screen:** Reports  
**File:** `components/pos/reports.tsx`

**Problem:** Date picker popover has `w-[300px]` which may overflow on small phones.

**Fix:**
```
// Current
"w-[300px]"
// Change to
"w-full max-w-[300px]"
```
Ensure the popover is positioned correctly on mobile (may need `align="start"` and to be inside a responsive container).

---

## Issue 20 — Text too small across the app on mobile

**Severity:** Medium  
**Screen:** All screens  
**File:** Multiple

**Problem:** Several elements use `text-[10px]` which is below the minimum readable size on mobile. Badge counts, timestamps, and status labels are hard to read.

**Fix:**
Global rule — minimum font size of 11px on mobile:
- `text-[10px]` → `text-[11px]`
- `text-[8px]` → `text-[10px]`
- Any `text-xs` in critical areas should remain (12px is fine).

Specific locations:
- `new-order.tsx` — table capacity dots label `text-[8px]` → remove or change to `text-[10px]`
- `new-order.tsx` — badge counts `text-[11px]` → OK, keep
- `sidebar.tsx` — bottom nav labels `text-[11px]` → OK
- `table-management.tsx` — order info text
- `kitchen-display.tsx` — timer text

---

## Issue 21 — Menu item card images too large on small phones

**Severity:** Low  
**Screen:** New Order  
**File:** `components/pos/new-order.tsx`

**Problem:** Menu item cards at `grid-cols-2` on a 375px screen means each card is ~170px wide. The image `aspect-[4/3]` takes ~128px of height per card, leaving little room for the name and price below. Users see mostly images and have to scroll more.

**Fix:**
Reduce image aspect ratio on mobile:
```
// Current
"relative w-full aspect-[4/3]"
// Change to
"relative w-full aspect-[4/3] sm:aspect-[4/3]"
// Or use a shorter ratio on mobile:
"relative w-full aspect-square sm:aspect-[4/3]"
```
Or make it `aspect-[3/2]` on mobile for a taller, narrower image that takes less vertical space.

---

## Issue 22 — No pull-to-refresh or loading states on mobile

**Severity:** Low (UX polish)  
**Screen:** All screens  

**Problem:** Mobile users expect pull-to-refresh behavior. Currently there's no visual feedback when data is loading or refreshing.

**Fix:** (Deferred — nice-to-have for Phase 3 backend integration)

---

## Implementation Order

| Priority | Issues | Est. Effort |
|----------|--------|-------------|
| **P0 — Blockers** | #1, #2, #9, #13 | Small (class changes) |
| **P1 — Major UX** | #3, #4, #5, #11 | Medium (some JSX restructuring) |
| **P2 — Polish** | #6, #7, #8, #10, #14, #15, #16, #17, #18 | Small-Medium |
| **P3 — Nice-to-have** | #12, #19, #20, #21, #22 | Small |

---

## Testing Checklist

After fixing each issue, verify on:
- [ ] iPhone SE (375 x 667) — smallest common phone
- [ ] iPhone 14/15 (390 x 844) — standard phone
- [ ] iPhone 14/15 Pro Max (430 x 932) — large phone
- [ ] Galaxy S21 (360 x 800) — narrow Android
- [ ] iPad Mini (744 x 1133) — verify nothing breaks

**Per-fix checks:**
- [ ] Bottom nav bar never overlaps content or buttons
- [ ] All buttons tappable (44px+ touch target)
- [ ] All text readable (11px+ minimum)
- [ ] Dialogs don't overflow viewport
- [ ] Cart opens/closes smoothly
- [ ] Payment flow completable start-to-finish on mobile
- [ ] No horizontal overflow on any screen
- [ ] Landscape orientation still works

---

## Rules

1. **CSS/className changes only** — no store, RBAC, or flow modifications.
2. **Mobile-first fixes** — use `sm:`, `md:`, `lg:` overrides (not the other way around).
3. **Test `npm run build`** after each batch of fixes.
4. **Preserve desktop** — all fixes must use responsive breakpoints so desktop is unchanged.
5. **Use existing primitives** — shadcn `Sheet`, `Drawer`, `Dialog` for mobile patterns.
