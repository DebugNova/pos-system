"use client";

import { cn } from "@/lib/utils";
import { usePOSStore } from "@/lib/store";
import {
  LayoutDashboard,
  ShoppingCart,
  Grid3X3,
  ChefHat,
  BarChart3,
  Settings,
  Coffee,
} from "lucide-react";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "orders", label: "New Order", icon: ShoppingCart },
  { id: "tables", label: "Tables", icon: Grid3X3 },
  { id: "kitchen", label: "Kitchen", icon: ChefHat },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

export function POSSidebar() {
  const { activeView, setActiveView } = usePOSStore();

  return (
    <aside className="flex h-full w-20 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex h-20 items-center justify-center border-b border-sidebar-border">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <Coffee className="h-6 w-6 text-primary-foreground" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col items-center gap-2 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as typeof activeView)}
              className={cn(
                "flex h-14 w-14 flex-col items-center justify-center rounded-xl transition-all active:scale-95",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="mt-1 text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User */}
      <div className="flex items-center justify-center border-t border-sidebar-border py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
          AD
        </div>
      </div>
    </aside>
  );
}
