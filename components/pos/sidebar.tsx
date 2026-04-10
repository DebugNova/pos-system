"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { usePOSStore } from "@/lib/store";
import { canAccessView, type ViewId } from "@/lib/roles";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  ShoppingCart,
  Grid3X3,
  ChefHat,
  Settings,
  Store,
  CreditCard,
  ClipboardList,
  LogOut,
  BarChart3,
  Sun,
  Moon,
} from "lucide-react";
import { CatLogo } from "@/components/ui/cat-logo";
import { EndShiftDialog } from "./end-shift-dialog";
import { SyncStatus } from "./sync-status";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

const navItems = [
  { id: "dashboard" as ViewId, label: "Dashboard", icon: LayoutDashboard },
  { id: "orders" as ViewId, label: "New Order", icon: ShoppingCart },
  { id: "tables" as ViewId, label: "Tables", icon: Grid3X3 },
  { id: "kitchen" as ViewId, label: "Kitchen", icon: ChefHat },
  { id: "aggregator" as ViewId, label: "Online", icon: Store, showBadge: true },
  { id: "billing" as ViewId, label: "Billing", icon: CreditCard },
  { id: "history" as ViewId, label: "History", icon: ClipboardList },
  { id: "settings" as ViewId, label: "Settings", icon: Settings },
] as const;

