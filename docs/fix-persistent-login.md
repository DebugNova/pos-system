# Fix: Persistent Login Across Page Reload (until browser closes)

> **Handoff doc for the next agent.** Read this end-to-end before touching code. Do not skip the "Why" sections — they explain why simpler-looking shortcuts are wrong.

---

## The Problem

On [suhashico.vercel.app](https://suhashico.vercel.app/) (and local dev), every hard reload / page refresh in Chrome kicks the logged-in staff member back to the PIN screen. The cafe staff (Admin, Cashier, Server, Kitchen) have to re-enter their PIN every single time, which is painful mid-shift.

**Desired behavior:**

| Action                          | Should the session survive? |
| ------------------------------- | --------------------------- |
| `F5` / Ctrl+R / soft reload     | ✅ Yes, stay logged in      |
| Close the tab, reopen from history within the same Chrome window | ✅ Yes (best effort — see note) |
| Completely quit Chrome (all windows closed) and reopen | ❌ No, force re-login |
| Click the in-app "Logout" / "End Shift" button | ❌ No, force re-login |
| JWT has expired on the server   | ❌ No, force re-login       |
| Another device logs this staff out | ❌ No, force re-login    |

**Non-goals / constraints:**

- No new dependencies.
- No changes to RLS, Edge Functions, or the database.
- No secrets in `localStorage` that persist across Chrome restarts (that's the whole point).
- The fix must keep working offline (the app is offline-first).

---

## Root Cause (Read This Before Coding)

There are **two** independent state layers, and both currently reset on reload:

### Layer 1 — Zustand store (`lib/store.ts`)

The store is persisted via `zustand/middleware`'s `persist` to `localStorage` under the key `suhashi-pos-storage`. But look at `partialize` around [lib/store.ts:1302-1315](lib/store.ts#L1302-L1315):

```ts
partialize: (state) => ({
  pendingBillingOrderId: state.pendingBillingOrderId,
  orders: state.orders,
  tables: state.tables,
  menuItems: state.menuItems,
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

`isLoggedIn` and `currentUser` are **deliberately excluded**. On reload, the store rehydrates from localStorage and both fall back to their initial values (`false` and `null`). That's why `app/page.tsx` renders `<Login />` on reload.

### Layer 2 — Supabase auth session

`lib/supabase.ts` creates the client with `createBrowserClient` from `@supabase/ssr`. By default that persists the JWT to `localStorage`. Good news: the JWT actually *does* survive reload. Bad news: **nothing in `app/page.tsx` reads it on mount**. There's a helper `hasValidSession()` in [lib/auth.ts:74](lib/auth.ts#L74) — it's just never called.

### Why we can't just add `isLoggedIn` + `currentUser` to `partialize`

That would technically "work" for reload, but it breaks the user's second requirement: *close Chrome entirely → log out*. `localStorage` survives Chrome restarts indefinitely. We'd have a staff session sitting on a shared iPad for days. That's the vulnerability we're trying to avoid.

**We need a storage medium whose lifetime is "until the browser process ends":** that's `sessionStorage`.

`sessionStorage` properties that matter here:

- Survives `location.reload()` ✅
- Survives navigating away and back within the same tab ✅
- Cleared when the tab is closed ⚠️ (acceptable — see "Trade-offs" below)
- Cleared when the browser process fully quits ✅
- Scoped per-origin, not shared with other sites ✅
- Not accessible to other tabs (each tab has its own) ⚠️

---

## The Fix — High Level

1. **Move the Supabase auth session from `localStorage` to `sessionStorage`.** This alone makes the JWT die on Chrome close instead of persisting forever.
2. **Cache a minimal `currentUser` snapshot in `sessionStorage`** (not Zustand/localStorage) so we can re-hydrate `isLoggedIn` + `currentUser` on reload without an extra network round-trip.
3. **On app mount, before rendering `<Login>`**, call a new `bootstrapSession()` helper that:
   - Asks Supabase for the current session.
   - If the session is missing or expired → show login.
   - If the session is valid → restore `currentUser` from `sessionStorage` and call a new `restoreSession()` store action.
4. **Show a small "Loading…" splash** while the bootstrap check runs so the login screen doesn't flash for a split second on reload.
5. **Clear the `sessionStorage` cache on logout** and on any detected session expiry.

That's the whole thing. No schema changes, no Edge Function changes.

---

## Step-by-Step Changes

> File paths are relative to the repo root `c:\Users\kaust\OneDrive\Desktop\POS system\`.

### Step 1 — Switch Supabase auth storage to `sessionStorage`

**File:** [lib/supabase.ts](lib/supabase.ts)

Replace the contents with:

```ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./supabase-types";

let supabaseInstance: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getSupabase() {
  if (!supabaseInstance) {
    supabaseInstance = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          // Session lives only for the life of the browser process.
          // sessionStorage survives reloads but is cleared when Chrome fully quits.
          storage: typeof window !== "undefined" ? window.sessionStorage : undefined,
          storageKey: "suhashi-pos-auth",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      }
    );
  }
  return supabaseInstance;
}

