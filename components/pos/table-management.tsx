"use client";

import { usePOSStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, CreditCard, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const statusColors = {
  available: "bg-success/20 border-success/50 text-success",
  occupied: "bg-warning/20 border-warning/50 text-warning",
  "waiting-payment": "bg-destructive/20 border-destructive/50 text-destructive",
};

const statusLabels = {
  available: "Available",
  occupied: "Occupied",
  "waiting-payment": "Payment",
};

export function TableManagement() {
  const { tables, orders, setActiveView, setSelectedTable, setOrderType } =
    usePOSStore();

  const handleTableClick = (tableId: string, status: string) => {
    if (status === "available") {
      setOrderType("dine-in");
      setSelectedTable(tableId);
      setActiveView("orders");
    }
  };

  const getTableOrder = (orderId?: string) => {
    if (!orderId) return null;
    return orders.find((o) => o.id === orderId);
  };

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Table Management</h1>
          <p className="text-sm text-muted-foreground">
            Tap a table to view or start an order
          </p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-success" />
            <span className="text-sm text-muted-foreground">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-warning" />
            <span className="text-sm text-muted-foreground">Occupied</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-destructive" />
            <span className="text-sm text-muted-foreground">Waiting Payment</span>
          </div>
        </div>
      </div>

      {/* Table Grid */}
      <div className="grid flex-1 grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {tables.map((table) => {
          const order = getTableOrder(table.orderId);
          return (
            <Card
              key={table.id}
              className={cn(
                "cursor-pointer border-2 transition-all hover:scale-[1.02] active:scale-[0.98]",
                statusColors[table.status]
              )}
              onClick={() => handleTableClick(table.id, table.status)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl text-foreground">
                    Table {table.number}
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className={cn(
                      "border-current",
                      table.status === "available" && "text-success",
                      table.status === "occupied" && "text-warning",
                      table.status === "waiting-payment" && "text-destructive"
                    )}
                  >
                    {statusLabels[table.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{table.capacity} seats</span>
                </div>

                {order && (
                  <div className="mt-3 space-y-2 rounded-lg bg-background/50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {order.id.toUpperCase()}
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {order.total.toLocaleString("en-IN", {
                          style: "currency",
                          currency: "INR",
                          minimumFractionDigits: 0,
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>
                        {formatDistanceToNow(order.createdAt, { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {order.items.length} items &bull; {order.status}
                    </p>

                    {table.status === "waiting-payment" && (
                      <Button size="sm" className="mt-2 w-full gap-1.5">
                        <CreditCard className="h-3 w-3" />
                        Process Payment
                      </Button>
                    )}
                  </div>
                )}

                {table.status === "available" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full gap-1.5 border-success/50 text-success hover:bg-success/10"
                  >
                    <Plus className="h-3 w-3" />
                    New Order
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
