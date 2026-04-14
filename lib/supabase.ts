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
        realtime: {
          // Ping every 15s instead of the default 30s to keep the WebSocket
          // alive through NAT timeouts and iOS background throttling.
          // One WebSocket per device — minimal impact on free-tier limits.
          heartbeatIntervalMs: 15_000,
          // Reconnect faster: 500ms, 1s, 2s, 4s, 8s (cap at 8s for café use)
          reconnectAfterMs: (tries: number) => Math.min(500 * Math.pow(2, tries), 8_000),
        },
      }
    );
  }
  return supabaseInstance;
}

export const supabase = typeof window !== "undefined" ? getSupabase() : null;
