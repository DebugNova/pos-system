"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  BellRing,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Pencil } from "lucide-react";
import type { Order } from "@/lib/data";

const orderTypeIcons = {
  "dine-in": UtensilsCrossed,
  takeaway: ShoppingBag,
  delivery: Bike,
};

const orderTypeLabels: Record<string, string> = {
  "dine-in": "Dine In",
  takeaway: "Takeaway",
  delivery: "Delivery",
};

type FilterType = "all" | "dine-in" | "takeaway" | "delivery";
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

/**
 * Play a notification sound for new KDS orders.
 * Uses the Web Audio API to generate a clean bell-like tone.
 */
function playNewOrderSound() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.5);

    // Second tone (higher pitch) for a two-tone bell effect
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1175, audioCtx.currentTime + 0.15); // D6
    gain2.gain.setValueAtTime(0.25, audioCtx.currentTime + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.65);
    osc2.start(audioCtx.currentTime + 0.15);
    osc2.stop(audioCtx.currentTime + 0.65);
  } catch (e) {
    console.warn("[KDS] Could not play notification sound:", e);
  }
}

export function KitchenDisplay() {
  const { orders, updateOrderStatus, startEditOrder, markOrderServed } = usePOSStore();

  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("oldest");
  const [mobileTab, setMobileTab] = useState<"new" | "preparing" | "ready">("new");
  // Force re-render every 30 seconds to keep timestamps fresh
  const [, setTick] = useState(0);

  // ── Task 12: KDS new-order detection ──
  const [newOrderFlash, setNewOrderFlash] = useState(false);
  const prevNewOrderIdsRef = useRef<Set<string>>(new Set());
  const isInitialRenderRef = useRef(true);

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

  // ── Task 12: Detect newly arrived orders and play notification ──
  useEffect(() => {
    const currentNewIds = new Set(newOrders.map((o) => o.id));
    const prevIds = prevNewOrderIdsRef.current;

    // Skip on initial render (don't beep for orders already in the store)
    if (isInitialRenderRef.current) {
      isInitialRenderRef.current = false;
      prevNewOrderIdsRef.current = currentNewIds;
      return;
    }

    // Check if there's any genuinely new order ID we haven't seen before
    let hasNewArrival = false;
    currentNewIds.forEach((id) => {
      if (!prevIds.has(id)) {
        hasNewArrival = true;
      }
    });

    if (hasNewArrival) {
      // Play bell sound
      playNewOrderSound();

      // Flash the "New Orders" column header
      setNewOrderFlash(true);
      const timeout = setTimeout(() => setNewOrderFlash(false), 3000);
      prevNewOrderIdsRef.current = currentNewIds;
      return () => clearTimeout(timeout);
    }

    prevNewOrderIdsRef.current = currentNewIds;
  }, [newOrders]);

  const handleAccept = (orderId: string) => {
    updateOrderStatus(orderId, "preparing");
  };

  const handleReady = (orderId: string) => {
    updateOrderStatus(orderId, "ready");
  };

  const handleComplete = (orderId: string) => {
    markOrderServed(orderId);
  };

  const filterTabs: { id: FilterType; label: string; icon: React.ElementType }[] = [
    { id: "all", label: "All", icon: Filter },
    { id: "dine-in", label: "Dine In", icon: UtensilsCrossed },
    { id: "takeaway", label: "Takeaway", icon: ShoppingBag },
    { id: "delivery", label: "Delivery", icon: Bike },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-border p-3 sm:p-4 lg:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground lg:text-2xl">Kitchen Display</h1>
            <p className="text-xs text-muted-foreground lg:text-sm">
              Manage incoming orders and preparation status
            </p>
          </div>

          {/* Stats summary */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:overflow-visible sm:pb-0 lg:gap-4 snap-x snap-mandatory">
            {/* New */}
            <div className="flex shrink-0 items-center gap-2.5 rounded-xl border border-border/60 bg-card px-3 py-2 shadow-sm transition-all hover:bg-accent/50 sm:px-4 snap-start">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Clock className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] sm:text-xs font-semibold tracking-wider text-muted-foreground uppercase">New</span>
                <span className="text-base font-bold leading-none text-foreground">{newOrders.length}</span>
              </div>
            </div>

            {/* Preparing */}
            <div className="flex shrink-0 items-center gap-2.5 rounded-xl border border-border/60 bg-card px-3 py-2 shadow-sm transition-all hover:bg-accent/50 sm:px-4 snap-start">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10 text-warning">
                <ChefHat className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] sm:text-xs font-semibold tracking-wider text-muted-foreground uppercase">Preparing</span>
                <span className="text-base font-bold leading-none text-foreground">{preparingOrders.length}</span>
              </div>
            </div>

            {/* Ready */}
            <div className="flex shrink-0 items-center gap-2.5 rounded-xl border border-border/60 bg-card px-3 py-2 shadow-sm transition-all hover:bg-accent/50 sm:px-4 snap-start">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10 text-success">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] sm:text-xs font-semibold tracking-wider text-muted-foreground uppercase">Ready</span>
                <span className="text-base font-bold leading-none text-foreground">{readyOrders.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter bar & sort toggle */}
        <div className="flex items-center gap-2 overflow-x-auto snap-x snap-mandatory">
          {filterTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                variant={filter === tab.id ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "shrink-0 gap-1.5 text-xs lg:text-sm snap-start",
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

      {/* Mobile Tabs */}
      <div className="flex md:hidden px-3 pt-2 gap-2">
        <Button 
          variant={mobileTab === "new" ? "default" : "outline"} 
          onClick={() => setMobileTab("new")}
          className="flex-1"
        >
          New ({newOrders.length})
        </Button>
        <Button 
          variant={mobileTab === "preparing" ? "default" : "outline"} 
          onClick={() => setMobileTab("preparing")}
          className="flex-1"
        >
          Prep ({preparingOrders.length})
        </Button>
        <Button 
          variant={mobileTab === "ready" ? "default" : "outline"} 
          onClick={() => setMobileTab("ready")}
          className="flex-1"
        >
          Ready ({readyOrders.length})
        </Button>
      </div>

      {/* Kanban Board */}
      <div className="flex flex-1 flex-col gap-3 sm:gap-4 lg:gap-6 overflow-hidden p-3 sm:p-4 lg:p-6 md:flex-row">
        {/* New Orders Column */}
        <div className={cn("min-h-[200px] flex-1 flex-col rounded-lg bg-secondary/30 p-3 md:min-h-0 lg:rounded-xl lg:p-4", mobileTab === "new" ? "flex" : "hidden md:flex")}>
          <div className={cn("mb-3 flex items-center gap-2 lg:mb-4 transition-colors duration-300", newOrderFlash && "bg-primary/15 rounded-lg px-2 py-1")}>
            <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg bg-primary lg:h-8 lg:w-8", newOrderFlash && "animate-bounce")}>
              <Clock className="h-3.5 w-3.5 text-primary-foreground lg:h-4 lg:w-4" />
            </div>
            <h2 className="text-base font-semibold text-foreground lg:text-lg">New Orders</h2>
            {newOrderFlash && (
              <Badge className="animate-pulse bg-primary text-primary-foreground text-[11px] gap-1">
                <BellRing className="h-3 w-3" />
                NEW!
              </Badge>
            )}
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
                onEdit={() => startEditOrder(order.id)}
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
        <div className={cn("min-h-[200px] flex-1 flex-col rounded-lg bg-warning/10 p-3 md:min-h-0 lg:rounded-xl lg:p-4", mobileTab === "preparing" ? "flex" : "hidden md:flex")}>
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
                onEdit={() => startEditOrder(order.id)}
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
        <div className={cn("min-h-[200px] flex-1 flex-col rounded-lg bg-success/10 p-3 md:min-h-0 lg:rounded-xl lg:p-4", mobileTab === "ready" ? "flex" : "hidden md:flex")}>
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
                onEdit={() => startEditOrder(order.id)}
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
  onEdit: () => void;
}

function KitchenOrderCard({ order, column, onAction, onEdit }: KitchenOrderCardProps) {
  const [expanded, setExpanded] = useState(false);
  const TypeIcon = orderTypeIcons[order.type];
  const elapsed = getElapsedMinutes(order.createdAt);
  const urgency = getUrgency(elapsed);
  const styles = urgencyStyles[urgency];

  const totalItems = order.items.length + (order.supplementaryBills?.reduce((sum, b) => sum + b.items.length, 0) || 0);
  const showShowMore = totalItems > 3;

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
      label: "Mark Served",
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
            <Badge variant="secondary" className="text-[11px] sm:text-xs lg:text-xs">
              {orderTypeLabels[order.type] || order.type}
            </Badge>
            {/* Pay Later indicator */}
            {order.payLater && (
              <Badge
                variant="outline"
                className="text-[11px] sm:text-xs font-bold lg:text-xs bg-chart-3/10 text-chart-3 border-chart-3/30"
              >
                Pay Later
              </Badge>
            )}
          </div>
        </div>

        {/* Time + Table + Customer */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground" suppressHydrationWarning>
          {/* Elapsed time badge with urgency color */}
          <Badge variant="outline" className={cn("gap-1 border text-[11px] sm:text-xs", styles.badge)}>
            <Timer className="h-3 w-3" />
            {elapsed < 1 ? "Just now" : `${elapsed}m ago`}
          </Badge>

          {order.tableId && (
            <Badge variant="secondary" className="text-[11px] sm:text-xs lg:text-xs">
              Table {order.tableId.replace("t", "")}
            </Badge>
          )}
          {order.customerName && (
            <Badge variant="outline" className="text-[11px] sm:text-xs lg:text-xs">
              {order.customerName}
            </Badge>
          )}
          {order.customerPhone && (
            <Badge variant="outline" className="text-[11px] sm:text-xs lg:text-xs border-dashed">
              📞 {order.customerPhone}
            </Badge>
          )}
          {order.createdBy && (
            <Badge variant="outline" className="text-[11px] sm:text-xs lg:text-xs border-dashed opacity-70">
              by {order.createdBy}
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
          {order.items.slice(0, expanded ? undefined : 3).map((item) => (
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
          {/* Supplementary Items */}
          {(!showShowMore || expanded) && order.supplementaryBills?.map(bill =>
            bill.items.map(item => (
              <li key={item.id} className="flex flex-col text-sm border-l-2 border-warning/50 pl-2 ml-1 mt-1 font-medium bg-warning/5 rounded-r py-1">
                <div className="text-foreground">
                  <span className="text-[11px] sm:text-xs font-bold text-warning mr-1 tracking-wider uppercase">+ADD</span>
                  <span className="font-semibold text-primary">{item.quantity}x</span>{" "}
                  {item.name}
                  {item.variant && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({item.variant})
                    </span>
                  )}
                </div>
                {item.notes && (
                  <span className="text-xs text-muted-foreground italic pl-10">
                    ↳ {item.notes}
                  </span>
                )}
              </li>
            ))
          )}
          {showShowMore && (
            <li>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-xs h-7 mt-1 text-muted-foreground" 
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? "Show Less" : `+ ${totalItems - 3} more items`}
              </Button>
            </li>
          )}
        </ul>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            size="sm"
            variant={action.variant}
            className={cn("flex-1", action.className)}
            onClick={onAction}
          >
            <ActionIcon className="h-4 w-4" />
            {action.label}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
