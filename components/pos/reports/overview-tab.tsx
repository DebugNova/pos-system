"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IndianRupee, ShoppingBag, CreditCard, Clock, Smartphone, Banknote } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";

export function OverviewTab({ props }: any) {
  const { totalRevenue, totalOrders, avgOrderValue, avgPrepTime, hourlyRevenue, paymentBreakdown, topItems, staffPerformance, cashUpiStats } = props;
  const { trend, totalCash, totalUPI } = cashUpiStats || { trend: [], totalCash: 0, totalUPI: 0 };

  return (
    <div className="flex h-full flex-col overflow-y-auto pt-2 space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Total Revenue */}
        <div className="flex flex-col p-5 sm:p-6 rounded-[24px] bg-gradient-to-br from-emerald-500/5 to-card border border-border/40 shadow-sm transition-all hover:shadow-lg relative overflow-hidden group cursor-default">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-[40px] -mr-10 -mt-10 transition-all duration-500 group-hover:bg-emerald-500/20" />
          <div className="flex items-start justify-between mb-4 relative z-10">
            <div className="flex items-center justify-center w-12 h-12 rounded-[18px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 shadow-sm">
              <IndianRupee className="h-6 w-6" />
            </div>
          </div>
          <div className="flex flex-col relative z-10">
            <div className="text-3xl sm:text-4xl font-black text-foreground tracking-tighter mb-1 drop-shadow-sm">
              {totalRevenue.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}
            </div>
            <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Total Revenue</span>
          </div>
        </div>

        {/* Total Orders */}
        <div className="flex flex-col p-5 sm:p-6 rounded-[24px] bg-gradient-to-br from-blue-500/5 to-card border border-border/40 shadow-sm transition-all hover:shadow-lg relative overflow-hidden group cursor-default">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-[40px] -mr-10 -mt-10 transition-all duration-500 group-hover:bg-blue-500/20" />
          <div className="flex items-start justify-between mb-4 relative z-10">
            <div className="flex items-center justify-center w-12 h-12 rounded-[18px] bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500 shadow-sm">
              <ShoppingBag className="h-6 w-6" />
            </div>
          </div>
          <div className="flex flex-col relative z-10">
            <div className="text-3xl sm:text-4xl font-black text-foreground tracking-tighter mb-1 drop-shadow-sm">
              {totalOrders}
            </div>
            <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Total Orders</span>
          </div>
        </div>

        {/* Avg Order Value */}
        <div className="flex flex-col p-5 sm:p-6 rounded-[24px] bg-gradient-to-br from-amber-500/5 to-card border border-border/40 shadow-sm transition-all hover:shadow-lg relative overflow-hidden group cursor-default">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-[40px] -mr-10 -mt-10 transition-all duration-500 group-hover:bg-amber-500/20" />
          <div className="flex items-start justify-between mb-4 relative z-10">
            <div className="flex items-center justify-center w-12 h-12 rounded-[18px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 shadow-sm">
              <CreditCard className="h-6 w-6" />
            </div>
          </div>
          <div className="flex flex-col relative z-10">
            <div className="text-3xl sm:text-4xl font-black text-foreground tracking-tighter mb-1 drop-shadow-sm">
              {avgOrderValue.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}
            </div>
            <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Avg Order Value</span>
          </div>
        </div>

        {/* Avg Prep Time */}
        <div className="flex flex-col p-5 sm:p-6 rounded-[24px] bg-gradient-to-br from-rose-500/5 to-card border border-border/40 shadow-sm transition-all hover:shadow-lg relative overflow-hidden group cursor-default">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-[40px] -mr-10 -mt-10 transition-all duration-500 group-hover:bg-rose-500/20" />
          <div className="flex items-start justify-between mb-4 relative z-10">
            <div className="flex items-center justify-center w-12 h-12 rounded-[18px] bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500 shadow-sm">
              <Clock className="h-6 w-6" />
            </div>
          </div>
          <div className="flex flex-col relative z-10">
            <div className="text-3xl sm:text-4xl font-black text-foreground tracking-tighter mb-1 drop-shadow-sm">
              {avgPrepTime}
            </div>
            <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Avg Prep Time</span>
          </div>
        </div>
      </div>

      {/* Premium Payment Breakdown Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        {/* Cash Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent border border-emerald-500/20 p-5 sm:p-6 transition-all duration-300 hover:shadow-[0_8px_40px_-12px_rgba(16,185,129,0.3)] hover:border-emerald-500/40 group active:scale-[0.98] cursor-default">
          <div className="absolute -top-6 -right-6 p-4 opacity-10 transition-transform duration-700 ease-out group-hover:scale-125 group-hover:opacity-20 group-hover:-rotate-12">
            <Banknote className="w-32 h-32 text-emerald-500" />
          </div>
          <div className="relative z-10 flex flex-col gap-3 sm:gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600 shadow-inner backdrop-blur-md border border-emerald-500/20">
                <Banknote className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-emerald-600/90 uppercase tracking-widest">Total Cash</h3>
                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Physical currency collection</p>
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-1 sm:mt-2">
              <span className="text-3xl sm:text-4xl font-black tracking-tighter text-foreground drop-shadow-sm">
                {totalCash.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}
              </span>
              <span className="text-xs sm:text-sm font-bold text-emerald-500 flex items-center bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                {totalRevenue > 0 ? ((totalCash / totalRevenue) * 100).toFixed(1) : "0"}%
              </span>
            </div>
            <div className="w-full bg-emerald-500/10 h-1.5 sm:h-2 rounded-full overflow-hidden mt-1 sm:mt-2 backdrop-blur-sm">
              <div 
                className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-full rounded-full transition-all duration-1000 ease-out" 
                style={{ width: `${totalRevenue > 0 ? Math.min(100, (totalCash / totalRevenue) * 100) : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* UPI Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/15 via-violet-500/5 to-transparent border border-violet-500/20 p-5 sm:p-6 transition-all duration-300 hover:shadow-[0_8px_40px_-12px_rgba(139,92,246,0.3)] hover:border-violet-500/40 group active:scale-[0.98] cursor-default">
          <div className="absolute -top-6 -right-6 p-4 opacity-10 transition-transform duration-700 ease-out group-hover:scale-125 group-hover:opacity-20 group-hover:rotate-12">
            <Smartphone className="w-32 h-32 text-violet-500" />
          </div>
          <div className="relative z-10 flex flex-col gap-3 sm:gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-violet-500/20 text-violet-600 shadow-inner backdrop-blur-md border border-violet-500/20">
                <Smartphone className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-violet-600/90 uppercase tracking-widest">Total UPI</h3>
                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Digital payments collection</p>
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-1 sm:mt-2">
              <span className="text-3xl sm:text-4xl font-black tracking-tighter text-foreground drop-shadow-sm">
                {totalUPI.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}
              </span>
              <span className="text-xs sm:text-sm font-bold text-violet-500 flex items-center bg-violet-500/10 px-2.5 py-0.5 rounded-full">
                {totalRevenue > 0 ? ((totalUPI / totalRevenue) * 100).toFixed(1) : "0"}%
              </span>
            </div>
            <div className="w-full bg-violet-500/10 h-1.5 sm:h-2 rounded-full overflow-hidden mt-1 sm:mt-2 backdrop-blur-sm">
              <div 
                className="bg-gradient-to-r from-violet-400 to-violet-600 h-full rounded-full transition-all duration-1000 ease-out" 
                style={{ width: `${totalRevenue > 0 ? Math.min(100, (totalUPI / totalRevenue) * 100) : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Cash vs UPI Trend Chart */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Cash vs. UPI Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            {trend.length === 0 ? (
              <div className="flex w-full h-full items-center justify-center text-muted-foreground text-sm">
                No data available for the selected period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" stroke="hsl(var(--border))" tick={{ fill: "hsl(var(--foreground))" }} fontSize={12} axisLine={false} tickLine={false} dy={10} />
                  <YAxis width={60} stroke="hsl(var(--border))" tick={{ fill: "hsl(var(--foreground))" }} fontSize={12} axisLine={false} tickLine={false} tickFormatter={(value) => `₹${value}`} />
                  <Tooltip 
                    cursor={{ fill: 'hsl(var(--foreground))', opacity: 0.05 }}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                    labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600, marginBottom: "4px" }}
                    formatter={(value: number, name: string) => [`₹${value.toLocaleString("en-IN")}`, name]} 
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                  <Bar dataKey="cash" name="Cash" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                  <Bar dataKey="upi" name="UPI" stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Hourly Revenue Chart */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">Hourly Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {hourlyRevenue.length === 0 ? (
                <div className="flex w-full h-full items-center justify-center text-muted-foreground text-sm">
                  No data available for the selected period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={hourlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="hour" stroke="hsl(var(--border))" tick={{ fill: "hsl(var(--foreground))" }} fontSize={12} />
                    <YAxis stroke="hsl(var(--border))" tick={{ fill: "hsl(var(--foreground))" }} fontSize={12} tickFormatter={(value) => `₹${value}`} />
                    <Tooltip trigger="click" cursor={false} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} formatter={(value: number) => [`₹${value}`, "Revenue"]} />
                    <Line type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2} dot={{ fill: "#f59e0b", strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment Breakdown */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">Payment Methods</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row h-auto sm:h-64 items-center gap-4 sm:gap-8 min-h-[16rem]">
              {paymentBreakdown.length === 0 ? (
                <div className="flex w-full h-full items-center justify-center text-muted-foreground text-sm">
                  No data available for the selected period
                </div>
              ) : (
                <>
                  <div className="w-full h-48 sm:h-full sm:flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={paymentBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={4} dataKey="value">
                          {paymentBreakdown.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip trigger="click" cursor={false} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} formatter={(value: number) => [`${value}%`, "Share"]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    {paymentBreakdown.map((item: any, index: number) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-foreground">{item.name}</span>
                        </div>
                        <span className="ml-auto text-sm font-semibold text-foreground">{item.value}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top Items */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">Top Selling Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {topItems.length === 0 ? (
                <div className="flex w-full h-full items-center justify-center text-muted-foreground text-sm">
                  No data available for the selected period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topItems} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--border))" tick={{ fill: "hsl(var(--foreground))" }} fontSize={12} />
                    <YAxis type="category" dataKey="name" stroke="hsl(var(--border))" tick={{ fill: "hsl(var(--foreground))" }} fontSize={12} width={100} />
                    <Tooltip trigger="click" cursor={false} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} formatter={(value: number, name: string) => [name === "orders" ? `${value} orders` : `₹${value}`, name === "orders" ? "Orders" : "Revenue"]} />
                    <Bar dataKey="orders" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Staff Performance */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">Staff Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {staffPerformance.length === 0 ? (
                <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                  No data available for the selected period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={staffPerformance} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--border))" tick={{ fill: "hsl(var(--foreground))" }} fontSize={12} />
                    <YAxis type="category" dataKey="name" stroke="hsl(var(--border))" tick={{ fill: "hsl(var(--foreground))" }} fontSize={12} width={100} />
                    <Tooltip trigger="click" cursor={false} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} formatter={(value: number, name: string) => [name === "orders" ? `${value} orders` : `₹${value.toFixed(2)}`, name === "orders" ? "Orders" : "Revenue"]} />
                    <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
