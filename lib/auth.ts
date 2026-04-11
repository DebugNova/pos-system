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
export async function loginWithPin(pin: string): Promise<{
  session: AuthSession;
  user: StaffUser;
}> {
  const supabase = getSupabase();
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const response = await fetch(`${projectUrl}/functions/v1/pin-auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
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
