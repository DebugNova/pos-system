"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { usePOSStore } from "@/lib/store";
import { Order, OrderItem } from "@/lib/data";

interface SplitBillDialogProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SplitBillDialog({ order, open, onOpenChange }: SplitBillDialogProps) {
  const { splitOrder } = usePOSStore();
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  if (!order) return null;

  const handleToggleItem = (itemId: string) => {
    setSelectedItems((prev) => 
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const calculateTotal = (items: OrderItem[]) => items.reduce((sum, item) => {
    const modTotal = item.modifiers?.reduce((mSum, mod) => mSum + mod.price, 0) || 0;
    return sum + (item.price + modTotal) * item.quantity;
  }, 0);

  const splitItems = order.items.filter((item) => selectedItems.includes(item.id));
  const remainingItems = order.items.filter((item) => !selectedItems.includes(item.id));

  const splitTotal = calculateTotal(splitItems);
  const remainingTotal = calculateTotal(remainingItems);

  const handleConfirm = () => {
    if (selectedItems.length > 0 && selectedItems.length < order.items.length) {
      splitOrder(order.id, selectedItems);
      setSelectedItems([]);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) setSelectedItems([]);
      onOpenChange(open);
    }}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Split Bill - Order {order.id.toUpperCase()}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Select items to move to a separate bill. The new bill will be marked as Takeaway.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6 py-4">
          <div className="space-y-4">
            <h3 className="font-semibold text-lg text-foreground">Bill A (Original)</h3>
            <div className="rounded-md border border-border p-4 space-y-3 h-[200px] sm:h-[300px] overflow-y-auto">
              {remainingItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={false}
                      onCheckedChange={() => handleToggleItem(item.id)}
                      id={`item-${item.id}`}
                    />
                    <label htmlFor={`item-${item.id}`} className="text-sm font-medium leading-none cursor-pointer text-foreground">
                      {item.quantity}x {item.name}
                    </label>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {((item.price + (item.modifiers?.reduce((s, m) => s + m.price, 0) || 0)) * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-bold text-foreground">
              <span>Total:</span>
              <span>₹{remainingTotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-lg text-primary">Bill B (New Bill)</h3>
            <div className="rounded-md border border-primary/20 bg-primary/5 p-4 space-y-3 h-[200px] sm:h-[300px] overflow-y-auto">
              {splitItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={true}
                      onCheckedChange={() => handleToggleItem(item.id)}
                      id={`item-move-${item.id}`}
                    />
                    <label htmlFor={`item-move-${item.id}`} className="text-sm font-medium leading-none cursor-pointer text-foreground">
                      {item.quantity}x {item.name}
                    </label>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {((item.price + (item.modifiers?.reduce((s, m) => s + m.price, 0) || 0)) * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
              {splitItems.length === 0 && (
                <p className="text-sm text-muted-foreground text-center pt-8">Select items from Bill A to move here</p>
              )}
            </div>
            <div className="flex justify-between font-bold text-primary">
              <span>Total:</span>
              <span>₹{splitTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={handleConfirm} 
            disabled={selectedItems.length === 0 || selectedItems.length === order.items.length}
          >
            Create Split Bill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
