"use client";

import { useState, useEffect } from "react";
import { usePOSStore } from "@/lib/store";
import { pollActiveOrders } from "@/lib/hydrate";
import { cn } from "@/lib/utils";
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
  Wallet,
  Smartphone
} from "lucide-react";
import { formatDistanceToNow, isToday, differenceInDays } from "date-fns";
import { ReportsContent } from "./reports";
import { DataManager } from "./data-manager";

export function Dashboard() {
  const [showReports, setShowReports] = useState(false);
  const [showDataManager, setShowDataManager] = useState(false);
  const { orders, tables, shifts, currentUser, setActiveView } = usePOSStore();

  const isOwner = currentUser?.role === "Owner";

  // ── Live-update: poll on mount + periodic tick ──
  // 1. Immediately poll when Dashboard mounts to catch orders completed
  //    while the user was on Billing/Kitchen/other views.
  // 2. Every 30 seconds, force a re-render so "X minutes ago" labels stay
  //    fresh and any Zustand store updates that didn't trigger a render
  //    (e.g., mutation from pollActiveOrders) are picked up.
  const [, setTick] = useState(0);
  useEffect(() => {
    // Immediate poll for freshness on mount
    if (navigator.onLine) {
      pollActiveOrders().catch(console.error);
    }

    // Periodic re-render tick (30s)
    const timer = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  const todaySales = orders
    .filter((o) => o.status === "completed" && isToday(new Date(o.createdAt)))
    .reduce((sum, o) => {
      const orderTotal = o.grandTotal ?? o.total;
      const refundAmount = o.refund?.amount ?? 0;
      return sum + (orderTotal - refundAmount);
    }, 0);

  let todayCash = 0;
  let todayUPI = 0;

  orders
    .filter((o) => o.status === "completed" && isToday(new Date(o.createdAt)))
    .forEach((o) => {
      const processPayment = (payment: any, maxAmount: number) => {
        if (!payment) return;
        if (payment.method === "cash") {
          todayCash += maxAmount;
        } else if (payment.method === "upi") {
          todayUPI += maxAmount;
        } else if (payment.method === "split" && payment.splitDetails) {
          const splitTotal = (payment.splitDetails.cash || 0) + (payment.splitDetails.upi || 0) + (payment.splitDetails.card || 0);
          if (splitTotal > 0) {
            const ratio = maxAmount / splitTotal;
            todayCash += (payment.splitDetails.cash || 0) * ratio;
            todayUPI += (payment.splitDetails.upi || 0) * ratio;
          }
        }
      };

      const refundAmount = o.refund?.amount ?? 0;
      const orderMainPaymentAmount = o.payment?.amount || (o.grandTotal ?? o.total);
      const effectiveMainAmount = Math.max(0, orderMainPaymentAmount - refundAmount);
      
      if (o.payment) {
        processPayment(o.payment, effectiveMainAmount);
      }

      if (o.supplementaryBills) {
        o.supplementaryBills.forEach((sb) => {
          if (sb.payment && sb.paidAt) {
            processPayment(sb.payment, sb.payment.amount || sb.total);
          }
        });
      }
    });

  const activeTables = tables.filter((t) => t.status !== "available").length;
  const pendingOrders = orders.filter(
    (o) => o.status === "new" || o.status === "preparing" || o.status === "ready"
  ).length;
  const kitchenQueue = orders.filter((o) => o.status === "preparing").length;
  const awaitingPaymentOrdersList = orders.filter((o) => {
    if (o.status === "cancelled" || o.status === "completed") return false;
    return (
      o.status === "awaiting-payment" ||
      o.status === "served-unpaid" ||
      (o.supplementaryBills && o.supplementaryBills.some((b) => !b.payment))
    );
  });
  const awaitingPaymentOrders = awaitingPaymentOrdersList.length;

  const totalPendingAmount = awaitingPaymentOrdersList.reduce((sum, o) => {
    if (o.status === "awaiting-payment" || o.status === "served-unpaid") {
      return sum + (o.total || 0);
    }
    return sum + (o.supplementaryBills?.filter(b => !b.payment).reduce((s, b) => s + b.total, 0) || 0);
  }, 0);

  const hasOverdueBills = awaitingPaymentOrdersList.some(o => differenceInDays(new Date(), new Date(o.createdAt)) >= 3);

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
    <div className="flex flex-col gap-5 sm:gap-6 lg:gap-8 p-4 sm:p-6 lg:p-8 bg-[#FAF6F1] dark:bg-[#1A1410] min-h-full">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">Dashboard</h1>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-success/15 border border-success/20 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
              </span>
              <span className="text-[10px] font-bold text-success uppercase tracking-wider">Online</span>
            </div>
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            Welcome back, Owner. Here&apos;s today&apos;s snapshot.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            size="sm"
            className="gap-2 h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-[0_4px_14px_0_rgba(245,158,11,0.39)] border-0 transition-all"
            onClick={() => setActiveView("subscription")}
          >
            <Briefcase className="h-4 w-4" />
            <span className="font-bold text-sm">Subscription</span>
          </Button>
          <Button
            size="sm"
            className="gap-2 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] border-0 transition-all"
            onClick={() => setShowDataManager(true)}
          >
            <Database className="h-4 w-4" />
            <span className="font-bold text-sm">Data Manager</span>
          </Button>
          <Button
            size="sm"
            className="gap-2 h-10 rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-[0_4px_14px_0_rgba(225,29,72,0.39)] border-0 transition-all"
            onClick={() => setShowReports(true)}
          >
            <BarChart3 className="h-4 w-4" />
            <span className="font-bold text-sm">Detailed Reports</span>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5 lg:gap-5">
        {/* Sales */}
        <div className="flex flex-col p-5 sm:p-6 rounded-[24px] bg-gradient-to-br from-emerald-500/5 to-card border border-border/40 shadow-sm transition-all hover:shadow-lg relative overflow-hidden group cursor-default">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-[40px] -mr-10 -mt-10 transition-all duration-500 group-hover:bg-emerald-500/20" />
          <div className="flex items-start justify-between mb-4 relative z-10">
            <div className="flex items-center justify-center w-12 h-12 rounded-[18px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 shadow-sm">
              <IndianRupee className="h-6 w-6" />
            </div>
          </div>
          <div className="flex flex-col relative z-10">
            <div className="text-3xl sm:text-4xl font-black text-foreground tracking-tighter mb-1 drop-shadow-sm">
              {todaySales.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}
            </div>
            <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Today's Sales</span>
          </div>
        </div>

        {/* Awaiting Payment */}
        <div 
          onClick={() => setActiveView("billing")}
          className={cn(
            "flex flex-col p-5 sm:p-6 rounded-[24px] border shadow-sm transition-all hover:shadow-lg relative overflow-hidden group cursor-pointer active:scale-[0.98]",
            hasOverdueBills 
              ? "bg-red-500/10 border-red-500/30 hover:bg-red-500/15" 
              : "bg-gradient-to-br from-amber-500/5 to-card border-border/40"
          )}
        >
          <div className={cn(
            "absolute top-0 right-0 w-32 h-32 rounded-full blur-[40px] -mr-10 -mt-10 transition-all duration-500",
            hasOverdueBills ? "bg-red-500/20 group-hover:bg-red-500/30" : "bg-amber-500/10 group-hover:bg-amber-500/20"
          )} />
          <div className="flex items-start justify-between mb-4 relative z-10">
            <div className={cn(
              "flex items-center justify-center w-12 h-12 rounded-[18px] border group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500 shadow-sm",
              hasOverdueBills 
                ? "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20" 
                : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20"
            )}>
              <Wallet className="h-6 w-6" />
            </div>
            {hasOverdueBills && (
              <div className="px-2 py-1 rounded-full bg-red-500/20 text-red-600 dark:text-red-400 text-[10px] font-bold uppercase tracking-wider animate-pulse">
                Overdue
              </div>
            )}
          </div>
          <div className="flex flex-col relative z-10">
            <div className="text-3xl sm:text-4xl font-black text-foreground tracking-tighter mb-1 drop-shadow-sm flex items-end gap-2">
              {awaitingPaymentOrders}
              {totalPendingAmount > 0 && (
                <span className={cn(
                  "text-base mb-1.5 font-bold",
                  hasOverdueBills ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-500"
                )}>
                  ({totalPendingAmount.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })})
                </span>
              )}
            </div>
            <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Awaiting Pay</span>
          </div>
        </div>

        {/* Active Tables */}
        <div 
          onClick={() => setActiveView("tables")}
          className="flex flex-col p-5 sm:p-6 rounded-[24px] bg-gradient-to-br from-blue-500/5 to-card border border-border/40 shadow-sm transition-all hover:shadow-lg relative overflow-hidden group cursor-pointer active:scale-[0.98]"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-[40px] -mr-10 -mt-10 transition-all duration-500 group-hover:bg-blue-500/20" />
          <div className="flex items-start justify-between mb-4 relative z-10">
            <div className="flex items-center justify-center w-12 h-12 rounded-[18px] bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 shadow-sm">
              <Users className="h-6 w-6" />
            </div>
          </div>
          <div className="flex flex-col relative z-10">
            <div className="flex items-baseline gap-1 mb-1 drop-shadow-sm">
              <span className="text-3xl sm:text-4xl font-black text-foreground tracking-tighter">{activeTables}</span>
              <span className="text-lg font-bold text-muted-foreground">/ {tables.length}</span>
            </div>
            <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Active Tables</span>
          </div>
        </div>

        {/* Pending Orders */}
        <div 
          onClick={() => setActiveView("orders")}
          className="flex flex-col p-5 sm:p-6 rounded-[24px] bg-gradient-to-br from-indigo-500/5 to-card border border-border/40 shadow-sm transition-all hover:shadow-lg relative overflow-hidden group cursor-pointer active:scale-[0.98]"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-[40px] -mr-10 -mt-10 transition-all duration-500 group-hover:bg-indigo-500/20" />
          <div className="flex items-start justify-between mb-4 relative z-10">
            <div className="flex items-center justify-center w-12 h-12 rounded-[18px] bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500 shadow-sm">
              <ShoppingBag className="h-6 w-6" />
            </div>
          </div>
          <div className="flex flex-col relative z-10">
            <div className="text-3xl sm:text-4xl font-black text-foreground tracking-tighter mb-1 drop-shadow-sm">
              {pendingOrders}
            </div>
            <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Pending Orders</span>
          </div>
        </div>

        {/* Kitchen Queue */}
        <div 
          onClick={() => setActiveView("kitchen")}
          className="flex flex-col p-5 sm:p-6 rounded-[24px] bg-gradient-to-br from-rose-500/5 to-card border border-border/40 shadow-sm transition-all hover:shadow-lg relative overflow-hidden group cursor-pointer active:scale-[0.98] sm:col-span-2 md:col-span-1 lg:col-span-1"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-[40px] -mr-10 -mt-10 transition-all duration-500 group-hover:bg-rose-500/20" />
          <div className="flex items-start justify-between mb-4 relative z-10">
            <div className="flex items-center justify-center w-12 h-12 rounded-[18px] bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 shadow-sm">
              <Clock className="h-6 w-6" />
            </div>
          </div>
          <div className="flex flex-col relative z-10">
            <div className="text-3xl sm:text-4xl font-black text-foreground tracking-tighter mb-1 drop-shadow-sm">
              {kitchenQueue}
            </div>
            <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Kitchen Queue</span>
          </div>
        </div>
      </div>

      {/* Premium Payment Breakdown Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
        {/* Cash Card */}
        <div className="relative overflow-hidden rounded-[24px] bg-emerald-50 border border-emerald-200/50 p-6 sm:p-8 transition-all duration-300 hover:shadow-[0_8px_40px_-12px_rgba(16,185,129,0.2)] group cursor-default">
          <div className="absolute -right-12 -top-12 sm:top-2 sm:-right-8">
            <Banknote className="w-40 h-40 text-emerald-500/10 transition-transform duration-700 ease-out group-hover:scale-110 group-hover:-rotate-12" strokeWidth={1.5} />
          </div>

          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-200/50 text-emerald-700">
                <Banknote className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-emerald-600 uppercase tracking-widest">Total Cash</h3>
                <p className="text-xs text-muted-foreground font-medium">Physical currency collection</p>
              </div>
            </div>
            
            <div className="flex items-end gap-3 mt-2">
              <span className="text-4xl sm:text-5xl font-black tracking-tighter text-foreground">
                {todayCash.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}
              </span>
              <span className="text-sm font-bold text-emerald-600 flex items-center bg-emerald-100 px-3 py-1 rounded-full mb-1 sm:mb-2">
                {todaySales > 0 ? ((todayCash / todaySales) * 100).toFixed(1) : "0"}%
              </span>
            </div>
            
            <div className="w-full bg-emerald-200/50 h-2.5 rounded-full overflow-hidden mt-1">
              <div 
                className="bg-emerald-400 h-full rounded-full transition-all duration-1000 ease-out relative" 
                style={{ width: `${todaySales > 0 ? Math.min(100, (todayCash / todaySales) * 100) : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* UPI Card */}
        <div className="relative overflow-hidden rounded-[24px] bg-purple-50 border border-purple-200/50 p-6 sm:p-8 transition-all duration-300 hover:shadow-[0_8px_40px_-12px_rgba(168,85,247,0.2)] group cursor-default">
          <div className="absolute -right-12 -top-12 sm:top-2 sm:-right-8">
            <Smartphone className="w-40 h-40 text-purple-500/10 transition-transform duration-700 ease-out group-hover:scale-110 group-hover:rotate-12" strokeWidth={1.5} />
          </div>

          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-200/50 text-purple-700">
                <Smartphone className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-purple-600 uppercase tracking-widest">Total UPI</h3>
                <p className="text-xs text-muted-foreground font-medium">Digital payments collection</p>
              </div>
            </div>
            
            <div className="flex items-end gap-3 mt-2">
              <span className="text-4xl sm:text-5xl font-black tracking-tighter text-foreground">
                {todayUPI.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}
              </span>
              <span className="text-sm font-bold text-purple-600 flex items-center bg-purple-100 px-3 py-1 rounded-full mb-1 sm:mb-2">
                {todaySales > 0 ? ((todayUPI / todaySales) * 100).toFixed(1) : "0"}%
              </span>
            </div>
            
            <div className="w-full bg-purple-200/50 h-2.5 rounded-full overflow-hidden mt-1">
              <div 
                className="bg-purple-400 h-full rounded-full transition-all duration-1000 ease-out relative" 
                style={{ width: `${todaySales > 0 ? Math.min(100, (todayUPI / todaySales) * 100) : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Alerts Row */}
      {(pendingOrders > 3 || kitchenQueue > 2) && (
        <div className="flex flex-col sm:flex-row gap-3 bg-amber-500/10 border border-amber-500/20 rounded-[20px] p-4 sm:p-5 items-start sm:items-center shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-amber-700 dark:text-amber-500">Attention Required</h4>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {pendingOrders > 3 && (
                <span className="text-xs font-semibold text-amber-700/90 dark:text-amber-500/90 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20">
                  High order backlog ({pendingOrders} pending)
                </span>
              )}
              {kitchenQueue > 2 && (
                <span className="text-xs font-semibold text-amber-700/90 dark:text-amber-500/90 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20">
                  Kitchen busy ({kitchenQueue} preparing)
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Owner Only: Shift History & Recent Orders */}
      <div className={`grid grid-cols-1 ${isOwner ? "lg:grid-cols-2 gap-4 lg:gap-5" : ""}`}>
        {isOwner && (
          <div className="flex flex-col bg-card rounded-[24px] border border-border/40 shadow-sm overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-border/40 bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Briefcase className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-foreground tracking-tight">Recent Shifts</h3>
              </div>
            </div>
            <div className="flex flex-col p-2 sm:p-3">
              {shifts.slice(0, 5).map((shift) => (
                <div key={shift.id} className="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground font-bold">
                      {shift.staffName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-sm">{shift.staffName}</span>
                        {!shift.endedAt && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-success/15 text-success uppercase tracking-wider">Active</span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground font-medium" suppressHydrationWarning>
                        {shift.startedAt.toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        {shift.endedAt ? ` - ${shift.endedAt.toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : " - Now"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {shift.endedAt && shift.totalSales !== undefined && (
                      <span className="font-bold text-foreground text-sm">
                        ₹{shift.totalSales.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                      </span>
                    )}
                    <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                      <Banknote className="h-3 w-3" />
                      ₹{shift.closingCash !== undefined ? shift.closingCash : shift.openingCash}
                    </span>
                  </div>
                </div>
              ))}
              {shifts.length === 0 && (
                <div className="p-8 text-center text-sm font-medium text-muted-foreground">
                  No shift records found
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent Orders */}
        <div className="flex flex-col bg-card rounded-[24px] border border-border/40 shadow-sm overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-border/40 bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground tracking-tight">Recent Orders</h3>
            </div>
          </div>
          <div className="flex flex-col">
            {recentOrders.map((order, index) => {
              // Generate Avatar content
              let avatarContent = <ShoppingBag className="h-4 w-4" />;
              if (order.customerName && order.customerName.toLowerCase() !== "guest") {
                avatarContent = <span className="text-sm">{order.customerName.charAt(0).toUpperCase()}</span>;
              }
              
              // Status Badge styling
              let statusBg = "bg-secondary text-muted-foreground border-transparent";
              if (order.status === "new") statusBg = "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
              else if (order.status === "preparing") statusBg = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
              else if (order.status === "ready") statusBg = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
              else if (order.status === "served-unpaid" || order.status === "awaiting-payment") statusBg = "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
              else if (order.status === "completed") statusBg = "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";

              return (
                <div 
                  key={order.id} 
                  className={cn(
                    "flex items-center justify-between gap-3 p-4 sm:p-5 hover:bg-secondary/30 transition-colors cursor-pointer active:scale-[0.99]",
                    index !== recentOrders.length - 1 && "border-b border-border/40"
                  )}
                  onClick={() => setActiveView("orders")}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 font-black shadow-inner border border-orange-500/20">
                      {avatarContent}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-[15px] truncate max-w-[140px] sm:max-w-[180px]">
                          {order.customerName || "Guest"}
                        </span>
                        {order.platform && (
                          <span 
                            className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border"
                            style={{
                              backgroundColor: order.platform === "swiggy" ? "#fc801915" : "#e2374415",
                              color: order.platform === "swiggy" ? "#fc8019" : "#e23744",
                              borderColor: order.platform === "swiggy" ? "#fc801930" : "#e2374430",
                            }}
                          >
                            {order.platform}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground font-medium" suppressHydrationWarning>
                        {formatDistanceToNow(order.createdAt, { addSuffix: true })} <span className="opacity-50">•</span> {order.items.length} items
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="font-black text-foreground text-[15px]">
                      {order.total.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                    </span>
                    <span className={cn(
                      "text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                      statusBg
                    )}>
                      {order.status.replace("-", " ")}
                    </span>
                  </div>
                </div>
              );
            })}
            {recentOrders.length === 0 && (
              <div className="p-10 text-center text-sm font-medium text-muted-foreground">
                No orders today
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
