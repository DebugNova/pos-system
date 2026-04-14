import { getSupabase } from "./supabase";

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
}

export interface StaffUser {
  id: string;
  name: string;
  role: string;
  initials: string;
}

/**
 * Authenticate a staff member by their unique 4-digit PIN.
 * Calls the `pin-auth` Edge Function which validates the PIN against the
 * `staff` table and returns a Supabase JWT with custom claims.
 */
export async function loginWithPin(
  pin: string,
  staffId?: string,
): Promise<{
  session: AuthSession;
  user: StaffUser;
}> {
  const supabase = getSupabase();
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const response = await fetch(`${projectUrl}/functions/v1/pin-auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin, staffId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Login failed");
  }

  const { session, user } = await response.json();

  // Set the session in the Supabase client so all subsequent queries
  // carry the JWT (RLS enforcement)
  await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  cacheCurrentUser(user);

  return { session, user };
}

/**
 * Sign out the current Supabase session.
 */
export async function logoutFromSupabase(): Promise<void> {
  const supabase = getSupabase();
  await supabase.auth.signOut();
}

/**
 * Retrieve the current Supabase auth session (if any).
 * Returns null when not authenticated.
 */
export async function getSession() {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Check if we have a valid, non-expired session.
 * Used for auto-login on app start.
 */
export async function hasValidSession(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  // Check expiry — session.expires_at is a Unix timestamp in seconds
  const now = Math.floor(Date.now() / 1000);
  return session.expires_at ? session.expires_at > now : false;
}

const USER_CACHE_KEY = "suhashi-pos-current-user";
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
