"use client";

import { useEffect, useState, useRef } from "react";
import { POSSidebar } from "@/components/pos/sidebar";
import { Dashboard } from "@/components/pos/dashboard";
import { NewOrder } from "@/components/pos/new-order";
import { TableManagement } from "@/components/pos/table-management";
import { KitchenDisplay } from "@/components/pos/kitchen-display";
import { ReportsContent } from "@/components/pos/reports";
import { Settings } from "@/components/pos/settings";
import { Billing } from "@/components/pos/billing";
import { Subscription } from "@/components/pos/subscription";
import { SubscriptionLockModal } from "@/components/pos/subscription-lock-modal";
import { SubscriptionExpiryWarningModal } from "@/components/pos/subscription-expiry-modal";
import { OrderHistory } from "@/components/pos/order-history";
import { Login } from "@/components/pos/login";
import { TransitionOverlay } from "@/components/pos/transition-overlay";
import { usePOSStore } from "@/lib/store";
import { canAccessView, getDefaultView, type ViewId } from "@/lib/roles";
import { SWRegister } from "@/components/sw-register";
import { OfflineBanner } from "@/components/pos/offline-banner";
import { hydrateStoreFromSupabase, startBackgroundSync } from "@/lib/hydrate";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { bootstrapSession } from "@/lib/auth";
import { ThemeProvider } from "@/components/theme-provider";

export default function POSApp() {
  const { activeView, isLoggedIn, login, currentUser, setActiveView, isSubscriptionActive, subscriptionExpiryDate, lastDismissedExpiryWarningDate, dismissExpiryWarning } = usePOSStore();
  const [bootstrapping, setBootstrapping] = useState(true);
  const [animationState, setAnimationState] = useState<{ isAnimating: boolean, origin: {x: number, y: number} | null }>({ isAnimating: false, origin: null });
  const bgSyncCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await bootstrapSession();
        if (cancelled) return;
        if (user && !usePOSStore.getState().isLoggedIn) {
          usePOSStore.getState().restoreSession({
            id: user.id,
            name: user.name,
            role: user.role as any,
            initials: user.initials,
          } as any);
        }
      } catch (err) {
        console.error("Session bootstrap failed", err);
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  if (bootstrapping) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!isLoggedIn && !animationState.isAnimating) {
    return <Login onLogin={handleLogin} />;
  }

  // Calculate time remaining if subscription is active and we have an expiry date
  let timeRemainingStr = "";
  let showExpiryWarning = false;

  const calculateTimeRemainingStr = (diffTime: number, expiryDate: Date) => {
    if (diffTime < 0) return "soon";
    const hours = diffTime / (1000 * 60 * 60);
    
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const isToday = expiryDate.getDate() === today.getDate() && expiryDate.getMonth() === today.getMonth() && expiryDate.getFullYear() === today.getFullYear();
    const isTomorrow = expiryDate.getDate() === tomorrow.getDate() && expiryDate.getMonth() === tomorrow.getMonth() && expiryDate.getFullYear() === tomorrow.getFullYear();
    
    if (isToday) {
      if (hours < 1) return "in less than an hour";
      return `tonight (in ${Math.floor(hours)} ${Math.floor(hours) === 1 ? 'hour' : 'hours'})`;
    }
    
    if (isTomorrow) {
      if (hours < 24) return `tomorrow (in ${Math.floor(hours)} ${Math.floor(hours) === 1 ? 'hour' : 'hours'})`;
      return "tomorrow";
    }

    if (hours < 24) {
      const h = Math.max(1, Math.floor(hours));
      return `in ${h} ${h === 1 ? 'hour' : 'hours'}`;
    } else {
      const d = Math.ceil(hours / 24);
      return `in ${d} ${d === 1 ? 'day' : 'days'}`;
    }
  };
  
  if (isSubscriptionActive && subscriptionExpiryDate) {
    const todayStr = new Date().toISOString().split('T')[0];
    const hasDismissedToday = lastDismissedExpiryWarningDate === todayStr;
    
    if (!hasDismissedToday) {
      const expiryDate = new Date(subscriptionExpiryDate);
      const today = new Date();
      const diffTime = expiryDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 3 && diffDays >= 0) {
        timeRemainingStr = calculateTimeRemainingStr(diffTime, expiryDate);
        showExpiryWarning = true;
      }
    }
  } else if (isSubscriptionActive === false) {
    // Grace period warning for July 1st cutoff
    const todayStr = new Date().toISOString().split('T')[0];
    const hasDismissedToday = lastDismissedExpiryWarningDate === todayStr;
    
    if (!hasDismissedToday) {
      const expiryDate = new Date("2026-07-01T00:00:00Z");
      const today = new Date();
      const diffTime = expiryDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 3 && diffDays > 0) {
        timeRemainingStr = calculateTimeRemainingStr(diffTime, expiryDate);
        showExpiryWarning = true;
      }
    }
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className="relative flex h-[100dvh] bg-background overflow-hidden w-full">
        {isLoggedIn && (
          <div className="flex w-full h-full flex-col">
            <OfflineBanner />
            {isSubscriptionActive === false && activeView !== "subscription" && new Date() >= new Date("2026-07-01T00:00:00Z") ? (
              <div className="flex w-full h-full overflow-hidden relative">
                {/* Blurred POS Background */}
                <div className="flex w-full h-full overflow-hidden blur-[8px] pointer-events-none opacity-50 scale-[0.98] transition-all">
                  <POSSidebar />
                  <main className="flex-1 overflow-auto pb-14 md:pb-0">
                    <Dashboard />
                  </main>
                </div>
                
                {/* Lock Modal */}
                <SubscriptionLockModal onViewPlans={() => setActiveView("subscription")} />
              </div>
            ) : isSubscriptionActive === false && activeView === "subscription" ? (
              <div className="flex w-full h-full overflow-hidden">
                <main className="flex-1 overflow-auto bg-background">
                  <Subscription />
                </main>
              </div>
            ) : (
              <div className="flex w-full h-full overflow-hidden min-h-0">
                <POSSidebar />
                <main 
                  className="flex-1 overflow-y-auto overflow-x-auto pb-14 md:pb-0 min-h-0 min-w-0 touch-pan-y relative" 
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  {activeView === "dashboard" && <Dashboard />}
                  {activeView === "orders" && <NewOrder />}
                  {activeView === "tables" && <TableManagement />}
                  {activeView === "kitchen" && <KitchenDisplay />}
                  {activeView === "reports" && <ReportsContent />}
                  {activeView === "billing" && <Billing />}
                  {activeView === "subscription" && <Subscription />}
                  {activeView === "history" && <OrderHistory />}
                  {activeView === "settings" && <Settings />}
                </main>
              </div>
            )}
        </div>
      )}
      </div>
      
      <SWRegister />
      <TransitionOverlay
        isAnimating={animationState.isAnimating}
        origin={animationState.origin}
        onComplete={() => setAnimationState({ isAnimating: false, origin: null })}
      />
      {showExpiryWarning && (
        <SubscriptionExpiryWarningModal
          timeRemainingStr={timeRemainingStr}
          onViewPlans={() => {
            dismissExpiryWarning();
            setActiveView("subscription");
          }}
          onDismiss={dismissExpiryWarning}
        />
      )}
    </ThemeProvider>
  );
}
