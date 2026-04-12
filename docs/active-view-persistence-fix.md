# Fix: Active View Resets to Dashboard on Refresh (per-role)

## The Bug

When any user refreshes the browser, the app always lands on the **Dashboard** view — regardless of:

- which role is logged in (Owner / Manager / Chef), and
- which screen the user was on before the refresh.

For an **Owner**, this looks like "the page came back to the dashboard."
For a **Manager** or **Chef**, this looks worse — they get dropped onto the Owner's dashboard for a flash before the role-guard kicks in and bounces them somewhere else. It feels broken because:

1. The view they were actually using (e.g. Kitchen for a Chef, Orders for a Manager) is lost.
2. There is a visible flicker through "dashboard" before the redirect lands.
3. There is no concept of "where was this user last working?" — the app forgets every refresh.

The user's ask: **each role should land back where it was, in its own scope, after a refresh.**

---

## Root Cause

Two cooperating problems in [lib/store.ts](../lib/store.ts) and [app/page.tsx](../app/page.tsx).

### 1. `activeView` is never persisted

The Zustand store hard-codes the initial navigation state:

```ts
// lib/store.ts:347
activeView: "dashboard",
setActiveView: (view) => set({ activeView: view }),
```

And the persist `partialize` allow-list **does not include `activeView`**:

```ts
// lib/store.ts:1460-1474
partialize: (state) => ({
  pendingBillingOrderId: state.pendingBillingOrderId,
  orders: state.orders,
  tables: state.tables,
  menuItems: state.menuItems,
  modifiers: state.modifiers,
  staffMembers: state.staffMembers,
  settings: state.settings,
  auditLog: state.auditLog,
  shifts: state.shifts,
  currentShift: state.currentShift,
  syncQueue: state.syncQueue,
  lastSyncedAt: state.lastSyncedAt,
  supabaseEnabled: state.supabaseEnabled,
}),
```

So when localStorage rehydrates on page load, `activeView` falls back to its in-code default of `"dashboard"`. Every refresh, every role.

### 2. `restoreSession` does not re-pick the role's default view

The reload path in [app/page.tsx:29-52](../app/page.tsx#L29-L52) calls `bootstrapSession()` and then `restoreSession(user)`:

```ts
// lib/store.ts:300-306
restoreSession: (user) => {
  // Reload-path login: no audit entry, no shift side effects.
  set({
    isLoggedIn: true,
    currentUser: user,
  });
},
```

Unlike the fresh-login path `login()` (which sets `activeView: getDefaultView(user.role)` at [lib/store.ts:296](../lib/store.ts#L296)), `restoreSession` deliberately leaves `activeView` alone — but because of bug #1, "alone" means "still the hard-coded default `dashboard`."

### What the user actually sees

The role-access guard at [app/page.tsx:58-67](../app/page.tsx#L58-L67) then runs:

```ts
if (isLoggedIn && currentUser) {
  if (!canAccessView(currentUser.role, activeView as ViewId)) {
    const defaultView = getDefaultView(currentUser.role);
    setActiveView(defaultView as typeof activeView);
  }
}
```

So per role, on refresh:

| Role    | `activeView` after rehydrate | `canAccessView`? | Final view                          |
|---------|------------------------------|------------------|-------------------------------------|
| Owner   | `dashboard`                  | yes              | **Dashboard** (forgets prior view)  |
| Manager | `dashboard`                  | no               | flickers dashboard → **Orders**     |
| Chef    | `dashboard`                  | no               | flickers dashboard → **Kitchen**    |

Owner gets stuck on Dashboard forever. Manager/Chef get a wrong-view flash and never resume what they were doing.

---

## The Fix

Two small changes. The whole thing fits in [lib/store.ts](../lib/store.ts) and (optionally) [app/page.tsx](../app/page.tsx).

### Step 1 — Persist `activeView`

Add `activeView` to the `partialize` allow-list so the last-used view survives a refresh:

```ts
// lib/store.ts — inside partialize
partialize: (state) => ({
  activeView: state.activeView,           // <-- ADD THIS
  pendingBillingOrderId: state.pendingBillingOrderId,
  orders: state.orders,
  // ...rest unchanged
}),
```

Bump `STORE_VERSION` since the persisted shape grows by one field. The existing `migrate` function does not need to do anything special — a missing `activeView` in old payloads will fall back to the in-code default.

### Step 2 — Validate the rehydrated view against the role on session restore

When `bootstrapSession()` gives us a user back after a refresh, we still need to defend against two cases:

1. The persisted `activeView` is a screen the user's role can no longer access (e.g. role was downgraded from Owner to Chef while they were away, and the persisted view is `settings`).
2. The persisted `activeView` is `undefined` because this is the very first load after the upgrade.

Update `restoreSession` so it picks the right view itself, instead of relying on the post-render guard effect:

```ts
// lib/store.ts
restoreSession: (user) => {
  const persistedView = get().activeView;
  const safeView = canAccessView(user.role, persistedView as ViewId)
    ? persistedView
    : (getDefaultView(user.role) as POSState["activeView"]);

  set({
    isLoggedIn: true,
    currentUser: user,
    activeView: safeView,
  });
},
```

(Import `canAccessView` and `getDefaultView` from `./roles` at the top of `store.ts` if they aren't already imported there.)

This makes `restoreSession` symmetric with the fresh `login()` path: both end with a known-valid view for the role, and neither relies on a post-render redirect to clean up after them.

### Step 3 (optional polish) — Drop the redirect flicker

With Step 2 in place, the role-guard `useEffect` in [app/page.tsx:58-67](../app/page.tsx#L58-L67) is no longer the *primary* mechanism — it only catches mid-session edge cases (e.g. an Owner manually navigating to a view they shouldn't, which the sidebar already prevents). It can stay as a safety net; no changes required.

If you want zero flicker on first paint, you can also gate the `<main>` render in [app/page.tsx](../app/page.tsx) on `currentUser` being present *and* `activeView` being valid for that role, but in practice Step 2 makes the first paint already correct, so this is cosmetic.

---

## Verification

After the fix, manually verify each role:

1. Log in as **Owner**, navigate to **Tables**, hard-refresh → should land on **Tables**.
2. Log in as **Manager**, navigate to **Billing**, hard-refresh → should land on **Billing** (no dashboard flash).
3. Log in as **Chef**, hard-refresh → should land on **Kitchen** (no dashboard flash).
4. As Owner, navigate to **Settings**, log out, log in as Chef → should land on **Kitchen** (not Settings — the role-validation in `restoreSession` / `login` rejects the stale view).
5. Run `npm run build` to confirm types still check.

---

## Files Touched

- [lib/store.ts](../lib/store.ts) — add `activeView` to `partialize`, bump `STORE_VERSION`, harden `restoreSession`.
- [app/page.tsx](../app/page.tsx) — no required changes; existing role-guard effect remains as a safety net.
