"use client";

import { useState, useCallback } from "react";
import { usePOSStore } from "@/lib/store";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { cn } from "@/lib/utils";
import { Order, MenuItem } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Clock,
  CheckCircle2,
  XCircle,
  ChefHat,
  Package,
  Truck,
  Phone,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const aggregatorStatuses = [
  { id: "received", label: "Received", icon: Clock },
  { id: "accepted", label: "Accepted", icon: CheckCircle2 },
  { id: "preparing", label: "Preparing", icon: ChefHat },
  { id: "ready", label: "Ready", icon: Package },
  { id: "packed", label: "Packed", icon: Package },
  { id: "handed-over", label: "Handed Over", icon: Truck },
] as const;

export function AggregatorInbox() {
  const { orders, updateOrderStatus, addOrder, addAuditEntry, currentUser } = usePOSStore();
  const [activeTab, setActiveTab] = useState<"all" | "swiggy" | "zomato">("all");
  const [incomingExternalOrders, setIncomingExternalOrders] = useState<any[]>([]);

  const aggregatorOrders = orders.filter((o) => o.type === "aggregator");
  
  const filteredOrders = aggregatorOrders.filter((o) => {
    if (activeTab === "all") return true;
    return o.platform === activeTab;
  });

  const pendingOrders = incomingExternalOrders.filter((o) => {
    if (activeTab === "all") return true;
    return o.platform === activeTab;
  });

  const activeOrders = filteredOrders.filter((o) => o.status === "new" || o.status === "preparing" || o.status === "ready");
  const completedOrders = filteredOrders.filter((o) => o.status === "completed" || o.status === "cancelled");

  const simulateIncomingOrder = useCallback(() => {
    const isSwiggy = Math.random() > 0.5;
    const items = [
      { id: `mock-1-${Date.now()}`, name: "Mock Burger", price: 150, quantity: 2 },
      { id: `mock-2-${Date.now()}`, name: "Mock Soda", price: 50, quantity: 2 },
    ];
    const total = 400;
    
    const newExternal = {
      id: `ext-${Date.now()}`,
      platform: isSwiggy ? "swiggy" : "zomato",
      customerName: "Online User",
      items,
      total,
      createdAt: new Date(),
    };
    
    setIncomingExternalOrders(prev => [newExternal, ...prev]);
  }, []);

  const handleAccept = (orderId: string) => {
    const extOrder = incomingExternalOrders.find(o => o.id === orderId);
    if (!extOrder) return;
    
    setIncomingExternalOrders(prev => prev.filter(o => o.id !== orderId));
    
    const id = addOrder({
      type: "aggregator",
      platform: extOrder.platform,
      customerName: extOrder.customerName,
      items: extOrder.items,
      total: extOrder.total,
    }, { initialStatus: "new", skipTableLock: true });
    
    const userName = currentUser?.name || "System";
    addAuditEntry({ 
      action: "payment_recorded", 
      userId: userName, 
      details: `Payment of ₹${extOrder.total} recorded via platform`, 
      orderId: id,
      metadata: { method: "platform", amount: extOrder.total, cashier: userName, platform: extOrder.platform }
    });
    
    addAuditEntry({ 
      action: "order_sent_to_kitchen", 
      userId: userName, 
      details: `Order ${id.toUpperCase()} sent to kitchen automatically (platform pre-paid)`, 
      orderId: id,
      metadata: { sentBy: "System" }
    });
  };

  const handleReady = (orderId: string) => {
    updateOrderStatus(orderId, "ready");
  };

  const handleComplete = (orderId: string) => {
    updateOrderStatus(orderId, "completed");
  };

  const handleReject = (orderId: string) => {
    setIncomingExternalOrders(prev => prev.filter(o => o.id !== orderId));
    const userName = currentUser?.name || "System";
    addAuditEntry({ 
      action: "void", 
      userId: userName, 
      details: `Rejected external order ${orderId.toUpperCase()}`, 
      orderId: orderId,
      metadata: { reason: "Rejected from inbox" }
    });
  };

  const swiggyCount = aggregatorOrders.filter((o) => o.platform === "swiggy" && o.status !== "completed").length;
  const zomatoCount = aggregatorOrders.filter((o) => o.platform === "zomato" && o.status !== "completed").length;

  const isOnline = useOnlineStatus();

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Online Orders</h1>
          <p className="text-sm text-muted-foreground">
            Manage Swiggy and Zomato orders
          </p>
        </div>
        <Button 
          variant="outline" 
          className="gap-2" 
          disabled={!isOnline}
          title={!isOnline ? "Offline — cannot fetch new orders" : undefined}
          onClick={simulateIncomingOrder}
        >
          <RefreshCw className={cn("h-4 w-4", !isOnline && "opacity-50")} />
          Refresh / Simulate
        </Button>
      </div>

      {/* Platform Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 flex flex-col">
        <TabsList className="mb-4 bg-secondary">
          <TabsTrigger value="all" className="gap-2">
            All Orders
            <Badge variant="secondary" className="ml-1">{incomingExternalOrders.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="swiggy" className="gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-[#fc8019]">
              <span className="text-xs font-bold text-white">S</span>
            </div>
            Swiggy
            <Badge variant="secondary" className="ml-1">{incomingExternalOrders.filter(o => o.platform === "swiggy").length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="zomato" className="gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-[#e23744]">
              <span className="text-xs font-bold text-white">Z</span>
            </div>
            Zomato
            <Badge variant="secondary" className="ml-1">{incomingExternalOrders.filter(o => o.platform === "zomato").length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="flex-1 mt-0">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 h-full">
            {/* Pending Orders */}
            <div className="flex flex-col rounded-xl bg-destructive/5 p-4">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive">
                  <Clock className="h-4 w-4 text-destructive-foreground" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">New Orders</h2>
                <Badge variant="destructive" className="ml-auto">{pendingOrders.length}</Badge>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto">
                {pendingOrders.map((order) => (
                  <Card key={order.id} className="bg-card border-destructive/30">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base text-foreground">
                          {order.id.toUpperCase()}
                        </CardTitle>
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={{
                            borderColor: order.platform === "swiggy" ? "#fc8019" : "#e23744",
                            color: order.platform === "swiggy" ? "#fc8019" : "#e23744",
                            backgroundColor: order.platform === "swiggy" ? "rgba(252,128,25,0.1)" : "rgba(226,55,68,0.1)",
                          }}
                        >
                          {order.platform?.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground" suppressHydrationWarning>
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(order.createdAt, { addSuffix: true })}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {order.customerName && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">Customer:</span>
                          <span className="font-medium text-foreground">{order.customerName}</span>
                        </div>
                      )}
                      <ul className="space-y-1 rounded-lg bg-secondary/50 p-2">
                        {order.items.map((item) => (
                          <li key={item.id} className="flex justify-between text-sm">
                            <span className="text-foreground">{item.quantity}x {item.name}</span>
                            <span className="text-muted-foreground">
                              {item.price.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div className="flex justify-between border-t border-border pt-2">
                        <span className="font-medium text-foreground">Total</span>
                        <span className="font-bold text-primary">
                          {order.total.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 border-destructive text-destructive hover:bg-destructive/10"
                          onClick={() => handleReject(order.id)}
                        >
                          <XCircle className="mr-1 h-4 w-4" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => handleAccept(order.id)}
                        >
                          <CheckCircle2 className="mr-1 h-4 w-4" />
                          Accept
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {pendingOrders.length === 0 && (
                  <div className="flex h-32 items-center justify-center text-muted-foreground">
                    No pending orders
                  </div>
                )}
              </div>
            </div>

            {/* Active Orders */}
            <div className="flex flex-col rounded-xl bg-warning/5 p-4">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning">
                  <ChefHat className="h-4 w-4 text-warning-foreground" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">In Progress</h2>
                <Badge variant="secondary" className="ml-auto">{activeOrders.length}</Badge>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto">
                {activeOrders.map((order) => (
                  <Card key={order.id} className={cn(
                    "bg-card",
                    order.status === "preparing" && "border-warning/30",
                    order.status === "ready" && "border-success/30"
                  )}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base text-foreground">
                          {order.id.toUpperCase()}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              order.status === "preparing" && "border-warning text-warning",
                              order.status === "ready" && "border-success text-success"
                            )}
                          >
                            {order.status}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-xs"
                            style={{
                              borderColor: order.platform === "swiggy" ? "#fc8019" : "#e23744",
                              color: order.platform === "swiggy" ? "#fc8019" : "#e23744",
                            }}
                          >
                            {order.platform?.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <ul className="space-y-1">
                        {order.items.map((item) => (
                          <li key={item.id} className="flex justify-between text-sm">
                            <span className="text-foreground">{item.quantity}x {item.name}</span>
                          </li>
                        ))}
                      </ul>
                      {order.status === "preparing" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full border-success text-success hover:bg-success/10"
                          onClick={() => handleReady(order.id)}
                        >
                          <Package className="mr-1 h-4 w-4" />
                          Mark Ready
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full bg-success text-success-foreground hover:bg-success/90"
                          onClick={() => handleComplete(order.id)}
                        >
                          <Truck className="mr-1 h-4 w-4" />
                          Handed Over
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {activeOrders.length === 0 && (
                  <div className="flex h-32 items-center justify-center text-muted-foreground">
                    No active orders
                  </div>
                )}
              </div>
            </div>

            {/* Completed Orders */}
            <div className="flex flex-col rounded-xl bg-success/5 p-4">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success">
                  <CheckCircle2 className="h-4 w-4 text-success-foreground" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Completed</h2>
                <Badge variant="secondary" className="ml-auto">{completedOrders.length}</Badge>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto">
                {completedOrders.slice(0, 5).map((order) => (
                  <Card key={order.id} className="bg-card border-success/20">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm text-foreground">
                          {order.id.toUpperCase()}
                        </CardTitle>
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={{
                            borderColor: order.platform === "swiggy" ? "#fc8019" : "#e23744",
                            color: order.platform === "swiggy" ? "#fc8019" : "#e23744",
                          }}
                        >
                          {order.platform?.toUpperCase()}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{order.items.length} items</span>
                        <span className="font-medium text-foreground">
                          {order.total.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {completedOrders.length === 0 && (
                  <div className="flex h-32 items-center justify-center text-muted-foreground">
                    No completed orders today
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
