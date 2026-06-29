"use client";

import { useState } from "react";
import { usePOSStore } from "@/lib/store";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import type { Order } from "@/lib/data";

interface OrdersViewProps {
  searchQuery: string;
}

export function OrdersView({ searchQuery }: OrdersViewProps) {
  const { orders, updateOrder, deleteOrder } = usePOSStore();
  
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [showCancelOrderConfirm, setShowCancelOrderConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ id: string; name?: string } | null>(null);

  const filteredOrders = orders.filter((o) =>
    o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.customerPhone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = () => {
    if (showDeleteConfirm) {
      deleteOrder(showDeleteConfirm.id);
      setShowDeleteConfirm(null);
      toast.success("Order deleted");
    }
  };

  const handleSaveOrder = () => {
    if (!editingOrder) return;
    const originalOrder = orders.find((o) => o.id === editingOrder.id);
    if (editingOrder.status === "cancelled" && originalOrder?.status !== "cancelled") {
      setShowCancelOrderConfirm(true);
      return;
    }
    updateOrder(editingOrder.id, {
      status: editingOrder.status,
      customerName: editingOrder.customerName,
      customerPhone: editingOrder.customerPhone,
    });
    setEditingOrder(null);
    toast.success("Order updated");
  };

  const handleConfirmCancelOrder = () => {
    if (!editingOrder) return;
    updateOrder(editingOrder.id, {
      status: editingOrder.status,
      customerName: editingOrder.customerName,
      customerPhone: editingOrder.customerPhone,
    });
    setShowCancelOrderConfirm(false);
    setEditingOrder(null);
    toast.success(`Order ${editingOrder.id.toUpperCase()} has been cancelled.`);
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <Card className="bg-gradient-to-br from-indigo-50/50 to-card dark:from-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/50 shadow-sm rounded-[24px] flex-1 flex flex-col overflow-hidden relative">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        <CardHeader className="py-4 border-b border-indigo-100/50 dark:border-indigo-900/50 shrink-0 bg-white/60 dark:bg-black/40 backdrop-blur-md relative z-10">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-indigo-950 dark:text-indigo-50">
            <span className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-600">📦</span>
            Orders Directory ({filteredOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-y-auto flex-1 relative z-10">
          <Table>
            <TableHeader className="sticky top-0 bg-white/80 dark:bg-black/60 backdrop-blur-xl z-10 border-b border-white/40 dark:border-white/10">
              <TableRow className="hover:bg-transparent border-0">
                <TableHead className="text-xs">Customer</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs max-w-[200px]">Item Details</TableHead>
                <TableHead className="text-xs">Total</TableHead>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => (
                <TableRow key={order.id} className="hover:bg-indigo-50/50 dark:hover:bg-white/5 transition-colors border-b border-indigo-100/30 dark:border-white/5">
                  <TableCell className="text-xs">
                    <div className="font-bold">{order.customerName || "Guest"}</div>
                    <div className="text-[10px] text-muted-foreground font-mono group relative inline-block cursor-help mt-0.5" title={order.id}>
                      {order.id.slice(0, 8)}...
                      {/* CSS Tooltip on Hover */}
                      <div className="absolute hidden group-hover:block bottom-full left-0 mb-1 px-2 py-1 bg-black text-white text-[10px] rounded whitespace-nowrap z-50">
                        {order.id}
                      </div>
                    </div>
                    {order.customerPhone && <div className="text-[10px] text-muted-foreground mt-0.5">📞 {order.customerPhone}</div>}
                  </TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="outline" className="text-[11px] sm:text-xs bg-white/5">{order.type}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    <Badge variant={order.status === "completed" ? "default" : "secondary"} className="text-[11px] sm:text-xs">
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="max-w-[250px] truncate text-muted-foreground" title={order.items.map(it => `${it.quantity}x ${it.name}${it.variant ? ` (${it.variant})` : ""}`).join(", ")}>
                      {order.items.map(it => `${it.quantity}x ${it.name}${it.variant ? ` (${it.variant})` : ""}`).join(", ") || "-"}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    {order.total.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground" suppressHydrationWarning>
                    {format(order.createdAt, "MMM d, HH:mm")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/10" onClick={() => setEditingOrder(order)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setShowDeleteConfirm({ id: order.id, name: order.customerName || order.id.toUpperCase() })}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredOrders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                    No orders found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Order Dialog */}
      <Dialog open={!!editingOrder} onOpenChange={(open) => !open && setEditingOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Order {editingOrder?.id.toUpperCase().slice(0, 8)}...</DialogTitle>
          </DialogHeader>
          {editingOrder && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editingOrder.status} onValueChange={(value) => setEditingOrder({ ...editingOrder, status: value as Order["status"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Input value={editingOrder.customerName || ""} onChange={(e) => setEditingOrder({ ...editingOrder, customerName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Customer Phone</Label>
                <Input type="tel" value={editingOrder.customerPhone || ""} onChange={(e) => {
                  const value = e.target.value;
                  if (/^\d*$/.test(value)) setEditingOrder({ ...editingOrder, customerPhone: value });
                }} />
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

      <Dialog open={showCancelOrderConfirm} onOpenChange={setShowCancelOrderConfirm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancel Order?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to cancel this order? This action may affect inventory and reporting.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelOrderConfirm(false)}>No, Keep Order</Button>
            <Button variant="destructive" onClick={handleConfirmCancelOrder}>Yes, Cancel Order</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showDeleteConfirm} onOpenChange={(open) => !open && setShowDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Order</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to permanently delete this order? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete Permanently</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
