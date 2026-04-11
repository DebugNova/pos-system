"use client";

import { useEffect, useState, useRef } from "react";
import { POSSidebar } from "@/components/pos/sidebar";
import { Dashboard } from "@/components/pos/dashboard";
import { NewOrder } from "@/components/pos/new-order";
import { TableManagement } from "@/components/pos/table-management";
import { KitchenDisplay } from "@/components/pos/kitchen-display";
import { ReportsContent } from "@/components/pos/reports";
import { Settings } from "@/components/pos/settings";
import { AggregatorInbox } from "@/components/pos/aggregator-inbox";
import { Billing } from "@/components/pos/billing";
import { OrderHistory } from "@/components/pos/order-history";
import { Login } from "@/components/pos/login";
import { TransitionOverlay } from "@/components/pos/transition-overlay";
import { usePOSStore } from "@/lib/store";
import { canAccessView, getDefaultView, type ViewId } from "@/lib/roles";
import { SWRegister } from "@/components/sw-register";
import { OfflineBanner } from "@/components/pos/offline-banner";
import { hydrateStoreFromSupabase, startBackgroundSync } from "@/lib/hydrate";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";

export default function POSApp() {
  const { activeView, isLoggedIn, login, currentUser, setActiveView } = usePOSStore();
  const [animationState, setAnimationState] = useState<{ isAnimating: boolean, origin: {x: number, y: number} | null }>({ isAnimating: false, origin: null });
  const bgSyncCleanupRef = useRef<(() => void) | null>(null);

  // Activate Supabase Realtime subscriptions when logged in (Task 11)
  useRealtimeSync();

  // Enforce role-based access: if the current view isn't allowed, redirect to default
  useEffect(() => {
    usePOSStore.getState().clearSyncedMutations();
    
    if (isLoggedIn && currentUser) {
      if (!canAccessView(currentUser.role, activeView as ViewId)) {
        const defaultView = getDefaultView(currentUser.role);
        setActiveView(defaultView as typeof activeView);
      }
    }
  }, [isLoggedIn, currentUser, activeView, setActiveView]);

  // Start background sync when logged in, stop when logged out
  useEffect(() => {
    if (isLoggedIn) {
      // Hydrate store from Supabase after login
      if (navigator.onLine) {
        hydrateStoreFromSupabase().catch(console.error);
      }

      // Start the background sync loop (mutation drain + periodic re-hydrate)
      bgSyncCleanupRef.current = startBackgroundSync();
    }

    return () => {
      if (bgSyncCleanupRef.current) {
        bgSyncCleanupRef.current();
        bgSyncCleanupRef.current = null;
      }
    };
  }, [isLoggedIn]);

  const handleLogin = (user: any, origin?: {x: number, y: number}) => {
    if (origin) {
      setAnimationState({ isAnimating: true, origin });
      // The dashboard renders in the background because isLoggedIn becomes true instantly
      login(user);
    } else {
      login(user); // Fallback
    }
  };

  // Listen for the replay triggers locally from anywhere
  useEffect(() => {
    const handleTrigger = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setAnimationState(prev => prev.isAnimating ? prev : { isAnimating: true, origin: customEvent.detail });
      }
    };
    window.addEventListener("trigger-logo-animation", handleTrigger);
    return () => window.removeEventListener("trigger-logo-animation", handleTrigger);
  }, []);

  if (!isLoggedIn && !animationState.isAnimating) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="relative flex h-screen bg-background overflow-hidden w-full">
      {isLoggedIn && (
        <div className="flex w-full h-full flex-col">
          <OfflineBanner />
          <div className="flex w-full h-full overflow-hidden">
            <POSSidebar />
            <main className="flex-1 overflow-auto pb-14 md:pb-0">
              {activeView === "dashboard" && <Dashboard />}
            {activeView === "orders" && <NewOrder />}
            {activeView === "tables" && <TableManagement />}
            {activeView === "kitchen" && <KitchenDisplay />}
            {activeView === "reports" && <ReportsContent />}
            {activeView === "aggregator" && <AggregatorInbox />}
            {activeView === "billing" && <Billing />}
            {activeView === "history" && <OrderHistory />}
            {activeView === "settings" && <Settings />}
            </main>
          </div>
        </div>
      )}
      
      <SWRegister />
      <TransitionOverlay
        isAnimating={animationState.isAnimating}
        origin={animationState.origin}
        onComplete={() => setAnimationState({ isAnimating: false, origin: null })}
      />
    </div>
  );
}