export const supabase = typeof window !== "undefined" ? getSupabase() : null;
```

**Why these options:**

- `storage: window.sessionStorage` — the core of the fix. JWT dies on Chrome close.
- `storageKey` — explicit, so it's easy to spot in DevTools.
- `persistSession: true` — keep the JWT in storage across reloads within the session.
- `autoRefreshToken: true` — the client rotates the access token as it nears expiry, so long shifts don't silently drop.
- `detectSessionInUrl: false` — we never do OAuth redirects; setting this prevents spurious history parsing.

**Watch out:** because `sessionStorage` is per-tab, if a staff member opens the POS in a second tab, that tab will *not* see the first tab's session. They'd have to log in again in the new tab. For a POS pinned to one tab/app on an iPad this is fine. If the user complains later, the alternative is broadcasting the session via `BroadcastChannel` — do not implement that now.

### Step 2 — Add a `currentUser` cache helper

**File:** [lib/auth.ts](lib/auth.ts)

Append these helpers at the bottom of the file (keep everything that's already there):

```ts
const USER_CACHE_KEY = "suhashi-pos-current-user";

/**
 * Persist the logged-in staff user to sessionStorage so we can rehydrate
 * on reload without a network round-trip.
 */
export function cacheCurrentUser(user: StaffUser): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  } catch {
    // sessionStorage can throw in private mode / quota full — safe to ignore
  }
}

/**
 * Read the cached staff user from sessionStorage. Returns null if missing
 * or malformed. Callers MUST still verify the Supabase session is valid
 * before trusting this value.
 */
