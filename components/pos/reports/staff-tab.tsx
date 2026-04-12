"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function StaffTab({ props }: any) {
  const { filteredOrders, shifts } = props;

  const { staffData, staffCharts } = useMemo(() => {
    const sMap: Record<string, any> = {};

    filteredOrders.forEach((o: any) => {
      const staffName = o.createdBy || "Unknown";
      if (!sMap[staffName]) {
        sMap[staffName] = { name: staffName, shifts: 0, orders: 0, revenue: 0, itemsSold: 0 };
      }
      sMap[staffName].orders += 1;
      sMap[staffName].revenue += (o.grandTotal || o.total || 0);
      sMap[staffName].itemsSold += o.items.reduce((sum: number, i: any) => sum + i.quantity, 0);
    });

    if (shifts && shifts.length > 0) {
      shifts.forEach((s: any) => {
        if (!sMap[s.staffName]) {
          sMap[s.staffName] = { name: s.staffName, shifts: 0, orders: 0, revenue: 0, itemsSold: 0 };
        }
        sMap[s.staffName].shifts += 1;
      });
    }

    const arr = Object.values(sMap).sort((a,b) => b.revenue - a.revenue);
    const charts = arr.slice(0, 8).map(s => ({ name: s.name, revenue: s.revenue }));

    return { staffData: arr, staffCharts: charts };
  }, [filteredOrders, shifts]);

  return (
    <div className="flex h-full flex-col overflow-y-auto pt-2 space-y-4">
      <Card className="bg-card border-border shrink-0">
        <CardHeader>
          <CardTitle className="text-base">Revenue per Staff</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {staffCharts.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={staffCharts}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" stroke="hsl(var(--border))" tick={{ fill: "hsl(var(--foreground))" }} fontSize={12} />
                  <YAxis stroke="hsl(var(--border))" tick={{ fill: "hsl(var(--foreground))" }} fontSize={12} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip trigger="click" cursor={false} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} formatter={(value: number) => `₹${value.toFixed(0)}`} />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border flex-1 flex flex-col min-h-[300px]">
        <CardHeader>
          <CardTitle className="text-base">Staff Details</CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10 shadow-sm border-b">
              <TableRow className="hover:bg-transparent">
                <TableHead>Staff Member</TableHead>
                <TableHead className="text-right">Known Shifts</TableHead>
                <TableHead className="text-right">Orders Served</TableHead>
                <TableHead className="text-right">Items Sold</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">AOV</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No records</TableCell>
                </TableRow>
              ) : (
                staffData.map((row: any) => (
                  <TableRow key={row.name}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right">{row.shifts}</TableCell>
                    <TableCell className="text-right">{row.orders}</TableCell>
                    <TableCell className="text-right">{row.itemsSold}</TableCell>
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
