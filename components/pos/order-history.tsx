"use client";

import { useState, useEffect } from "react";
import { usePOSStore } from "@/lib/store";
import { pollActiveOrders } from "@/lib/hydrate";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search,
  Filter,
  Clock,
  CheckCircle2,
  XCircle,
  ChefHat,
  UtensilsCrossed,
  ShoppingBag,
  Bike,
  Store,
  Printer,
  RotateCcw,
  Eye,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ReceiptTemplate } from "./receipt-template";

const statusFilters = [
  { id: "all", label: "All Orders", icon: null },
  { id: "new", label: "New", icon: Clock },
  { id: "preparing", label: "Preparing", icon: ChefHat },
  { id: "ready", label: "Ready", icon: CheckCircle2 },
  { id: "completed", label: "Completed", icon: CheckCircle2 },
  { id: "cancelled", label: "Cancelled", icon: XCircle },
] as const;

const typeFilters = [
  { id: "all", label: "All Types" },
  { id: "dine-in", label: "Dine-in" },
  { id: "takeaway", label: "Takeaway" },
  { id: "delivery", label: "Delivery" },
] as const;

const paymentFilters = [
  { id: "all", label: "All Payments" },
  { id: "cash", label: "Cash" },
  { id: "upi", label: "UPI" },
  { id: "card", label: "Card" },
  { id: "split", label: "Split" },
] as const;

const orderTypeIcons = {
  "dine-in": UtensilsCrossed,
  takeaway: ShoppingBag,
  delivery: Bike,
};

