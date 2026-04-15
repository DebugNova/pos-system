"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { usePOSStore } from "@/lib/store";
import packageJson from "../package.json";

export function SWRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const lastVersion = localStorage.getItem("app_version");
    if (lastVersion && lastVersion !== packageJson.version) {
      toast.success(`App updated to version ${packageJson.version}`);
    }
    localStorage.setItem("app_version", packageJson.version);

    // Auto-apply waiting workers: no user prompt. The moment a new SW is
    // installed we tell it to take over. With sw.ts now using skipWaiting,
    // this happens automatically — but we also handle the case where a
    // previous install left a waiting worker behind.
    const activateWaiting = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }
    };

    navigator.serviceWorker.ready.then((registration) => {
      activateWaiting(registration);

      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        newWorker?.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            // Only auto-activate if user isn't in the middle of taking an
            // order (cart empty). Otherwise wait until cart clears.
            const cart = usePOSStore.getState().cart;
            if (cart.length === 0) {
              newWorker.postMessage({ type: "SKIP_WAITING" });
            }
          }
        });
      });
    });

    // When controller changes (new SW took over), reload to pick up the
    // new bundle. Guard against reload loops.
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    // Check for updates on every foreground event — this is what the user
    // means by "every launch should be the latest version". iOS PWA doesn't
    // do this on its own.
    const checkForUpdates = () => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return;
        reg.update().catch(() => {});
        activateWaiting(reg);
      });
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") checkForUpdates();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", checkForUpdates);
    window.addEventListener("online", checkForUpdates);

    const messageHandler = (event: MessageEvent) => {
      if (event.data?.type === "SYNC_MUTATIONS") {
        import("@/lib/sync").then((mod) => mod.syncPendingMutations());
      }
    };
    navigator.serviceWorker.addEventListener("message", messageHandler);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", checkForUpdates);
      window.removeEventListener("online", checkForUpdates);
      navigator.serviceWorker.removeEventListener("message", messageHandler);
    };
  }, []);

  return null;
}
