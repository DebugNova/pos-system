"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function TablesTab({ props }: any) {
  const { filteredOrders, tables } = props;

  const { tableData, tableCharts } = useMemo(() => {
    const tMap: Record<string, any> = {};

    filteredOrders.forEach((o: any) => {
      // Only care about orders with a table ID
      if (!o.tableId) return;

      const tid = o.tableId;
      if (!tMap[tid]) {
        tMap[tid] = { tableId: tid, name: `Table ${tid.replace('t', '')}`, orders: 0, revenue: 0, capacity: 0 };
      }
      tMap[tid].orders += 1;
      tMap[tid].revenue += (o.grandTotal || o.total || 0);
    });

    if (tables && tables.length > 0) {
      tables.forEach((t: any) => {
        if (!tMap[t.id]) {
          tMap[t.id] = { tableId: t.id, name: `Table ${t.number}`, orders: 0, revenue: 0, capacity: t.capacity || 0 };
        } else {
          tMap[t.id].name = `Table ${t.number}`;
          tMap[t.id].capacity = t.capacity || 0;
        }
      });
    }

    const arr = Object.values(tMap)
      .filter(t => t.orders > 0 || t.revenue > 0)
      .sort((a,b) => b.revenue - a.revenue);
      
    const charts = arr.map(t => ({ name: t.name, revenue: t.revenue })).slice(0, 10);

    return { tableData: arr, tableCharts: charts };
  }, [filteredOrders, tables]);

  return (
    <div className="flex h-full flex-col overflow-y-auto pt-2 space-y-4">
      <Card className="bg-card border-border shrink-0">
        <CardHeader>
          <CardTitle className="text-base">Revenue per Table (Top 10)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {tableCharts.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No dine-in data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tableCharts}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" stroke="hsl(var(--border))" tick={{ fill: "hsl(var(--foreground))" }} fontSize={12} />
                  <YAxis stroke="hsl(var(--border))" tick={{ fill: "hsl(var(--foreground))" }} fontSize={12} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip trigger="click" cursor={false} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} formatter={(value: number) => `₹${value.toFixed(0)}`} />
                  <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border flex-1 flex flex-col min-h-[300px]">
        <CardHeader>
          <CardTitle className="text-base">Table Utilisation & Revenue</CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10 shadow-sm border-b">
              <TableRow className="hover:bg-transparent">
                <TableHead>Table</TableHead>
                <TableHead className="text-right">Capacity</TableHead>
                <TableHead className="text-right">Orders Hosted</TableHead>
                <TableHead className="text-right">Total Revenue</TableHead>
                <TableHead className="text-right">AOV</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No records</TableCell>
                </TableRow>
              ) : (
                tableData.map((row: any) => (
                  <TableRow key={row.tableId}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{row.capacity > 0 ? row.capacity : '--'}</TableCell>
                    <TableCell className="text-right">{row.orders}</TableCell>
                    <TableCell className="text-right font-medium text-primary">₹{row.revenue.toFixed(0)}</TableCell>
                    <TableCell className="text-right">₹{row.orders > 0 ? (row.revenue / row.orders).toFixed(0) : 0}</TableCell>
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
