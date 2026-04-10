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
  Database,
  Banknote,
  Briefcase,
  Wallet
} from "lucide-react";
import { formatDistanceToNow, isToday } from "date-fns";
import { ReportsContent } from "./reports";
import { DataManager } from "./data-manager";

export function Dashboard() {
  const [showReports, setShowReports] = useState(false);
  const [showDataManager, setShowDataManager] = useState(false);
  const { orders, tables, shifts, currentUser, setActiveView } = usePOSStore();

  const isAdmin = currentUser?.role === "Admin";

  const todaySales = orders
    .filter((o) => o.status === "completed" && isToday(new Date(o.createdAt)))
    .reduce((sum, o) => {
      const orderTotal = o.grandTotal ?? o.total;
      const refundAmount = o.refund?.amount ?? 0;
      return sum + (orderTotal - refundAmount);
    }, 0);

  const activeTables = tables.filter((t) => t.status !== "available").length;
  const pendingOrders = orders.filter(
    (o) => o.status === "new" || o.status === "preparing" || o.status === "ready"
  ).length;
  const kitchenQueue = orders.filter((o) => o.status === "preparing").length;
  const awaitingPaymentOrders = orders.filter((o) => o.status === "awaiting-payment").length;

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

  if (showDataManager) {
    return <DataManager onBack={() => setShowDataManager(false)} />;
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground lg:text-2xl">Dashboard</h1>
          <p className="text-xs text-muted-foreground lg:text-sm">
            Welcome back, Admin. Here&apos;s your cafe overview.
          </p>
        </div>
        <div className="flex items-center gap-2 lg:gap-3">
          <Button
            size="sm"
            className="gap-1.5 h-9 lg:h-10 lg:gap-2 bg-orange-600 hover:bg-orange-700 text-white shadow border-0"
            onClick={() => setShowReports(true)}
          >
            <BarChart3 className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
            <span className="text-xs lg:text-sm font-semibold">Reports</span>
          </Button>
          <Button
            size="sm"
            className="gap-1.5 h-9 lg:h-10 lg:gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow border-0"
            onClick={() => setShowDataManager(true)}
          >
            <Database className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
            <span className="text-xs lg:text-sm font-semibold">Data</span>
          </Button>
          <Badge variant="outline" className="gap-1 py-1 text-xs text-success border-success/30 bg-success/10 lg:gap-1.5 lg:py-1.5">
            <Wifi className="h-2.5 w-2.5 lg:h-3 lg:w-3" />
            Online
          </Badge>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-5 lg:gap-4">
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
          onClick={() => setActiveView("billing")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Awaiting Payment
            </CardTitle>
            <Wallet className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${awaitingPaymentOrders > 0 ? "text-amber-500" : "text-muted-foreground"}`}>
              {awaitingPaymentOrders}
            </div>
            <p className="text-xs text-muted-foreground">pending bills</p>
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
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 rounded-lg bg-[#fc8019]/10 p-4">
              <div className="flex shrink-0 h-10 w-10 items-center justify-center rounded-lg bg-[#fc8019]">
                <span className="text-sm font-bold text-white">S</span>
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-foreground truncate">{swiggyOrders}</p>
                <p className="text-xs text-muted-foreground truncate">Swiggy</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-[#e23744]/10 p-4">
              <div className="flex shrink-0 h-10 w-10 items-center justify-center rounded-lg bg-[#e23744]">
                <span className="text-sm font-bold text-white">Z</span>
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-foreground truncate">{zomatoOrders}</p>
                <p className="text-xs text-muted-foreground truncate">Zomato</p>
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

      {/* Admin Only: Shift History & Recent Orders */}
      <div className={`grid grid-cols-1 ${isAdmin ? "lg:grid-cols-2 gap-4 lg:gap-6" : ""}`}>
        {isAdmin && (
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" />
                Recent Shifts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {shifts.slice(0, 5).map((shift) => (
                  <div key={shift.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg bg-secondary/50 p-3">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{shift.staffName}</span>
                        {shift.endedAt ? (
                          <Badge variant="outline" className="text-[10px] py-0">Completed</Badge>
                        ) : (
                          <Badge variant="default" className="text-[10px] py-0 bg-success hover:bg-success/90">Active</Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground mt-1" suppressHydrationWarning>
                        {shift.startedAt.toLocaleString("en-IN", {
                          hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short"
                        })}
                        {shift.endedAt && ` - ${shift.endedAt.toLocaleString("en-IN", {
                          hour: "2-digit", minute: "2-digit"
                        })}`}
                      </span>
                    </div>
                    <div className="flex flex-row sm:flex-col items-end gap-2 sm:gap-1">
                      {shift.endedAt && shift.totalSales !== undefined && (
                        <div className="text-right">
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Sales</span>
                          <span className="font-semibold text-foreground text-sm">
                            ₹{shift.totalSales.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                          </span>
                        </div>
                      )}
                      <div className="text-right">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Drawer</span>
                        <span className="text-sm font-medium text-muted-foreground flex items-center justify-end gap-1">
                          <Banknote className="h-3 w-3" />
                          ₹{shift.closingCash !== undefined ? shift.closingCash : shift.openingCash}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {shifts.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    No shift records found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

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
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-lg bg-secondary/50 p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex shrink-0 h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <ShoppingBag className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <p className="font-medium text-foreground truncate max-w-[120px] sm:max-w-[200px]">
                        {order.id.toUpperCase()}
                      </p>
                      {order.tableId && (
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          Table {order.tableId.replace("t", "")}
                        </span>
                      )}
                      {order.platform && (
                        <Badge
                          variant="outline"
                          className="text-xs shrink-0"
                          style={{
                            borderColor:
                              order.platform === "swiggy" ? "#fc8019" : "#e23744",
                            color: order.platform === "swiggy" ? "#fc8019" : "#e23744",
                          }}
                        >
                          {order.platform}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate" suppressHydrationWarning>
                      {order.items.length} items &bull;{" "}
                      {formatDistanceToNow(order.createdAt, { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3 justify-end sm:justify-start">
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
            {recentOrders.length === 0 && (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No orders today
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
