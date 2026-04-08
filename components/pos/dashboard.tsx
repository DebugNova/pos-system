"use client";

import { useState } from "react";
import { usePOSStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  IndianRupee,
  ShoppingBag,
  Users,
  Clock,
  AlertTriangle,
  Wifi,
  BarChart3,
  ArrowLeft,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ReportsContent } from "./reports";

export function Dashboard() {
  const [showReports, setShowReports] = useState(false);
  const { orders, tables, setActiveView } = usePOSStore();

  const todaySales = orders
    .filter((o) => o.status === "completed" || o.status === "ready")
    .reduce((sum, o) => sum + o.total, 0);

  const activeTables = tables.filter((t) => t.status !== "available").length;
  const pendingOrders = orders.filter(
    (o) => o.status === "new" || o.status === "preparing"
  ).length;
  const kitchenQueue = orders.filter((o) => o.status === "preparing").length;

  const swiggyOrders = orders.filter(
    (o) => o.platform === "swiggy" && o.status !== "completed"
  ).length;
  const zomatoOrders = orders.filter(
    (o) => o.platform === "zomato" && o.status !== "completed"
  ).length;

  const recentOrders = orders.slice(0, 5);

  if (showReports) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-4 border-b border-border p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowReports(false)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold text-foreground">Reports & Analytics</h1>
        </div>
        <ReportsContent />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, Admin. Here&apos;s your cafe overview.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setShowReports(true)}
          >
            <BarChart3 className="h-4 w-4" />
            Reports
          </Button>
          <Badge variant="outline" className="gap-1.5 py-1.5 text-success border-success/30 bg-success/10">
            <Wifi className="h-3 w-3" />
            Online
          </Badge>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Today&apos;s Sales
            </CardTitle>
            <IndianRupee className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {todaySales.toLocaleString("en-IN", {
                style: "currency",
                currency: "INR",
                minimumFractionDigits: 0,
              })}
            </div>
            <p className="text-xs text-muted-foreground">+12% from yesterday</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer bg-card border-border transition-colors hover:bg-secondary/50 active:scale-[0.98]"
          onClick={() => setActiveView("tables")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Tables
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {activeTables}/{tables.length}
            </div>
            <p className="text-xs text-muted-foreground">tables occupied</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer bg-card border-border transition-colors hover:bg-secondary/50 active:scale-[0.98]"
          onClick={() => setActiveView("orders")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Orders
            </CardTitle>
            <ShoppingBag className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{pendingOrders}</div>
            <p className="text-xs text-muted-foreground">orders in queue</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer bg-card border-border transition-colors hover:bg-secondary/50 active:scale-[0.98]"
          onClick={() => setActiveView("kitchen")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Kitchen Queue
            </CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{kitchenQueue}</div>
            <p className="text-xs text-muted-foreground">items preparing</p>
          </CardContent>
        </Card>
      </div>

      {/* Aggregator + Alerts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Aggregator Orders */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">Aggregator Orders</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            <div className="flex flex-1 items-center gap-3 rounded-lg bg-[#fc8019]/10 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#fc8019]">
                <span className="text-sm font-bold text-white">S</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{swiggyOrders}</p>
                <p className="text-xs text-muted-foreground">Swiggy</p>
              </div>
            </div>
            <div className="flex flex-1 items-center gap-3 rounded-lg bg-[#e23744]/10 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e23744]">
                <span className="text-sm font-bold text-white">Z</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{zomatoOrders}</p>
                <p className="text-xs text-muted-foreground">Zomato</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card className="bg-card border-border lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Alerts</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {pendingOrders > 3 && (
              <Badge variant="destructive" className="gap-1.5 py-1.5">
                <AlertTriangle className="h-3 w-3" />
                High order backlog
              </Badge>
            )}
            <Badge variant="outline" className="gap-1.5 py-1.5 text-success border-success/30">
              <Wifi className="h-3 w-3" />
              All printers connected
            </Badge>
            {kitchenQueue > 2 && (
              <Badge variant="secondary" className="gap-1.5 py-1.5">
                <Clock className="h-3 w-3" />
                Kitchen busy
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between rounded-lg bg-secondary/50 p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <ShoppingBag className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {order.id.toUpperCase()}
                      {order.tableId && (
                        <span className="ml-2 text-muted-foreground">
                          Table {order.tableId.replace("t", "")}
                        </span>
                      )}
                      {order.platform && (
                        <Badge
                          variant="outline"
                          className="ml-2 text-xs"
                          style={{
                            borderColor:
                              order.platform === "swiggy" ? "#fc8019" : "#e23744",
                            color: order.platform === "swiggy" ? "#fc8019" : "#e23744",
                          }}
                        >
                          {order.platform}
                        </Badge>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground" suppressHydrationWarning>
                      {order.items.length} items &bull;{" "}
                      {formatDistanceToNow(order.createdAt, { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={
                      order.status === "new"
                        ? "default"
                        : order.status === "preparing"
                        ? "secondary"
                        : order.status === "ready"
                        ? "outline"
                        : "outline"
                    }
                    className={
                      order.status === "ready"
                        ? "border-success text-success bg-success/10"
                        : ""
                    }
                  >
                    {order.status}
                  </Badge>
                  <span className="font-semibold text-foreground">
                    {order.total.toLocaleString("en-IN", {
                      style: "currency",
                      currency: "INR",
                      minimumFractionDigits: 0,
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
