"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { format } from "date-fns";
import { Banknote, Smartphone } from "lucide-react";

export function SalesTab({ props }: any) {
  const { filteredOrders, cashUpiStats, totalRevenue } = props;
  const { trend, totalCash, totalUPI } = cashUpiStats || { trend: [], totalCash: 0, totalUPI: 0 };

  const { orderTypeMix, categorySales, dailyBreakdown } = useMemo(() => {
    const typeMap: Record<string, { value: number, revenue: number }> = {
      'dine-in': { value: 0, revenue: 0 },
      'takeaway': { value: 0, revenue: 0 },
      'swiggy': { value: 0, revenue: 0 },
      'zomato': { value: 0, revenue: 0 },
    };

    const catMap: Record<string, number> = {};
    const dMap: Record<string, { orders: number, gross: number, net: number }> = {};

    filteredOrders.forEach((o: any) => {
      // Order type mix
      const p = o.platform || (o.type === 'takeaway' ? 'takeaway' : 'dine-in');
      const key = p.toLowerCase();
      if (!typeMap[key]) typeMap[key] = { value: 0, revenue: 0 };
      typeMap[key].value += 1;
      typeMap[key].revenue += (o.grandTotal || o.total || 0);

      // Daily Breakdown
      const d = format(new Date(o.createdAt), "MMM dd");
      if (!dMap[d]) dMap[d] = { orders: 0, gross: 0, net: 0 };
      dMap[d].orders += 1;
      const tAmount = (o.grandTotal || o.total || 0);
      dMap[d].net += tAmount;
      // fake gross assuming 5% tax if not available
      dMap[d].gross += o.subtotal || (tAmount * 0.95);

      // Category Sales
      o.items.forEach((item: any) => {
        const cat = item.category || 'Uncategorized';
        catMap[cat] = (catMap[cat] || 0) + (item.price * item.quantity);
      });
    });

    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
    const typePie = Object.entries(typeMap).filter(([, v]) => v.value > 0).map(([k, v], i) => ({
      name: k.charAt(0).toUpperCase() + k.slice(1),
      value: v.revenue,
      orders: v.value,
      color: colors[i % colors.length]
    }));

    const catBar = Object.entries(catMap).map(([k, v]) => ({ name: k, revenue: v })).sort((a,b) => b.revenue - a.revenue);
    
    const dailyArr = Object.entries(dMap).map(([d, v]) => ({ date: d, ...v }));

    return { orderTypeMix: typePie, categorySales: catBar, dailyBreakdown: dailyArr };
  }, [filteredOrders]);

  return (
    <div className="flex h-full flex-col overflow-y-auto pt-2 space-y-4">
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
      <Card className="bg-gradient-to-br from-card to-card border border-border/40 shadow-sm rounded-[24px] overflow-hidden">
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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="bg-gradient-to-br from-indigo-500/5 to-card border border-border/40 shadow-sm rounded-[24px] overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">Revenue by Order Type</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-center gap-6">
            <div className="h-48 w-48 shrink-0">
              {orderTypeMix.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={orderTypeMix} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
                      {orderTypeMix.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip trigger="click" cursor={false} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} formatter={(value: number) => `₹${value.toFixed(0)}`} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="space-y-2 w-full">
              {orderTypeMix.map((e, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: e.color }}></div>
                    <span>{e.name}</span>
                  </div>
                  <span className="font-medium">₹{e.value.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/5 to-card border border-border/40 shadow-sm rounded-[24px] overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">Revenue by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              {categorySales.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categorySales} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--border))" tick={{ fill: "hsl(var(--foreground))" }} fontSize={12} />
                    <YAxis type="category" dataKey="name" stroke="hsl(var(--border))" tick={{ fill: "hsl(var(--foreground))" }} fontSize={12} width={80} />
                    <Tooltip trigger="click" cursor={false} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} formatter={(value: number) => `₹${value.toFixed(0)}`} />
                    <Bar dataKey="revenue" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gradient-to-br from-orange-500/5 to-card border border-border/40 shadow-sm flex-1 flex flex-col min-h-[300px] rounded-[24px] overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">Daily Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-orange-50/80 dark:bg-orange-950/20 backdrop-blur-md z-10 shadow-sm border-b border-border/40">
              <TableRow className="hover:bg-transparent">
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Net Revenue</TableHead>
                <TableHead className="text-right">AOV</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dailyBreakdown.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No records</TableCell>
                </TableRow>
              ) : (
                dailyBreakdown.map((row: any) => (
                  <TableRow key={row.date}>
                    <TableCell className="font-medium">{row.date}</TableCell>
                    <TableCell className="text-right">{row.orders}</TableCell>
                    <TableCell className="text-right text-muted-foreground">₹{row.gross.toFixed(0)}</TableCell>
                    <TableCell className="text-right font-medium">₹{row.net.toFixed(0)}</TableCell>
                    <TableCell className="text-right">₹{(row.net / row.orders).toFixed(0)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
