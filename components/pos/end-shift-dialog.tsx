"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePOSStore } from "@/lib/store";
import { formatDistanceToNow } from "date-fns";

interface EndShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EndShiftDialog({ open, onOpenChange }: EndShiftDialogProps) {
  const { currentShift, orders, endShift, logout } = usePOSStore();
  const [closingCash, setClosingCash] = useState("");
  const [notes, setNotes] = useState("");
  const [totalSales, setTotalSales] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);

  useEffect(() => {
    if (open && currentShift) {
      const shiftOrders = orders.filter(
        (o) => o.createdAt >= currentShift.startedAt && o.status === "completed"
      );
      setTotalSales(shiftOrders.reduce((sum, o) => sum + o.total, 0));
      setTotalOrders(shiftOrders.length);
    }
  }, [open, currentShift, orders]);

  if (!currentShift) return null;

  const handleEndShift = () => {
    endShift(parseFloat(closingCash || "0"), notes);
    onOpenChange(false);
    logout();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">End Shift Confirmation</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Review your shift summary and enter closing cash before logging out.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div className="rounded-xl border border-border bg-secondary/30 p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Duration</p>
              <p className="text-sm font-semibold text-foreground">
                {formatDistanceToNow(currentShift.startedAt)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-secondary/30 p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Orders Processed</p>
              <p className="text-sm font-semibold text-foreground">{totalOrders}</p>
            </div>
          </div>
          
          <div className="rounded-xl border border-border bg-primary/5 border-primary/20 p-4 text-center">
            <p className="text-xs text-primary mb-1 font-medium">Shift Total Sales</p>
            <p className="text-2xl font-bold text-primary">
              ₹{totalSales.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <Label htmlFor="closingCash" className="text-foreground">Closing Cash in Drawer</Label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
              <Input
                id="closingCash"
                type="number"
                placeholder="Enter exact cash amount"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                className="pl-8 bg-secondary/50 border-border text-foreground rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-foreground">Shift Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any discrepancies or notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-secondary/50 border-border resize-none h-20 rounded-xl text-foreground"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={handleEndShift}
            disabled={!closingCash} 
          >
            End Shift & Logout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
