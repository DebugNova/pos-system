"use client";

import { useState } from "react";
import { usePOSStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Users, Clock, CreditCard, Plus, MoreVertical, ArrowRight, Merge, Split, Eye, Pencil } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { SplitBillDialog } from "./split-bill-dialog";

const statusColors: Record<string, string> = {
  available: "bg-success/20 border-success/50 text-success",
  occupied: "bg-warning/20 border-warning/50 text-warning",
  "waiting-payment": "bg-destructive/20 border-destructive/50 text-destructive",
};

const statusLabels: Record<string, string> = {
  available: "Available",
  occupied: "Occupied",
  "waiting-payment": "Awaiting Payment",
};

export function TableManagement() {
  const { tables, orders, setActiveView, setSelectedTable, setOrderType, moveTable, mergeTable, startEditOrder, setPendingBillingOrderId } =
    usePOSStore();
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showSplitDialog, setShowSplitDialog] = useState(false);

  const handleTableClick = (tableId: string, status: string) => {
    if (status === "available") {
      setOrderType("dine-in");
      setSelectedTable(tableId);
      setActiveView("orders");
    } else if (status === "waiting-payment") {
      const order = orders.find(o => o.tableId === tableId && o.status === "awaiting-payment");
      if (order) {
        setPendingBillingOrderId(order.id);
        setActiveView("billing");
      } else {
        toast.error("Order not found or already paid.");
      }
    }
  };

  const getTableOrder = (orderId?: string) => {
    if (!orderId) return null;
    return orders.find((o) => o.id === orderId);
  };

  const handleViewOrder = (tableId: string, orderId: string) => {
    setSelectedTableId(tableId);
    setSelectedOrderId(orderId);
    setShowOrderDialog(true);
  };

  const handleMoveTable = (tableId: string, orderId: string) => {
    setSelectedTableId(tableId);
    setSelectedOrderId(orderId);
    setShowMoveDialog(true);
  };

  const handleMergeTable = (tableId: string) => {
    setSelectedTableId(tableId);
    setShowMergeDialog(true);
  };

  const handleConfirmMove = (newTableId: string) => {
    if (selectedOrderId) {
      moveTable(selectedOrderId, newTableId);
      setShowMoveDialog(false);
      setSelectedTableId(null);
      setSelectedOrderId(null);
    }
  };

  const handleConfirmMerge = (targetTableId: string) => {
    if (selectedTableId) {
      mergeTable(selectedTableId, targetTableId);
      setShowMergeDialog(false);
      setSelectedTableId(null);
    }
  };

  const handleProcessPayment = (tableId: string) => {
    const table = tables.find((t) => t.id === tableId);
    if (table?.orderId) {
      setPendingBillingOrderId(table.orderId);
      setActiveView("billing");
    }
  };

  const availableTablesForMove = tables.filter(
    (t) => t.status === "available" && t.id !== selectedTableId
  );
  const occupiedTablesForMerge = tables.filter(
    (t) => t.status === "occupied" && t.id !== selectedTableId
  );

  const selectedOrder = selectedOrderId ? orders.find((o) => o.id === selectedOrderId) : null;

  return (
    <div className="flex h-full flex-col p-3 sm:p-4 lg:p-6">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:mb-6">
        <div>
          <h1 className="text-lg font-bold text-foreground lg:text-2xl">Table Management</h1>
          <p className="text-xs text-muted-foreground lg:text-sm">
            Tap a table to view or start an order
          </p>
        </div>
        <div className="flex flex-wrap gap-3 lg:gap-4">
          <div className="flex items-center gap-1.5 lg:gap-2">
            <div className="h-3 w-3 rounded-full bg-success lg:h-3 lg:w-3" />
            <span className="text-xs text-muted-foreground lg:text-sm">Available</span>
          </div>
          <div className="flex items-center gap-1.5 lg:gap-2">
            <div className="h-3 w-3 rounded-full bg-warning lg:h-3 lg:w-3" />
            <span className="text-xs text-muted-foreground lg:text-sm">Occupied</span>
          </div>
          <div className="flex items-center gap-1.5 lg:gap-2">
            <div className="h-3 w-3 rounded-full bg-destructive lg:h-3 lg:w-3" />
            <span className="text-xs text-muted-foreground lg:text-sm">Awaiting Payment</span>
          </div>
        </div>
      </div>

      {/* Table Grid */}
      <div className="grid flex-1 grid-cols-2 gap-3 sm:gap-4 lg:gap-6 overflow-y-auto sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
        {tables.map((table) => {
          const order = getTableOrder(table.orderId);
          return (
            <Card
              key={table.id}
              className={cn(
                "cursor-pointer border-2 transition-all hover:scale-[1.02] active:scale-[0.98] flex flex-col",
                statusColors[table.status]
              )}
              onClick={() => handleTableClick(table.id, table.status)}
            >
              <CardHeader className="p-3 pb-2 sm:p-6 sm:pb-2">
                <div className="flex flex-row flex-nowrap items-center justify-between w-full">
                  <CardTitle className="text-base sm:text-xl text-foreground whitespace-nowrap overflow-hidden text-ellipsis mr-1 sm:mr-2 shrink">
                    Table {table.number}
                  </CardTitle>
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    <Badge
                      variant="outline"
                      className={cn(
                        "border-current whitespace-nowrap text-[10px] sm:text-xs px-1.5 py-0 sm:px-2.5 sm:py-0.5 flex items-center justify-center h-5 sm:h-auto leading-none",
                        table.status === "available" && "text-success",
                        table.status === "occupied" && "text-warning",
                        table.status === "waiting-payment" && "text-destructive"
                      )}
                    >
                      {statusLabels[table.status]}
                    </Badge>
                    {table.status !== "available" && order && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-8 sm:w-8 -mr-2 sm:mr-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleViewOrder(table.id, order.id);
                          }}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Order
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            startEditOrder(order.id);
                          }}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit Order
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleMoveTable(table.id, order.id);
                          }}>
                            <ArrowRight className="mr-2 h-4 w-4" />
                            Move to Table
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleMergeTable(table.id);
                          }}>
                            <Merge className="mr-2 h-4 w-4" />
                            Merge Tables
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrderId(order.id);
                            setShowSplitDialog(true);
                          }}>
                            <Split className="mr-2 h-4 w-4" />
                            Split Bill
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0 flex flex-col flex-1">
                <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground mb-auto">
                  <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="leading-none flex items-center translate-y-[1px]">{table.capacity} seats</span>
                </div>

                {order && (
                  <div className="mt-3 space-y-2 rounded-lg bg-background/50 p-2.5 sm:p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground truncate max-w-[80px] sm:max-w-none">
                        {order.id.toUpperCase()}
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {order.total.toLocaleString("en-IN", {
                          style: "currency",
                          currency: "INR",
                          minimumFractionDigits: 0,
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground" suppressHydrationWarning>
                      <Clock className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">
                        {formatDistanceToNow(order.createdAt, { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                      {order.items.length} items &bull; {order.status}
                    </p>

                    {table.status === "waiting-payment" && (
                      <Button
                        size="sm"
                        className="mt-2 w-full gap-1.5 h-8 sm:h-9 text-xs sm:text-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProcessPayment(table.id);
                        }}
                      >
                        <CreditCard className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                        <span className="truncate">Process Payment</span>
                      </Button>
                    )}
                  </div>
                )}

                {table.status === "available" && (
                  <div className="w-full mt-3 flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-1.5 h-9 sm:h-10 border-success/50 text-success hover:bg-success/10 active:bg-success/20 flex items-center justify-center font-medium"
                    >
                      <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                      New Order
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent className="max-h-[85vh] overflow-y-auto w-[95vw] max-w-lg sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move to Table</DialogTitle>
            <DialogDescription>
              Select a table to move this order to
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4">
            {availableTablesForMove.map((table) => (
              <Button
                key={table.id}
                variant="outline"
                className="h-16 flex-col gap-1"
                onClick={() => handleConfirmMove(table.id)}
              >
                <span className="text-lg font-semibold">T{table.number}</span>
                <span className="text-xs text-muted-foreground">{table.capacity} seats</span>
              </Button>
            ))}
            {availableTablesForMove.length === 0 && (
              <p className="col-span-3 text-center text-muted-foreground">
                No available tables
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent className="max-h-[85vh] overflow-y-auto w-[95vw] max-w-lg sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Merge Tables</DialogTitle>
            <DialogDescription>
              Select a table to merge this order with
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4">
            {occupiedTablesForMerge.map((table) => {
              const order = getTableOrder(table.orderId);
              return (
                <Button
                  key={table.id}
                  variant="outline"
                  className="h-20 flex-col gap-1"
                  onClick={() => handleConfirmMerge(table.id)}
                >
                  <span className="text-lg font-semibold">T{table.number}</span>
                  {order && (
                    <span className="text-xs text-muted-foreground">
                      {order.items.length} items
                    </span>
                  )}
                </Button>
              );
            })}
            {occupiedTablesForMerge.length === 0 && (
              <p className="col-span-3 text-center text-muted-foreground">
                No occupied tables to merge with
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
        <DialogContent className="max-h-[85vh] overflow-y-auto w-[95vw] max-w-lg sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedOrder?.id.toUpperCase()}</DialogTitle>
            <DialogDescription>
              Order details for Table {selectedTableId?.replace("t", "")}
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 pt-4">
              <div className="flex gap-2">
                <Badge variant="outline">{selectedOrder.status}</Badge>
                <Badge variant="secondary">{selectedOrder.type}</Badge>
              </div>
              <div className="rounded-lg bg-secondary/50 p-3">
                <ul className="space-y-2">
                  {selectedOrder.items.map((item) => (
                    <li key={item.id} className="flex justify-between text-sm">
                      <span className="text-foreground">
                        {item.quantity}x {item.name}
                        {item.notes && (
                          <span className="block text-xs text-muted-foreground italic">
                            {item.notes}
                          </span>
                        )}
                      </span>
                      <span className="text-muted-foreground">
                        {(item.price * item.quantity).toLocaleString("en-IN", {
                          style: "currency",
                          currency: "INR",
                          minimumFractionDigits: 0,
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex justify-between border-t border-border pt-2">
                  <span className="font-medium text-foreground">Total</span>
                  <span className="font-bold text-primary">
                    {selectedOrder.total.toLocaleString("en-IN", {
                      style: "currency",
                      currency: "INR",
                      minimumFractionDigits: 0,
                    })}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowOrderDialog(false);
                    startEditOrder(selectedOrder.id);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Order
                </Button>
                <Button className="flex-1" onClick={() => {
                  setShowOrderDialog(false);
                  setActiveView("billing");
                }}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Payment
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Split Bill Dialog */}
      <SplitBillDialog
        order={selectedOrderId ? orders.find((o) => o.id === selectedOrderId) || null : null}
        open={showSplitDialog}
        onOpenChange={setShowSplitDialog}
      />
    </div>
  );
}
