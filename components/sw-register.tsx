"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { usePOSStore } from "@/lib/store";
import packageJson from "../package.json";

export function SWRegister() {
  const cart = usePOSStore((state) => state.cart);
  const [updateWorker, setUpdateWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // Check for update toast
      const lastVersion = localStorage.getItem("app_version");
      if (lastVersion && lastVersion !== packageJson.version) {
        toast({
          title: "App Updated",
          description: `Updated to version ${packageJson.version}`,
        });
      }
      localStorage.setItem("app_version", packageJson.version);

      // Check if there's already a waiting worker
      navigator.serviceWorker.ready.then((registration) => {
        if (registration.waiting) {
          setUpdateWorker(registration.waiting);
        }

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          newWorker?.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateWorker(newWorker);
            }
          });
        });
      });

      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });

      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "SYNC_MUTATIONS") {
           import("@/lib/sync").then((mod) => mod.syncPendingMutations());
        }
      });
    }
  }, []);

  useEffect(() => {
    if (updateWorker && cart.length === 0) {
      toast({
        title: "Update available",
        description: "A new version is available. Update?",
        action: (
          <ToastAction
            altText="Update now"
            onClick={() => {
              updateWorker.postMessage({ type: "SKIP_WAITING" });
            }}
          >
            Update now
          </ToastAction>
        ),
      });
      // Clear to prevent duplicate toasts
      setUpdateWorker(null);
    }
  }, [updateWorker, cart.length]);

  return null;
}
