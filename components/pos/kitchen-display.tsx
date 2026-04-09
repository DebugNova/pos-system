"use client";

import { useState, useEffect } from "react";
import { usePOSStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  ChefHat,
  CheckCircle2,
  PlayCircle,
  UtensilsCrossed,
  ShoppingBag,
  Bike,
  Store,
  AlertTriangle,
  Filter,
  ArrowUpDown,
  Timer,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Order } from "@/lib/data";

const orderTypeIcons = {
  "dine-in": UtensilsCrossed,
  takeaway: ShoppingBag,
  delivery: Bike,
  aggregator: Store,
};

const orderTypeLabels: Record<string, string> = {
  "dine-in": "Dine In",
  takeaway: "Takeaway",
  delivery: "Delivery",
  aggregator: "Online",
};

type FilterType = "all" | "dine-in" | "takeaway" | "delivery" | "aggregator";
type SortType = "oldest" | "newest";

/** Returns elapsed minutes since order creation */
function getElapsedMinutes(createdAt: Date): number {
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
}

/** Returns a color-coded urgency level based on elapsed time */
function getUrgency(minutes: number): "fresh" | "warning" | "urgent" {
  if (minutes < 5) return "fresh";
  if (minutes < 10) return "warning";
  return "urgent";
}

const urgencyStyles = {
  fresh: {
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    ring: "",
    pulse: false,
  },
  warning: {
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    ring: "ring-1 ring-amber-500/20",
    pulse: false,
  },
  urgent: {
    badge: "bg-red-500/15 text-red-400 border-red-500/30",
    ring: "ring-1 ring-red-500/30",
    pulse: true,
  },
};

/** Sort orders: oldest first (FIFO — what kitchen needs) or newest first */
function sortOrders(orders: Order[], sort: SortType): Order[] {
  return [...orders].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    return sort === "oldest" ? timeA - timeB : timeB - timeA;
  });
}

