"use client";

import { useState } from "react";
import { usePOSStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  const { orders } = usePOSStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);

  const filteredOrders = orders.filter((order) => {
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

  return (
    <div className="flex h-full flex-col p-6">
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
          <SelectTrigger className="w-[160px] bg-secondary border-none">
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
          <SelectTrigger className="w-[140px] bg-secondary border-none">
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
                  <div className="flex items-center justify-between">
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
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className={getStatusColor(o.status)}>
                        {o.status}
                      </Badge>
                      <span className="text-lg font-bold text-foreground">
                        {o.total.toLocaleString("en-IN", {
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
        <DialogContent className="max-w-lg">
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

              {/* Customer Info */}
              {order.customerName && (
                <div className="rounded-lg bg-secondary/50 p-3">
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="font-medium text-foreground">{order.customerName}</p>
                </div>
              )}

              {/* Order Items */}
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="mb-2 text-sm text-muted-foreground">Items</p>
                <ul className="space-y-2">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex justify-between text-sm">
                      <span className="text-foreground">
                        {item.quantity}x {item.name}
                        {item.variant && (
                          <span className="text-muted-foreground"> ({item.variant})</span>
                        )}
                        {item.notes && (
                          <span className="block text-xs text-muted-foreground">
                            Note: {item.notes}
                          </span>
                        )}
                      </span>
                      <span className="text-muted-foreground">
                        {(item.price * item.quantity).toLocaleString("en-IN", {
                          style: "currency",
                          currency: "INR",
                          minimumFractionDigits: 0,
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
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
              </div>

              {/* Timeline */}
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="mb-2 text-sm text-muted-foreground">Timeline</p>
                <div className="text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span className="text-foreground">
                      {format(order.createdAt, "dd MMM yyyy, hh:mm a")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-2">
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
                {order.status === "completed" && (
                  <Button variant="outline" className="flex-1 gap-2 text-destructive hover:text-destructive">
                    <RotateCcw className="h-4 w-4" />
                    Refund
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
