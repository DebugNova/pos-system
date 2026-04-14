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
          // Persist session in localStorage so it survives mobile tab suspensions
          // (iOS Safari / Android Chrome wipe sessionStorage when backgrounded).
          // For a dedicated café POS this is the correct choice.
          storage: typeof window !== "undefined" ? window.localStorage : undefined,
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
