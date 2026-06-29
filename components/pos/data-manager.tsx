"use client";

import { useState } from "react";
import { usePOSStore } from "@/lib/store";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Download,
  Upload,
  RefreshCw,
  Package,
  Users,
  Grid3X3,
  ShoppingBag,
  Search,
  Coffee,
} from "lucide-react";
import { exportToExcel } from "./data-manager/export-utils";
import { OrdersView } from "./data-manager/orders-view";
import { MenuView } from "./data-manager/menu-view";
import { TablesView } from "./data-manager/tables-view";
import { StaffView } from "./data-manager/staff-view";
import { CustomersView } from "./data-manager/customers-view";

interface DataManagerProps {
  onBack: () => void;
}

export function DataManager({ onBack }: DataManagerProps) {
  const {
    orders,
    menuItems,
    tables,
    staffMembers,
    shifts,
    auditLog,
    settings,
    currentUser,
    clearAllData,
    importData,
  } = usePOSStore();

  const [activeTab, setActiveTab] = useState("orders");
  const [searchQuery, setSearchQuery] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [importText, setImportText] = useState("");
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Stats
  const totalOrders = orders.length;
  const completedOrders = orders.filter((o) => o.status === "completed").length;
  const totalRevenue = orders.filter((o) => o.status === "completed").reduce((sum, o) => sum + (o.grandTotal ?? o.total), 0);

  // Handlers
  const handleExport = () => {
    exportToExcel({
      currentUser,
      settings,
      orders,
      menuItems,
      tables,
      staffMembers,
      shifts: shifts || [],
      auditLog: auditLog || [],
    });
  };

  const handleImport = () => {
    const success = importData(importText);
    if (success) {
      setShowImportDialog(false);
      setImportText("");
      toast.success("Data imported successfully.");
    } else {
      toast.error("Failed to import data. Please check the format.");
    }
  };

  return (
    <div className="flex h-full flex-col bg-background/95 backdrop-blur-3xl">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4 border-b border-white/10 p-4 lg:p-6 lg:flex-row lg:items-center lg:justify-between shrink-0 bg-white/5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 h-8 w-8 sm:h-9 sm:w-9 -ml-1 hover:bg-white/10">
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <div className="pt-1 sm:pt-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground lg:text-2xl leading-none">Data Manager</h1>
            <p className="text-[11px] sm:text-sm text-muted-foreground mt-1">View, edit, and manage all stored data in one place</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-row items-center gap-2 mt-1 sm:mt-0 lg:w-auto">
          <Button variant="outline" onClick={handleExport} className="justify-center h-8 sm:h-9 px-3 text-[11px] sm:text-sm font-medium bg-white/10 border-white/20 hover:bg-white/20">
            <Download className="mr-1.5 h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
            Download
          </Button>
          <Button variant="outline" onClick={() => setShowImportDialog(true)} className="justify-center h-8 sm:h-9 px-3 text-[11px] sm:text-sm font-medium bg-white/10 border-white/20 hover:bg-white/20">
            <Upload className="mr-1.5 h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
            Upload
          </Button>
          <Button variant="destructive" onClick={() => setShowClearConfirm(true)} className="col-span-2 sm:col-span-1 justify-center h-8 sm:h-9 px-3 text-[11px] sm:text-sm font-medium shadow-sm hover:bg-destructive/90">
            <RefreshCw className="mr-1.5 h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
            Reset
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-3 p-4 shrink-0 lg:gap-4 lg:p-6 xl:grid-cols-4">
          <Card className="flex flex-col p-5 sm:p-6 rounded-[24px] bg-gradient-to-br from-indigo-500/5 to-card border border-border/40 shadow-sm transition-all hover:shadow-lg relative overflow-hidden group cursor-default">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-[40px] -mr-10 -mt-10 transition-all duration-500 group-hover:bg-indigo-500/20" />
            <div className="flex items-start justify-between mb-4 relative z-10">
              <div className="flex items-center justify-center w-12 h-12 rounded-[18px] bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500 shadow-sm">
                <ShoppingBag className="h-6 w-6" />
              </div>
            </div>
            <div className="flex flex-col relative z-10">
              <div className="text-3xl sm:text-4xl font-black text-foreground tracking-tighter mb-1 drop-shadow-sm">
                {totalOrders}
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Total Orders</span>
            </div>
          </Card>
          
          <Card className="flex flex-col p-5 sm:p-6 rounded-[24px] bg-gradient-to-br from-emerald-500/5 to-card border border-border/40 shadow-sm transition-all hover:shadow-lg relative overflow-hidden group cursor-default">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-[40px] -mr-10 -mt-10 transition-all duration-500 group-hover:bg-emerald-500/20" />
            <div className="flex items-start justify-between mb-4 relative z-10">
              <div className="flex items-center justify-center w-12 h-12 rounded-[18px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500 shadow-sm">
                <Package className="h-6 w-6" />
              </div>
            </div>
            <div className="flex flex-col relative z-10">
              <div className="text-3xl sm:text-4xl font-black text-foreground tracking-tighter mb-1 drop-shadow-sm">
                {completedOrders}
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Completed</span>
            </div>
          </Card>
          
          <Card className="flex flex-col p-5 sm:p-6 rounded-[24px] bg-gradient-to-br from-blue-500/5 to-card border border-border/40 shadow-sm transition-all hover:shadow-lg relative overflow-hidden group cursor-default">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-[40px] -mr-10 -mt-10 transition-all duration-500 group-hover:bg-blue-500/20" />
            <div className="flex items-start justify-between mb-4 relative z-10">
              <div className="flex items-center justify-center w-12 h-12 rounded-[18px] bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500 shadow-sm">
                <Coffee className="h-6 w-6" />
              </div>
            </div>
            <div className="flex flex-col relative z-10">
              <div className="text-3xl sm:text-4xl font-black text-foreground tracking-tighter mb-1 drop-shadow-sm">
                {menuItems.length}
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Menu Items</span>
            </div>
          </Card>
          
          <Card className="flex flex-col p-5 sm:p-6 rounded-[24px] bg-gradient-to-br from-orange-500/5 to-card border border-border/40 shadow-sm transition-all hover:shadow-lg relative overflow-hidden group cursor-default">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-[40px] -mr-10 -mt-10 transition-all duration-500 group-hover:bg-orange-500/20" />
            <div className="flex items-start justify-between mb-4 relative z-10">
              <div className="flex items-center justify-center w-12 h-12 rounded-[18px] bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/20 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500 shadow-sm">
                <Grid3X3 className="h-6 w-6" />
              </div>
            </div>
            <div className="flex flex-col relative z-10">
              <div className="text-3xl sm:text-4xl font-black text-foreground tracking-tighter mb-1 drop-shadow-sm truncate">
                {totalRevenue.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Total Revenue</span>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex-1 flex flex-col p-4 pt-0 lg:p-6 lg:pt-0 pb-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col h-full min-h-[400px]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0 mb-4">
              <TabsList className="grid w-full grid-cols-5 sm:flex sm:w-auto h-12 sm:h-11 p-1 bg-white/20 dark:bg-black/20 backdrop-blur-md rounded-xl border border-white/10 shadow-inner">
                <TabsTrigger value="orders" className="flex items-center justify-center gap-1.5 h-full rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:shadow-sm">
                  <ShoppingBag className="h-4 w-4 sm:h-4 sm:w-4 shrink-0" />
                  <span className="hidden sm:inline text-sm font-medium">Orders</span>
                </TabsTrigger>
                <TabsTrigger value="menu" className="flex items-center justify-center gap-1.5 h-full rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:shadow-sm">
                  <Coffee className="h-4 w-4 sm:h-4 sm:w-4 shrink-0" />
                  <span className="hidden sm:inline text-sm font-medium">Menu</span>
                </TabsTrigger>
                <TabsTrigger value="customers" className="flex items-center justify-center gap-1.5 h-full rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:shadow-sm">
                  <Users className="h-4 w-4 sm:h-4 sm:w-4 shrink-0" />
                  <span className="hidden sm:inline text-sm font-medium">Customers</span>
                </TabsTrigger>
                <TabsTrigger value="tables" className="flex items-center justify-center gap-1.5 h-full rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:shadow-sm">
                  <Grid3X3 className="h-4 w-4 sm:h-4 sm:w-4 shrink-0" />
                  <span className="hidden sm:inline text-sm font-medium">Tables</span>
                </TabsTrigger>
                <TabsTrigger value="staff" className="flex items-center justify-center gap-1.5 h-full rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:shadow-sm">
                  <Users className="h-4 w-4 sm:h-4 sm:w-4 shrink-0" />
                  <span className="hidden sm:inline text-sm font-medium">Staff</span>
                </TabsTrigger>
              </TabsList>
              <div className="relative w-full sm:w-64 shrink-0">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Global search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-11 sm:h-11 bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-white/20 dark:border-white/10 focus-visible:ring-1 text-sm shadow-sm rounded-xl"
                />
              </div>
            </div>

            <TabsContent value="orders" className="mt-3 flex-1 overflow-hidden">
              <OrdersView searchQuery={searchQuery} />
            </TabsContent>

            <TabsContent value="menu" className="mt-3 flex-1 overflow-hidden">
              <MenuView searchQuery={searchQuery} />
            </TabsContent>

            <TabsContent value="customers" className="mt-3 flex-1 overflow-hidden">
              <CustomersView />
            </TabsContent>

            <TabsContent value="tables" className="mt-3 flex-1 overflow-hidden">
              <TablesView searchQuery={searchQuery} />
            </TabsContent>

            <TabsContent value="staff" className="mt-3 flex-1 overflow-hidden">
              <StaffView searchQuery={searchQuery} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Global Dialogs */}
      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Reset All Data</DialogTitle>
            <DialogDescription>
              Are you absolutely sure? This will delete all orders, menu items, categories, staff members, and settings. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setShowClearConfirm(false)} disabled={isResetting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isResetting}
              onClick={() => {
                setIsResetting(true);
                clearAllData();
                setTimeout(() => {
                  setIsResetting(false);
                  setShowClearConfirm(false);
                  toast.success("All data has been reset");
                }, 500);
              }}
            >
              {isResetting ? "Resetting..." : "Yes, Delete Everything"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Import Data</DialogTitle>
            <DialogDescription>Paste the exported JSON text below to restore data.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <textarea
              className="min-h-[200px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              placeholder='{"orders":[], "menuItems":[]...}'
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>Cancel</Button>
            <Button onClick={handleImport} disabled={!importText.trim()}>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
