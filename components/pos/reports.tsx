"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { usePOSStore } from "@/lib/store";
import { Loader2, Database, CalendarIcon, Download } from "lucide-react";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchDailySales,
  fetchHourlyRevenue,
  fetchPaymentBreakdown,
  fetchTopItems,
  fetchStaffPerformance,
  fetchItemDetails,
} from "@/lib/supabase-queries";
import { OverviewTab } from "./reports/overview-tab";
import { ItemsTab } from "./reports/items-tab";
import { SalesTab } from "./reports/sales-tab";
import { StaffTab } from "./reports/staff-tab";
import { TablesTab } from "./reports/tables-tab";

interface HourlyData { hour: number; revenue: number; orderCount: number }
interface PaymentData { method: string; count: number; total: number }
interface TopItemData { name: string; menuItemId: string; totalQuantity: number; totalRevenue: number }
interface StaffData { staffName: string; ordersCreated: number; ordersCompleted: number; totalRevenue: number }

export function ReportsContent() {
  const { orders, tables, shifts, supabaseEnabled } = usePOSStore();
  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });

  const [activeTab, setActiveTab] = useState("overview");

  // Server-side data states
  const [serverLoading, setServerLoading] = useState(false);
  const [useServer, setUseServer] = useState(false);
  const [serverHourly, setServerHourly] = useState<HourlyData[]>([]);
  const [serverPayments, setServerPayments] = useState<PaymentData[]>([]);
  const [serverTopItems, setServerTopItems] = useState<TopItemData[]>([]);
  const [serverStaff, setServerStaff] = useState<StaffData[]>([]);
  const [serverTotals, setServerTotals] = useState<{ totalRevenue: number; totalOrders: number; avgOrderValue: number } | null>(null);
  const [serverItemDetails, setServerItemDetails] = useState<any[]>([]);

  const formatDateForQuery = (d: Date) => format(d, "yyyy-MM-dd");

  const loadServerData = useCallback(async () => {
    if (!supabaseEnabled || !date?.from) return;
    setServerLoading(true);
    try {
      const fromStr = formatDateForQuery(date.from);
      const toStr = date.to ? formatDateForQuery(date.to) : fromStr;
      const isSingleDay = fromStr === toStr;

      const [dailySales, hourly, payments, topItems, staff, itemDetails] = await Promise.all([
        fetchDailySales(90),
        isSingleDay ? fetchHourlyRevenue(fromStr) : Promise.resolve([]),
        isSingleDay ? fetchPaymentBreakdown(fromStr) : Promise.resolve([]),
        isSingleDay ? fetchTopItems(fromStr, 10) : Promise.resolve([]),
        isSingleDay ? fetchStaffPerformance(fromStr) : Promise.resolve([]),
        fetchItemDetails(fromStr, toStr) // using the new function
      ]);

      setServerItemDetails(itemDetails);

      const filteredDailySales = dailySales.filter((s: any) => s.saleDate >= fromStr && s.saleDate <= toStr);
      const totalRevenue = filteredDailySales.reduce((sum: number, s: any) => sum + s.totalRevenue, 0);
      const totalOrders = filteredDailySales.reduce((sum: number, s: any) => sum + s.totalOrders, 0);
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      setServerTotals({ totalRevenue, totalOrders, avgOrderValue });
      setServerHourly(hourly as HourlyData[]);

      if (!isSingleDay) {
        // Multi-day aggregate logic
        const allPayments = await Promise.all(filteredDailySales.map((s: any) => fetchPaymentBreakdown(s.saleDate)));
        const pmtMap = new Map<string, { count: number; total: number }>();
        allPayments.flat().forEach((p: any) => {
          const existing = pmtMap.get(p.method) || { count: 0, total: 0 };
          pmtMap.set(p.method, { count: existing.count + p.count, total: existing.total + p.total });
        });
        setServerPayments(Array.from(pmtMap.entries()).map(([method, data]) => ({ method, ...data })));

        const allItems = await Promise.all(filteredDailySales.map((s: any) => fetchTopItems(s.saleDate, 20)));
        const itemMap = new Map<string, TopItemData>();
        allItems.flat().forEach((item: any) => {
          const existing = itemMap.get(item.name);
          if (existing) {
            existing.totalQuantity += item.totalQuantity;
            existing.totalRevenue += item.totalRevenue;
          } else {
            itemMap.set(item.name, { ...item });
          }
        });
        setServerTopItems(Array.from(itemMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity).slice(0, 10));

        const allStaff = await Promise.all(filteredDailySales.map((s: any) => fetchStaffPerformance(s.saleDate)));
        const staffMap = new Map<string, StaffData>();
        allStaff.flat().forEach((s: any) => {
          const existing = staffMap.get(s.staffName);
          if (existing) {
            existing.ordersCreated += s.ordersCreated;
            existing.ordersCompleted += s.ordersCompleted;
            existing.totalRevenue += s.totalRevenue;
          } else {
            staffMap.set(s.staffName, { ...s });
          }
        });
        setServerStaff(Array.from(staffMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue));
      } else {
        setServerPayments(payments as PaymentData[]);
        setServerTopItems((topItems as TopItemData[]).slice(0, 10));
        setServerStaff(staff as StaffData[]);
      }

      setUseServer(true);
    } catch (err) {
      console.error("[reports] Server fetch failed, falling back to local:", err);
      setUseServer(false);
    } finally {
      setServerLoading(false);
    }
  }, [supabaseEnabled, date]);

  useEffect(() => {
    if (supabaseEnabled) {
      loadServerData();
    } else {
      setUseServer(false);
    }
  }, [loadServerData, supabaseEnabled]);

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

  const totalRevenue = useServer ? (serverTotals?.totalRevenue ?? 0) : filteredOrders.reduce((sum, o) => sum + (o.grandTotal || o.total || 0), 0);
  const totalOrders = useServer ? (serverTotals?.totalOrders ?? 0) : filteredOrders.length;
  const avgOrderValue = useServer ? (serverTotals?.avgOrderValue ?? 0) : totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const avgPrepTime = "N/A";

  const hourlyRevenue = useMemo(() => {
    if (useServer) return serverHourly.map((h) => {
      const hour = h.hour;
      const label = hour > 12 ? `${hour - 12}PM` : hour === 12 ? "12PM" : hour === 0 ? "12AM" : `${hour}AM`;
      return { hour: label, revenue: h.revenue, _hour: hour };
    }).sort((a, b) => a._hour - b._hour);

    const hours: Record<string, number> = {};
    filteredOrders.forEach((o) => {
      const hour = new Date(o.createdAt).getHours();
      const label = hour > 12 ? `${hour - 12}PM` : hour === 12 ? "12PM" : hour === 0 ? "12AM" : `${hour}AM`;
      hours[label] = (hours[label] || 0) + (o.grandTotal || o.total || 0);
    });
    const result = [];
    for (let i = 0; i < 24; i++) {
      const hLabel = i > 12 ? `${i - 12}PM` : i === 12 ? "12PM" : i === 0 ? "12AM" : `${i}AM`;
      if (hours[hLabel] !== undefined) result.push({ hour: hLabel, revenue: hours[hLabel], _hour: i });
    }
    return result.sort((a, b) => a._hour - b._hour);
  }, [filteredOrders, useServer, serverHourly]);

  const paymentBreakdown = useMemo(() => {
    const colorMap: Record<string, string> = { Cash: "#22c55e", cash: "#22c55e", UPI: "#f59e0b", upi: "#f59e0b", Card: "#3b82f6", card: "#3b82f6", Split: "#ec4899", split: "#ec4899", platform: "#8b5cf6" };
    if (useServer) {
      const total = serverPayments.reduce((a, b) => a + b.count, 0);
      return serverPayments.filter((p) => p.count > 0).map((p) => {
        const key = p.method?.charAt(0).toUpperCase() + (p.method?.slice(1) || "");
        return { name: p.method === "upi" ? "UPI" : key, value: total > 0 ? Math.round((p.count / total) * 100) : 0, color: colorMap[p.method] || "#94a3b8" };
      });
    }

    const methods: Record<string, number> = { Cash: 0, UPI: 0, Card: 0, Split: 0 };
    filteredOrders.forEach((o) => {
      if (o.payment) {
        const method = o.payment.method;
        const key = method.toLowerCase() === "upi" ? "UPI" : method.charAt(0).toUpperCase() + method.slice(1);
        methods[key] = (methods[key] || 0) + 1;
      } else methods["Unknown"] = (methods["Unknown"] || 0) + 1;
    });
    if (methods["Unknown"] === 0) delete methods["Unknown"];
    const total = Object.values(methods).reduce((a, b) => a + b, 0);
    return Object.entries(methods).filter(([, count]) => count > 0).map(([name, count]) => ({
      name, value: total > 0 ? Math.round((count / total) * 100) : 0, color: colorMap[name] || "#94a3b8",
    }));
  }, [filteredOrders, useServer, serverPayments]);

  const topItems = useMemo(() => {
    if (useServer) return serverTopItems.map((item) => ({ name: item.name, orders: item.totalQuantity, revenue: item.totalRevenue }));
    const itemMap: Record<string, { name: string; orders: number; revenue: number }> = {};
    filteredOrders.forEach((o) => {
      o.items.forEach((item) => {
        if (!itemMap[item.menuItemId]) itemMap[item.menuItemId] = { name: item.name, orders: 0, revenue: 0 };
        itemMap[item.menuItemId].orders += item.quantity;
        itemMap[item.menuItemId].revenue += item.price * item.quantity;
      });
    });
    return Object.values(itemMap).sort((a, b) => b.orders - a.orders).slice(0, 5);
  }, [filteredOrders, useServer, serverTopItems]);

  const staffPerformance = useMemo(() => {
    if (useServer) return serverStaff.map((s) => ({ name: s.staffName, orders: s.ordersCompleted, revenue: s.totalRevenue }));
    const staffMap = new Map<string, { name: string; orders: number; revenue: number }>();
    filteredOrders.forEach((o) => {
      const staffName = o.createdBy || "Unknown";
      const current = staffMap.get(staffName) || { name: staffName, orders: 0, revenue: 0 };
      staffMap.set(staffName, { ...current, orders: current.orders + 1, revenue: current.revenue + (o.grandTotal || o.total || 0) });
    });
    return Array.from(staffMap.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders, useServer, serverStaff]);

  const itemDetails = useMemo(() => {
    if (useServer) return serverItemDetails;
    const itemMap = new Map<string, any>();
    filteredOrders.forEach(o => {
      const addedToOrder = new Set();
      o.items.forEach(item => {
        if (!itemMap.has(item.menuItemId)) {
          itemMap.set(item.menuItemId, { menuItemId: item.menuItemId, name: item.name, category: "Local", totalQuantity: 0, grossRevenue: 0, timesInOrder: 0 });
        }
        const current = itemMap.get(item.menuItemId);
        current.totalQuantity += item.quantity;
        current.grossRevenue += item.price * item.quantity;
        if (!addedToOrder.has(item.menuItemId)) {
          current.timesInOrder += 1;
          addedToOrder.add(item.menuItemId);
        }
      });
    });
    return Array.from(itemMap.values());
  }, [filteredOrders, useServer, serverItemDetails]);

  const overviewProps = { totalRevenue, totalOrders, avgOrderValue, avgPrepTime, hourlyRevenue, paymentBreakdown, topItems, staffPerformance };
  const itemsTabProps = { itemDetails, totalRevenue, totalOrders };
  const salesTabProps = { filteredOrders };
  const staffTabProps = { filteredOrders, shifts };
  const tablesTabProps = { filteredOrders, tables };

  return (
    <div className="flex flex-col h-full overflow-hidden p-3 sm:p-4 lg:p-6 bg-background">
      {/* Header Area */}
      <div className="mb-6 flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            Performance overview
            {serverLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            {useServer && !serverLoading && (
              <span className="inline-flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                <Database className="h-3 w-3" />
                Live Cloud Sync
              </span>
            )}
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Quick Presets (Phase A req) */}
          <div className="flex gap-1 mr-2 hidden sm:flex">
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setDate({from: startOfDay(new Date()), to: endOfDay(new Date())})}>Today</Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => {
              const d = new Date(); d.setDate(d.getDate() - 7);
              setDate({from: startOfDay(d), to: endOfDay(new Date())});
            }}>7D</Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => {
              const d = new Date(); d.setDate(d.getDate() - 30);
              setDate({from: startOfDay(d), to: endOfDay(new Date())});
            }}>30D</Button>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button id="date" variant={"outline"} className={cn("w-full sm:w-[260px] justify-start text-left font-normal bg-card h-9 border-border", !date && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date?.from ? (date.to ? <>{format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}</> : format(date.from, "LLL dd, y")) : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2} />
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="icon" className="h-9 w-9 bg-card border-border" title="Export CSV">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs Layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full justify-start overflow-x-auto overflow-y-hidden whitespace-nowrap border-b rounded-none px-0 bg-transparent h-auto mb-4 border-b-border space-x-2 pb-1">
          <TabsTrigger value="overview" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2">
            Overview
          </TabsTrigger>
          <TabsTrigger value="items" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2">
            Items
          </TabsTrigger>
          <TabsTrigger value="sales" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2">Sales</TabsTrigger>
          <TabsTrigger value="staff" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2">Staff</TabsTrigger>
          <TabsTrigger value="tables" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2">Tables</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto">
          <TabsContent value="overview" className="m-0 h-full">
            <OverviewTab props={overviewProps} />
          </TabsContent>
          
          <TabsContent value="items" className="m-0 h-full">
            <ItemsTab props={itemsTabProps} />
          </TabsContent>

          <TabsContent value="sales" className="m-0 h-full">
            <SalesTab props={salesTabProps} />
          </TabsContent>

          <TabsContent value="staff" className="m-0 h-full">
            <StaffTab props={staffTabProps} />
          </TabsContent>

          <TabsContent value="tables" className="m-0 h-full">
            <TablesTab props={tablesTabProps} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
