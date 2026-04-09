"use client";

import { useOnlineStatus } from "@/hooks/use-online-status";
import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setShow(true);
    } else {
      setShow(false);
    }
  }, [isOnline]);

  if (!show) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-center gap-2 text-amber-600 text-sm font-medium">
      <WifiOff className="h-4 w-4" />
      You're working offline. Orders will sync when connection returns.
    </div>
  );
}