export function KitchenDisplay() {
  const { orders, updateOrderStatus } = usePOSStore();

  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("oldest");
  // Force re-render every 30 seconds to keep timestamps fresh
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  // Filter orders by type
  const applyFilter = (list: Order[]) => {
    if (filter === "all") return list;
    return list.filter((o) => o.type === filter);
  };

  const newOrders = sortOrders(
    applyFilter(orders.filter((o) => o.status === "new")),
    sort
  );
  const preparingOrders = sortOrders(
    applyFilter(orders.filter((o) => o.status === "preparing")),
    sort
  );
  const readyOrders = sortOrders(
    applyFilter(orders.filter((o) => o.status === "ready")),
    sort
  );

  const handleAccept = (orderId: string) => {
    updateOrderStatus(orderId, "preparing");
  };

  const handleReady = (orderId: string) => {
    updateOrderStatus(orderId, "ready");
  };

  const handleComplete = (orderId: string) => {
    updateOrderStatus(orderId, "completed");
  };

  const filterTabs: { id: FilterType; label: string; icon: React.ElementType }[] = [
    { id: "all", label: "All", icon: Filter },
    { id: "dine-in", label: "Dine In", icon: UtensilsCrossed },
    { id: "takeaway", label: "Takeaway", icon: ShoppingBag },
    { id: "delivery", label: "Delivery", icon: Bike },
    { id: "aggregator", label: "Online", icon: Store },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-border p-3 lg:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground lg:text-2xl">Kitchen Display</h1>
            <p className="text-xs text-muted-foreground lg:text-sm">
              Manage incoming orders and preparation status
            </p>
          </div>

          {/* Stats summary */}
          <div className="flex items-center gap-3 lg:gap-6">
            <div className="flex items-center gap-1.5 lg:gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20 lg:h-8 lg:w-8">
                <Clock className="h-3.5 w-3.5 text-primary lg:h-4 lg:w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground lg:text-sm">{newOrders.length}</p>
                <p className="text-[10px] text-muted-foreground lg:text-xs">New</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 lg:gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning/20 lg:h-8 lg:w-8">
                <ChefHat className="h-3.5 w-3.5 text-warning lg:h-4 lg:w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground lg:text-sm">
                  {preparingOrders.length}
                </p>
                <p className="text-[10px] text-muted-foreground lg:text-xs">Preparing</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 lg:gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-success/20 lg:h-8 lg:w-8">
                <CheckCircle2 className="h-3.5 w-3.5 text-success lg:h-4 lg:w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground lg:text-sm">{readyOrders.length}</p>
                <p className="text-[10px] text-muted-foreground lg:text-xs">Ready</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter bar & sort toggle */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {filterTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                variant={filter === tab.id ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "shrink-0 gap-1.5 text-xs lg:text-sm",
                  filter === tab.id && "bg-primary text-primary-foreground"
                )}
                onClick={() => setFilter(tab.id)}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </Button>
            );
          })}

          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground"
              onClick={() => setSort(sort === "oldest" ? "newest" : "oldest")}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              {sort === "oldest" ? "Oldest first" : "Newest first"}
            </Button>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex flex-1 flex-col gap-3 overflow-hidden p-3 md:flex-row lg:gap-4 lg:p-4">
        {/* New Orders Column */}
        <div className="flex min-h-[200px] flex-1 flex-col rounded-lg bg-secondary/30 p-3 md:min-h-0 lg:rounded-xl lg:p-4">
          <div className="mb-3 flex items-center gap-2 lg:mb-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary lg:h-8 lg:w-8">
              <Clock className="h-3.5 w-3.5 text-primary-foreground lg:h-4 lg:w-4" />
            </div>
            <h2 className="text-base font-semibold text-foreground lg:text-lg">New Orders</h2>
            <Badge variant="secondary" className="ml-auto text-xs">
              {newOrders.length}
            </Badge>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto lg:space-y-3">
            {newOrders.map((order) => (
              <KitchenOrderCard
                key={order.id}
                order={order}
                column="new"
                onAction={() => handleAccept(order.id)}
              />
            ))}
            {newOrders.length === 0 && (
              <div className="flex h-32 flex-col items-center justify-center gap-1 text-muted-foreground">
                <Clock className="h-8 w-8 opacity-20" />
                <span className="text-sm">No new orders</span>
              </div>
            )}
          </div>
        </div>

        {/* Preparing Column */}
        <div className="flex min-h-[200px] flex-1 flex-col rounded-lg bg-warning/10 p-3 md:min-h-0 lg:rounded-xl lg:p-4">
          <div className="mb-3 flex items-center gap-2 lg:mb-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning lg:h-8 lg:w-8">
              <ChefHat className="h-3.5 w-3.5 text-warning-foreground lg:h-4 lg:w-4" />
            </div>
            <h2 className="text-base font-semibold text-foreground lg:text-lg">Preparing</h2>
            <Badge variant="secondary" className="ml-auto text-xs">
              {preparingOrders.length}
            </Badge>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto lg:space-y-3">
            {preparingOrders.map((order) => (
              <KitchenOrderCard
                key={order.id}
                order={order}
                column="preparing"
                onAction={() => handleReady(order.id)}
              />
            ))}
            {preparingOrders.length === 0 && (
              <div className="flex h-32 flex-col items-center justify-center gap-1 text-muted-foreground">
                <ChefHat className="h-8 w-8 opacity-20" />
                <span className="text-sm">No orders preparing</span>
              </div>
            )}
          </div>
        </div>

        {/* Ready Column */}
        <div className="flex min-h-[200px] flex-1 flex-col rounded-lg bg-success/10 p-3 md:min-h-0 lg:rounded-xl lg:p-4">
          <div className="mb-3 flex items-center gap-2 lg:mb-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-success lg:h-8 lg:w-8">
              <CheckCircle2 className="h-3.5 w-3.5 text-success-foreground lg:h-4 lg:w-4" />
            </div>
            <h2 className="text-base font-semibold text-foreground lg:text-lg">Ready</h2>
            <Badge variant="secondary" className="ml-auto text-xs">
              {readyOrders.length}
            </Badge>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto lg:space-y-3">
            {readyOrders.map((order) => (
              <KitchenOrderCard
                key={order.id}
                order={order}
                column="ready"
                onAction={() => handleComplete(order.id)}
              />
            ))}
            {readyOrders.length === 0 && (
              <div className="flex h-32 flex-col items-center justify-center gap-1 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 opacity-20" />
                <span className="text-sm">No orders ready</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────
 * Kitchen Order Card Component
 * ─────────────────────────── */

interface KitchenOrderCardProps {
  order: Order;
  column: "new" | "preparing" | "ready";
  onAction: () => void;
}

function KitchenOrderCard({ order, column, onAction }: KitchenOrderCardProps) {
  const TypeIcon = orderTypeIcons[order.type];
  const elapsed = getElapsedMinutes(order.createdAt);
  const urgency = getUrgency(elapsed);
  const styles = urgencyStyles[urgency];

  const actionConfig = {
    new: {
      label: "Accept Order",
      icon: PlayCircle,
      className: "w-full gap-1.5",
      variant: "default" as const,
    },
    preparing: {
      label: "Mark Ready",
      icon: CheckCircle2,
      className: "w-full gap-1.5 border-success text-success hover:bg-success/10",
      variant: "outline" as const,
    },
    ready: {
      label: "Complete",
      icon: CheckCircle2,
      className: "w-full gap-1.5 bg-success text-success-foreground hover:bg-success/90",
      variant: "default" as const,
    },
  };

  const action = actionConfig[column];
  const ActionIcon = action.icon;

  const borderClass =
    column === "new"
      ? "border-border"
      : column === "preparing"
        ? "border-warning/30"
        : "border-success/30";

  return (
    <Card
      className={cn(
        "bg-card transition-all duration-300",
        borderClass,
        styles.ring,
        styles.pulse && "animate-pulse-subtle"
      )}
    >
      <CardHeader className="pb-2">
        {/* Order ID + Type + Source */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TypeIcon className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base text-foreground">
              {order.id.toUpperCase()}
            </CardTitle>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Order type label */}
            <Badge variant="secondary" className="text-[10px] lg:text-xs">
              {orderTypeLabels[order.type] || order.type}
            </Badge>
            {/* Aggregator platform badge — prominent */}
            {order.platform && (
              <Badge
                className="text-[10px] font-bold lg:text-xs"
                style={{
                  backgroundColor:
                    order.platform === "swiggy"
                      ? "rgba(252,128,25,0.15)"
                      : "rgba(226,55,68,0.15)",
                  borderColor:
                    order.platform === "swiggy" ? "#fc8019" : "#e23744",
                  color:
                    order.platform === "swiggy" ? "#fc8019" : "#e23744",
                }}
              >
                {order.platform === "swiggy" ? "🟠 Swiggy" : "🔴 Zomato"}
              </Badge>
            )}
          </div>
        </div>

        {/* Time + Table + Customer */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground" suppressHydrationWarning>
          {/* Elapsed time badge with urgency color */}
          <Badge variant="outline" className={cn("gap-1 border text-[10px] lg:text-xs", styles.badge)}>
            <Timer className="h-3 w-3" />
            {elapsed < 1 ? "Just now" : `${elapsed}m ago`}
          </Badge>

          {order.tableId && (
            <Badge variant="secondary" className="text-[10px] lg:text-xs">
              Table {order.tableId.replace("t", "")}
            </Badge>
          )}
          {order.customerName && (
            <Badge variant="outline" className="text-[10px] lg:text-xs">
              {order.customerName}
            </Badge>
          )}
        </div>

        {/* Urgency warning for stale orders */}
        {urgency === "urgent" && column !== "ready" && (
          <div className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-400">
            <AlertTriangle className="h-3 w-3" />
            Waiting over {elapsed} minutes!
          </div>
        )}

        {/* Order notes */}
        {order.orderNotes && (
          <p className="mt-1 text-xs italic text-primary">
            Note: {order.orderNotes}
          </p>
        )}
      </CardHeader>

      <CardContent>
        {/* Item list */}
        <ul className="mb-3 space-y-1">
          {order.items.map((item) => (
            <li key={item.id} className="flex flex-col text-sm">
              <span className="text-foreground">
                <span className="font-semibold text-primary">{item.quantity}x</span>{" "}
                {item.name}
                {item.variant && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({item.variant})
                  </span>
                )}
              </span>
              {item.notes && (
                <span className="text-xs text-muted-foreground italic pl-5">
                  ↳ {item.notes}
                </span>
              )}
            </li>
          ))}
        </ul>

        {/* Action button */}
        <Button
          size="sm"
          variant={action.variant}
          className={action.className}
          onClick={onAction}
        >
          <ActionIcon className="h-4 w-4" />
          {action.label}
        </Button>
      </CardContent>
    </Card>
  );
}
