"use client";

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
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const orderTypeIcons = {
  "dine-in": UtensilsCrossed,
  takeaway: ShoppingBag,
  delivery: Bike,
  aggregator: ShoppingBag,
};

export function KitchenDisplay() {
  const { orders, updateOrderStatus } = usePOSStore();

  const newOrders = orders.filter((o) => o.status === "new");
  const preparingOrders = orders.filter((o) => o.status === "preparing");
  const readyOrders = orders.filter((o) => o.status === "ready");

  const handleAccept = (orderId: string) => {
    updateOrderStatus(orderId, "preparing");
  };

  const handleReady = (orderId: string) => {
    updateOrderStatus(orderId, "ready");
  };

  const handleComplete = (orderId: string) => {
    updateOrderStatus(orderId, "completed");
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Kitchen Display</h1>
          <p className="text-sm text-muted-foreground">
            Manage incoming orders and preparation status
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{newOrders.length}</p>
              <p className="text-xs text-muted-foreground">New</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/20">
              <ChefHat className="h-4 w-4 text-warning" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {preparingOrders.length}
              </p>
              <p className="text-xs text-muted-foreground">Preparing</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/20">
              <CheckCircle2 className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{readyOrders.length}</p>
              <p className="text-xs text-muted-foreground">Ready</p>
            </div>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex flex-1 gap-4 overflow-hidden p-4">
        {/* New Orders Column */}
        <div className="flex flex-1 flex-col rounded-xl bg-secondary/30 p-4">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Clock className="h-4 w-4 text-primary-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">New Orders</h2>
            <Badge variant="secondary" className="ml-auto">
              {newOrders.length}
            </Badge>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto">
            {newOrders.map((order) => {
              const TypeIcon = orderTypeIcons[order.type];
              return (
                <Card key={order.id} className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-base text-foreground">
                          {order.id.toUpperCase()}
                        </CardTitle>
                      </div>
                      {order.platform && (
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={{
                            borderColor:
                              order.platform === "swiggy" ? "#fc8019" : "#e23744",
                            color:
                              order.platform === "swiggy" ? "#fc8019" : "#e23744",
                          }}
                        >
                          {order.platform}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(order.createdAt, { addSuffix: true })}
                      {order.tableId && (
                        <Badge variant="secondary" className="ml-1 text-xs">
                          Table {order.tableId.replace("t", "")}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="mb-3 space-y-1">
                      {order.items.map((item) => (
                        <li
                          key={item.id}
                          className="flex justify-between text-sm"
                        >
                          <span className="text-foreground">
                            {item.quantity}x {item.name}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      size="sm"
                      className="w-full gap-1.5"
                      onClick={() => handleAccept(order.id)}
                    >
                      <PlayCircle className="h-4 w-4" />
                      Accept Order
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
            {newOrders.length === 0 && (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                No new orders
              </div>
            )}
          </div>
        </div>

        {/* Preparing Column */}
        <div className="flex flex-1 flex-col rounded-xl bg-warning/10 p-4">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning">
              <ChefHat className="h-4 w-4 text-warning-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Preparing</h2>
            <Badge variant="secondary" className="ml-auto">
              {preparingOrders.length}
            </Badge>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto">
            {preparingOrders.map((order) => {
              const TypeIcon = orderTypeIcons[order.type];
              return (
                <Card
                  key={order.id}
                  className="border-warning/30 bg-card"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-base text-foreground">
                          {order.id.toUpperCase()}
                        </CardTitle>
                      </div>
                      {order.platform && (
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={{
                            borderColor:
                              order.platform === "swiggy" ? "#fc8019" : "#e23744",
                            color:
                              order.platform === "swiggy" ? "#fc8019" : "#e23744",
                          }}
                        >
                          {order.platform}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(order.createdAt, { addSuffix: true })}
                      {order.tableId && (
                        <Badge variant="secondary" className="ml-1 text-xs">
                          Table {order.tableId.replace("t", "")}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="mb-3 space-y-1">
                      {order.items.map((item) => (
                        <li
                          key={item.id}
                          className="flex justify-between text-sm"
                        >
                          <span className="text-foreground">
                            {item.quantity}x {item.name}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full gap-1.5 border-success text-success hover:bg-success/10"
                      onClick={() => handleReady(order.id)}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Mark Ready
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
            {preparingOrders.length === 0 && (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                No orders preparing
              </div>
            )}
          </div>
        </div>

        {/* Ready Column */}
        <div className="flex flex-1 flex-col rounded-xl bg-success/10 p-4">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success">
              <CheckCircle2 className="h-4 w-4 text-success-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Ready</h2>
            <Badge variant="secondary" className="ml-auto">
              {readyOrders.length}
            </Badge>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto">
            {readyOrders.map((order) => {
              const TypeIcon = orderTypeIcons[order.type];
              return (
                <Card
                  key={order.id}
                  className="border-success/30 bg-card"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-base text-foreground">
                          {order.id.toUpperCase()}
                        </CardTitle>
                      </div>
                      {order.platform && (
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={{
                            borderColor:
                              order.platform === "swiggy" ? "#fc8019" : "#e23744",
                            color:
                              order.platform === "swiggy" ? "#fc8019" : "#e23744",
                          }}
                        >
                          {order.platform}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(order.createdAt, { addSuffix: true })}
                      {order.tableId && (
                        <Badge variant="secondary" className="ml-1 text-xs">
                          Table {order.tableId.replace("t", "")}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="mb-3 space-y-1">
                      {order.items.map((item) => (
                        <li
                          key={item.id}
                          className="flex justify-between text-sm"
                        >
                          <span className="text-foreground">
                            {item.quantity}x {item.name}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      size="sm"
                      className="w-full gap-1.5 bg-success text-success-foreground hover:bg-success/90"
                      onClick={() => handleComplete(order.id)}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Complete
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
            {readyOrders.length === 0 && (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                No orders ready
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
