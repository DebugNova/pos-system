"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IndianRupee, ShoppingBag, CreditCard, Clock, Smartphone, Banknote } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from "recharts";

export function OverviewTab({ props }: any) {
  const { totalRevenue, totalOrders, avgOrderValue, avgPrepTime, hourlyRevenue, paymentBreakdown, topItems, staffPerformance } = props;

  return (
    <div className="flex h-full flex-col overflow-y-auto pt-2 space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <IndianRupee className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {totalRevenue.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
            </div>
            {/* TODO: Add delta % vs previous period */}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
            <ShoppingBag className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalOrders}</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Order Value</CardTitle>
            <CreditCard className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
               {avgOrderValue.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Prep Time</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{avgPrepTime}</div>
          </CardContent>
        </Card>
      </div>

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
