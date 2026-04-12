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
