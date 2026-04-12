# Fix Part 2 — Only Restore Session on True Reload

> **Handoff doc for the next agent.** This builds on `docs/fix-persistent-login.md`, which has already been applied. Do NOT revert Part 1 — this doc only *adds* one extra check.

---

## The Remaining Problem

Part 1 moved Supabase auth + the `currentUser` cache into `sessionStorage`. That was correct, but the user still sees the session survive in two cases that should force a fresh login:

| Case                                              | Observed      | Expected  |
| ------------------------------------------------- | ------------- | --------- |
| F5 / Ctrl+R reload                                | Logged in ✅  | Logged in |
| Open a new tab and paste the app URL              | Logged in ❌  | Fresh login |
| Alt+F4 Chrome, reopen, tab is restored            | Logged in ❌  | Fresh login |
| Click in-app Logout                               | Logged out ✅ | Logged out |

## Why `sessionStorage` Alone Isn't Enough

Two Chrome behaviors intentionally preserve `sessionStorage` in cases we don't want:

### 1. Chrome "Continue where you left off"

`chrome://settings/onStartup` → "Continue where you left off". When enabled, closing Chrome and reopening it doesn't just restore the tabs — it restores **each tab's `sessionStorage` as well**. So our "session dies when Chrome quits" assumption is broken for any user with that setting enabled. It's also the default after Chrome crash recovery.

We can't flip this setting from the app. We need to detect the case in code.

### 2. Tab duplication / `window.open` / middle-click

When a tab is created by cloning another (duplicate tab, middle-click a link, `window.open(..., "_blank")`), Chrome **copies** `sessionStorage` from the source tab into the new tab. That looks like "I opened a new tab and I'm still logged in."

A genuine "open new tab → type the URL → Enter" actually does get a fresh empty `sessionStorage`. So some of the user's "new tab" reports may be one of these copy cases. Either way, the fix below covers both.

---

## The Insight: `PerformanceNavigationTiming.type`

The browser knows *why* the current document was loaded. The Navigation Timing API exposes it:

```ts
const [nav] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
nav.type; // "reload" | "navigate" | "back_forward" | "prerender"
```

- Pressing F5 / Ctrl+R → `"reload"` ✅ (we want to keep the session)
- Typing URL in new tab → `"navigate"` ❌ (we want to kill it)
- Duplicate tab → `"navigate"` ❌ (kill it)
- Chrome "Continue where you left off" restore → `"navigate"` ❌ (kill it)
- Click an in-app link or submit PIN → no new document load, this code never runs ✅

So the rule is simple: **only restore the session when `type === "reload"`**. In every other case, clear `sessionStorage` and force a fresh login.

---

## The Fix — Two Small Edits

Only two files change. No new files, no schema changes.

### Edit 1 — Add the reload detector and gate `bootstrapSession`

**File:** [lib/auth.ts](lib/auth.ts)

Add this helper somewhere above `bootstrapSession` (e.g. right under the `USER_CACHE_KEY` constant):

```ts
const SUPABASE_AUTH_STORAGE_KEY = "suhashi-pos-auth";

/**
 * Returns true only when the current document was loaded via an explicit
 * reload (F5 / Ctrl+R / location.reload()). Returns false for:
 *   - first visit / address-bar navigation
 *   - duplicate tab, middle-click, window.open
 *   - Chrome "Continue where you left off" tab restore after a browser restart
 *
 * This is the single heuristic that separates "stay logged in" (reload) from
 * "force a fresh login" (every other way a document can be created).
 */
function isPageReload(): boolean {
  if (typeof window === "undefined" || typeof performance === "undefined") {
    return false;
  }
  try {
    const entries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    if (entries && entries.length > 0) {
      return entries[0].type === "reload";
    }
  } catch {
    // fall through to the legacy API
  }
  // Legacy fallback for very old engines — performance.navigation.type === 1 is TYPE_RELOAD.
  const legacy = (performance as unknown as { navigation?: { type: number } }).navigation;
  if (legacy) return legacy.type === 1;
  return false;
}

/**
 * Forcibly drop the Supabase session from this tab. Used when we detect a
 * non-reload navigation and want the UI to fall back to the PIN screen.
 */
async function hardClearSession(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SUPABASE_AUTH_STORAGE_KEY);
  } catch {
    // ignore quota / private-mode errors
  }
  clearCachedCurrentUser();
  try {
    // signOut() with default (local) scope clears the in-memory session on
    // the Supabase client so any later getSession() call returns null.
    // Do NOT use { scope: "global" } — that would revoke the JWT server-side
    // and can race with the Edge Function.
    await getSupabase().auth.signOut();
  } catch {
    // offline or client not yet initialized — the storage clear above is
    // enough to make hasValidSession() return false on the next check.
  }
}
```

Now update `bootstrapSession` so it bails out early on anything that isn't a reload. Replace the existing `bootstrapSession` body with:

