"use client";

import { useMemo, useState } from "react";
import { usePOSStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search, Users, Banknote, Smartphone } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface CustomerAgg {
  id: string; // phone or name or 'guest'
  name: string;
  phone: string;
  totalVisits: number;
  lifetimeSpent: number;
  lastVisitDate: Date;
  cashOrders: number;
  upiOrders: number;
}

export function CustomersView() {
  const { orders } = usePOSStore();
  const [searchQuery, setSearchQuery] = useState("");

  const customers = useMemo(() => {
    const map = new Map<string, CustomerAgg>();

    orders.forEach((order) => {
      // Determine unique ID for the customer
      const id = order.customerPhone?.trim() || order.customerName?.trim() || "guest";
      const name = order.customerName?.trim() || (id === "guest" ? "Guest" : "Unknown");
      const phone = order.customerPhone?.trim() || "—";
      const paymentMethod = order.payment?.method?.toLowerCase();

      const existing = map.get(id) || {
        id,
        name,
        phone,
        totalVisits: 0,
        lifetimeSpent: 0,
        lastVisitDate: new Date(0),
        cashOrders: 0,
        upiOrders: 0,
      };

      // Update name/phone if previously unknown but now available
      if (existing.name === "Unknown" && name !== "Unknown") existing.name = name;
      if (existing.phone === "—" && phone !== "—") existing.phone = phone;

      existing.totalVisits += 1;
      existing.lifetimeSpent += (order.grandTotal ?? order.total ?? 0);
      
      const orderDate = new Date(order.createdAt);
      if (orderDate > existing.lastVisitDate) {
        existing.lastVisitDate = orderDate;
      }

      if (paymentMethod === "cash") {
        existing.cashOrders += 1;
      } else if (paymentMethod === "upi") {
        existing.upiOrders += 1;
      }

      map.set(id, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.lifetimeSpent - a.lifetimeSpent);
  }, [orders]);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
  );

  return (
    <div className="space-y-4">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Customer Insights</h2>
          <p className="text-sm text-muted-foreground">View lifetime analytics and preferences for all customers.</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-11 bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-sm rounded-xl"
          />
        </div>
      </div>

      <Card className="bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-lg overflow-hidden rounded-2xl">
        <CardHeader className="py-3 border-b border-white/10 bg-white/20 dark:bg-black/20">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Customer Directory ({filteredCustomers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-white/10">
                  <TableHead className="text-xs font-semibold">Customer</TableHead>
                  <TableHead className="text-xs font-semibold text-center">Total Visits</TableHead>
                  <TableHead className="text-xs font-semibold">Lifetime Spent</TableHead>
                  <TableHead className="text-xs font-semibold">Last Visit</TableHead>
                  <TableHead className="text-xs font-semibold">Payment Preference (Cash vs UPI)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => {
                  const totalPaid = customer.cashOrders + customer.upiOrders;
                  const cashPercent = totalPaid > 0 ? Math.round((customer.cashOrders / totalPaid) * 100) : 0;
                  const upiPercent = totalPaid > 0 ? Math.round((customer.upiOrders / totalPaid) * 100) : 0;
                  
                  return (
                    <TableRow key={customer.id} className="hover:bg-white/10 dark:hover:bg-white/5 transition-colors border-b border-white/10">
                      <TableCell>
                        <div className="font-bold text-sm text-foreground">{customer.name}</div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">{customer.phone}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="font-bold bg-primary/10 text-primary hover:bg-primary/20">
                          {customer.totalVisits}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {customer.lifetimeSpent.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {customer.lastVisitDate.getTime() === 0 ? "—" : format(customer.lastVisitDate, "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5 min-w-[200px]">
                          <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground">
                            <span className="flex items-center gap-1"><Banknote className="h-3 w-3 text-green-500"/> Cash ({cashPercent}%)</span>
                            <span className="flex items-center gap-1"><Smartphone className="h-3 w-3 text-blue-500"/> UPI ({upiPercent}%)</span>
                          </div>
                          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden flex">
                            <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${cashPercent}%` }} />
                            <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${upiPercent}%` }} />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredCustomers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-12">
                      No customers found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
