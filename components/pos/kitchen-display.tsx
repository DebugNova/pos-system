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
      <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between lg:p-4">
        <div>
          <h1 className="text-lg font-bold text-foreground lg:text-2xl">Kitchen Display</h1>
          <p className="text-xs text-muted-foreground lg:text-sm">
            Manage incoming orders and preparation status
          </p>
        </div>
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
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" suppressHydrationWarning>
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(order.createdAt, { addSuffix: true })}
                      {order.tableId && (
                        <Badge variant="secondary" className="text-xs">
                          Table {order.tableId.replace("t", "")}
                        </Badge>
                      )}
                      {order.customerName && (
                        <Badge variant="outline" className="text-xs">
                          {order.customerName}
                        </Badge>
                      )}
                    </div>
                    {order.orderNotes && (
                      <p className="mt-1 text-xs italic text-primary">
                        Note: {order.orderNotes}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <ul className="mb-3 space-y-1">
                      {order.items.map((item) => (
                        <li
                          key={item.id}
                          className="flex flex-col text-sm"
                        >
                          <span className="text-foreground">
                            {item.quantity}x {item.name}
                          </span>
                          {item.notes && (
                            <span className="text-xs text-muted-foreground italic pl-4">
                              - {item.notes}
                            </span>
                          )}
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
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" suppressHydrationWarning>
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(order.createdAt, { addSuffix: true })}
                      {order.tableId && (
                        <Badge variant="secondary" className="text-xs">
                          Table {order.tableId.replace("t", "")}
                        </Badge>
                      )}
                      {order.customerName && (
                        <Badge variant="outline" className="text-xs">
                          {order.customerName}
                        </Badge>
                      )}
                    </div>
                    {order.orderNotes && (
                      <p className="mt-1 text-xs italic text-primary">
                        Note: {order.orderNotes}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <ul className="mb-3 space-y-1">
                      {order.items.map((item) => (
                        <li
                          key={item.id}
                          className="flex flex-col text-sm"
                        >
                          <span className="text-foreground">
                            {item.quantity}x {item.name}
                          </span>
                          {item.notes && (
                            <span className="text-xs text-muted-foreground italic pl-4">
                              - {item.notes}
                            </span>
                          )}
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
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" suppressHydrationWarning>
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(order.createdAt, { addSuffix: true })}
                      {order.tableId && (
                        <Badge variant="secondary" className="text-xs">
                          Table {order.tableId.replace("t", "")}
                        </Badge>
                      )}
                      {order.customerName && (
                        <Badge variant="outline" className="text-xs">
                          {order.customerName}
                        </Badge>
                      )}
                    </div>
                    {order.orderNotes && (
                      <p className="mt-1 text-xs italic text-primary">
                        Note: {order.orderNotes}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <ul className="mb-3 space-y-1">
                      {order.items.map((item) => (
                        <li
                          key={item.id}
                          className="flex flex-col text-sm"
                        >
                          <span className="text-foreground">
                            {item.quantity}x {item.name}
                          </span>
                          {item.notes && (
                            <span className="text-xs text-muted-foreground italic pl-4">
                              - {item.notes}
                            </span>
                          )}
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