```ts
export async function bootstrapSession(): Promise<StaffUser | null> {
  // Rule: the only path that may restore a session is an explicit reload
  // of the same tab. Everything else (fresh tab, pasted URL, Chrome
  // "continue where you left off" restore, duplicated tab) must land on
  // the PIN screen even if sessionStorage still has an auth token.
  if (!isPageReload()) {
    await hardClearSession();
    return null;
  }

  const valid = await hasValidSession();
  if (!valid) {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      clearCachedCurrentUser();
    }
    return null;
  }

  const cached = readCachedCurrentUser();
  if (cached) return cached;

  // Session is valid but we lost the user cache (e.g. sessionStorage was
  // cleared manually). Try to reconstruct from the JWT claims.
  try {
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    const claims = session?.user?.user_metadata as
      | { staff_id?: string; staff_name?: string; user_role?: string }
      | undefined;
    if (claims?.staff_id && claims.staff_name && claims.user_role) {
      const initials = claims.staff_name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
      const user: StaffUser = {
        id: claims.staff_id,
        name: claims.staff_name,
        role: claims.user_role,
        initials,
      };
      cacheCurrentUser(user);
      return user;
    }
  } catch {
    // fall through
  }

  // Session is valid but we can't identify the user — safest to force re-login.
  await hardClearSession();
  return null;
}
```

The only differences from the current version:

1. New `isPageReload()` / `hardClearSession()` helpers.
2. First line of `bootstrapSession` is the `if (!isPageReload())` early-out.
3. The failure paths use `hardClearSession()` instead of just `clearCachedCurrentUser()` — that way any stale Supabase token in `sessionStorage` also gets nuked, not just the user cache.

### Edit 2 — Nothing changes in `app/page.tsx`

The existing bootstrap effect in `app/page.tsx` already calls `bootstrapSession()` and falls back to `<Login />` when it returns `null`. We don't need to touch it. The splash + flow are unchanged.

### Edit 3 — (defensive) Keep `storageKey` in sync

**File:** [lib/supabase.ts](lib/supabase.ts)

Sanity check: the `storageKey` value in the Supabase client **must** match `SUPABASE_AUTH_STORAGE_KEY` in `lib/auth.ts`. Both should be `"suhashi-pos-auth"`. If either one drifts, `hardClearSession()` will silently leave a stale token in storage and the bug comes back. No code change needed if they already match — just verify once.

---

## Verification Checklist

Same Chrome browser, real behavior, not just devtools inspection.

### Precondition

- [ ] `npm run build` is green.
- [ ] Before testing, clear Application → Session Storage and Local Storage for `localhost:3000` so you start from a known-clean state.

### Must pass

- [ ] Log in as Admin (`1234`) → on Dashboard.
- [ ] F5 / Ctrl+R in the same tab → still on Dashboard. ✅
- [ ] Navigate to Kitchen → F5 → still on Kitchen. ✅
- [ ] Open a new tab, paste `http://localhost:3000` → **PIN screen**. ✅
- [ ] In DevTools for the logged-in tab, go to Application → Session Storage → confirm `suhashi-pos-auth` and `suhashi-pos-current-user` exist.
- [ ] Enable `chrome://settings/onStartup` → "Continue where you left off".
- [ ] Log in again → Alt+F4 the whole Chrome window (not just the tab) → reopen Chrome → the restored tab should land on the **PIN screen**. ✅ (the core bug this doc fixes)
- [ ] Disable "Continue where you left off" again if that's not your normal setting.
- [ ] Log in → right-click the tab → "Duplicate" → the duplicated tab should land on the **PIN screen**. ✅
- [ ] Log in → click the in-app Logout → PIN screen, session storage cleared. ✅
- [ ] Log in → End Shift → PIN screen, session storage cleared. ✅

### Must not regress

- [ ] Offline reload test: log in → DevTools → Network → Offline → F5 → still logged in (this is a `"reload"` navigation, so the gate lets it through; `hasValidSession()` reads from in-memory storage, no network needed).
- [ ] Sync queue still flushes after reconnecting.
- [ ] Realtime subscriptions still fire (`useRealtimeSync` runs after `restoreSession` sets `isLoggedIn = true`).
- [ ] RBAC: log in as Server → reload → sidebar still shows Server items only.

### Security spot-checks

- [ ] In the logged-in tab, open DevTools → Application → Session Storage → manually delete `suhashi-pos-auth` → F5 → PIN screen (reload path runs `hasValidSession()`, which now returns false).
- [ ] Paste a fake value into `suhashi-pos-current-user` → F5 → PIN screen (bootstrap still verifies the Supabase session first, so a fake cache alone gets nothing).

---

## Why Not Just Use a `beforeunload` Flag?

A tempting alternative is: on `beforeunload`, set a flag `sessionStorage.setItem("__reloading", "1")`. On next mount, if the flag is set, treat as reload.

This **does not work** for Chrome "Continue where you left off". When Chrome shuts down, `beforeunload` does fire for each open tab, so the flag gets written. When Chrome restarts and restores the tab, the restored `sessionStorage` still has that flag in it — so the mount code thinks it's a reload and keeps the session. Exactly the bug we're trying to fix.

`PerformanceNavigationTiming.type` is the right primitive because the browser itself labels the navigation, and Chrome correctly reports restored tabs as `"navigate"`, not `"reload"`.

---

## Files Touched

| File           | Change                                                                        |
| -------------- | ----------------------------------------------------------------------------- |
| `lib/auth.ts`  | +`isPageReload`, +`hardClearSession`; `bootstrapSession` bails out on non-reload and uses `hardClearSession` on failure paths. |

No other files change. No new dependencies. No store/schema/Edge Function changes.

---

## Done When

1. Every checkbox in the verification checklist is ticked.
2. `npm run build` is green.
3. Reloading the POS in the same tab still keeps the user logged in.
4. New tab with the URL pasted lands on the PIN screen.
5. Alt+F4 → reopen Chrome lands on the PIN screen, **even with "Continue where you left off" enabled**.
