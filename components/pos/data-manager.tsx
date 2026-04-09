"use client";

import { useState } from "react";
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
} from "lucide-react";
import { format } from "date-fns";
import type { Order, MenuItem, Table as TableType } from "@/lib/data";

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: string; id: string } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [importText, setImportText] = useState("");
  const [showImportDialog, setShowImportDialog] = useState(false);

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
    updateOrder(editingOrder.id, {
      status: editingOrder.status,
      customerName: editingOrder.customerName,
    });
    setEditingOrder(null);
  };

  const handleSaveMenuItem = () => {
    if (!editingMenuItem) return;
    if (editingMenuItem.id.startsWith("new-")) {
      const newId = `${editingMenuItem.category}-${Date.now()}`;
      addMenuItem({ ...editingMenuItem, id: newId });
    } else {
      updateMenuItem(editingMenuItem.id, editingMenuItem);
    }
    setEditingMenuItem(null);
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
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between lg:p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground lg:text-xl">Data Manager</h1>
            <p className="text-xs text-muted-foreground">View, edit, and manage all stored data</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)} className="gap-1.5">
            <Upload className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Import</span>
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setShowClearConfirm(true)} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 lg:gap-3 lg:p-4">
        <Card className="bg-card border-border">
          <CardContent className="p-3 lg:p-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-primary" />
              <div>
                <p className="text-lg font-bold text-foreground">{totalOrders}</p>
                <p className="text-xs text-muted-foreground">Total Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-3 lg:p-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-success" />
              <div>
                <p className="text-lg font-bold text-foreground">{completedOrders}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-3 lg:p-4">
            <div className="flex items-center gap-2">
              <Coffee className="h-4 w-4 text-primary" />
              <div>
                <p className="text-lg font-bold text-foreground">{menuItems.length}</p>
                <p className="text-xs text-muted-foreground">Menu Items</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-3 lg:p-4">
            <div className="flex items-center gap-2">
              <Grid3X3 className="h-4 w-4 text-primary" />
              <div>
                <p className="text-lg font-bold text-foreground">
                  {totalRevenue.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-hidden p-3 lg:p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="grid w-full grid-cols-4 sm:w-auto">
              <TabsTrigger value="orders" className="gap-1 text-xs lg:text-sm">
                <ShoppingBag className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Orders</span>
              </TabsTrigger>
              <TabsTrigger value="menu" className="gap-1 text-xs lg:text-sm">
                <Coffee className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Menu</span>
              </TabsTrigger>
              <TabsTrigger value="tables" className="gap-1 text-xs lg:text-sm">
                <Grid3X3 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Tables</span>
              </TabsTrigger>
              <TabsTrigger value="staff" className="gap-1 text-xs lg:text-sm">
                <Users className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Staff</span>
              </TabsTrigger>
            </TabsList>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-secondary border-none"
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
                          <Badge variant="outline" className="text-[10px]">{order.type}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge
                            variant={order.status === "completed" ? "default" : "secondary"}
                            className="text-[10px]"
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
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setShowDeleteConfirm({ type: "order", id: order.id })}>
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
                          <Badge variant="outline" className="text-[10px] capitalize">{item.category}</Badge>
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          {item.price.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant={item.available ? "default" : "secondary"} className="text-[10px]">
                            {item.available ? "Available" : "Unavailable"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingMenuItem(item)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setShowDeleteConfirm({ type: "menuItem", id: item.id })}>
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
                            className={`text-[10px] ${
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
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setShowDeleteConfirm({ type: "table", id: table.id })}>
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
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                              {staff.initials}
                            </div>
                            {staff.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="text-[10px]">{staff.role}</Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono">****</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingStaff(staff)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setShowDeleteConfirm({ type: "staff", id: staff.id })}>
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
        </Tabs>
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
            <Button variant="outline" onClick={() => setEditingMenuItem(null)}>Cancel</Button>
            <Button onClick={handleSaveMenuItem}>
              {editingMenuItem?.id.startsWith("new-") ? "Add Item" : "Save Changes"}
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
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the {showDeleteConfirm?.type}.
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

      {/* Clear All Data Confirmation */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset All Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete ALL orders, reset tables to default, and restore default menu items and staff. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearAllData();
                setShowClearConfirm(false);
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
