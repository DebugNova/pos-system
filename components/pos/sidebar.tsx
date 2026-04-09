"use client";

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

  const userRole = currentUser?.role || "Kitchen"; // Most restrictive fallback

  // Filter nav items based on user role
  const visibleNavItems = navItems.filter((item) =>
    canAccessView(userRole, item.id)
  );

  const pendingAggregatorOrders = orders.filter(
    (o) => o.type === "aggregator" && o.status === "new"
  ).length;

  return (
    <aside className="flex h-full w-[72px] flex-col bg-sidebar border-r border-sidebar-border lg:w-20">
      {/* Logo */}
      <div className="flex h-16 items-center justify-center border-b border-sidebar-border lg:h-20">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary lg:h-12 lg:w-12">
          <CatLogo className="h-full w-full p-0.5" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col items-center gap-0.5 overflow-y-auto py-2 px-1.5 lg:gap-1 lg:px-2">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          const showBadge = "showBadge" in item && item.showBadge && pendingAggregatorOrders > 0;

          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as typeof activeView)}
              className={cn(
                "relative flex h-12 w-full flex-col items-center justify-center rounded-lg transition-all active:scale-95 lg:h-14 lg:rounded-xl",
                isActive
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 lg:h-5 lg:w-5" />
              <span className="mt-0.5 text-[8px] font-medium leading-tight lg:mt-1 lg:text-[9px]">{item.label}</span>
              {showBadge && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground lg:-top-1 lg:-right-1 lg:h-5 lg:w-5 lg:text-[10px]">
                  {pendingAggregatorOrders}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User */}
      <div className="flex flex-col items-center border-t border-sidebar-border py-2 gap-1.5 lg:py-3 lg:gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground lg:h-10 lg:w-10 lg:text-sm">
          {currentUser?.name.split(" ").map((n) => n[0]).join("").slice(0, 2) || "??"}
        </div>
        <span className="text-[8px] text-muted-foreground lg:text-[9px]">{currentUser?.role || "Guest"}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive lg:h-8 lg:w-8"
          onClick={logout}
        >
          <LogOut className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
        </Button>
      </div>
    </aside>
  );
}