export function POSSidebar() {
  const { activeView, setActiveView, orders, currentUser, logout, currentShift } = usePOSStore();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showEndShift, setShowEndShift] = useState(false);
  const isOnline = useOnlineStatus();

  useEffect(() => setMounted(true), []);

  const userRole = currentUser?.role || "Kitchen"; // Most restrictive fallback

  // Filter nav items based on user role
  const visibleNavItems = navItems.filter((item) =>
    canAccessView(userRole, item.id)
  );

  const pendingAggregatorOrders = orders.filter(
    (o) => o.type === "aggregator" && o.status === "new"
  ).length;

  const handleLogoutClick = () => {
    if (currentShift) {
      setShowEndShift(true);
    } else {
      logout();
    }
  };

  const mobileBottomItems = visibleNavItems.slice(0, 4);
  const mobileMoreItems = visibleNavItems.slice(4);

  return (
    <>
      <aside className="hidden md:flex h-full w-16 flex-col bg-sidebar border-r border-sidebar-border lg:w-28 shadow-sm z-10 relative">
        {/* Logo */}
        <div className="flex h-16 items-center justify-center border-b border-sidebar-border lg:h-24">
          <button 
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = rect.left + rect.width / 2;
              const y = rect.top + rect.height / 2;
              window.dispatchEvent(new CustomEvent("trigger-logo-animation", { detail: { x, y } }));
            }}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary lg:h-16 lg:w-16 hover:opacity-90 active:scale-95 transition-all outline-none"
            title="Play Logo Animation"
          >
            <CatLogo className="h-full w-full p-0.5" onlyBlink />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto py-3 px-2 lg:gap-2 snap-y snap-mandatory">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            const showBadge = "showBadge" in item && item.showBadge && pendingAggregatorOrders > 0;

            return (
              <div key={item.id} className="relative w-full px-1.5 lg:px-2 snap-start">
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 h-[60%] w-1 rounded-r-md bg-primary z-20" />
                )}
                <button
                  onClick={() => setActiveView(item.id as typeof activeView)}
                  className={cn(
                    "relative flex h-14 w-full flex-col items-center justify-center rounded-lg transition-all active:scale-95 lg:h-16 lg:rounded-xl touch-target",
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                      : "text-muted-foreground hover:bg-primary/10 active:bg-primary/20 hover:text-primary active:bg-primary/20"
                  )}
                  title={item.label}
                >
                  <Icon className={cn("h-5 w-5 lg:h-6 lg:w-6", isActive ? "text-primary-foreground" : "")} />
                  <span className="hidden lg:block mt-1.5 text-xs font-medium leading-tight">{item.label}</span>
                  {showBadge && (
                    <span className="absolute -top-1 -right-1 flex h-5 min-w-[24px] px-1.5 items-center justify-center rounded-full bg-destructive text-[11px] sm:text-xs font-bold text-destructive-foreground shadow-sm lg:h-6 lg:min-w-[24px] lg:px-2 lg:text-xs">
                      {pendingAggregatorOrders}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </nav>

        {/* Theme Toggle & User */}
        <div className="flex flex-col items-center border-t border-sidebar-border py-4 gap-2 lg:py-5 lg:gap-3">
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-muted-foreground hover:bg-secondary hover:text-foreground active:bg-secondary/70 mb-1 lg:h-12 lg:w-12 rounded-full"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              title="Toggle theme"
            >
              {resolvedTheme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          )}
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground lg:h-12 lg:w-12 lg:text-base">
            {currentUser?.name.split(" ").map((n) => n[0]).join("").slice(0, 2) || "??"}
            <div 
              title={isOnline ? "Online" : "Offline"} 
              className={cn(
                "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-sidebar", 
                isOnline ? "bg-green-500" : "bg-amber-500"
              )} 
            />
          </div>
          <span className="hidden lg:block text-xs text-muted-foreground">{currentUser?.role || "Guest"}</span>
          
          <div className="mt-1 mb-2">
            <SyncStatus />
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-muted-foreground hover:text-destructive active:bg-destructive/10 lg:h-10 lg:w-10"
            onClick={handleLogoutClick}
          >
            <LogOut className="h-5 w-5 lg:h-5 lg:w-5" />
          </Button>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-[calc(env(safe-area-inset-bottom))] left-0 right-0 z-50 flex h-14 w-full items-center justify-around border-t border-sidebar-border bg-background shadow-[0_-4px_10px_rgba(0,0,0,0.05)] safe-bottom">
        {mobileBottomItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          const showBadge = "showBadge" in item && item.showBadge && pendingAggregatorOrders > 0;

          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as typeof activeView)}
              className={cn(
                "relative flex h-14 flex-1 flex-col items-center justify-center transition-all active:scale-95 touch-target",
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-primary active:bg-primary/5"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive ? "text-primary" : "")} />
              <span className="mt-0.5 text-[11px] sm:text-xs font-medium leading-tight">{item.label}</span>
              {showBadge && (
                <span className="absolute top-1 right-[calc(50%-16px)] flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground shadow-sm">
                  {pendingAggregatorOrders}
                </span>
              )}
            </button>
          );
        })}
        
        {mobileMoreItems.length > 0 && (
          <Sheet>
            <SheetTrigger asChild>
              <button className="relative flex h-14 flex-1 flex-col items-center justify-center transition-all active:scale-95 touch-target text-muted-foreground hover:text-primary active:bg-primary/5">
                <Menu className="h-5 w-5" />
                <span className="mt-0.5 text-[11px] sm:text-xs font-medium leading-tight">More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh] rounded-t-xl safe-bottom">
              <SheetHeader className="text-left">
                <SheetTitle>More</SheetTitle>
                <SheetDescription className="sr-only">Access additional views and settings.</SheetDescription>
              </SheetHeader>
              <div className="grid grid-cols-4 gap-4 py-6">
                {mobileMoreItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeView === item.id;
                  const showBadge = "showBadge" in item && item.showBadge && pendingAggregatorOrders > 0;
                  
                  return (
                    <SheetTrigger asChild key={item.id}>
                      <button
                        onClick={() => setActiveView(item.id as typeof activeView)}
                        className={cn(
                          "relative flex flex-col items-center justify-center gap-2 rounded-xl p-3 transition-all active:scale-95 touch-target",
                          isActive
                            ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                            : "bg-muted/50 text-muted-foreground hover:bg-primary/10 active:bg-primary/20 hover:text-primary active:bg-primary/20"
                        )}
                      >
                        <Icon className="h-6 w-6" />
                        <span className="text-[11px] font-medium text-center">{item.label}</span>
                        {showBadge && (
                          <span className="absolute -top-1 -right-1 flex h-5 min-w-[24px] px-1.5 items-center justify-center rounded-full bg-destructive text-[11px] sm:text-xs font-bold text-destructive-foreground shadow-sm">
                            {pendingAggregatorOrders}
                          </span>
                        )}
                      </button>
                    </SheetTrigger>
                  );
                })}
              </div>
              
              <div className="mt-auto border-t pt-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                    {currentUser?.name.split(" ").map((n) => n[0]).join("").slice(0, 2) || "??"}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{currentUser?.name}</span>
                    <span className="text-[11px] sm:text-xs text-muted-foreground">{currentUser?.role || "Guest"}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {mounted && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-muted-foreground touch-target"
                      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                    >
                      {resolvedTheme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-muted-foreground hover:text-destructive touch-target"
                    onClick={handleLogoutClick}
                  >
                    <LogOut className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </nav>

      <EndShiftDialog 
        open={showEndShift} 
        onOpenChange={setShowEndShift} 
      />
    </>
  );
}
