import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

/**
 * Shared reference to the "pos-control" broadcast channel that
 * `useRealtimeSync` sets up while the app is mounted. Used to send
 * control events (e.g. a global nuke/reset) from non-React code.
 *
 * When the hook mounts it calls `setActiveControlChannel(channel)`.
 * On cleanup it calls `setActiveControlChannel(null)` (guarded so it
 * only clears its own reference).
 */
let activeControlChannel: RealtimeChannel | null = null;

export function setActiveControlChannel(ch: RealtimeChannel | null) {
  if (ch === null) {
    activeControlChannel = null;
    return;
  }
  activeControlChannel = ch;
}

export function clearActiveControlChannelIfMatches(ch: RealtimeChannel | null) {
  if (activeControlChannel === ch) {
    activeControlChannel = null;
  }
}

/**
 * Send a broadcast event on the "pos-control" channel. Uses the active
 * channel owned by `useRealtimeSync` when present; otherwise spins up a
 * throwaway channel, waits for it to subscribe, sends, and tears it down.
 */
export async function sendPosControlBroadcast(
  event: string,
  payload: Record<string, any> = {}
): Promise<void> {
  try {
    if (activeControlChannel) {
      await activeControlChannel.send({
        type: "broadcast",
        event,
        payload,
      });
      return;
    }
    const supabase = getSupabase();
    if (!supabase) return;
    const ch = supabase.channel("pos-control");
    await new Promise<void>((resolve) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }, 3000);
      ch.subscribe((status) => {
        if (status === "SUBSCRIBED" && !resolved) {
          ch.send({ type: "broadcast", event, payload })
            .finally(() => {
              clearTimeout(timeout);
              setTimeout(() => {
                try { supabase.removeChannel(ch); } catch {}
                if (!resolved) {
                  resolved = true;
                  resolve();
                }
              }, 300);
            });
        }
      });
    });
  } catch (err) {
    console.error("[realtime-control] sendPosControlBroadcast failed:", err);
  }
}
