# Fix: Mobile "More" menu + Logout missing for non-Admin roles

## The bug

On the mobile bottom nav, the **More** button (which holds Logout, Theme toggle, and overflow nav items) only appears when a role has **more than 4 accessible views**. That means:

| Role | Visible views | Overflow (`slice(4)`) | More button? | Can logout on mobile? |
|---|---|---|---|---|
| Admin | 7 | 3 | ✅ Yes | ✅ Yes |
| Cashier | 4 | 0 | ❌ No | ❌ **No** |
| Server | 4 | 0 | ❌ No | ❌ **No** |
| Kitchen | 1 | 0 | ❌ No | ❌ **No** |

So Cashier, Server and Kitchen staff are **stranded** on mobile — they cannot log out, cannot toggle dark/light mode, cannot end their shift. They'd have to clear site data or switch to a desktop.

Also for consistency: even Admin should always see More in the same slot, so the nav layout doesn't shift between roles.

## Root cause

File: [components/pos/sidebar.tsx:325](components/pos/sidebar.tsx#L325)

```tsx
{mobileMoreItems.length > 0 && (
  <Sheet>
    ...
```

The whole `<Sheet>` is gated behind `mobileMoreItems.length > 0`. The sheet is the **only** place the mobile UI exposes logout / theme / user info, so when there's no overflow, those controls disappear entirely.

Related:
- [components/pos/sidebar.tsx:187-188](components/pos/sidebar.tsx#L187-L188) — `mobileBottomItems` / `mobileMoreItems` split
- [components/pos/sidebar.tsx:291](components/pos/sidebar.tsx#L291) — mobile bottom nav container

## Fix

### 1. Always render the More sheet (sidebar.tsx)

Remove the `mobileMoreItems.length > 0` guard. The sheet should render for **every** role because it always needs to expose Logout + Theme + user info.

When `mobileMoreItems.length === 0`, hide the overflow-items grid (or show a subtle "No additional sections" placeholder) but keep the footer (avatar + theme + logout) intact.

### 2. Reserve a slot for More in the bottom nav

Currently `mobileBottomItems = visibleNavItems.slice(0, 4)` + the More button = up to 5 slots. For Kitchen (1 view) this makes the Kitchen tab stretch across ~80% of the bar, which looks broken.

Change the split so More **always** occupies one slot:

```tsx
const MOBILE_MAX_PRIMARY = 4; // 4 primary + 1 More = 5 slots total
const needsMore = visibleNavItems.length > MOBILE_MAX_PRIMARY;
const mobileBottomItems = needsMore
  ? visibleNavItems.slice(0, MOBILE_MAX_PRIMARY)
  : visibleNavItems;
const mobileMoreItems = needsMore ? visibleNavItems.slice(MOBILE_MAX_PRIMARY) : [];
```

The More button is rendered **unconditionally** after the bottom items. Its grid section inside the sheet only renders when `mobileMoreItems.length > 0`.

### 3. Responsive layout for tiny screens (≤360px)

On very small phones, 5 flex-1 items with icon + label can overflow. Confirm:
- Labels use `text-[10px]` or `text-[11px]` and `truncate` / `leading-tight`.
- Icons stay `h-5 w-5`.
- The bar respects `env(safe-area-inset-bottom)` (already handled via `safe-bottom` class — verify the class exists in `globals.css`).
- No horizontal overflow — test at 320px width (iPhone SE).

### 4. Ensure the Sheet footer is reachable

The current Sheet uses `min-h-[55vh] max-h-[85vh]` with the footer pinned via `mt-auto`. When the overflow grid is empty, the footer should **not** collapse to the top of the sheet. Use `flex-1` on the grid container (or a spacer) so the footer stays pinned to the bottom.

### 5. Test matrix

Log in as each role on mobile viewport (DevTools → iPhone SE 375×667 and iPhone 12 Pro 390×844):

- [ ] **Admin** — 4 primary tabs + More, overflow sheet shows Reports/Settings/History(?), logout works
- [ ] **Cashier** — 4 primary tabs + More, overflow grid hidden, footer shows logout + theme
- [ ] **Server** — 4 primary tabs + More, overflow grid hidden, footer shows logout + theme
- [ ] **Kitchen** — 1 primary tab (Kitchen) + More, sheet footer shows logout + theme; tab doesn't stretch weirdly
- [ ] Dark ↔ Light toggle works from the sheet footer on all roles
- [ ] Logout from the sheet triggers `EndShiftDialog` when a shift is active
- [ ] Safe-area inset respected on iPhone with home indicator
- [ ] No horizontal scroll at 320px
- [ ] Desktop sidebar (≥md) unchanged

## Files to touch

1. [components/pos/sidebar.tsx](components/pos/sidebar.tsx) — primary fix (unconditional Sheet, slot reservation, empty-state handling)

That's it. No changes needed in roles.ts, store.ts, or layout.tsx.

## Acceptance criteria

- Every role on every mobile screen size can see a **More** button in the bottom nav.
- Tapping More opens a bottom sheet that always contains: user avatar+name+role, theme toggle, logout button.
- If the role has overflow nav items, they appear as a grid above the footer.
- Desktop (md+) layout is unchanged.
- `npm run build` passes.
