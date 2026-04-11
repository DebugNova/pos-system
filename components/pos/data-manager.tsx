"use client";

import { useState, useRef } from "react";
import { usePOSStore } from "@/lib/store";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  Package,
  Users,
  Grid3X3,
  ShoppingBag,
  Search,
  Coffee,
  ImageIcon,
  Loader2,
  X,
} from "lucide-react";
import { format } from "date-fns";
import type { Order, MenuItem, Table as TableType } from "@/lib/data";
import { uploadMenuImage } from "@/lib/supabase-queries";

interface DataManagerProps {
  onBack: () => void;
}

export function DataManager({ onBack }: DataManagerProps) {
  const {
    orders,
    menuItems,
    tables,
    staffMembers,
    deleteOrder,
    updateOrder,
    deleteMenuItem,
    updateMenuItem,
    addMenuItem,
    deleteTable,
    updateTable,
    addTable,
    deleteStaffMember,
    updateStaffMember,
    addStaffMember,
    clearAllData,
    exportData,
    importData,
  } = usePOSStore();

  const [activeTab, setActiveTab] = useState("orders");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
  const [editingTable, setEditingTable] = useState<TableType | null>(null);
  const [editingStaff, setEditingStaff] = useState<{ id: string; name: string; role: string; pin: string; initials: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: string; id: string; name?: string } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [importText, setImportText] = useState("");
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showCancelOrderConfirm, setShowCancelOrderConfirm] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stats
  const totalOrders = orders.length;
  const completedOrders = orders.filter((o) => o.status === "completed").length;
  const totalRevenue = orders.filter((o) => o.status === "completed").reduce((sum, o) => sum + o.total, 0);

  // Filter functions
  const filteredOrders = orders.filter((o) =>
    o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMenuItems = menuItems.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTables = tables.filter((t) =>
    t.number.toString().includes(searchQuery) ||
    t.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredStaff = staffMembers.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handlers
  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `suhashi-pos-backup-${format(new Date(), "yyyy-MM-dd-HHmm")}.json`;
    a.click();
    URL.revokeObjectURL(url);
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

  const handleDelete = () => {
    if (!showDeleteConfirm) return;
    const { type, id } = showDeleteConfirm;
    switch (type) {
      case "order":
        deleteOrder(id);
        break;
      case "menuItem":
        deleteMenuItem(id);
        break;
      case "table":
        deleteTable(id);
        break;
      case "staff":
        deleteStaffMember(id);
        break;
    }
    setShowDeleteConfirm(null);
  };

  const handleSaveOrder = () => {
    if (!editingOrder) return;

    // Guard: require confirmation when changing status to cancelled
    const originalOrder = orders.find((o) => o.id === editingOrder.id);
    if (editingOrder.status === "cancelled" && originalOrder?.status !== "cancelled") {
      setShowCancelOrderConfirm(true);
      return;
    }

    updateOrder(editingOrder.id, {
      status: editingOrder.status,
      customerName: editingOrder.customerName,
    });
    setEditingOrder(null);
  };

  const handleConfirmCancelOrder = () => {
    if (!editingOrder) return;
    updateOrder(editingOrder.id, {
      status: editingOrder.status,
      customerName: editingOrder.customerName,
    });
    setShowCancelOrderConfirm(false);
    setEditingOrder(null);
    toast.success(`Order ${editingOrder.id.toUpperCase()} has been cancelled.`);
  };

  const handleSaveMenuItem = async () => {
    if (!editingMenuItem) return;

    let finalItem = { ...editingMenuItem };

    // Upload image if a file was selected
    if (imageFile) {
      setIsUploading(true);
      try {
        const ext = imageFile.name.split('.').pop() || 'png';
        const safeName = (finalItem.name || 'item').toLowerCase().replace(/[^a-z0-9]/g, '-');
        const fileName = `${safeName}-${Date.now()}.${ext}`;
        const publicUrl = await uploadMenuImage(imageFile, fileName);
        finalItem.image_url = publicUrl;
        toast.success("Image uploaded successfully");
      } catch (err) {
        console.error("[data-manager] Image upload failed:", err);
        toast.error("Image upload failed — saving without image");
      } finally {
        setIsUploading(false);
      }
    }

    if (finalItem.id.startsWith("new-")) {
      const newId = `${finalItem.category}-${Date.now()}`;
      addMenuItem({ ...finalItem, id: newId });
    } else {
      updateMenuItem(finalItem.id, finalItem);
    }
    setEditingMenuItem(null);
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSaveTable = () => {
    if (!editingTable) return;
    if (editingTable.id.startsWith("new-")) {
      const newId = `t${Date.now()}`;
      addTable({ ...editingTable, id: newId });
    } else {
      updateTable(editingTable.id, editingTable);
    }
    setEditingTable(null);
  };

  const handleSaveStaff = () => {
    if (!editingStaff) return;
    if (editingStaff.id.startsWith("new-")) {
      const newId = `staff-${Date.now()}`;
      addStaffMember({ ...editingStaff, id: newId });
    } else {
      updateStaffMember(editingStaff.id, editingStaff);
    }
    setEditingStaff(null);
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4 border-b border-border p-4 lg:p-6 lg:flex-row lg:items-center lg:justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 h-8 w-8 sm:h-9 sm:w-9 -ml-1">
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <div className="pt-1 sm:pt-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground lg:text-2xl leading-none">Data Manager</h1>
            <p className="text-[11px] sm:text-sm text-muted-foreground mt-1">View, edit, and manage all stored data</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-row items-center gap-2 mt-1 sm:mt-0 lg:w-auto">
          <Button variant="outline" onClick={handleExport} className="justify-center h-8 sm:h-9 px-3 text-[11px] sm:text-sm font-medium bg-background shadow-sm">
            <Download className="mr-1.5 h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
            Download
          </Button>
          <Button variant="outline" onClick={() => setShowImportDialog(true)} className="justify-center h-8 sm:h-9 px-3 text-[11px] sm:text-sm font-medium bg-background shadow-sm">
            <Upload className="mr-1.5 h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
            Upload
          </Button>
          <Button variant="destructive" onClick={() => setShowClearConfirm(true)} className="col-span-2 sm:col-span-1 justify-center h-8 sm:h-9 px-3 text-[11px] sm:text-sm font-medium shadow-sm">
            <RefreshCw className="mr-1.5 h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
            Reset
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-3 p-4 shrink-0 lg:gap-4 lg:p-6 xl:grid-cols-4">
          <Card className="bg-card shadow-[0_1px_3px_0_rgb(0,0,0,0.05)] border-border/60">
            <CardContent className="p-4 md:p-5 flex flex-col gap-3 lg:gap-2">
              <div className="flex flex-row items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground text-left">Total Orders</p>
                <div className="flex h-8 w-8 lg:h-9 lg:w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <ShoppingBag className="h-4 w-4 lg:h-4 lg:w-4 text-primary stroke-[2px]" />
                </div>
              </div>
              <div className="flex items-start">
                <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground text-left">{totalOrders}</h3>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card shadow-[0_1px_3px_0_rgb(0,0,0,0.05)] border-border/60">
            <CardContent className="p-4 md:p-5 flex flex-col gap-3 lg:gap-2">
              <div className="flex flex-row items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground text-left">Completed</p>
                <div className="flex h-8 w-8 lg:h-9 lg:w-9 shrink-0 items-center justify-center rounded-lg bg-success/10">
                  <Package className="h-4 w-4 lg:h-4 lg:w-4 text-success stroke-[2px]" />
                </div>
              </div>
              <div className="flex items-start">
                <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground text-left">{completedOrders}</h3>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card shadow-[0_1px_3px_0_rgb(0,0,0,0.05)] border-border/60">
            <CardContent className="p-4 md:p-5 flex flex-col gap-3 lg:gap-2">
              <div className="flex flex-row items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground text-left">Menu Items</p>
                <div className="flex h-8 w-8 lg:h-9 lg:w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                  <Coffee className="h-4 w-4 lg:h-4 lg:w-4 text-blue-500 stroke-[2px]" />
                </div>
              </div>
              <div className="flex items-start">
                <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground text-left">{menuItems.length}</h3>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card shadow-[0_1px_3px_0_rgb(0,0,0,0.05)] border-border/60">
            <CardContent className="p-4 md:p-5 flex flex-col gap-3 lg:gap-2">
              <div className="flex flex-row items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground text-left">Total Revenue</p>
                <div className="flex h-8 w-8 lg:h-9 lg:w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
                  <Grid3X3 className="h-4 w-4 lg:h-4 lg:w-4 text-orange-500 stroke-[2px]" />
                </div>
              </div>
              <div className="flex items-start">
                <h3 className="text-xl md:text-2xl xl:text-3xl font-bold tracking-tight text-foreground text-left truncate">
                  {totalRevenue.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}
                </h3>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex-1 flex flex-col p-4 pt-0 lg:p-6 lg:pt-0 pb-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col h-full min-h-[400px]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0 mb-4">
              <TabsList className="grid w-full grid-cols-4 sm:flex sm:w-auto h-12 sm:h-11 p-1 bg-muted/60 rounded-lg">
                <TabsTrigger value="orders" className="flex items-center justify-center gap-1.5 h-full rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <ShoppingBag className="h-4 w-4 sm:h-4 sm:w-4 shrink-0 transition-all" />
                  <span className="hidden sm:inline text-sm font-medium">Orders</span>
                </TabsTrigger>
                <TabsTrigger value="menu" className="flex items-center justify-center gap-1.5 h-full rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Coffee className="h-4 w-4 sm:h-4 sm:w-4 shrink-0 transition-all" />
                  <span className="hidden sm:inline text-sm font-medium">Menu</span>
                </TabsTrigger>
                <TabsTrigger value="tables" className="flex items-center justify-center gap-1.5 h-full rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Grid3X3 className="h-4 w-4 sm:h-4 sm:w-4 shrink-0 transition-all" />
                  <span className="hidden sm:inline text-sm font-medium">Tables</span>
                </TabsTrigger>
                <TabsTrigger value="staff" className="flex items-center justify-center gap-1.5 h-full rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Users className="h-4 w-4 sm:h-4 sm:w-4 shrink-0 transition-all" />
                  <span className="hidden sm:inline text-sm font-medium">Staff</span>
                </TabsTrigger>
              </TabsList>
              <div className="relative w-full sm:w-64 shrink-0">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-11 sm:h-11 bg-secondary/50 border-border/50 focus-visible:ring-1 text-sm shadow-sm rounded-lg"
                />
              </div>
            </div>

          {/* Orders Tab */}
          <TabsContent value="orders" className="mt-3 flex-1 overflow-hidden">
            <Card className="h-full bg-card border-border">
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Orders ({filteredOrders.length})</CardTitle>
              </CardHeader>
              <CardContent className="h-[calc(100%-60px)] overflow-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Order ID</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Customer</TableHead>
                      <TableHead className="text-xs">Items</TableHead>
                      <TableHead className="text-xs">Total</TableHead>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="text-xs font-medium">{order.id.toUpperCase()}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="text-[11px] sm:text-xs">{order.type}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge
                            variant={order.status === "completed" ? "default" : "secondary"}
                            className="text-[11px] sm:text-xs"
                          >
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{order.customerName || "-"}</TableCell>
                        <TableCell className="text-xs">{order.items.length}</TableCell>
                        <TableCell className="text-xs font-medium">
                          {order.total.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                        </TableCell>
                        <TableCell className="text-xs" suppressHydrationWarning>
                          {format(order.createdAt, "MMM d, HH:mm")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingOrder(order)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setShowDeleteConfirm({ type: "order", id: order.id, name: order.id.toUpperCase() })}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredOrders.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                          No orders found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Menu Tab */}
          <TabsContent value="menu" className="mt-3 flex-1 overflow-hidden">
            <Card className="h-full bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-sm">Menu Items ({filteredMenuItems.length})</CardTitle>
                <Button
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => setEditingMenuItem({ id: "new-" + Date.now(), name: "", price: 0, category: "coffee", available: true })}
                >
                  <Plus className="h-3 w-3" />
                  Add Item
                </Button>
              </CardHeader>
              <CardContent className="h-[calc(100%-60px)] overflow-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">Category</TableHead>
                      <TableHead className="text-xs">Price</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMenuItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-xs font-medium">{item.name}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="text-[11px] sm:text-xs capitalize">{item.category}</Badge>
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          {item.price.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant={item.available ? "default" : "secondary"} className="text-[11px] sm:text-xs">
                            {item.available ? "Available" : "Unavailable"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingMenuItem(item)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setShowDeleteConfirm({ type: "menuItem", id: item.id, name: item.name })}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tables Tab */}
          <TabsContent value="tables" className="mt-3 flex-1 overflow-hidden">
            <Card className="h-full bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-sm">Tables ({filteredTables.length})</CardTitle>
                <Button
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => setEditingTable({ id: "new-" + Date.now(), number: tables.length + 1, capacity: 4, status: "available" })}
                >
                  <Plus className="h-3 w-3" />
                  Add Table
                </Button>
              </CardHeader>
              <CardContent className="h-[calc(100%-60px)] overflow-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Table No.</TableHead>
                      <TableHead className="text-xs">Capacity</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Current Order</TableHead>
                      <TableHead className="text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTables.map((table) => (
                      <TableRow key={table.id}>
                        <TableCell className="text-xs font-medium">Table {table.number}</TableCell>
                        <TableCell className="text-xs">{table.capacity} seats</TableCell>
                        <TableCell className="text-xs">
                          <Badge
                            variant="outline"
                            className={`text-[11px] sm:text-xs ${
                              table.status === "available"
                                ? "border-success text-success"
                                : table.status === "occupied"
                                ? "border-warning text-warning"
                                : "border-destructive text-destructive"
                            }`}
                          >
                            {table.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{table.orderId || "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingTable(table)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setShowDeleteConfirm({ type: "table", id: table.id, name: `Table ${table.number}` })}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Staff Tab */}
          <TabsContent value="staff" className="mt-3 flex-1 overflow-hidden">
            <Card className="h-full bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-sm">Staff Members ({filteredStaff.length})</CardTitle>
                <Button
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => setEditingStaff({ id: "new-" + Date.now(), name: "", role: "Cashier", pin: "1111", initials: "" })}
                >
                  <Plus className="h-3 w-3" />
                  Add Staff
                </Button>
              </CardHeader>
              <CardContent className="h-[calc(100%-60px)] overflow-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">Role</TableHead>
                      <TableHead className="text-xs">PIN</TableHead>
                      <TableHead className="text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStaff.map((staff) => (
                      <TableRow key={staff.id}>
                        <TableCell className="text-xs font-medium">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[11px] sm:text-xs font-semibold text-primary">
                              {staff.initials}
                            </div>
                            {staff.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="text-[11px] sm:text-xs">{staff.role}</Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono">****</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingStaff(staff)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setShowDeleteConfirm({ type: "staff", id: staff.id, name: staff.name })}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            {/* Staff Tab Content remains same internally but requires parent div to be closed later */}
          </TabsContent>
        </Tabs>
      </div>
    </div>

      {/* Edit Order Dialog */}
      <Dialog open={!!editingOrder} onOpenChange={() => setEditingOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Order {editingOrder?.id.toUpperCase()}</DialogTitle>
          </DialogHeader>
          {editingOrder && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editingOrder.status}
                  onValueChange={(value) => setEditingOrder({ ...editingOrder, status: value as Order["status"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="preparing">Preparing</SelectItem>
                    <SelectItem value="ready">Ready</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Customer Name</Label>
                <Input
                  value={editingOrder.customerName || ""}
                  onChange={(e) => setEditingOrder({ ...editingOrder, customerName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Items</Label>
                <div className="space-y-1 rounded-lg bg-secondary/50 p-3">
                  {editingOrder.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>{item.quantity}x {item.name}</span>
                      <span className="text-muted-foreground">
                        {(item.price * item.quantity).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                      </span>
                    </div>
                  ))}
                  <div className="mt-2 border-t border-border pt-2 flex justify-between font-semibold">
                    <span>Total</span>
                    <span>{editingOrder.total.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOrder(null)}>Cancel</Button>
            <Button onClick={handleSaveOrder}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Menu Item Dialog */}
      <Dialog open={!!editingMenuItem} onOpenChange={() => setEditingMenuItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMenuItem?.id.startsWith("new-") ? "Add Menu Item" : "Edit Menu Item"}</DialogTitle>
          </DialogHeader>
          {editingMenuItem && (
            <div className="space-y-4">
              {/* Image preview and upload */}
              <div className="space-y-2">
                <Label>Image</Label>
                <div className="flex items-center gap-3">
                  <div className="relative h-16 w-16 rounded-lg bg-secondary/50 border border-border overflow-hidden flex items-center justify-center shrink-0">
                    {(imagePreview || editingMenuItem.image_url) ? (
                      <img
                        src={imagePreview || editingMenuItem.image_url}
                        alt={editingMenuItem.name || "Menu item"}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          // Fallback to local path if Supabase URL fails
                          const target = e.target as HTMLImageElement;
                          if (editingMenuItem.image_url && !editingMenuItem.image_url.startsWith('/menu/')) {
                            target.src = '/menu/_fallback.png';
                          }
                        }}
                      />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setImageFile(file);
                          setImagePreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-3 w-3" />
                      {imageFile ? "Change" : "Upload"}
                    </Button>
                    {(imageFile || editingMenuItem.image_url) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1 text-xs text-muted-foreground hover:text-destructive px-1"
                        onClick={() => {
                          setImageFile(null);
                          setImagePreview(null);
                          setEditingMenuItem({ ...editingMenuItem, image_url: undefined });
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                      >
                        <X className="h-3 w-3" />
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={editingMenuItem.name}
                  onChange={(e) => setEditingMenuItem({ ...editingMenuItem, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Price (INR)</Label>
                <Input
                  type="number"
                  value={editingMenuItem.price}
                  onChange={(e) => setEditingMenuItem({ ...editingMenuItem, price: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={editingMenuItem.category}
                  onValueChange={(value) => setEditingMenuItem({ ...editingMenuItem, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tea">Tea</SelectItem>
                    <SelectItem value="coffee">Coffee</SelectItem>
                    <SelectItem value="drinks">Drinks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Availability</Label>
                <Select
                  value={editingMenuItem.available ? "true" : "false"}
                  onValueChange={(value) => setEditingMenuItem({ ...editingMenuItem, available: value === "true" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Available</SelectItem>
                    <SelectItem value="false">Unavailable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingMenuItem(null); setImageFile(null); setImagePreview(null); }}>Cancel</Button>
            <Button onClick={handleSaveMenuItem} disabled={isUploading}>
              {isUploading ? (
                <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Uploading...</>
              ) : (
                editingMenuItem?.id.startsWith("new-") ? "Add Item" : "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Table Dialog */}
      <Dialog open={!!editingTable} onOpenChange={() => setEditingTable(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTable?.id.startsWith("new-") ? "Add Table" : "Edit Table"}</DialogTitle>
          </DialogHeader>
          {editingTable && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Table Number</Label>
                <Input
                  type="number"
                  value={editingTable.number}
                  onChange={(e) => setEditingTable({ ...editingTable, number: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Capacity (seats)</Label>
                <Input
                  type="number"
                  value={editingTable.capacity}
                  onChange={(e) => setEditingTable({ ...editingTable, capacity: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editingTable.status}
                  onValueChange={(value) => setEditingTable({ ...editingTable, status: value as TableType["status"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="occupied">Occupied</SelectItem>
                    <SelectItem value="waiting-payment">Waiting Payment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTable(null)}>Cancel</Button>
            <Button onClick={handleSaveTable}>
              {editingTable?.id.startsWith("new-") ? "Add Table" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Staff Dialog */}
      <Dialog open={!!editingStaff} onOpenChange={() => setEditingStaff(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStaff?.id.startsWith("new-") ? "Add Staff Member" : "Edit Staff Member"}</DialogTitle>
          </DialogHeader>
          {editingStaff && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={editingStaff.name}
                  onChange={(e) => setEditingStaff({ ...editingStaff, name: e.target.value, initials: e.target.value.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() })}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={editingStaff.role}
                  onValueChange={(value) => setEditingStaff({ ...editingStaff, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Cashier">Cashier</SelectItem>
                    <SelectItem value="Server">Server</SelectItem>
                    <SelectItem value="Kitchen">Kitchen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>PIN (4 digits)</Label>
                <Input
                  type="password"
                  maxLength={4}
                  value={editingStaff.pin}
                  onChange={(e) => setEditingStaff({ ...editingStaff, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingStaff(null)}>Cancel</Button>
            <Button onClick={handleSaveStaff}>
              {editingStaff?.id.startsWith("new-") ? "Add Staff" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <AlertDialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import Data (Overwrite)</AlertDialogTitle>
            <AlertDialogDescription>
              Paste your exported JSON data below to restore your backup. WARNING: This will overwrite and replace all current data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>JSON Data</Label>
            <textarea
              className="w-full h-48 rounded-lg bg-secondary border-none p-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='{"orders": [], "tables": [], ...}'
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowImportDialog(false);
              setImportText("");
            }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleImport} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Import & Overwrite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {showDeleteConfirm?.type === "menuItem" ? "menu item" : showDeleteConfirm?.type}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the {showDeleteConfirm?.type === "menuItem" ? "menu item" : showDeleteConfirm?.type}
              {showDeleteConfirm?.name ? ` "${showDeleteConfirm.name}"` : ""}
              {showDeleteConfirm?.type === "order" ? " and all associated data" : ""}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel/Void Order Confirmation */}
      <AlertDialog open={showCancelOrderConfirm} onOpenChange={setShowCancelOrderConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to void order {editingOrder?.id.toUpperCase()}. This will mark the order as cancelled and cannot be easily undone. This action will be logged in the audit trail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowCancelOrderConfirm(false)}>Go Back</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCancelOrder} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, Cancel Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Data Confirmation */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset All Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently wipe ALL data across all devices — orders, audit logs, shifts, and more. Tables will reset to default, and default menu items and staff will be restored. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearAllData();
                setShowClearConfirm(false);
                toast.success("All data has been wiped.");
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reset Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
