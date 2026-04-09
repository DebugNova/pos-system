import { useState, useEffect } from 'react';
import { usePOSStore } from '@/lib/store';
import { syncPendingMutations } from '@/lib/sync';
import { toast } from 'sonner';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Initial state
    const initialStatus = typeof navigator !== 'undefined' ? navigator.onLine : true;
    setIsOnline(initialStatus);
    usePOSStore.setState({ isOnline: initialStatus });

    const handleOnline = () => {
      setIsOnline(true);
      usePOSStore.setState({ isOnline: true });
      
      const pendingCount = usePOSStore.getState().syncQueue.filter(m => m.status === "pending" || m.status === "failed").length;
      if (pendingCount > 0) {
        toast.info(`Back online — syncing ${pendingCount} orders…`);
      } else {
        toast.success("Back online");
      }

      setTimeout(() => {
        syncPendingMutations().then(() => {
           if (usePOSStore.getState().syncQueue.filter(m => m.status === "pending" || m.status === "failed").length === 0 && pendingCount > 0) {
             toast.success("All changes synced");
           }
        });
      }, 1000);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      usePOSStore.setState({ isOnline: false });
      toast.warning("Connection lost — working offline");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