export function OrderHistory() {
  const { orders, updateOrder, updateOrderStatus, updateTableStatus, currentUser, settings, cancelPlacedOrder, deleteOrder } = usePOSStore();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refundAmount, setRefundAmount] = useState("");

  // Temporary cleanup for the specific test order stuck in local storage
  useEffect(() => {
    const testOrderId = "ord-1782677224608";
    if (orders.some(o => o.id === testOrderId || o.id === testOrderId.toUpperCase())) {
      deleteOrder(testOrderId);
      deleteOrder(testOrderId.toUpperCase());
    }
  }, [orders, deleteOrder]);

  // ── Live-update: poll on mount + periodic tick ──
  // Immediately fetches active + recently-completed orders from the server
  // so the list is never stale when the user navigates here. The 30s tick
  // keeps "X minutes ago" labels fresh and catches any missed updates.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (navigator.onLine) {
      pollActiveOrders().catch(console.error);
    }
    const timer = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  const filteredOrders = orders.filter((order) => {
    if (order.status === "awaiting-payment" || order.status === "served-unpaid") return false;
    
    const matchesSearch =
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerPhone?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    const matchesType = typeFilter === "all" || order.type === typeFilter;
    const matchesPayment = paymentFilter === "all" || (order.payment?.method || "").toLowerCase() === paymentFilter;
    return matchesSearch && matchesStatus && matchesType && matchesPayment;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const validOrdersForTotal = filteredOrders.filter(
    (o) => o.status !== "cancelled" && !o.refund
  );

  const totalCash = validOrdersForTotal.reduce((sum, o) => {
    let orderCash = 0;
    if (o.payment?.method === "cash") {
      orderCash += o.payment.amount || (o.grandTotal ?? o.total);
    } else if (o.payment?.method === "split" && o.payment.splitDetails?.cash) {
      orderCash += o.payment.splitDetails.cash;
    }
    
    o.supplementaryBills?.forEach(bill => {
      if (bill.payment?.method === "cash") {
        orderCash += bill.payment.amount || bill.total;
      } else if (bill.payment?.method === "split" && bill.payment.splitDetails?.cash) {
        orderCash += bill.payment.splitDetails.cash;
      }
    });

    return sum + orderCash;
  }, 0);

  const totalUPI = validOrdersForTotal.reduce((sum, o) => {
    let orderUPI = 0;
    if (o.payment?.method === "upi") {
      orderUPI += o.payment.amount || (o.grandTotal ?? o.total);
    } else if (o.payment?.method === "split" && o.payment.splitDetails?.upi) {
      orderUPI += o.payment.splitDetails.upi;
    }
    
    o.supplementaryBills?.forEach(bill => {
      if (bill.payment?.method === "upi") {
        orderUPI += bill.payment.amount || bill.total;
      } else if (bill.payment?.method === "split" && bill.payment.splitDetails?.upi) {
        orderUPI += bill.payment.splitDetails.upi;
      }
    });

    return sum + orderUPI;
  }, 0);

  const order = selectedOrder ? orders.find((o) => o.id === selectedOrder) : null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new":
        return "bg-primary/10 text-primary border-primary/30";
      case "preparing":
        return "bg-warning/10 text-warning border-warning/30";
      case "ready":
        return "bg-success/10 text-success border-success/30";
      case "completed":
        return "bg-success/10 text-success border-success/30";
      case "served-unpaid":
        return "bg-destructive/10 text-destructive border-destructive/30";
      case "cancelled":
        return "bg-destructive/10 text-destructive border-destructive/30";
      default:
        return "bg-secondary text-muted-foreground";
    }
  };

  const handleRefund = () => {
    if (!order) return;
    const amount = refundAmount ? parseFloat(refundAmount) : order.grandTotal || order.total;

    updateOrder(order.id, {
      refund: {
        amount,
        reason: refundReason,
        refundedAt: new Date(),
        refundedBy: currentUser?.name || "Unknown",
      },
    });

    updateOrderStatus(order.id, "cancelled");

    if (order.tableId) {
      updateTableStatus(order.tableId, "available");
    }

    setShowRefundDialog(false);
    setRefundReason("");
    setRefundAmount("");

    toast.success("Refund processed successfully", {
      description: `Refunded ${amount.toLocaleString("en-IN", { style: "currency", currency: "INR" })} for order ${order.id.toUpperCase()}`
    });
  };

  return (
    <div className="flex h-full flex-col p-3 sm:p-4 lg:p-6 bg-background">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Order History</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">
            View and manage all past and active orders
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="px-3 py-1.5 text-sm font-bold bg-secondary/80 shadow-sm border border-border/50 rounded-xl">
            {filteredOrders.length} orders found
          </Badge>
          {totalCash > 0 && (
            <Badge variant="outline" className="px-3 py-1.5 text-sm font-bold border-emerald-500/50 text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10 shadow-sm rounded-xl">
              Cash: {totalCash.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
            </Badge>
          )}
          {totalUPI > 0 && (
            <Badge variant="outline" className="px-3 py-1.5 text-sm font-bold border-violet-500/50 text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-500/10 shadow-sm rounded-xl">
              UPI: {totalUPI.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
            </Badge>
          )}
        </div>
      </div>

      {/* Premium Control Center */}
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-border/50 bg-card/60 p-4 sm:p-5 shadow-sm backdrop-blur-md">
        {/* Top Row: Search & Type Filter */}
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by Order ID, Customer, or Phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background/50 border-border/50 h-11 rounded-xl shadow-inner focus-visible:ring-1 focus-visible:ring-primary/30 font-medium"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-background/50 border-border/50 h-11 rounded-xl font-medium">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              {typeFilters.map((filter) => (
                <SelectItem key={filter.id} value={filter.id} className="font-medium">
                  {filter.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Divider */}
        <div className="h-px w-full bg-border/40 my-1"></div>

        {/* Status Filter Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Status</span>
          <div className="mx-1 hidden h-5 w-px bg-border/50 sm:block"></div>
          {statusFilters.map((filter) => {
            const Icon = filter.icon;
            return (
              <Button
                key={filter.id}
                variant="outline"
                size="sm"
                onClick={() => setStatusFilter(filter.id)}
                className={cn(
                  "gap-1.5 rounded-full px-4 transition-all duration-300",
                  statusFilter === filter.id
                    ? filter.id === "new"
                      ? "border-blue-500 bg-blue-500 text-white shadow-md shadow-blue-500/25 hover:bg-blue-600 hover:text-white"
                      : filter.id === "preparing"
                      ? "border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-500/25 hover:bg-amber-600 hover:text-white"
                      : filter.id === "ready"
                      ? "border-emerald-400 bg-emerald-400 text-white shadow-md shadow-emerald-400/25 hover:bg-emerald-500 hover:text-white"
                      : filter.id === "completed"
                      ? "border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-700 hover:text-white"
                      : filter.id === "cancelled"
                      ? "border-rose-500 bg-rose-500 text-white shadow-md shadow-rose-500/25 hover:bg-rose-600 hover:text-white"
                      : "bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90"
                    : filter.id === "new"
                    ? "border-border text-blue-600 hover:border-blue-500/50 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
                    : filter.id === "preparing"
                    ? "border-border text-amber-600 hover:border-amber-500/50 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10"
                    : filter.id === "ready" || filter.id === "completed"
                    ? "border-border text-emerald-600 hover:border-emerald-500/50 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
                    : filter.id === "cancelled"
                    ? "border-border text-rose-600 hover:border-rose-500/50 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:bg-secondary"
                )}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {filter.label}
              </Button>
            );
          })}
        </div>

        {/* Payment Filter Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Payment</span>
          <div className="mx-1 hidden h-5 w-px bg-border/50 sm:block"></div>
          {paymentFilters.map((filter) => (
            <Button
              key={filter.id}
              variant="outline"
              size="sm"
              onClick={() => setPaymentFilter(filter.id)}
              className={cn(
                "gap-1.5 rounded-full px-4 transition-all duration-300",
                paymentFilter === filter.id
                  ? filter.id === "cash"
                    ? "border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-500/25 hover:bg-emerald-600 hover:text-white"
                    : filter.id === "upi"
                    ? "border-violet-500 bg-violet-500 text-white shadow-md shadow-violet-500/25 hover:bg-violet-600 hover:text-white"
                    : "bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90"
                  : filter.id === "cash"
                  ? "border-border text-emerald-600 hover:border-emerald-500/50 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
                  : filter.id === "upi"
                  ? "border-border text-violet-600 hover:border-violet-500/50 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-500/10"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:bg-secondary"
              )}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-3">
          {filteredOrders.map((o) => {
            const TypeIcon = orderTypeIcons[o.type];
            return (
              <Card
                key={o.id}
                className="cursor-pointer bg-card/60 border-border/40 transition-all hover:bg-card hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5 rounded-2xl"
                onClick={() => setSelectedOrder(o.id)}
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
                      {/* Avatar */}
                      <div className="flex shrink-0 h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-lg sm:text-xl border border-primary/20 shadow-sm mt-1 sm:mt-0">
                        {o.customerName ? o.customerName.charAt(0).toUpperCase() : <TypeIcon className="h-5 w-5 sm:h-6 sm:w-6" />}
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="font-black text-foreground text-lg sm:text-xl truncate block max-w-full tracking-tight">
                            {o.customerName || "Guest"}
                          </span>
                          {o.tableId && (
                            <Badge variant="secondary" className="shrink-0 px-2 py-0.5 h-6 text-xs font-bold bg-secondary/80 border-border/50 shadow-sm rounded-md">
                              Table {o.tableId.replace("t", "")}
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] sm:text-xs text-muted-foreground w-full font-medium">
                          <span className="shrink-0 whitespace-nowrap bg-secondary px-1.5 py-0.5 rounded-md font-mono text-foreground/80">{o.id.toUpperCase()}</span>
                          <span className="shrink-0 text-muted-foreground/30">•</span>
                          <span className="shrink-0 whitespace-nowrap">{o.items.length} items</span>
                          <span className="shrink-0 text-muted-foreground/30">•</span>
                          <span suppressHydrationWarning className="shrink-0 whitespace-nowrap flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(o.createdAt, { addSuffix: true })}
                          </span>
                          {o.customerPhone && (
                            <>
                              <span className="shrink-0 text-muted-foreground/30">•</span>
                              <span className="shrink-0 whitespace-nowrap">📞 {o.customerPhone}</span>
                            </>
                          )}
                          {o.createdBy && (
                            <>
                              <span className="shrink-0 text-muted-foreground/30">•</span>
                              <span className="truncate max-w-[80px] sm:max-w-[100px] shrink block">by {o.createdBy}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Right Side Actions / Totals */}
                    <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-3 sm:pt-0 border-t border-border/40 sm:border-0 shrink-0">
                      <div className="flex items-center gap-2">
                        {o.payment?.method && (
                          <Badge variant="outline" className="capitalize font-bold border-border/50 bg-card">
                            {o.payment.method}
                          </Badge>
                        )}
                        <Badge variant="outline" className={cn("font-bold px-2.5 py-0.5 shadow-sm", getStatusColor(o.status))}>
                          {o.status}
                        </Badge>
                        {o.refund && (
                          <Badge variant="outline" className="border-destructive/30 text-destructive bg-destructive/10 hidden sm:inline-flex font-bold">
                            Refunded
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 pl-2 sm:pl-4 sm:border-l border-border/50">
                        <span className={cn("text-xl sm:text-2xl font-black text-foreground tracking-tight tabular-nums", o.status === "cancelled" && "line-through opacity-50")}>
                          {(o.grandTotal ?? o.total).toLocaleString("en-IN", {
                            style: "currency",
                            currency: "INR",
                            minimumFractionDigits: 0,
                          })}
                        </span>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-secondary/50 hover:bg-primary hover:text-primary-foreground transition-colors shrink-0">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filteredOrders.length === 0 && (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              No orders found
            </div>
          )}
        </div>
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto w-[95vw] sm:max-w-xl p-0 gap-0 border-border/40 shadow-2xl sm:rounded-[2rem] print:hidden hide-scrollbar">
          {order && (
            <>
              {/* Premium Header */}
              <div className="bg-secondary/40 p-6 pb-5 border-b border-border/50 relative overflow-hidden">
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                
                <DialogHeader className="relative z-10">
                  <DialogTitle className="text-2xl sm:text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
                    {order.customerName || "Guest"}
                    {order.tableId && (
                      <Badge variant="secondary" className="text-xs font-bold bg-background shadow-sm px-2 py-0.5 rounded-md border-border/50">
                        Table {order.tableId.replace("t", "")}
                      </Badge>
                    )}
                  </DialogTitle>
                  <DialogDescription className="text-sm font-medium mt-1.5 flex items-center gap-2">
                    <span className="font-mono bg-background/60 px-1.5 py-0.5 rounded-md text-foreground/80 shadow-sm">{order.id.toUpperCase()}</span>
                    <span>Order details and actions</span>
                  </DialogDescription>
                </DialogHeader>
                
                <div className="flex flex-wrap gap-2.5 mt-5 relative z-10">
                  <Badge variant="outline" className={cn("font-bold px-3 py-1 shadow-sm border-border/50", getStatusColor(order.status))}>
                    {order.status.toUpperCase()}
                  </Badge>
                  <Badge variant="outline" className="font-bold px-3 py-1 shadow-sm uppercase bg-card border-border/50">
                    {order.type}
                  </Badge>
                  {order.payment?.method && (
                    <Badge variant="outline" className="font-bold px-3 py-1 shadow-sm uppercase bg-card border-border/50">
                      {order.payment.method}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6 bg-background/50">
                {/* Customer and Staff Info */}
                {(order.customerPhone || order.createdBy) && (
                  <div className="rounded-2xl bg-secondary/30 border border-border/40 p-4 flex justify-between shadow-sm backdrop-blur-sm">
                    {order.customerPhone && (
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Customer Phone</p>
                        <p className="font-bold text-foreground flex items-center gap-1.5 text-[15px]">
                          <span className="text-lg">📞</span> {order.customerPhone}
                        </p>
                      </div>
                    )}
                    {order.createdBy && (
                      <div className="text-right">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Served By</p>
                        <p className="font-bold text-foreground text-[15px]">{order.createdBy}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Order Notes */}
                {order.orderNotes && (
                  <div className="rounded-2xl bg-primary/10 border border-primary/20 p-4 shadow-sm">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-primary/70 mb-1">Order Note</p>
                    <p className="font-bold text-primary text-[15px]">{order.orderNotes}</p>
                  </div>
                )}

                {/* Order Items & Totals */}
                <div className="rounded-2xl bg-secondary/30 border border-border/40 p-1 shadow-sm backdrop-blur-sm">
                  <div className="p-3 pb-2 border-b border-border/40">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Order Items</p>
                  </div>
                  <div className="p-3">
                    <ul className="space-y-3.5">
                      {order.items.map((item) => {
                        const modsTotal = item.modifiers?.reduce((s, m) => s + m.price, 0) || 0;
                        return (
                        <li key={item.id} className="flex flex-col text-sm border-b border-border/30 pb-3.5 last:border-0 last:pb-0">
                          <div className="flex justify-between items-start gap-4">
                            <span className={cn("text-foreground font-semibold flex items-start gap-2", order.status === "cancelled" && "line-through opacity-50")}>
                              <span className="font-black text-primary min-w-[20px]">{item.quantity}x</span>
                              <span>{item.name}</span>
                            </span>
                            <span className="text-foreground font-bold tabular-nums shrink-0">
                              {((item.price + modsTotal) * item.quantity).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                            </span>
                          </div>
                          {item.variant && <span className="text-[11px] font-bold text-muted-foreground bg-secondary/60 px-1.5 py-0.5 rounded w-fit ml-[28px] mt-1.5 block">({item.variant})</span>}
                          {item.modifiers && item.modifiers.length > 0 && (
                            <span className="text-xs font-medium text-muted-foreground ml-[28px] mt-1.5 block">
                              + {item.modifiers.map(m => m.name).join(", ")}
                            </span>
                          )}
                          {item.notes && (
                            <span className="block text-xs italic text-muted-foreground mt-1 ml-[28px]">
                              Note: {item.notes}
                            </span>
                          )}
                        </li>
                      )})}
                    </ul>

                    {order.supplementaryBills?.map((bill, index) => (
                      <div key={bill.id} className="mt-5 border-t border-border/40 pt-4">
                        <div className="flex justify-between items-center mb-3">
                          <p className="text-xs font-bold text-foreground">Supplementary #{index + 1}</p>
                          <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wider font-bold h-5 px-1.5", bill.payment ? "bg-success/10 text-success border-success/30" : "bg-warning/10 text-warning border-warning/30")}>
                            {bill.payment ? "Paid" : "Unpaid"}
                          </Badge>
                        </div>
                        <ul className="space-y-3.5">
                          {bill.items.map((item) => {
                            const modsTotal = item.modifiers?.reduce((s, m) => s + m.price, 0) || 0;
                            return (
                            <li key={item.id} className="flex flex-col text-sm border-b border-border/30 pb-3 last:border-0 last:pb-0">
                              <div className="flex justify-between items-start gap-4">
                                <span className={cn("text-foreground font-semibold flex items-start gap-2", order.status === "cancelled" && "line-through opacity-50")}>
                                  <span className="font-black text-primary min-w-[20px]">{item.quantity}x</span>
                                  <span>{item.name}</span>
                                </span>
                                <span className="text-foreground font-bold tabular-nums shrink-0">
                                  {((item.price + modsTotal) * item.quantity).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                                </span>
                              </div>
                              {item.variant && <span className="text-[11px] font-bold text-muted-foreground bg-secondary/60 px-1.5 py-0.5 rounded w-fit ml-[28px] mt-1.5 block">({item.variant})</span>}
                              {item.modifiers && item.modifiers.length > 0 && (
                                <span className="text-xs font-medium text-muted-foreground ml-[28px] mt-1.5 block">
                                  + {item.modifiers.map(m => m.name).join(", ")}
                                </span>
                              )}
                              {item.notes && (
                                <span className="block text-xs italic text-muted-foreground mt-1 ml-[28px]">
                                  Note: {item.notes}
                                </span>
                              )}
                            </li>
                          )})}
                        </ul>
                      </div>
                    ))}
                  </div>

                  {/* Totals Block */}
                  <div className="bg-background/80 p-4 border-t border-border/40 rounded-b-2xl">
                    {(!order.supplementaryBills || order.supplementaryBills.length === 0) ? (
                      <div className="flex justify-between items-end">
                        <span className="font-bold text-foreground">Grand Total</span>
                        <span className="font-black text-2xl text-primary tabular-nums tracking-tight">
                          {order.total.toLocaleString("en-IN", {
                            style: "currency",
                            currency: "INR",
                            minimumFractionDigits: 0,
                          })}
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-1.5 text-sm font-medium">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Original Total</span>
                          <span>{order.total.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}</span>
                        </div>
                        {order.supplementaryBills.map((bill, i) => (
                          <div key={bill.id} className="flex justify-between text-muted-foreground">
                            <span>Added Items #{i + 1}</span>
                            <span>{bill.total.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}</span>
                          </div>
                        ))}
                        <div className="flex justify-between font-black text-primary border-t border-border/50 mt-3 pt-3 text-2xl tracking-tight">
                          <span>Grand Total</span>
                          <span>{(order.grandTotal ?? order.total).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Timeline */}
                <div className="rounded-2xl bg-secondary/30 border border-border/40 p-4 shadow-sm backdrop-blur-sm">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Timeline</p>
                  <div className="space-y-3 font-medium text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Clock className="h-4 w-4" /> Created
                      </span>
                      <span className="text-foreground">
                        {format(order.createdAt, "dd MMM yyyy, hh:mm a")}
                      </span>
                    </div>
                    {order.refund && (
                      <div className="flex items-center justify-between border-t border-border/50 pt-3 text-destructive">
                        <span className="flex items-center gap-2">
                          <RotateCcw className="h-4 w-4" />
                          Refunded {order.refund.amount.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                        </span>
                        <span className="text-right">
                          <span className="block">{format(order.refund.refundedAt, "dd MMM yyyy, hh:mm a")}</span>
                          {order.refund.reason && <span className="block text-xs mt-0.5 opacity-80 font-normal">Reason: {order.refund.reason}</span>}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button variant="default" className="flex-1 h-12 gap-2 text-[15px] font-bold shadow-md hover:-translate-y-0.5 transition-transform" onClick={() => window.print()}>
                    <Printer className="h-5 w-5" />
                    Print Receipt
                  </Button>
                  {(order.status === "new" || order.status === "preparing" || order.status === "ready") && (
                    <Button variant="outline" className="flex-1 h-12 gap-2 text-[15px] font-bold text-destructive hover:text-destructive hover:bg-destructive/10 border-border/50 shadow-sm hover:-translate-y-0.5 transition-transform" onClick={() => setShowCancelDialog(true)}>
                      <XCircle className="h-5 w-5" />
                      Cancel Order
                    </Button>
                  )}
                  {!order.refund && order.status === "completed" && (
                    <Button variant="outline" className="flex-1 h-12 gap-2 text-[15px] font-bold text-destructive hover:text-destructive hover:bg-destructive/10 border-border/50 shadow-sm hover:-translate-y-0.5 transition-transform" onClick={() => setShowRefundDialog(true)}>
                      <RotateCcw className="h-5 w-5" />
                      Refund
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

        {/* Refund Dialog */}
        <AlertDialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
          <AlertDialogContent className="w-[95vw] max-w-lg sm:max-w-md max-h-[85vh] overflow-y-auto">
             <AlertDialogHeader>
               <AlertDialogTitle>Process Refund</AlertDialogTitle>
               <AlertDialogDescription>
                 Are you sure you want to refund this order? This action will be logged.
               </AlertDialogDescription>
             </AlertDialogHeader>
             {order && (
             <div className="space-y-4 pt-4">
               <div className="rounded-lg bg-secondary p-4">
                 <p className="mb-2 text-sm text-muted-foreground">Refund Amount</p>
                 <Input
                   type="number"
                   placeholder={(order.grandTotal || order.total).toString()}
                   value={refundAmount}
                   onChange={(e) => setRefundAmount(e.target.value)}
                   className="bg-background text-lg font-bold"
                 />
               </div>
               <div>
                 <Label className="text-sm">Reason (Optional)</Label>
                 <Input
                   placeholder="e.g., Customer requested, overcharged..."
                   value={refundReason}
                   onChange={(e) => setRefundReason(e.target.value)}
                   className="mt-1 bg-secondary border-none"
                 />
               </div>
               <AlertDialogFooter className="pt-2">
                 <AlertDialogCancel onClick={() => setShowRefundDialog(false)} className="flex-1 mt-0">
                   Cancel
                 </AlertDialogCancel>
                 <AlertDialogAction onClick={handleRefund} className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90">
                   Confirm Refund
                 </AlertDialogAction>
               </AlertDialogFooter>
             </div>
             )}
          </AlertDialogContent>
        </AlertDialog>

        {/* Cancel Placed Order Dialog */}
        <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <AlertDialogContent className="w-[95vw] max-w-lg sm:max-w-md max-h-[85vh] overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Order</AlertDialogTitle>
              <AlertDialogDescription>
                {order?.payment && !order?.payLater
                  ? `This order was paid. Cancelling records a full refund of ${((order?.grandTotal ?? order?.total) || 0).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })} and releases the table.`
                  : "The order will be cancelled and the table released. No refund is needed."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {order && (
              <div className="space-y-4 pt-4">
                <div>
                  <Label className="text-sm">Reason (Optional)</Label>
                  <Input
                    placeholder="e.g., Wrong order, customer left..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="mt-1 bg-secondary border-none"
                  />
                </div>
                <AlertDialogFooter className="pt-2">
                  <AlertDialogCancel onClick={() => { setShowCancelDialog(false); setCancelReason(""); }} className="flex-1 mt-0">
                    Keep Order
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      cancelPlacedOrder(order.id, cancelReason.trim() || undefined);
                      toast.success(`Order ${order.id.toUpperCase()} cancelled`);
                      setShowCancelDialog(false);
                      setCancelReason("");
                      setSelectedOrder(null);
                    }}
                    className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Confirm Cancel
                  </AlertDialogAction>
                </AlertDialogFooter>
              </div>
            )}
          </AlertDialogContent>
        </AlertDialog>

      {order && (
        <ReceiptTemplate order={order} settings={settings} />
      )}
    </div>
  );
}
