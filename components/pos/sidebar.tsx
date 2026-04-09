"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { usePOSStore } from "@/lib/store";
import { canAccessView, type ViewId } from "@/lib/roles";
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
  const { activeView, setActiveView, orders, currentUser, logout } = usePOSStore();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const userRole = currentUser?.role || "Kitchen"; // Most restrictive fallback

  // Filter nav items based on user role
  const visibleNavItems = navItems.filter((item) =>
    canAccessView(userRole, item.id)
  );

  const pendingAggregatorOrders = orders.filter(
    (o) => o.type === "aggregator" && o.status === "new"
  ).length;

  return (
    <aside className="flex h-full w-20 flex-col bg-sidebar border-r border-sidebar-border lg:w-28 shadow-sm z-10 relative">
      {/* Logo */}
      <div className="flex h-20 items-center justify-center border-b border-sidebar-border lg:h-24">
        <button 
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            // Calculate absolute center to dispatch perfectly to the animation system
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            window.dispatchEvent(new CustomEvent("trigger-logo-animation", { detail: { x, y } }));
          }}
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary lg:h-16 lg:w-16 hover:opacity-90 active:scale-95 transition-all outline-none"
          title="Play Logo Animation"
        >
          <CatLogo className="h-full w-full p-0.5" onlyBlink />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto py-3 px-2 lg:gap-2">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          const showBadge = "showBadge" in item && item.showBadge && pendingAggregatorOrders > 0;

          return (
            <div key={item.id} className="relative w-full px-1.5 lg:px-2">
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-[60%] w-1 rounded-r-md bg-primary z-20" />
              )}
              <button
                onClick={() => setActiveView(item.id as typeof activeView)}
                className={cn(
                  "relative flex h-14 w-full flex-col items-center justify-center rounded-lg transition-all active:scale-95 lg:h-16 lg:rounded-xl",
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                )}
              >
                <Icon className={cn("h-5 w-5 lg:h-6 lg:w-6", isActive ? "text-primary-foreground" : "")} />
                <span className="mt-1 text-[10px] font-medium leading-tight lg:mt-1.5 lg:text-xs">{item.label}</span>
                {showBadge && (
                  <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground shadow-sm lg:h-6 lg:min-w-[24px] lg:px-2 lg:text-xs">
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
            className="h-10 w-10 text-muted-foreground hover:bg-secondary hover:text-foreground mb-1 lg:h-12 lg:w-12 rounded-full"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            title="Toggle theme"
          >
            {resolvedTheme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        )}
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground lg:h-12 lg:w-12 lg:text-base">
          {currentUser?.name.split(" ").map((n) => n[0]).join("").slice(0, 2) || "??"}
        </div>
        <span className="text-[10px] text-muted-foreground lg:text-xs">{currentUser?.role || "Guest"}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive lg:h-10 lg:w-10"
          onClick={logout}
        >
          <LogOut className="h-4 w-4 lg:h-5 lg:w-5" />
        </Button>
      </div>
    </aside>
  );
}
