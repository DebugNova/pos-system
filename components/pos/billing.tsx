"use client";

import { useState } from "react";
import { usePOSStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Banknote,
  CreditCard,
  Smartphone,
  Wallet,
  Receipt,
  Printer,
  CheckCircle2,
  ArrowLeft,
  Split,
  Percent,
  RotateCcw,
  QrCode,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type PaymentMethod = "cash" | "upi" | "card" | "split";

export function Billing() {
  const { orders, updateOrderStatus, setActiveView } = usePOSStore();
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [cashReceived, setCashReceived] = useState("");
  const [splitAmounts, setSplitAmounts] = useState({ cash: "", upi: "", card: "" });
  const [discount, setDiscount] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);

  const pendingPaymentOrders = orders.filter(
    (o) => o.status === "ready" || o.status === "preparing"
  );

  const order = selectedOrder ? orders.find((o) => o.id === selectedOrder) : null;

  const subtotal = order?.total || 0;
  const discountAmount = discount
    ? discountType === "percent"
      ? (subtotal * parseFloat(discount)) / 100
      : parseFloat(discount)
    : 0;
  const taxRate = 0.05;
  const taxableAmount = subtotal - discountAmount;
  const tax = taxableAmount * taxRate;
  const grandTotal = taxableAmount + tax;

  const cashChange = cashReceived ? parseFloat(cashReceived) - grandTotal : 0;

  const handlePayment = () => {
    if (!selectedOrder || !paymentMethod) return;
    setPaymentComplete(true);
  };

  const handleCompleteBilling = () => {
    if (!selectedOrder) return;
    updateOrderStatus(selectedOrder, "completed");
    setSelectedOrder(null);
    setPaymentMethod(null);
    setCashReceived("");
    setSplitAmounts({ cash: "", upi: "", card: "" });
    setDiscount("");
    setPaymentComplete(false);
  };

  const handleRefund = () => {
    // In a real app, this would process a refund
    setShowRefundDialog(false);
  };

  const quickCashAmounts = [100, 200, 500, 1000, 2000];

  return (
    <div className="flex h-full">
      {/* Orders List */}
      <div className="w-80 border-r border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="text-lg font-semibold text-foreground">Pending Bills</h2>
          <p className="text-sm text-muted-foreground">
            {pendingPaymentOrders.length} orders waiting
          </p>
        </div>
        <div className="overflow-y-auto p-4 space-y-2">
          {pendingPaymentOrders.map((o) => (
            <button
              key={o.id}
              onClick={() => {
                setSelectedOrder(o.id);
                setPaymentMethod(null);
                setPaymentComplete(false);
              }}
              className={cn(
                "w-full rounded-lg border border-border p-3 text-left transition-all hover:bg-secondary/50",
                selectedOrder === o.id && "border-primary bg-primary/10"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">{o.id.toUpperCase()}</span>
                <Badge variant={o.status === "ready" ? "outline" : "secondary"} className={o.status === "ready" ? "border-success text-success" : ""}>
                  {o.status}
                </Badge>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {o.tableId ? `Table ${o.tableId.replace("t", "")}` : o.type}
                </span>
                <span className="font-semibold text-primary">
                  {o.total.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground" suppressHydrationWarning>
                {formatDistanceToNow(o.createdAt, { addSuffix: true })}
              </p>
            </button>
          ))}
          {pendingPaymentOrders.length === 0 && (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              No pending bills
            </div>
          )}
        </div>
      </div>

      {/* Payment Section */}
      <div className="flex flex-1 flex-col">
        {!order ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            Select an order to process payment
          </div>
        ) : paymentComplete ? (
          /* Payment Success */
          <div className="flex flex-1 flex-col items-center justify-center p-8">
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-success/20">
              <CheckCircle2 className="h-12 w-12 text-success" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-foreground">Payment Successful!</h2>
            <p className="mb-6 text-muted-foreground">
              {grandTotal.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })} received via {paymentMethod}
            </p>
            {paymentMethod === "cash" && cashChange > 0 && (
              <div className="mb-6 rounded-lg bg-warning/10 p-4 text-center">
                <p className="text-sm text-muted-foreground">Return Change</p>
                <p className="text-2xl font-bold text-warning">
                  {cashChange.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" className="gap-2">
                <Printer className="h-4 w-4" />
                Print Receipt
              </Button>
              <Button onClick={handleCompleteBilling} className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Done
              </Button>
            </div>
          </div>
        ) : (
          /* Payment Form */
          <div className="flex flex-1 flex-col p-6">
            {/* Order Summary */}
            <Card className="mb-6 bg-card border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{order.id.toUpperCase()}</CardTitle>
                  <div className="flex gap-2">
                    {order.tableId && (
                      <Badge variant="secondary">Table {order.tableId.replace("t", "")}</Badge>
                    )}
                    <Badge variant="outline">{order.type}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex justify-between text-sm">
                      <span className="text-foreground">{item.quantity}x {item.name}</span>
                      <span className="text-muted-foreground">
                        {(item.price * item.quantity).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Discount */}
            <div className="mb-6 flex gap-4">
              <div className="flex-1">
                <Label className="text-sm">Discount</Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    type="number"
                    placeholder="0"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="bg-secondary border-none"
                  />
                  <Button
                    variant={discountType === "percent" ? "default" : "outline"}
                    size="icon"
                    onClick={() => setDiscountType("percent")}
                  >
                    <Percent className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={discountType === "amount" ? "default" : "outline"}
                    size="icon"
                    onClick={() => setDiscountType("amount")}
                  >
                    ₹
                  </Button>
                </div>
              </div>
            </div>

            {/* Bill Summary */}
            <div className="mb-6 rounded-lg bg-secondary/50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-foreground">
                  {subtotal.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                </span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-success">Discount</span>
                  <span className="text-success">
                    -{discountAmount.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax (5% GST)</span>
                <span className="text-foreground">
                  {tax.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-lg font-bold">
                <span className="text-foreground">Grand Total</span>
                <span className="text-primary">
                  {grandTotal.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                </span>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="mb-6">
              <Label className="mb-2 block text-sm">Payment Method</Label>
              <div className="grid grid-cols-4 gap-3">
                <button
                  onClick={() => setPaymentMethod("cash")}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border-2 border-border p-4 transition-all hover:bg-secondary/50",
                    paymentMethod === "cash" && "border-primary bg-primary/10"
                  )}
                >
                  <Banknote className="h-6 w-6 text-success" />
                  <span className="text-sm font-medium text-foreground">Cash</span>
                </button>
                <button
                  onClick={() => setPaymentMethod("upi")}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border-2 border-border p-4 transition-all hover:bg-secondary/50",
                    paymentMethod === "upi" && "border-primary bg-primary/10"
                  )}
                >
                  <Smartphone className="h-6 w-6 text-chart-1" />
                  <span className="text-sm font-medium text-foreground">UPI</span>
                </button>
                <button
                  onClick={() => setPaymentMethod("card")}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border-2 border-border p-4 transition-all hover:bg-secondary/50",
                    paymentMethod === "card" && "border-primary bg-primary/10"
                  )}
                >
                  <CreditCard className="h-6 w-6 text-chart-3" />
                  <span className="text-sm font-medium text-foreground">Card</span>
                </button>
                <button
                  onClick={() => setPaymentMethod("split")}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border-2 border-border p-4 transition-all hover:bg-secondary/50",
                    paymentMethod === "split" && "border-primary bg-primary/10"
                  )}
                >
                  <Split className="h-6 w-6 text-chart-4" />
                  <span className="text-sm font-medium text-foreground">Split</span>
                </button>
              </div>
            </div>

            {/* Cash Input */}
            {paymentMethod === "cash" && (
              <div className="mb-6 space-y-3">
                <Label className="text-sm">Cash Received</Label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  className="h-14 bg-secondary border-none text-xl"
                />
                <div className="flex flex-wrap gap-2">
                  {quickCashAmounts.map((amount) => (
                    <Button
                      key={amount}
                      variant="outline"
                      size="sm"
                      onClick={() => setCashReceived(String(amount))}
                    >
                      ₹{amount}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCashReceived(String(Math.ceil(grandTotal)))}
                  >
                    Exact
                  </Button>
                </div>
                {cashReceived && parseFloat(cashReceived) >= grandTotal && (
                  <div className="rounded-lg bg-success/10 p-3 text-center">
                    <span className="text-sm text-muted-foreground">Change: </span>
                    <span className="text-lg font-bold text-success">
                      {cashChange.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* UPI QR */}
            {paymentMethod === "upi" && (
              <div className="mb-6 flex flex-col items-center gap-4">
                <div className="flex h-48 w-48 items-center justify-center rounded-xl bg-white p-4">
                  <QrCode className="h-32 w-32 text-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Scan QR code or enter UPI ID: cafe@upi
                </p>
              </div>
            )}

            {/* Split Payment */}
            {paymentMethod === "split" && (
              <div className="mb-6 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-sm">Cash</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={splitAmounts.cash}
                      onChange={(e) => setSplitAmounts({ ...splitAmounts, cash: e.target.value })}
                      className="mt-1 bg-secondary border-none"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">UPI</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={splitAmounts.upi}
                      onChange={(e) => setSplitAmounts({ ...splitAmounts, upi: e.target.value })}
                      className="mt-1 bg-secondary border-none"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Card</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={splitAmounts.card}
                      onChange={(e) => setSplitAmounts({ ...splitAmounts, card: e.target.value })}
                      className="mt-1 bg-secondary border-none"
                    />
                  </div>
                </div>
                <div className="rounded-lg bg-secondary/50 p-3 text-center">
                  <span className="text-sm text-muted-foreground">Split Total: </span>
                  <span className={cn(
                    "text-lg font-bold",
                    (parseFloat(splitAmounts.cash || "0") + parseFloat(splitAmounts.upi || "0") + parseFloat(splitAmounts.card || "0")) >= grandTotal
                      ? "text-success"
                      : "text-destructive"
                  )}>
                    {(parseFloat(splitAmounts.cash || "0") + parseFloat(splitAmounts.upi || "0") + parseFloat(splitAmounts.card || "0")).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                  </span>
                  <span className="text-sm text-muted-foreground"> / {grandTotal.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}</span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-auto flex gap-3">
              <Dialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <RotateCcw className="h-4 w-4" />
                    Refund
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Process Refund</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to refund this order? This action will be logged.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="rounded-lg bg-secondary p-4">
                      <p className="text-sm text-muted-foreground">Refund Amount</p>
                      <p className="text-2xl font-bold text-foreground">
                        {grandTotal.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => setShowRefundDialog(false)}>
                        Cancel
                      </Button>
                      <Button variant="destructive" className="flex-1" onClick={handleRefund}>
                        Confirm Refund
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="outline" className="gap-2">
                <Printer className="h-4 w-4" />
                Print Bill
              </Button>
              <Button
                className="flex-1 h-14 text-lg"
                disabled={!paymentMethod || (paymentMethod === "cash" && (!cashReceived || parseFloat(cashReceived) < grandTotal)) || (paymentMethod === "split" && (parseFloat(splitAmounts.cash || "0") + parseFloat(splitAmounts.upi || "0") + parseFloat(splitAmounts.card || "0")) < grandTotal)}
                onClick={handlePayment}
              >
                <Receipt className="mr-2 h-5 w-5" />
                Complete Payment
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
