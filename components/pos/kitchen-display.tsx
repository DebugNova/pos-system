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
  XCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Pencil } from "lucide-react";
import type { Order } from "@/lib/data";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

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


export function KitchenDisplay() {
  const { orders, updateOrderStatus, startEditOrder, markOrderServed, cancelPlacedOrder } = usePOSStore();

  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("oldest");
  const [mobileTab, setMobileTab] = useState<"new" | "preparing" | "ready">("new");
  // Force re-render every 30 seconds to keep timestamps fresh
  const [, setTick] = useState(0);

  // ── Task 12: KDS new-order detection ──
  const [newOrderFlash, setNewOrderFlash] = useState(false);
  const prevNewOrderIdsRef = useRef<Set<string>>(new Set());
  const isInitialRenderRef = useRef(true);
  // Track orders that have already advanced past `new` on this terminal.
  // Prevents the "NEW!" flash badge from firing if a stale realtime echo
  // briefly regresses a preparing/ready order back to `new`.
  const advancedIdsRef = useRef<Set<string>>(new Set());

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
    // Record any order we've ever seen past the `new` state so a stale
    // realtime regression can't retrigger the flash badge.
    for (const o of orders) {
      if (
        o.status === "preparing" ||
        o.status === "ready" ||
        o.status === "served-unpaid" ||
        o.status === "completed" ||
        o.status === "cancelled"
      ) {
        advancedIdsRef.current.add(o.id);
      }
    }

    const currentNewIds = new Set(newOrders.map((o) => o.id));
    const prevIds = prevNewOrderIdsRef.current;
    const advanced = advancedIdsRef.current;

    // Skip on initial render (don't beep for orders already in the store)
    if (isInitialRenderRef.current) {
      isInitialRenderRef.current = false;
      prevNewOrderIdsRef.current = currentNewIds;
      return;
    }

    // Genuine arrival = never seen before AND never advanced past `new`
    let hasNewArrival = false;
    currentNewIds.forEach((id) => {
      if (!prevIds.has(id) && !advanced.has(id)) {
        hasNewArrival = true;
      }
    });

    if (hasNewArrival) {
      // Flash the "New Orders" column header
      setNewOrderFlash(true);
      const timeout = setTimeout(() => setNewOrderFlash(false), 3000);
      prevNewOrderIdsRef.current = currentNewIds;
      return () => clearTimeout(timeout);
    }

    prevNewOrderIdsRef.current = currentNewIds;
  }, [newOrders, orders]);

  const handleAccept = (orderId: string) => {
    updateOrderStatus(orderId, "preparing");
  };

  const handleReady = (orderId: string) => {
    updateOrderStatus(orderId, "ready");
  };

  const handleComplete = (orderId: string) => {
    markOrderServed(orderId);
  };

  const handleCancel = (orderId: string, reason: string) => {
    const order = orders.find((o) => o.id === orderId);
    cancelPlacedOrder(orderId, reason || undefined);
    const refundMsg = order?.payment && !order.payLater
      ? ` Full refund of ₹${order.grandTotal ?? order.total} recorded.`
      : "";
    toast.success(`Order ${orderId.toUpperCase()} cancelled.${refundMsg}`);
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
          <div className="flex items-center gap-3 overflow-x-auto pb-1 sm:overflow-visible sm:pb-0 lg:gap-4 snap-x snap-mandatory hide-scrollbar">
            {/* New */}
            <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm px-4 py-2.5 shadow-sm transition-all hover:bg-card/80 snap-start relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-full blur-[20px] -mr-8 -mt-8 transition-all group-hover:bg-primary/20" />
              <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-primary/10 text-primary border border-primary/20">
                <Clock className="h-5 w-5" />
              </div>
              <div className="flex flex-col relative z-10">
                <span className="text-[10px] sm:text-[11px] font-bold tracking-widest text-muted-foreground uppercase">New</span>
                <span className="text-xl font-black leading-none text-foreground">{newOrders.length}</span>
              </div>
            </div>

            {/* Preparing */}
            <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm px-4 py-2.5 shadow-sm transition-all hover:bg-card/80 snap-start relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-warning/10 rounded-full blur-[20px] -mr-8 -mt-8 transition-all group-hover:bg-warning/20" />
              <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-warning/10 text-warning border border-warning/20">
                <ChefHat className="h-5 w-5" />
              </div>
              <div className="flex flex-col relative z-10">
                <span className="text-[10px] sm:text-[11px] font-bold tracking-widest text-muted-foreground uppercase">Preparing</span>
                <span className="text-xl font-black leading-none text-foreground">{preparingOrders.length}</span>
              </div>
            </div>

            {/* Ready */}
            <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm px-4 py-2.5 shadow-sm transition-all hover:bg-card/80 snap-start relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-success/10 rounded-full blur-[20px] -mr-8 -mt-8 transition-all group-hover:bg-success/20" />
              <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-success/10 text-success border border-success/20">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="flex flex-col relative z-10">
                <span className="text-[10px] sm:text-[11px] font-bold tracking-widest text-muted-foreground uppercase">Ready</span>
                <span className="text-xl font-black leading-none text-foreground">{readyOrders.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter bar & sort toggle */}
        <div className="flex items-center gap-3 overflow-x-auto snap-x snap-mandatory pt-2">
          <div className="flex bg-secondary/50 p-1 rounded-xl gap-1 shrink-0">
            {filterTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Button
                  key={tab.id}
                  variant={filter === tab.id ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "shrink-0 gap-1.5 text-[13px] font-semibold rounded-lg h-9 px-3.5 transition-all",
                    filter === tab.id 
                      ? "bg-background text-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                  onClick={() => setFilter(tab.id)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {tab.label}
                </Button>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-[13px] font-semibold h-9 rounded-xl border-border/60 shadow-sm"
              onClick={() => setSort(sort === "oldest" ? "newest" : "oldest")}
            >
              <ArrowUpDown className="h-4 w-4" />
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
      <div className="flex flex-1 flex-col gap-4 lg:gap-6 overflow-hidden p-4 lg:p-6 md:flex-row bg-background">
        {/* New Orders Column */}
        <div className={cn("min-h-[200px] flex-1 min-w-0 flex-col rounded-2xl bg-primary/[0.03] border border-primary/10 p-4 md:min-h-0 lg:p-5", mobileTab === "new" ? "flex" : "hidden md:flex")}>
          <div className={cn("mb-4 flex items-center gap-3 transition-colors duration-300", newOrderFlash && "bg-primary/15 rounded-xl px-3 py-2")}>
            <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm", newOrderFlash && "animate-bounce shadow-[0_0_15px_rgba(234,117,49,0.5)]")}>
              <Clock className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-black truncate text-foreground tracking-tight">New Orders</h2>
            {newOrderFlash && (
              <Badge className="animate-pulse bg-primary text-primary-foreground text-xs gap-1 shadow-sm">
                <BellRing className="h-3.5 w-3.5 shrink-0" />
                NEW!
              </Badge>
            )}
            <div className="ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
              {newOrders.length}
            </div>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden pr-1.5 hide-scrollbar">
            {newOrders.map((order) => (
              <KitchenOrderCard
                key={order.id}
                order={order}
                column="new"
                onAction={() => handleAccept(order.id)}
                onEdit={() => startEditOrder(order.id)}
                onCancel={(reason) => handleCancel(order.id, reason)}
              />
            ))}
            {newOrders.length === 0 && (
              <div className="flex h-40 flex-col items-center justify-center gap-3 text-muted-foreground bg-card/50 rounded-2xl border border-dashed border-border/50">
                <Clock className="h-8 w-8 opacity-20" />
                <span className="text-sm font-medium">No new orders</span>
              </div>
            )}
          </div>
        </div>

        {/* Preparing Column */}
        <div className={cn("min-h-[200px] flex-1 min-w-0 flex-col rounded-2xl bg-warning/[0.03] border border-warning/10 p-4 md:min-h-0 lg:p-5", mobileTab === "preparing" ? "flex" : "hidden md:flex")}>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-warning text-warning-foreground shadow-sm">
              <ChefHat className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-black truncate text-foreground tracking-tight">Preparing</h2>
            <div className="ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-warning/20 text-xs font-bold text-warning-700 dark:text-warning-400">
              {preparingOrders.length}
            </div>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden pr-1.5 hide-scrollbar">
            {preparingOrders.map((order) => (
              <KitchenOrderCard
                key={order.id}
                order={order}
                column="preparing"
                onAction={() => handleReady(order.id)}
                onEdit={() => startEditOrder(order.id)}
                onCancel={(reason) => handleCancel(order.id, reason)}
              />
            ))}
            {preparingOrders.length === 0 && (
              <div className="flex h-40 flex-col items-center justify-center gap-3 text-muted-foreground bg-card/50 rounded-2xl border border-dashed border-border/50">
                <ChefHat className="h-8 w-8 opacity-20" />
                <span className="text-sm font-medium">No orders preparing</span>
              </div>
            )}
          </div>
        </div>

        {/* Ready Column */}
        <div className={cn("min-h-[200px] flex-1 min-w-0 flex-col rounded-2xl bg-success/[0.03] border border-success/10 p-4 md:min-h-0 lg:p-5", mobileTab === "ready" ? "flex" : "hidden md:flex")}>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-success text-success-foreground shadow-sm">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-black truncate text-foreground tracking-tight">Ready</h2>
            <div className="ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-success/20 text-xs font-bold text-success-700 dark:text-success-400">
              {readyOrders.length}
            </div>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden pr-1.5 hide-scrollbar">
            {readyOrders.map((order) => (
              <KitchenOrderCard
                key={order.id}
                order={order}
                column="ready"
                onAction={() => handleComplete(order.id)}
                onEdit={() => startEditOrder(order.id)}
                onCancel={(reason) => handleCancel(order.id, reason)}
              />
            ))}
            {readyOrders.length === 0 && (
              <div className="flex h-40 flex-col items-center justify-center gap-3 text-muted-foreground bg-card/50 rounded-2xl border border-dashed border-border/50">
                <CheckCircle2 className="h-8 w-8 opacity-20" />
                <span className="text-sm font-medium">No orders ready</span>
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
  onCancel: (reason: string) => void;
}

function KitchenOrderCard({ order, column, onAction, onEdit, onCancel }: KitchenOrderCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const isPaid = !!order.payment && !order.payLater;
  const refundableAmount = order.grandTotal ?? order.total;
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
      ? "border-primary/20"
      : column === "preparing"
        ? "border-warning/30"
        : "border-success/30";

  const glowClass = 
    column === "new"
      ? "bg-primary"
      : column === "preparing"
        ? "bg-warning"
        : "bg-success";

  return (
    <Card
      className={cn(
        "bg-card/95 backdrop-blur-md transition-all duration-300 relative overflow-hidden group shadow-sm hover:shadow-md border",
        borderClass,
        styles.ring,
        styles.pulse && "animate-pulse-subtle"
      )}
    >
      {/* Top glowing edge */}
      <div className={cn(
        "absolute top-0 left-0 w-full h-[3px]",
        glowClass,
        styles.pulse && "bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)]"
      )} />
      <CardHeader className="pb-3 border-b border-border/40 px-4 pt-4 sm:pt-5">
        <div className="flex flex-col gap-3">
          {/* Row 1: Order/Table ID + Timer */}
          <div className="flex items-start justify-between w-full">
            <div className="flex flex-col">
               <div className="flex items-center gap-2 mb-1.5">
                 {order.tableId && (
                   <span className="text-[15px] sm:text-[17px] font-black text-foreground bg-secondary/80 px-2 py-0.5 rounded-md shadow-sm border border-border/50">
                     T-{order.tableId.replace("t", "")}
                   </span>
                 )}
                 <span className="text-[13px] sm:text-sm font-bold text-muted-foreground uppercase tracking-widest">
                   #{order.id.slice(0, 4)}
                 </span>
               </div>
               <div className="flex items-center gap-1.5 min-w-0">
                 <TypeIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                 <span className="text-[13px] sm:text-sm font-semibold text-foreground truncate" title={order.customerName || "Guest"}>
                   {order.customerName || "Guest"}
                 </span>
               </div>
            </div>
            
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              {/* Urgency Badge */}
              <Badge variant="outline" className={cn("gap-1 border font-bold text-xs px-2.5 py-1 shadow-sm transition-colors", styles.badge, styles.pulse && "bg-red-500 text-white border-red-500")}>
                <Timer className="h-3.5 w-3.5 shrink-0" />
                {elapsed < 1 ? "Just now" : `${elapsed}m` }
              </Badge>
              {order.payLater && (
                <Badge variant="outline" className="text-[9px] font-bold bg-chart-3/10 text-chart-3 border-chart-3/30 uppercase tracking-wider mt-1">
                  Pay Later
                </Badge>
              )}
            </div>
          </div>

          {/* Row 2: Secondary Info */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground w-full">
            <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-wider bg-secondary/60">
              {orderTypeLabels[order.type] || order.type}
            </Badge>
            {order.customerPhone && (
              <Badge variant="outline" className="text-[9px] font-medium border-dashed border-border/60">
                📞 {order.customerPhone}
              </Badge>
            )}
            {order.createdBy && (
              <span className="text-[10px] font-medium opacity-60 ml-auto truncate max-w-[80px]">
                by {order.createdBy}
              </span>
            )}
          </div>
        </div>

        {/* Urgency and Notes stacked below Row 2 */}
        {(urgency === "urgent" && column !== "ready") || order.orderNotes ? (
          <div className="pt-2.5 flex flex-col gap-1.5 mt-2 border-t border-dashed border-border/40">
            {urgency === "urgent" && column !== "ready" && (
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded-md w-max">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Waiting over {elapsed} minutes!
              </div>
            )}
            {order.orderNotes && (
              <p className="text-[11px] sm:text-xs italic text-primary/90 flex items-start line-clamp-2" title={order.orderNotes}>
                <span className="font-semibold mr-1 not-italic opacity-70">Note:</span> {order.orderNotes}
              </p>
            )}
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="p-4 pt-3 flex flex-col gap-4 flex-1">
        {/* Row 3: Item list */}
        <ul className="space-y-2.5">
          {order.items.slice(0, expanded ? undefined : 3).map((item) => (
            <li key={item.id} className="flex flex-col text-sm border-b border-border/40 pb-2.5 last:border-0 last:pb-0">
              <span className="text-foreground flex items-start leading-snug">
                <span className="font-black text-primary text-[15px] min-w-[28px] inline-block shrink-0">{item.quantity}x</span>
                <span className="flex-1 min-w-0 break-words font-semibold text-[14px]">
                  {item.name}
                  {item.variant && (
                    <span className="ml-1.5 text-[11px] sm:text-xs font-medium text-muted-foreground break-words bg-secondary/50 px-1.5 py-0.5 rounded">
                      {item.variant}
                    </span>
                  )}
                </span>
              </span>
              {item.modifiers && item.modifiers.length > 0 && (
                <span className="text-[11px] sm:text-xs text-muted-foreground pl-[28px] mt-1 leading-tight font-medium">
                  + {item.modifiers.map(m => m.name).join(", ")}
                </span>
              )}
              {item.notes && (
                <span className="text-[11px] sm:text-xs text-primary/80 italic pl-[28px] mt-1 leading-tight font-medium bg-primary/5 rounded-md py-1 px-2 border border-primary/10 w-fit">
                  ↳ {item.notes}
                </span>
              )}
            </li>
          ))}
          {/* Supplementary Items */}
          {(!showShowMore || expanded) && order.supplementaryBills?.map(bill =>
            bill.items.map(item => (
              <li key={item.id} className="flex flex-col text-sm border-l-4 border-warning pl-3 ml-0.5 mt-3 py-2 bg-warning/5 rounded-r-xl pb-2.5 last:mb-0 shadow-sm">
                <div className="text-foreground flex items-start leading-snug">
                  <span className="text-[9px] sm:text-[10px] font-black text-warning mr-2 tracking-wider uppercase mt-[3px] shrink-0 bg-warning/10 px-1.5 py-0.5 rounded">ADD</span>
                  <span className="font-black text-primary text-[15px] min-w-[28px] inline-block shrink-0">{item.quantity}x</span>
                  <span className="flex-1 min-w-0 break-words font-semibold text-[14px]">
                    {item.name}
                    {item.variant && (
                      <span className="ml-1 text-[11px] sm:text-xs text-muted-foreground break-words">
                        ({item.variant})
                      </span>
                    )}
                  </span>
                </div>
                {item.modifiers && item.modifiers.length > 0 && (
                  <span className="text-[11px] sm:text-xs text-muted-foreground pl-[40px] mt-0.5 leading-tight font-medium break-words">
                    + {item.modifiers.map(m => m.name).join(", ")}
                  </span>
                )}
                {item.notes && (
                  <span className="text-[11px] sm:text-xs text-muted-foreground italic pl-[40px] mt-0.5 leading-tight break-words">
                    ↳ {item.notes}
                  </span>
                )}
              </li>
            ))
          )}
          {showShowMore && (
            <li>
              <Button 
                variant="secondary" 
                size="sm" 
                className="w-full text-[11px] sm:text-xs h-7 mt-1.5 text-muted-foreground hover:text-foreground font-medium" 
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? "Show Less" : `View ${totalItems - 3} more items`}
              </Button>
            </li>
          )}
        </ul>

        {/* Row 4: Action buttons */}
        <div className="flex items-center gap-2 pt-2 mt-auto w-full">
          <Button
            size="sm"
            variant="outline"
            className="h-10 w-10 p-0 shrink-0 rounded-xl"
            onClick={onEdit}
            title="Edit order"
          >
            <Pencil className="h-4 w-4 text-muted-foreground" />
          </Button>
          <AlertDialog open={showCancel} onOpenChange={setShowCancel}>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-9 px-2.5 min-w-0 text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                title="Cancel order"
              >
                <XCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline truncate">Cancel</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="w-[95vw] max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel order {order.id.toUpperCase()}?</AlertDialogTitle>
                <AlertDialogDescription>
                  {isPaid
                    ? `This order was paid. Cancelling will record a full refund of ₹${refundableAmount.toLocaleString("en-IN")} and release the table.`
                    : `This order will be cancelled and the table released. No payment has been taken.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2 pt-2">
                <Textarea
                  placeholder="Reason (e.g., wrong order, customer left...)"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="resize-none bg-secondary border-none"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setCancelReason("")}>Keep Order</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    onCancel(cancelReason.trim());
                    setCancelReason("");
                    setShowCancel(false);
                  }}
                >
                  Confirm Cancel
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            size="sm"
            variant={action.variant}
            className={cn("flex-1 h-10 gap-2 font-black text-sm min-w-0 rounded-xl", action.className)}
            onClick={onAction}
          >
            <ActionIcon className="h-4 w-4 shrink-0" />
            <span className="truncate uppercase tracking-wider">{action.label}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