export function readCachedCurrentUser(): StaffUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.id === "string" &&
      typeof parsed.name === "string" &&
      typeof parsed.role === "string" &&
      typeof parsed.initials === "string"
    ) {
      return parsed as StaffUser;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearCachedCurrentUser(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(USER_CACHE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Bootstrap the session on app mount.
 *
 * Returns the cached user if (and only if) the Supabase session is valid.
 * Otherwise clears any stale cache and returns null.
 *
 * This is the single source of truth for "am I still logged in after reload?".
 */
export async function bootstrapSession(): Promise<StaffUser | null> {
  const valid = await hasValidSession();
  if (!valid) {
    clearCachedCurrentUser();
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
  await logoutFromSupabase();
  clearCachedCurrentUser();
  return null;
}
```

**Notes:**

- `bootstrapSession()` is the only place that decides "are we logged in after reload?". Do not sprinkle this logic elsewhere.
- The JWT-claims fallback path is defensive — most of the time the `sessionStorage` cache will be present. If claims don't line up, we force re-login rather than guess. That's the secure default.
- If `hasValidSession()` returns true but claims are missing, we hard-logout. Never return a partial `StaffUser`.

### Step 3 — Wire `cacheCurrentUser` into `loginWithPin`

**File:** [lib/auth.ts](lib/auth.ts)

Inside the existing `loginWithPin` function, after the `await supabase.auth.setSession(...)` call and *before* `return { session, user };`, add:

```ts
  cacheCurrentUser(user);
```

So the tail of that function reads:

```ts
  await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  cacheCurrentUser(user);

  return { session, user };
```

### Step 4 — Add a `restoreSession` store action

**File:** [lib/store.ts](lib/store.ts)

This action is identical to the existing `login` action except it **must not** write an audit log entry and **must not** start a new shift. It only flips `isLoggedIn` + `currentUser`.

1. In the `POSStore` type (search for `login: (user: User) => void;` near [lib/store.ts:47](lib/store.ts#L47) — the action list), add:

   ```ts
   restoreSession: (user: User) => void;
   ```

2. In the store creator (search for the `login:` implementation around [lib/store.ts:255](lib/store.ts#L255)), add right below it:

   ```ts
   restoreSession: (user) => {
     // Reload-path login: no audit entry, no shift side effects.
     set({
       isLoggedIn: true,
       currentUser: user,
     });
   },
   ```

   **Do not** call `addAuditEntry` here — audit entries are reserved for real human actions. A silent rehydrate on F5 is not a login event.

3. **Do not** add `isLoggedIn` / `currentUser` to `partialize`. They must stay out of `localStorage`.

### Step 5 — Clear the cache on logout

**File:** [lib/store.ts](lib/store.ts)

Find the `logout` action (around [lib/store.ts:262-265](lib/store.ts#L262-L265)). It currently just resets state. Update it so it also clears the sessionStorage caches and signs out of Supabase:

```ts
logout: () => {
  const userName = get().currentUser?.name || "Unknown";
  set({ isLoggedIn: false, currentUser: null, activeView: "dashboard" });
  get().addAuditEntry({
    action: "logout",
    userId: userName,
    details: "User logged out",
  });
  // Clear session-scoped caches and revoke the Supabase session.
  // Dynamic import avoids a circular dep between store.ts and auth.ts.
  if (typeof window !== "undefined") {
    import("./auth").then(({ logoutFromSupabase, clearCachedCurrentUser }) => {
      clearCachedCurrentUser();
      logoutFromSupabase().catch(() => {});
    });
  }
},
```

> ⚠️ Check whether the current `logout` action already writes an audit entry. If it does, keep exactly one — don't duplicate it.

Also check the `endShift` action around [lib/store.ts:1171](lib/store.ts#L1171) if it sets `isLoggedIn: false` — if so, apply the same `clearCachedCurrentUser()` + `logoutFromSupabase()` cleanup there. End of shift should fully log the user out.

### Step 6 — Bootstrap on app mount

**File:** [app/page.tsx](app/page.tsx)

This is the wiring step. Add a one-shot effect that runs `bootstrapSession()` before we decide whether to render `<Login>`.

Changes:

1. **Imports.** Add alongside the existing imports:

   ```ts
   import { bootstrapSession } from "@/lib/auth";
   ```

2. **Local state.** Inside the `POSApp` component, near the existing `animationState` state:

   ```ts
   const [bootstrapping, setBootstrapping] = useState(true);
   ```

3. **Bootstrap effect.** Add this effect near the top of the component (before the existing effects):

   ```ts
   useEffect(() => {
     let cancelled = false;
     (async () => {
       try {
         const user = await bootstrapSession();
         if (cancelled) return;
         if (user && !usePOSStore.getState().isLoggedIn) {
           usePOSStore.getState().restoreSession({
             id: user.id,
             name: user.name,
             role: user.role as any, // User['role'] in store.ts — cast once, safe.
             initials: user.initials,
           });
         }
       } catch (err) {
         console.error("Session bootstrap failed", err);
       } finally {
         if (!cancelled) setBootstrapping(false);
       }
     })();
     return () => {
       cancelled = true;
     };
   }, []);
   ```

4. **Gate the render.** Replace the existing early-return:

   ```tsx
   if (!isLoggedIn && !animationState.isAnimating) {
     return <Login onLogin={handleLogin} />;
   }
   ```

   with:

   ```tsx
   if (bootstrapping) {
     return (
       <div className="flex h-screen w-full items-center justify-center bg-background">
         <div className="text-sm text-muted-foreground">Loading…</div>
       </div>
     );
   }

   if (!isLoggedIn && !animationState.isAnimating) {
     return <Login onLogin={handleLogin} />;
   }
   ```

   Keep it dead simple — no logo animation, no skeletons. The splash should be invisible in the common case (session valid, restore is instant).

**Important:** the bootstrap effect must run before the hydration effect (`hydrateStoreFromSupabase`). It already will, because `hydrateStoreFromSupabase` runs inside the `if (isLoggedIn)` effect, which only fires after `restoreSession` sets `isLoggedIn = true`. Don't reorder.

### Step 7 — Sanity: don't persist auth accidentally

**File:** [lib/store.ts](lib/store.ts)

Double-check that neither `isLoggedIn` nor `currentUser` appears in `partialize` at [lib/store.ts:1302](lib/store.ts#L1302). If a previous agent added them, **remove them**. The whole security model depends on these two fields living only in React state + `sessionStorage`.

Also: **do not** bump `STORE_VERSION`. None of these changes touch the persisted store shape, so there's no migration to run. Bumping the version would nuke every device's cached menu/tables/orders for no reason.

---

## Verification Checklist

Run through every item. Don't mark done until you've actually done it in a real Chrome browser.

### Build & typecheck

- [ ] `npm run build` passes with zero errors.
- [ ] `npm run lint` has no new warnings.

### Happy path

- [ ] `npm run dev`, open `http://localhost:3000` in Chrome.
- [ ] Log in as Admin (`1234`) — lands on Dashboard.
- [ ] Hard reload (Ctrl+Shift+R). **Still on Dashboard, no login prompt.**
- [ ] Navigate to Kitchen → reload → still on Kitchen.
- [ ] DevTools → Application → Session Storage: confirm `suhashi-pos-auth` and `suhashi-pos-current-user` keys exist. Local Storage should NOT contain any auth JWT.

### Log-out triggers

- [ ] Click the in-app Logout button → back to PIN screen.
- [ ] After logout, DevTools → Session Storage: both keys are gone.
- [ ] Quit Chrome completely (all windows + background). Reopen → back to PIN screen. ✅ core requirement.
- [ ] End Shift → back to PIN screen and session cleared.

### Offline

- [ ] Log in. DevTools → Network → Offline.
- [ ] Reload. **Still logged in** (Supabase session check fails fast; the cache path should still hand us the user). If this breaks, see "Offline edge case" below.
- [ ] Create an order while offline → queued in sync queue as before.

### Security

- [ ] Open a second Chrome window (same profile). Navigate to localhost:3000 — may or may not be logged in (sessionStorage is per-tab). Either is acceptable.
- [ ] Incognito window → fresh login required. ✅
- [ ] With DevTools open, manually delete `suhashi-pos-auth` from Session Storage → reload → back to PIN screen. No stale user data visible.
- [ ] Manually delete `suhashi-pos-current-user` but keep `suhashi-pos-auth` → reload → `bootstrapSession()` reconstructs the user from JWT claims OR force-logs-out. Either is safe; it must NOT render the app with a null `currentUser`.

### Role checks

- [ ] Log in as Server → reload → still on the Server default view, sidebar shows Server-allowed items only. RBAC must still work after rehydrate.
- [ ] Repeat for Cashier and Kitchen.

---

## Offline Edge Case (read if verification step fails)

`hasValidSession()` reads from the in-memory Supabase client, which in turn loads from `sessionStorage`. It does **not** make a network call, so it works offline. If you find that reload-while-offline logs you out, the likely cause is `autoRefreshToken` firing, failing the refresh because there's no network, and the client clearing the session. Mitigation: keep `autoRefreshToken: true` (long shifts need it), but in `bootstrapSession()` only clear the cache when `hasValidSession()` returns false *and* `navigator.onLine` is true:

```ts
if (!valid) {
  if (typeof navigator !== "undefined" && navigator.onLine) {
    clearCachedCurrentUser();
  }
  return null;
}
```

Only apply this if the offline verification step actually fails. Don't pre-optimize.

---

## Security Notes (for the reviewer)

- **JWT in `sessionStorage` vs `localStorage`:** same XSS exposure in both (any script on the origin can read them). The difference is *lifetime*. For this POS, bounded lifetime is the feature. Anything better (HTTP-only cookies) would require routing all Supabase calls through a Next.js server route, which is out of scope here.
- **No new trust boundaries.** RLS still enforces access server-side based on the JWT claims. The changes in this doc only affect client-side session lifetime.
- **`currentUser` in sessionStorage is untrusted.** `bootstrapSession()` only returns it after verifying the Supabase session is valid. An attacker who plants a fake `suhashi-pos-current-user` value gets nothing — without a matching valid JWT, `bootstrapSession()` returns `null`.
- **No `isLoggedIn` / `currentUser` in the persisted Zustand store.** If you ever see a PR adding them to `partialize`, block it — that silently defeats the "log out on Chrome close" requirement.
- **Shared iPad scenario.** If staff A walks away without logging out and staff B refreshes, the app stays on staff A's session. That's the current behavior too, and is addressed by the existing Shift workflow — out of scope for this fix. Call it out to the user if they ask about it.

---

## Files Touched (summary)

| File              | What changed                                           |
| ----------------- | ------------------------------------------------------ |
| `lib/supabase.ts` | Supabase client uses `sessionStorage` for auth storage |
| `lib/auth.ts`     | +`cacheCurrentUser` / `readCachedCurrentUser` / `clearCachedCurrentUser` / `bootstrapSession`; `loginWithPin` now caches the user |
| `lib/store.ts`    | +`restoreSession` action; `logout` (and `endShift` if applicable) now clear the session cache and sign out of Supabase |
| `app/page.tsx`    | New `bootstrapSession()` effect, `bootstrapping` splash gate before `<Login>` |

No schema, no Edge Function, no env var, no dependency changes.

---

## Done When

1. Every checkbox in **Verification Checklist** is ticked.
2. `npm run build` is green.
3. The user can reload `suhashico.vercel.app` mid-shift and stay on the same screen.
4. Quitting Chrome and reopening lands on the PIN screen.
