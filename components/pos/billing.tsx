"use client";

import { useState, useEffect } from "react";
import { usePOSStore } from "@/lib/store";
import { getPermissions } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  Pencil,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { ReceiptTemplate } from "./receipt-template";
import { SplitBillDialog } from "./split-bill-dialog";

import type { PaymentMethod, PaymentRecord } from "@/lib/data";

export function Billing() {
  const { 
    orders, 
    updateOrder, 
    updateOrderStatus, 
    updateTableStatus, 
    setActiveView, 
    currentUser, 
    startEditOrder, 
    settings, 
    addAuditEntry,
    confirmPaymentAndSendToKitchen,
    cancelAwaitingPaymentOrder,
    pendingBillingOrderId,
    setPendingBillingOrderId
  } = usePOSStore();
  const permissions = getPermissions(currentUser?.role || "Kitchen");
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [cashReceived, setCashReceived] = useState("");
  const [splitAmounts, setSplitAmounts] = useState({ cash: "", upi: "", card: "" });
  const [discount, setDiscount] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [showSplitDialog, setShowSplitDialog] = useState(false);

  const pendingPaymentOrders = orders.filter(
    (o) => o.status === "awaiting-payment" || (o.supplementaryBills && o.supplementaryBills.some(b => !b.payment))
  );

  const order = selectedOrder ? orders.find((o) => o.id === selectedOrder) : null;

  useEffect(() => {
    if (pendingBillingOrderId) {
      const pendingOrder = orders.find((o) => o.id === pendingBillingOrderId);
      if (pendingOrder && pendingOrder.status === "awaiting-payment") {
        setSelectedOrder(pendingBillingOrderId);
      }
      setPendingBillingOrderId(null);
    }
  }, [pendingBillingOrderId, orders, setPendingBillingOrderId]);

  const isSupplementary = order?.status && order.status !== "awaiting-payment";
  const unpaidBills = isSupplementary ? order?.supplementaryBills?.filter(b => !b.payment) || [] : [];
  const subtotal = isSupplementary ? unpaidBills.reduce((s, b) => s + b.total, 0) : (order?.total || 0);
  const discountAmount = discount
    ? discountType === "percent"
      ? (subtotal * parseFloat(discount)) / 100
      : parseFloat(discount)
    : 0;
  const taxRate = settings.gstEnabled ? settings.taxRate / 100 : 0;
  const taxableAmount = subtotal - discountAmount;
  const tax = taxableAmount * taxRate;
  const grandTotal = taxableAmount + tax;

  const cashChange = cashReceived ? parseFloat(cashReceived) - grandTotal : 0;

  const handlePayment = () => {
    if (!selectedOrder || !paymentMethod) return;

    const payment: PaymentRecord = {
      method: paymentMethod,
      amount: grandTotal,
      transactionId: `txn-${Date.now()}`,
      ...(paymentMethod === "cash" && cashReceived && {
        cashReceived: parseFloat(cashReceived),
        change: cashChange
      }),
      ...(paymentMethod === "split" && {
        splitDetails: {
          cash: parseFloat(splitAmounts.cash || "0"),
          upi: parseFloat(splitAmounts.upi || "0"),
          card: parseFloat(splitAmounts.card || "0")
        }
      })
    };

    if (!isSupplementary) {
      updateOrder(selectedOrder, {
        subtotal,
        discount: discountAmount > 0 ? {
          type: discountType,
          amount: discountAmount,
          value: parseFloat(discount)
        } : undefined,
        taxRate: settings.gstEnabled ? settings.taxRate : 0,
        taxAmount: tax,
        grandTotal,
      });

      if (discountAmount > 0) {
        addAuditEntry({
          action: "discount",
          userId: currentUser?.name || "Unknown",
          details: `Discount of ${discountAmount} applied to order ${selectedOrder.toUpperCase()}`,
          orderId: selectedOrder
        });
      }

      confirmPaymentAndSendToKitchen(selectedOrder, payment);
    } else {
      const updatedBills = order!.supplementaryBills!.map(b => b.payment ? b : { ...b, payment, paidAt: new Date() });
      updateOrder(selectedOrder, { 
        supplementaryBills: updatedBills,
        grandTotal: (order!.grandTotal || order!.total) + grandTotal
      });
      addAuditEntry({ 
        action: "payment_recorded", 
        userId: currentUser?.name || "System", 
        details: `Supplementary bill payment of ₹${payment.amount} recorded for order ${selectedOrder}`, 
        orderId: selectedOrder,
        metadata: { method: payment.method, amount: payment.amount, transactionId: payment.transactionId, cashier: currentUser?.name || "System" }
      });
    }
    setPaymentComplete(true);

    setTimeout(() => {
      if (settings.printCustomerCopy) {
        window.print();
      }
    }, 100);
  };

  const handleCompleteBilling = () => {
    if (!selectedOrder) return;
    setSelectedOrder(null);
    setPaymentMethod(null);
    setCashReceived("");
    setSplitAmounts({ cash: "", upi: "", card: "" });
    setDiscount("");
    setPaymentComplete(false);
  };

  const handleVoidOrder = () => {
    if (!selectedOrder) return;
    
    cancelAwaitingPaymentOrder(selectedOrder, voidReason);
    setSelectedOrder(null);
    setShowVoidDialog(false);
    setVoidReason("");

    toast.success("Order voided successfully", {
      description: `Order ${selectedOrder.toUpperCase()} voided and table released`
    });
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
                <Badge variant="secondary" className="text-warning border-warning/50">
                  {o.status === "awaiting-payment" ? "Awaiting Payment" : "Supplementary Bill"}
                </Badge>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {o.tableId ? `Table ${o.tableId.replace("t", "")}` : o.type}
                </span>
                <span className="font-semibold text-primary">
                  {(o.status === "awaiting-payment" ? o.total : (o.supplementaryBills?.filter(b => !b.payment).reduce((sum, b) => sum + b.total, 0) || 0)).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
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
                  {order?.payment?.change?.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }) ||
                    cashChange.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" className="gap-2" onClick={() => window.print()}>
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
                  <div className="flex items-center gap-2">
                    {order.tableId && (
                      <Badge variant="secondary">Table {order.tableId.replace("t", "")}</Badge>
                    )}
                    <Badge variant="outline">{order.type}</Badge>
                    {order.createdBy && (
                      <Badge variant="outline" className="opacity-70 font-normal">By {order.createdBy}</Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-1 gap-1.5"
                      onClick={() => setShowSplitDialog(true)}
                    >
                      <Split className="h-3.5 w-3.5" />
                      Split
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-1 gap-1.5"
                      onClick={() => startEditOrder(order.id)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isSupplementary && unpaidBills.length > 0 ? (
                  <ul className="space-y-3">
                    {unpaidBills.map(bill => bill.items.map((item) => {
                      const modsTotal = item.modifiers?.reduce((s, m) => s + m.price, 0) || 0;
                      return (
                      <li key={item.id} className="flex flex-col text-sm border-b border-border/40 pb-2 last:border-0 last:pb-0">
                        <div className="flex justify-between">
                          <span className="text-foreground font-medium"><Badge variant="outline" className="mr-2 text-[10px] h-5 px-1 bg-warning/10 text-warning border-transparent">+ADD</Badge>{item.quantity}x {item.name}</span>
                          <span className="text-muted-foreground">
                            {((item.price + modsTotal) * item.quantity).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                          </span>
                        </div>
                        {item.variant && <span className="text-xs text-muted-foreground ml-8 mt-0.5">{item.variant}</span>}
                        {item.modifiers && item.modifiers.length > 0 && (
                          <span className="text-xs text-muted-foreground ml-8 mt-0.5">
                            + {item.modifiers.map(m => m.name).join(", ")}
                          </span>
                        )}
                      </li>
                    )}))}
                  </ul>
                ) : (
                  <ul className="space-y-3">
                    {order.items.map((item) => {
                      const modsTotal = item.modifiers?.reduce((s, m) => s + m.price, 0) || 0;
                      return (
                      <li key={item.id} className="flex flex-col text-sm border-b border-border/40 pb-2 last:border-0 last:pb-0">
                        <div className="flex justify-between">
                          <span className="text-foreground font-medium">{item.quantity}x {item.name}</span>
                          <span className="text-muted-foreground">
                            {((item.price + modsTotal) * item.quantity).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                          </span>
                        </div>
                        {item.variant && <span className="text-xs text-muted-foreground ml-4 mt-0.5">{item.variant}</span>}
                        {item.modifiers && item.modifiers.length > 0 && (
                          <span className="text-xs text-muted-foreground ml-4 mt-0.5">
                            + {item.modifiers.map(m => m.name).join(", ")}
                          </span>
                        )}
                      </li>
                    )})}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Discount - only Admin and Cashier can apply */}
            {permissions.canApplyDiscounts && (
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
            )}

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
                <span className="text-muted-foreground">Tax ({settings.gstEnabled ? `${settings.taxRate}% GST` : "disabled"})</span>
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
                <div className="rounded-xl bg-white p-4">
                  <QRCodeSVG 
                    value={`upi://pay?pa=${settings.upiId}&pn=${encodeURIComponent(settings.cafeName)}&am=${grandTotal.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Order ${order.id}`)}`} 
                    size={192} 
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Scan QR code or enter UPI ID: {settings.upiId}
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
              {/* Void Order */}
              <AlertDialog open={showVoidDialog} onOpenChange={setShowVoidDialog}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="gap-2 text-destructive border-destructive hover:bg-destructive/10">
                    <RotateCcw className="h-4 w-4" />
                    Void Order
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Void Order</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to void this order? The customer's table will be released.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <Label className="text-sm">Reason (Optional)</Label>
                      <Textarea
                        placeholder="e.g., Customer walked away..."
                        value={voidReason}
                        onChange={(e) => setVoidReason(e.target.value)}
                        className="mt-1 bg-secondary border-none resize-none"
                      />
                    </div>
                    <AlertDialogFooter className="pt-2">
                      <AlertDialogCancel onClick={() => setShowVoidDialog(false)} className="flex-1 mt-0">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction onClick={handleVoidOrder} className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Confirm Void
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </div>
                </AlertDialogContent>
              </AlertDialog>
              <Button variant="outline" className="gap-2" onClick={() => window.print()}>
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

      {order && (
        <ReceiptTemplate order={order} settings={settings} />
      )}
      <SplitBillDialog 
        order={order || null}
        open={showSplitDialog}
        onOpenChange={setShowSplitDialog}
      />
    </div>
  );
}
