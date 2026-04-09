"use client";

import { usePOSStore } from "@/lib/store";
import { syncPendingMutations } from "@/lib/sync";
import { Cloud, CloudUpload, CloudOff, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function SyncStatus() {
  const { syncQueue, isOnline, isSyncing, lastSyncedAt } = usePOSStore();

  const pendingCount = syncQueue.filter(m => m.status === "pending" || m.status === "failed").length;

  if (!isOnline) {
    return (
      <Badge variant="destructive" className="flex items-center justify-center gap-1.5 h-8">
        <CloudOff className="h-3.5 w-3.5" />
        <span className="hidden lg:inline">{pendingCount} queued</span>
      </Badge>
    );
  }

  if (isSyncing) {
    return (
      <Badge variant="secondary" className="flex items-center justify-center gap-1.5 h-8">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        <span className="hidden lg:inline border-amber-500/0">Syncing...</span>
      </Badge>
    );
  }

  if (pendingCount > 0) {
    return (
      <Badge 
        onClick={() => syncPendingMutations()} 
        variant="outline" 
        className="flex items-center justify-center gap-1.5 h-8 cursor-pointer bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20 transition-colors"
      >
        <CloudUpload className="h-3.5 w-3.5" />
        <span className="hidden lg:inline">{pendingCount} pending</span>
      </Badge>
    );
  }

  return (
    <Badge 
      variant="outline" 
      className="flex items-center justify-center gap-1.5 h-8 border-success/20 text-success bg-success/10 cursor-pointer" 
      title={lastSyncedAt ? `Last synced: ${new Date(lastSyncedAt).toLocaleTimeString()}` : "Synced"}
    >
      <Cloud className="h-3.5 w-3.5" />
      <span className="hidden lg:inline">Synced</span>
    </Badge>
  );
}
