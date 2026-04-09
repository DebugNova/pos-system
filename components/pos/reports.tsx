"use client";

import { useState, useMemo } from "react";
import { usePOSStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  IndianRupee,
  ShoppingBag,
  CreditCard,
  Banknote,
  Smartphone,
  Clock,
  Calendar as CalendarIcon,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

export function ReportsContent() {
  const { orders } = usePOSStore();
  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });

  const filteredOrders = useMemo(() => {
    if (!date?.from) return [];
    const from = startOfDay(date.from);
    const to = endOfDay(date.to || date.from);

    return orders.filter((o) => {
      if (o.status !== "completed" && o.status !== "ready") return false;
      const orderDate = new Date(o.createdAt);
      return isWithinInterval(orderDate, { start: from, end: to });
    });
  }, [orders, date]);

  const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.grandTotal || o.total || 0), 0);
  const totalOrders = filteredOrders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Since we don't track status transition timestamps right now, we default to N/A
  const avgPrepTime = "N/A";

  const hourlyRevenue = useMemo(() => {
    const hours: Record<string, number> = {};
    filteredOrders.forEach((o) => {
      const hour = new Date(o.createdAt).getHours();
      const label = hour > 12 ? `${hour - 12}PM` : hour === 12 ? "12PM" : hour === 0 ? "12AM" : `${hour}AM`;
      hours[label] = (hours[label] || 0) + (o.grandTotal || o.total || 0);
    });
    
    const result = [];
    for(let i=0; i<24; i++) {
        const hLabel = i > 12 ? `${i - 12}PM` : i === 12 ? "12PM" : i === 0 ? "12AM" : `${i}AM`;
        if (hours[hLabel] !== undefined) {
            result.push({ hour: hLabel, revenue: hours[hLabel], _hour: i });
        }
    }
    return result.sort((a,b) => a._hour - b._hour);
  }, [filteredOrders]);

  const paymentBreakdown = useMemo(() => {
    const methods: Record<string, number> = { Cash: 0, UPI: 0, Card: 0, Split: 0 };
    filteredOrders.forEach((o) => {
      if (o.payment) {
        const method = o.payment.method;
        const key = method.toLowerCase() === "upi" ? "UPI" : method.charAt(0).toUpperCase() + method.slice(1);
        methods[key] = (methods[key] || 0) + 1;
      } else {
        // Fallback for orders without payment details
        methods["Unknown"] = (methods["Unknown"] || 0) + 1;
      }
    });

    // Remove empty methods
    if (methods["Unknown"] === 0) delete methods["Unknown"];
    
    const total = Object.values(methods).reduce((a, b) => a + b, 0);
    return Object.entries(methods)
      .filter(([, count]) => count > 0)
      .map(([name, count]) => ({
        name,
        value: total > 0 ? Math.round((count / total) * 100) : 0,
        color: name === "Cash" ? "#22c55e" : name === "UPI" ? "#f59e0b" : name === "Card" ? "#3b82f6" : name === "Split" ? "#ec4899" : "#94a3b8",
      }));
  }, [filteredOrders]);

  const topItems = useMemo(() => {
    const itemMap: Record<string, { name: string; orders: number; revenue: number }> = {};
    filteredOrders.forEach((o) => {
      o.items.forEach((item) => {
        if (!itemMap[item.menuItemId]) {
          itemMap[item.menuItemId] = { name: item.name, orders: 0, revenue: 0 };
        }
        itemMap[item.menuItemId].orders += item.quantity;
        itemMap[item.menuItemId].revenue += item.price * item.quantity;
      });
    });
    return Object.values(itemMap).sort((a, b) => b.orders - a.orders).slice(0, 5);
  }, [filteredOrders]);

  const staffPerformance = useMemo(() => {
    const staffMap = new Map<string, { name: string; orders: number; revenue: number }>();
    filteredOrders.forEach((o) => {
      const staffName = o.createdBy || "Unknown";
      const current = staffMap.get(staffName) || { name: staffName, orders: 0, revenue: 0 };
      staffMap.set(staffName, {
        ...current,
        orders: current.orders + 1,
        revenue: current.revenue + (o.grandTotal || o.total || 0),
      });
    });
    return Array.from(staffMap.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders]);

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Performance overview
          </p>
        </div>
        
        {/* Date Filter */}
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn(
                  "w-[300px] justify-start text-left font-normal bg-card border-border",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "LLL dd, y")} -{" "}
                      {format(date.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(date.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Stats Row */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
            <IndianRupee className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {totalRevenue.toLocaleString("en-IN", {
                style: "currency",
                currency: "INR",
                minimumFractionDigits: 0,
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Orders
            </CardTitle>
            <ShoppingBag className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalOrders}</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Order Value
            </CardTitle>
            <CreditCard className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {avgOrderValue.toLocaleString("en-IN", {
                style: "currency",
                currency: "INR",
                minimumFractionDigits: 0,
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Prep Time
            </CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{avgPrepTime}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Hourly Revenue Chart */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">Hourly Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {hourlyRevenue.length === 0 ? (
                <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                  No data available for the selected period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={hourlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="hour"
                      stroke="hsl(var(--border))"
                      tick={{ fill: "hsl(var(--foreground))" }}
                      fontSize={12}
                    />
                    <YAxis
                      stroke="hsl(var(--border))"
                      tick={{ fill: "hsl(var(--foreground))" }}
                      fontSize={12}
                      tickFormatter={(value) => `₹${value}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))"
                      }}
                      formatter={(value: number) => [`₹${value}`, "Revenue"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ fill: "#f59e0b", strokeWidth: 2 }}
                    />
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
            <div className="flex h-64 items-center gap-8">
              {paymentBreakdown.length === 0 ? (
                <div className="flex w-full h-full items-center justify-center text-muted-foreground text-sm">
                  No data available for the selected period
                </div>
              ) : (
                <>
                  <div className="flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={paymentBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {paymentBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            color: "hsl(var(--foreground))"
                          }}
                          formatter={(value: number) => [`${value}%`, "Share"]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    {paymentBreakdown.map((item, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <div className="flex items-center gap-2">
                          {item.name === "UPI" && (
                            <Smartphone className="h-4 w-4 text-muted-foreground" />
                          )}
                          {item.name === "Cash" && (
                            <Banknote className="h-4 w-4 text-muted-foreground" />
                          )}
                          {item.name === "Card" && (
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                          )}
                          {(item.name !== "UPI" && item.name !== "Cash" && item.name !== "Card") && (
                            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-sm text-foreground">{item.name}</span>
                        </div>
                        <span className="ml-auto text-sm font-semibold text-foreground">
                          {item.value}%
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
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
                    <XAxis
                      type="number"
                      stroke="hsl(var(--border))"
                      tick={{ fill: "hsl(var(--foreground))" }}
                      fontSize={12}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="hsl(var(--border))"
                      tick={{ fill: "hsl(var(--foreground))" }}
                      fontSize={12}
                      width={100}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))"
                      }}
                      formatter={(value: number, name: string) => [
                        name === "orders" ? `${value} orders` : `₹${value}`,
                        name === "orders" ? "Orders" : "Revenue",
                      ]}
                    />
                    <Bar
                      dataKey="orders"
                      fill="#f59e0b"
                      radius={[0, 4, 4, 0]}
                    />
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
                    <XAxis
                      type="number"
                      stroke="hsl(var(--border))"
                      tick={{ fill: "hsl(var(--foreground))" }}
                      fontSize={12}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="hsl(var(--border))"
                      tick={{ fill: "hsl(var(--foreground))" }}
                      fontSize={12}
                      width={100}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))"
                      }}
                      formatter={(value: number, name: string) => [
                        name === "orders" ? `${value} orders` : `₹${value.toFixed(2)}`,
                        name === "orders" ? "Orders" : "Revenue",
                      ]}
                    />
                    <Bar
                      dataKey="revenue"
                      fill="#3b82f6"
                      radius={[0, 4, 4, 0]}
                    />
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

