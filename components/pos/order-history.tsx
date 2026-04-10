"use client";

import { useState } from "react";
import { usePOSStore } from "@/lib/store";
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
  { id: "aggregator", label: "Online" },
] as const;

const orderTypeIcons = {
  "dine-in": UtensilsCrossed,
  takeaway: ShoppingBag,
  delivery: Bike,
  aggregator: Store,
};

export function OrderHistory() {
  const { orders, updateOrder, updateOrderStatus, updateTableStatus, currentUser, settings } = usePOSStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refundAmount, setRefundAmount] = useState("");

  const filteredOrders = orders.filter((order) => {
    if (order.status === "awaiting-payment") return false;
    
    const matchesSearch =
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    const matchesType = typeFilter === "all" || order.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

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
    <div className="flex h-full flex-col p-3 sm:p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Order History</h1>
          <p className="text-sm text-muted-foreground">
            View and manage all orders
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{filteredOrders.length} orders</Badge>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by order ID or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary border-none"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px] bg-secondary border-none">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {statusFilters.map((filter) => (
              <SelectItem key={filter.id} value={filter.id}>
                {filter.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[140px] bg-secondary border-none">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {typeFilters.map((filter) => (
              <SelectItem key={filter.id} value={filter.id}>
                {filter.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status Filter Chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {statusFilters.map((filter) => {
          const Icon = filter.icon;
          return (
            <Button
              key={filter.id}
              variant={statusFilter === filter.id ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(filter.id)}
              className="gap-1.5"
            >
              {Icon && <Icon className="h-3 w-3" />}
              {filter.label}
            </Button>
          );
        })}
      </div>

      {/* Orders List */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-3">
          {filteredOrders.map((o) => {
            const TypeIcon = orderTypeIcons[o.type];
            return (
              <Card
                key={o.id}
                className="cursor-pointer bg-card border-border transition-all hover:bg-secondary/30"
                onClick={() => setSelectedOrder(o.id)}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
                        <TypeIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {o.id.toUpperCase()}
                          </span>
                          {o.tableId && (
                            <Badge variant="secondary">
                              Table {o.tableId.replace("t", "")}
                            </Badge>
                          )}
                          {o.platform && (
                            <Badge
                              variant="outline"
                              className="text-xs"
                              style={{
                                borderColor:
                                  o.platform === "swiggy" ? "#fc8019" : "#e23744",
                                color: o.platform === "swiggy" ? "#fc8019" : "#e23744",
                              }}
                            >
                              {o.platform}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span>{o.items.length} items</span>
                          <span>&bull;</span>
                          <span suppressHydrationWarning>
                            {formatDistanceToNow(o.createdAt, { addSuffix: true })}
                          </span>
                          {o.customerName && (
                            <>
                              <span>&bull;</span>
                              <span>{o.customerName}</span>
                            </>
                          )}
                          {o.createdBy && (
                            <>
                              <span>&bull;</span>
                              <span>by {o.createdBy}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-3 sm:pt-0 border-t border-border/40 sm:border-0">
                      <Badge variant="outline" className={getStatusColor(o.status)}>
                        {o.status}
                      </Badge>
                      {o.refund && (
                        <Badge variant="outline" className="border-destructive/30 text-destructive bg-destructive/10 hidden sm:inline-flex">
                          Refunded
                        </Badge>
                      )}
                      <span className={cn("text-lg font-bold text-foreground", o.status === "cancelled" && "line-through opacity-50")}>
                        {(o.grandTotal ?? o.total).toLocaleString("en-IN", {
                          style: "currency",
                          currency: "INR",
                          minimumFractionDigits: 0,
                        })}
                      </span>
                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                      </Button>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{order?.id.toUpperCase()}</DialogTitle>
            <DialogDescription>
              Order details and actions
            </DialogDescription>
          </DialogHeader>
          {order && (
            <div className="space-y-4 pt-4">
              {/* Order Info */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={getStatusColor(order.status)}>
                  {order.status}
                </Badge>
                <Badge variant="secondary">{order.type}</Badge>
                {order.tableId && (
                  <Badge variant="secondary">Table {order.tableId.replace("t", "")}</Badge>
                )}
                {order.platform && (
                  <Badge
                    variant="outline"
                    style={{
                      borderColor: order.platform === "swiggy" ? "#fc8019" : "#e23744",
                      color: order.platform === "swiggy" ? "#fc8019" : "#e23744",
                    }}
                  >
                    {order.platform}
                  </Badge>
                )}
              </div>

              {/* Customer and Staff Info */}
              {(order.customerName || order.createdBy) && (
                <div className="rounded-lg bg-secondary/50 p-3 flex justify-between">
                  {order.customerName && (
                    <div>
                      <p className="text-sm text-muted-foreground">Customer</p>
                      <p className="font-medium text-foreground">{order.customerName}</p>
                    </div>
                  )}
                  {order.createdBy && (
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Created By</p>
                      <p className="font-medium text-foreground">{order.createdBy}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Order Notes */}
              {order.orderNotes && (
                <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
                  <p className="text-sm text-muted-foreground">Order Note</p>
                  <p className="font-medium text-primary">{order.orderNotes}</p>
                </div>
              )}

              {/* Order Items */}
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="mb-2 text-sm text-muted-foreground">Items</p>
                <ul className="space-y-3">
                  {order.items.map((item) => {
                    const modsTotal = item.modifiers?.reduce((s, m) => s + m.price, 0) || 0;
                    return (
                    <li key={item.id} className="flex flex-col text-sm border-b border-border/40 pb-2 last:border-0 last:pb-0">
                      <div className="flex justify-between">
                        <span className={cn("text-foreground font-medium", order.status === "cancelled" && "line-through opacity-60")}>{item.quantity}x {item.name}</span>
                        <span className="text-muted-foreground">
                          {((item.price + modsTotal) * item.quantity).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                        </span>
                      </div>
                      {item.variant && <span className="text-xs text-muted-foreground ml-4 mt-0.5">({item.variant})</span>}
                      {item.modifiers && item.modifiers.length > 0 && (
                        <span className="text-xs text-muted-foreground ml-4 mt-0.5">
                          + {item.modifiers.map(m => m.name).join(", ")}
                        </span>
                      )}
                      {item.notes && (
                        <span className="block text-xs text-muted-foreground mt-0.5 ml-4">
                          Note: {item.notes}
                        </span>
                      )}
                    </li>
                  )})}
                </ul>

                {order.supplementaryBills?.map((bill, index) => (
                  <div key={bill.id} className="mt-4 border-t border-border pt-3">
                    <div className="flex justify-between items-center mb-2">
                       <p className="text-sm font-medium text-foreground">Supplementary #{index + 1}</p>
                       <Badge variant="outline" className={cn("text-[11px] sm:text-xs h-5", bill.payment ? "bg-success/10 text-success border-success/30" : "bg-warning/10 text-warning border-warning/30")}>
                         {bill.payment ? "Paid" : "Unpaid"}
                       </Badge>
                    </div>
                    <ul className="space-y-3">
                      {bill.items.map((item) => {
                        const modsTotal = item.modifiers?.reduce((s, m) => s + m.price, 0) || 0;
                        return (
                        <li key={item.id} className="flex flex-col text-sm border-b border-border/40 pb-2 last:border-0 last:pb-0">
                          <div className="flex justify-between">
                            <span className={cn("text-foreground font-medium", order.status === "cancelled" && "line-through opacity-60")}>{item.quantity}x {item.name}</span>
                            <span className="text-muted-foreground">
                              {((item.price + modsTotal) * item.quantity).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                            </span>
                          </div>
                          {item.variant && <span className="text-xs text-muted-foreground ml-4 mt-0.5">({item.variant})</span>}
                          {item.modifiers && item.modifiers.length > 0 && (
                            <span className="text-xs text-muted-foreground ml-4 mt-0.5">
                              + {item.modifiers.map(m => m.name).join(", ")}
                            </span>
                          )}
                          {item.notes && (
                            <span className="block text-xs text-muted-foreground mt-0.5 ml-4">
                              Note: {item.notes}
                            </span>
                          )}
                        </li>
                      )})}
                    </ul>
                  </div>
                ))}

                {(!order.supplementaryBills || order.supplementaryBills.length === 0) ? (
                  <div className="mt-3 flex justify-between border-t border-border pt-2">
                    <span className="font-medium text-foreground">Total</span>
                    <span className="font-bold text-primary">
                      {order.total.toLocaleString("en-IN", {
                        style: "currency",
                        currency: "INR",
                        minimumFractionDigits: 0,
                      })}
                    </span>
                  </div>
                ) : (
                  <div className="mt-4 border-t border-border pt-3 text-sm">
                    <div className="flex justify-between text-muted-foreground mb-1">
                      <span>Original Total</span>
                      <span>{order.total.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}</span>
                    </div>
                    {order.supplementaryBills.map((bill, i) => (
                      <div key={bill.id} className="flex justify-between text-muted-foreground mb-1">
                        <span>Supplementary #{i + 1}</span>
                        <span>{bill.total.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold text-primary border-t border-border mt-2 pt-2 text-base">
                      <span>Grand Total</span>
                      <span>{(order.grandTotal ?? order.total).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Details */}
              {order.payment && (
                <div className="rounded-lg bg-secondary/50 p-3">
                  <p className="mb-2 text-sm text-muted-foreground">Payment Details</p>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Method</span>
                      <span className="text-foreground capitalize">{order.payment.method}</span>
                    </div>
                    {order.payment.transactionId && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Txn ID</span>
                        <span className="text-foreground">{order.payment.transactionId}</span>
                      </div>
                    )}
                    {order.payment.method === "cash" && order.payment.cashReceived && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Given</span>
                          <span className="text-foreground">
                            {order.payment.cashReceived.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Change</span>
                          <span className="text-foreground">
                            {order.payment.change?.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                          </span>
                        </div>
                      </>
                    )}
                    {order.payment.method === "split" && order.payment.splitDetails && (
                      <div className="pt-1 mt-1 border-t border-border">
                        {order.payment.splitDetails.cash > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Cash</span>
                            <span className="text-foreground">{order.payment.splitDetails.cash.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}</span>
                          </div>
                        )}
                        {order.payment.splitDetails.upi > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">UPI</span>
                            <span className="text-foreground">{order.payment.splitDetails.upi.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}</span>
                          </div>
                        )}
                        {order.payment.splitDetails.card > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Card</span>
                            <span className="text-foreground">{order.payment.splitDetails.card.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="mb-2 text-sm text-muted-foreground">Timeline</p>
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span className="text-foreground">
                      {format(order.createdAt, "dd MMM yyyy, hh:mm a")}
                    </span>
                  </div>
                  {order.refund && (
                    <div className="flex justify-between border-t border-border/50 pt-2 text-destructive">
                      <span>Refunded {order.refund.amount.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}</span>
                      <span>
                        {format(order.refund.refundedAt, "dd MMM yyyy, hh:mm a")}
                        {order.refund.reason && <span className="block text-xs mt-0.5 opacity-80 text-right">Reason: {order.refund.reason}</span>}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 gap-2" onClick={() => window.print()}>
                    <Printer className="h-4 w-4" />
                    Print
                  </Button>
                  {!order.refund && order.status === "completed" && (
                    <Button variant="outline" className="flex-1 gap-2 text-destructive hover:text-destructive" onClick={() => setShowRefundDialog(true)}>
                      <RotateCcw className="h-4 w-4" />
                      Refund
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Refund Dialog */}
        <AlertDialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
          <AlertDialogContent>
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

      {order && (
        <ReceiptTemplate order={order} settings={settings} />
      )}
    </div>
  );
}
