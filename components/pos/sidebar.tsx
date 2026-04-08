"use client";

import { cn } from "@/lib/utils";
import { usePOSStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  ShoppingCart,
  Grid3X3,
  ChefHat,
  BarChart3,
  Settings,
  Coffee,
  Store,
  CreditCard,
  ClipboardList,
  LogOut,
} from "lucide-react";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "orders", label: "New Order", icon: ShoppingCart },
  { id: "tables", label: "Tables", icon: Grid3X3 },
  { id: "kitchen", label: "Kitchen", icon: ChefHat },
  { id: "aggregator", label: "Online", icon: Store, showBadge: true },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "history", label: "History", icon: ClipboardList },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

export function POSSidebar() {
  const { activeView, setActiveView, orders, currentUser, logout } = usePOSStore();

  const pendingAggregatorOrders = orders.filter(
    (o) => o.type === "aggregator" && o.status === "new"
  ).length;

  return (
    <aside className="flex h-full w-20 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex h-20 items-center justify-center border-b border-sidebar-border">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <Coffee className="h-6 w-6 text-primary-foreground" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          const showBadge = item.showBadge && pendingAggregatorOrders > 0;

          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as typeof activeView)}
              className={cn(
                "relative flex h-14 w-14 flex-col items-center justify-center rounded-xl transition-all active:scale-95",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="mt-1 text-[9px] font-medium leading-tight">{item.label}</span>
              {showBadge && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {pendingAggregatorOrders}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User */}
      <div className="flex flex-col items-center border-t border-sidebar-border py-3 gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
          {currentUser?.name.split(" ").map((n) => n[0]).join("").slice(0, 2) || "??"}
        </div>
        <span className="text-[9px] text-muted-foreground">{currentUser?.role || "Guest"}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={logout}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  );
}
