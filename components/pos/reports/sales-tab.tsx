"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { format } from "date-fns";

export function SalesTab({ props }: any) {
  const { filteredOrders } = props;

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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="bg-card border-border">
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

        <Card className="bg-card border-border">
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

      <Card className="bg-card border-border flex-1 flex flex-col min-h-[300px]">
        <CardHeader>
          <CardTitle className="text-base">Daily Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10 shadow-sm border-b">
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
