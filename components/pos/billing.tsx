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
  Clock,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { ReceiptTemplate } from "./receipt-template";
import { SplitBillDialog } from "./split-bill-dialog";
import { printToAllPrinters, printViaBrowser, generateReceiptHTML, generateKOTHTML } from "@/lib/print-service";

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
    sendToKitchenPayLater,
    confirmPaymentForServedOrder,
    cancelAwaitingPaymentOrder,
    pendingBillingOrderId,
    setPendingBillingOrderId,
    enqueueMutation,
    supabaseEnabled,
  } = usePOSStore();
  const permissions = getPermissions(currentUser?.role || "Chef");
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [cashReceived, setCashReceived] = useState("");
  const [splitAmounts, setSplitAmounts] = useState({ cash: "", upi: "", card: "" });
  const [discount, setDiscount] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [lastPayment, setLastPayment] = useState<{ amount: number, change: number } | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [showSplitDialog, setShowSplitDialog] = useState(false);

  const pendingPaymentOrders = orders.filter((o) => {
    // Cancelled / completed orders should never appear in the pending bills list,
    // even if they still have leftover unpaid supp bill rows. This prevents
    // staff from being forced to "pay" a cancelled order.
    if (o.status === "cancelled" || o.status === "completed") return false;
    return (
      o.status === "awaiting-payment" ||
      o.status === "served-unpaid" ||
      (o.supplementaryBills && o.supplementaryBills.some((b) => !b.payment))
    );
  });

  const order = selectedOrder ? orders.find((o) => o.id === selectedOrder) : null;

  useEffect(() => {
    if (pendingBillingOrderId) {
      const pendingOrder = orders.find((o) => o.id === pendingBillingOrderId);
      if (pendingOrder && (pendingOrder.status === "awaiting-payment" || pendingOrder.status === "served-unpaid")) {
        setSelectedOrder(pendingBillingOrderId);
      }
      setPendingBillingOrderId(null);
    }
  }, [pendingBillingOrderId, orders, setPendingBillingOrderId]);

  // If the selected order is cancelled/completed (e.g. cancelled from another
  // device via Realtime, or cancelled from the kitchen screen) — drop the
  // selection so the payment panel doesn't stay stuck on a phantom bill.
  useEffect(() => {
    if (!selectedOrder) return;
    const o = orders.find((x) => x.id === selectedOrder);
    if (!o || o.status === "cancelled" || o.status === "completed") {
      setSelectedOrder(null);
      setPaymentMethod(null);
      setPaymentComplete(false);
    }
  }, [selectedOrder, orders]);

  // Auto-select the first enabled payment method when an order is opened.
  // Cafe staff want one-tap flow; picking "cash" silently 90% of the time
  // removes an unnecessary step.
  useEffect(() => {
    if (!selectedOrder || paymentMethod || paymentComplete) return;
    if (settings.cashEnabled) setPaymentMethod("cash");
    else if (settings.upiEnabled) setPaymentMethod("upi");
    else if (settings.cardEnabled) setPaymentMethod("card");
  }, [selectedOrder, paymentMethod, paymentComplete, settings.cashEnabled, settings.upiEnabled, settings.cardEnabled]);

  const isServedUnpaid = order?.status === "served-unpaid";
  const isSupplementary = order?.status && order.status !== "awaiting-payment" && order.status !== "served-unpaid";
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

    // Handle served-unpaid (pay-later) orders
    if (isServedUnpaid) {
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
      }, { skipDirectWrite: true });

      if (discountAmount > 0) {
        addAuditEntry({
          action: "discount",
          userId: currentUser?.name || "Unknown",
          details: `Discount of ${discountAmount} applied to order ${selectedOrder.toUpperCase()}`,
          orderId: selectedOrder
        });
      }

      confirmPaymentForServedOrder(selectedOrder, payment);
      setLastPayment({ amount: grandTotal, change: cashChange });
      setPaymentComplete(true);

      // Auto-print receipt
      setTimeout(() => {
        if (settings.printCustomerCopy) {
          const receiptPrinters = settings.printers?.filter(p => p.type === "receipt" && p.enabled) || [];
          if (receiptPrinters.length > 0) {
            const freshOrder = orders.find(o => o.id === selectedOrder);
            if (freshOrder) {
              printToAllPrinters(receiptPrinters, freshOrder, settings, "receipt").then(({ results }) => {
                const failures = results.filter(r => !r.success);
                if (failures.length > 0) {
                  toast.error(`Receipt failed on: ${failures.map(f => f.printer).join(", ")}`);
                }
              });
            }
          } else {
            window.print();
          }
        }
      }, 100);
      return;
    }

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
      }, { skipDirectWrite: true });

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
      const paidAtDate = new Date();
      const newlyPaidBillIds: string[] = [];
      const updatedBills = order!.supplementaryBills!.map(b => {
        if (b.payment) return b;
        newlyPaidBillIds.push(b.id);
        return { ...b, payment, paidAt: paidAtDate };
      });
      const newGrandTotal = (order!.grandTotal || order!.total) + grandTotal;
      updateOrder(selectedOrder, {
        supplementaryBills: updatedBills,
        grandTotal: newGrandTotal,
      }, { skipDirectWrite: true });

      // Bug #2 fix: persist the payment info on each supplementary_bill row
      // (mapLocalOrderToDb intentionally ignores supplementaryBills, so without
      // these explicit writes the bill would stay unpaid in Supabase and
      // reappear in the billing queue on reload — double-billing risk).
      //
      // Sequence writes: supplementary_bills payment rows FIRST, then the
      // orders.grand_total update. This ensures a second terminal receives
      // the "bill paid" realtime event before the "grand_total increased"
      // event, so it can never show an unpaid-bill flicker.
      const paidAtIso = paidAtDate.toISOString();
      const suppMutIds = newlyPaidBillIds.map(billId =>
        enqueueMutation("supplementary-bill.payment", { billId, payment, paidAt: paidAtIso })
      );
      const orderMutId = enqueueMutation("order.update", {
        id: selectedOrder,
        changes: { grandTotal: newGrandTotal },
      });

      if (supabaseEnabled) {
        (async () => {
          try {
            const { updateSupplementaryBillPayment, updateOrderInDb } = await import("@/lib/supabase-queries");
            await Promise.all(
              newlyPaidBillIds.map((billId, idx) =>
                updateSupplementaryBillPayment(billId, payment, paidAtDate)
                  .then(() => usePOSStore.getState().markMutationSynced(suppMutIds[idx]))
              )
            );
            await updateOrderInDb(selectedOrder, { grandTotal: newGrandTotal });
            usePOSStore.getState().markMutationSynced(orderMutId);
          } catch (err: any) {
            console.warn("[billing] Direct write failed for supp bill payment, queued mutation will retry:", err?.message || err?.code || JSON.stringify(err));
          }
        })();
      }

      addAuditEntry({
        action: "payment_recorded",
        userId: currentUser?.name || "System",
        details: `Supplementary bill payment of ₹${payment.amount} recorded for order ${selectedOrder}`,
        orderId: selectedOrder,
        metadata: { method: payment.method, amount: payment.amount, transactionId: payment.transactionId, cashier: currentUser?.name || "System" }
      });
    }
    setLastPayment({ amount: grandTotal, change: cashChange });
    setPaymentComplete(true);

    // Auto-print KOT for orders going to kitchen
    if (!isSupplementary && settings.autoPrintKot) {
      const kotPrinters = settings.printers?.filter(p => p.type === "kot" && p.enabled) || [];
      const freshOrder = orders.find(o => o.id === selectedOrder);
      if (kotPrinters.length > 0 && freshOrder) {
        printToAllPrinters(kotPrinters, freshOrder, settings, "kot").then(({ results }) => {
          const failures = results.filter(r => !r.success);
          if (failures.length > 0) {
            toast.error(`KOT print failed on: ${failures.map(f => f.printer).join(", ")}`);
          }
        });
      }
    }

    // Auto-print receipt
    setTimeout(() => {
      if (settings.printCustomerCopy) {
        const receiptPrinters = settings.printers?.filter(p => p.type === "receipt" && p.enabled) || [];
        if (receiptPrinters.length > 0) {
          const freshOrder = orders.find(o => o.id === selectedOrder);
          if (freshOrder) {
            printToAllPrinters(receiptPrinters, freshOrder, settings, "receipt").then(({ results }) => {
              const failures = results.filter(r => !r.success);
              if (failures.length > 0) {
                toast.error(`Receipt failed on: ${failures.map(f => f.printer).join(", ")}`);
              }
            });
          }
        } else {
          window.print();
        }
      }
    }, 100);
  };

  const handleQuickCash = () => {
    if (!selectedOrder || !settings.cashEnabled) return;
    const exact = Math.ceil(grandTotal);
    setPaymentMethod("cash");
    setCashReceived(String(exact));
    // Defer the actual payment commit so the cashReceived state is visible in
    // the receipt calculations if they render.
    setTimeout(() => {
      const payment: PaymentRecord = {
        method: "cash",
        amount: grandTotal,
        transactionId: `txn-${Date.now()}`,
        cashReceived: exact,
        change: exact - grandTotal,
      };
      if (isServedUnpaid) {
        updateOrder(selectedOrder, {
          subtotal,
          discount: discountAmount > 0 ? { type: discountType, amount: discountAmount, value: parseFloat(discount) } : undefined,
          taxRate: settings.gstEnabled ? settings.taxRate : 0,
          taxAmount: tax,
          grandTotal,
        }, { skipDirectWrite: true });
        confirmPaymentForServedOrder(selectedOrder, payment);
      } else if (!isSupplementary) {
        updateOrder(selectedOrder, {
          subtotal,
          discount: discountAmount > 0 ? { type: discountType, amount: discountAmount, value: parseFloat(discount) } : undefined,
          taxRate: settings.gstEnabled ? settings.taxRate : 0,
          taxAmount: tax,
          grandTotal,
        }, { skipDirectWrite: true });
        confirmPaymentAndSendToKitchen(selectedOrder, payment);
      } else {
        const paidAtDate = new Date();
        const newlyPaidBillIds: string[] = [];
        const updatedBills = order!.supplementaryBills!.map(b => {
          if (b.payment) return b;
          newlyPaidBillIds.push(b.id);
          return { ...b, payment, paidAt: paidAtDate };
        });
        const newGrandTotal = (order!.grandTotal || order!.total) + grandTotal;
        updateOrder(selectedOrder, { supplementaryBills: updatedBills, grandTotal: newGrandTotal }, { skipDirectWrite: true });
        const paidAtIso = paidAtDate.toISOString();
        const suppMutIds = newlyPaidBillIds.map(billId =>
          enqueueMutation("supplementary-bill.payment", { billId, payment, paidAt: paidAtIso })
        );
        const orderMutId = enqueueMutation("order.update", { id: selectedOrder, changes: { grandTotal: newGrandTotal } });
        if (supabaseEnabled) {
          (async () => {
            try {
              const { updateSupplementaryBillPayment, updateOrderInDb } = await import("@/lib/supabase-queries");
              await Promise.all(
                newlyPaidBillIds.map((billId, idx) =>
                  updateSupplementaryBillPayment(billId, payment, paidAtDate)
                    .then(() => usePOSStore.getState().markMutationSynced(suppMutIds[idx]))
                )
              );
              await updateOrderInDb(selectedOrder, { grandTotal: newGrandTotal });
              usePOSStore.getState().markMutationSynced(orderMutId);
            } catch (err: any) {
              console.warn("[billing] Direct write failed for quick cash supp bill payment:", err?.message || err?.code || JSON.stringify(err));
            }
          })();
        }
        addAuditEntry({
          action: "payment_recorded",
          userId: currentUser?.name || "System",
          details: `Balance payment of ₹${payment.amount} recorded for order ${selectedOrder}`,
          orderId: selectedOrder,
          metadata: { method: payment.method, amount: payment.amount, transactionId: payment.transactionId, cashier: currentUser?.name || "System", quickCash: true },
        });
      }
      setLastPayment({ amount: grandTotal, change: exact - grandTotal });
      setPaymentComplete(true);

      if (!isSupplementary && settings.autoPrintKot) {
        const kotPrinters = settings.printers?.filter(p => p.type === "kot" && p.enabled) || [];
        const freshOrder = orders.find(o => o.id === selectedOrder);
        if (kotPrinters.length > 0 && freshOrder) {
          printToAllPrinters(kotPrinters, freshOrder, settings, "kot").then(({ results }) => {
            const failures = results.filter(r => !r.success);
            if (failures.length > 0) toast.error(`KOT print failed on: ${failures.map(f => f.printer).join(", ")}`);
          });
        }
      }
      if (settings.printCustomerCopy) {
        const receiptPrinters = settings.printers?.filter(p => p.type === "receipt" && p.enabled) || [];
        const freshOrder = orders.find(o => o.id === selectedOrder);
        if (receiptPrinters.length > 0 && freshOrder) {
          printToAllPrinters(receiptPrinters, freshOrder, settings, "receipt").catch(() => {});
        }
      }
    }, 0);
  };

  const handlePayLater = () => {
    if (!selectedOrder) return;
    sendToKitchenPayLater(selectedOrder);

    // Auto-print KOT for pay-later orders going to kitchen
    if (settings.autoPrintKot) {
      const kotPrinters = settings.printers?.filter(p => p.type === "kot" && p.enabled) || [];
      const freshOrder = orders.find(o => o.id === selectedOrder);
      if (kotPrinters.length > 0 && freshOrder) {
        printToAllPrinters(kotPrinters, freshOrder, settings, "kot").then(({ results }) => {
          const failures = results.filter(r => !r.success);
          if (failures.length > 0) {
            toast.error(`KOT print failed on: ${failures.map(f => f.printer).join(", ")}`);
          }
        });
      }
    }

    toast.success("Order sent to kitchen", {
      description: `Order ${selectedOrder.toUpperCase()} will be prepared. Payment will be collected after serving.`,
    });
    setSelectedOrder(null);
    setPaymentMethod(null);
    setDiscount("");
  };

  const handleCompleteBilling = () => {
    if (!selectedOrder) return;
    setSelectedOrder(null);
    setPaymentMethod(null);
    setCashReceived("");
    setSplitAmounts({ cash: "", upi: "", card: "" });
    setDiscount("");
    setLastPayment(null);
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
    <div className="flex h-full flex-col md:flex-row overflow-hidden">
      {/* Orders List */}
      <div className={cn("border-r border-border bg-card flex-col w-full md:w-80 shrink-0 h-full", selectedOrder ? "hidden md:flex" : "flex")}>
        <div className="border-b border-border p-4">
          <h2 className="text-lg font-semibold text-foreground">Pending Bills</h2>
          <p className="text-sm text-muted-foreground">
            {pendingPaymentOrders.length} orders waiting
          </p>
        </div>
        <div className="overflow-y-auto p-4 pb-20 md:pb-4 space-y-2">
          {pendingPaymentOrders.map((o) => (
            <button
              key={o.id}
              onClick={() => {
                setSelectedOrder(o.id);
                setPaymentMethod(null);
                setPaymentComplete(false);
              }}
              className={cn(
                "w-full rounded-lg border border-border p-3 text-left transition-all hover:bg-secondary/50 active:bg-secondary/70",
                selectedOrder === o.id && "border-primary bg-primary/10"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground text-base">{o.customerName || "Guest"}</span>
                <Badge variant="secondary" className={cn(
                  o.status === "served-unpaid" ? "text-destructive border-destructive/50" : "text-warning border-warning/50"
                )}>
                  {o.status === "awaiting-payment" ? "Pay Now" : o.status === "served-unpaid" ? "Pay Now" : "Balance Due"}
                </Badge>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {o.tableId ? `Table ${o.tableId.replace("t", "")}` : o.type}
                </span>
                <span className="font-semibold text-primary">
                  {((o.status === "awaiting-payment" || o.status === "served-unpaid") ? o.total : (o.supplementaryBills?.filter(b => !b.payment).reduce((sum, b) => sum + b.total, 0) || 0)).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground" suppressHydrationWarning>
                {formatDistanceToNow(o.createdAt, { addSuffix: true })}
                {o.customerPhone && ` • 📞 ${o.customerPhone}`}
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
      <div className={cn("flex flex-1 flex-col h-full overflow-y-auto", !selectedOrder ? "hidden md:flex" : "flex")}>
        {!order ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            Select an order to process payment
          </div>
        ) : paymentComplete ? (
          /* Payment Success */
          <div className="flex flex-1 flex-col items-center justify-center p-8 pb-24 md:pb-8">
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-success/20">
              <CheckCircle2 className="h-12 w-12 text-success" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-foreground">Payment Successful!</h2>
            <p className="mb-6 text-muted-foreground">
              {(lastPayment?.amount ?? grandTotal).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })} received via {paymentMethod}
            </p>
            {paymentMethod === "cash" && (lastPayment?.change || 0) > 0 && (
              <div className="mb-6 rounded-lg bg-warning/10 p-4 text-center">
                <p className="text-sm text-muted-foreground">Return Change</p>
                <p className="text-2xl font-bold text-warning">
                  {(lastPayment?.change || 0).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
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
          <div className="flex flex-1 flex-col h-full overflow-hidden">
            {/* Mobile Back Header */}
            <div className="flex md:hidden items-center gap-2 px-4 py-3 border-b border-border shrink-0">
              <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setSelectedOrder(null)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <span className="font-semibold text-foreground">Back to Orders</span>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 pb-44 md:pb-6 sm:p-5 lg:p-6">
              {/* Order Summary */}
              <Card className="mb-5 bg-card border-border">
                <CardHeader className="p-4 sm:p-5 pb-3">
                  {/* Customer Name */}
                  <CardTitle className="text-lg sm:text-xl font-bold truncate">{order.customerName || "Guest"}</CardTitle>
                  {/* Order ID + Badges Row */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="text-xs text-muted-foreground font-mono">{order.id.toUpperCase()}</span>
                    {order.tableId && (
                      <Badge variant="secondary">Table {order.tableId.replace("t", "")}</Badge>
                    )}
                    <Badge variant="outline">{order.type}</Badge>
                    {order.createdBy && (
                      <Badge variant="outline" className="opacity-70 font-normal">By {order.createdBy}</Badge>
                    )}
                  </div>
                  {/* Phone */}
                  {order.customerPhone && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-sm text-muted-foreground">
                      <span>📞 {order.customerPhone}</span>
                    </div>
                  )}
                  {/* Action Buttons Row */}
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-8"
                      onClick={() => setShowSplitDialog(true)}
                    >
                      <Split className="h-3.5 w-3.5" />
                      Split
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-8"
                      onClick={() => startEditOrder(order.id)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-5 pt-0">
                  <div className="border-t border-border pt-3">
                    {isSupplementary && unpaidBills.length > 0 ? (
                      <ul className="space-y-2.5">
                        {unpaidBills.map(bill => bill.items.map((item) => {
                          const modsTotal = item.modifiers?.reduce((s, m) => s + m.price, 0) || 0;
                          return (
                            <li key={item.id} className="flex flex-col text-sm border-b border-border/30 pb-2.5 last:border-0 last:pb-0">
                              <div className="flex items-start justify-between gap-3">
                                <span className="text-foreground font-medium flex items-center min-w-0">
                                  <Badge variant="outline" className="mr-2 text-[10px] sm:text-xs h-5 px-1.5 bg-warning/10 text-warning border-transparent shrink-0">+ADD</Badge>
                                  <span className="truncate">{item.quantity}x {item.name}</span>
                                </span>
                                <span className="text-foreground font-medium tabular-nums shrink-0">
                                  {((item.price + modsTotal) * item.quantity).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                                </span>
                              </div>
                              {item.variant && <span className="text-xs text-muted-foreground ml-[3.25rem] mt-1">{item.variant}</span>}
                              {item.modifiers && item.modifiers.length > 0 && (
                                <span className="text-xs text-muted-foreground ml-[3.25rem] mt-0.5">
                                  + {item.modifiers.map(m => m.name).join(", ")}
                                </span>
                              )}
                            </li>
                          )
                        }))}
                      </ul>
                    ) : (
                      <ul className="space-y-2.5">
                        {order.items.map((item) => {
                          const modsTotal = item.modifiers?.reduce((s, m) => s + m.price, 0) || 0;
                          return (
                            <li key={item.id} className="flex flex-col text-sm border-b border-border/30 pb-2.5 last:border-0 last:pb-0">
                              <div className="flex items-start justify-between gap-3">
                                <span className="text-foreground font-medium truncate">{item.quantity}x {item.name}</span>
                                <span className="text-foreground font-medium tabular-nums shrink-0">
                                  {((item.price + modsTotal) * item.quantity).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                                </span>
                              </div>
                              {item.variant && <span className="text-xs text-muted-foreground ml-5 mt-1">{item.variant}</span>}
                              {item.modifiers && item.modifiers.length > 0 && (
                                <span className="text-xs text-muted-foreground ml-5 mt-0.5">
                                  + {item.modifiers.map(m => m.name).join(", ")}
                                </span>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Discount - only Admin and Cashier can apply */}
              {permissions.canApplyDiscounts && (
                <div className="mb-5">
                  <Label className="text-sm font-medium mb-1.5 block">Discount</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="0"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      className="flex-1 bg-secondary border-none"
                    />
                    <Button
                      variant={discountType === "percent" ? "default" : "outline"}
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={() => setDiscountType("percent")}
                    >
                      <Percent className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={discountType === "amount" ? "default" : "outline"}
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={() => setDiscountType("amount")}
                    >
                      ₹
                    </Button>
                  </div>
                </div>
              )}

              {/* Quick Pay Row — one-tap exact cash */}
              {settings.cashEnabled && (
                <div className="mb-4">
                  <Button
                    onClick={handleQuickCash}
                    className="w-full h-14 text-base font-bold gap-2 bg-success text-success-foreground hover:bg-success/90 shadow-md"
                  >
                    <Zap className="h-5 w-5" />
                    Quick Pay — Cash {Math.ceil(grandTotal).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                  </Button>
                  <p className="text-[11px] text-muted-foreground text-center mt-1.5">One-tap: records exact cash, prints receipt, done.</p>
                </div>
              )}

              {/* Bill Summary */}
              <div className="mb-5 rounded-lg bg-secondary/50 p-4 space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground tabular-nums">
                    {subtotal.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                  </span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-success">Discount</span>
                    <span className="text-success tabular-nums">
                      -{discountAmount.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax ({settings.gstEnabled ? `${settings.taxRate}% GST` : "disabled"})</span>
                  <span className="text-foreground tabular-nums">
                    {tax.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="border-t border-border my-1" />
                <div className="flex justify-between items-baseline pt-1">
                  <span className="text-base sm:text-lg font-bold text-foreground">Grand Total</span>
                  <span className="text-xl sm:text-2xl font-bold text-primary tabular-nums">
                    {grandTotal.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                  </span>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="mb-5">
                <Label className="mb-2 block text-sm font-medium">Or choose another method</Label>
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                  {settings.cashEnabled && (
                    <button
                      onClick={() => setPaymentMethod("cash")}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-border p-4 transition-all hover:bg-secondary/50 active:bg-secondary/70",
                        paymentMethod === "cash" && "border-primary bg-primary/10"
                      )}
                    >
                      <Banknote className="h-6 w-6 text-success" />
                      <span className="text-sm font-medium text-foreground">Cash</span>
                    </button>
                  )}
                  {settings.upiEnabled && (
                    <button
                      onClick={() => setPaymentMethod("upi")}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-border p-4 transition-all hover:bg-secondary/50 active:bg-secondary/70",
                        paymentMethod === "upi" && "border-primary bg-primary/10"
                      )}
                    >
                      <Smartphone className="h-6 w-6 text-chart-1" />
                      <span className="text-sm font-medium text-foreground">UPI</span>
                    </button>
                  )}
                  {settings.cardEnabled && (
                    <button
                      onClick={() => setPaymentMethod("card")}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-border p-4 transition-all hover:bg-secondary/50 active:bg-secondary/70",
                        paymentMethod === "card" && "border-primary bg-primary/10"
                      )}
                    >
                      <CreditCard className="h-6 w-6 text-chart-3" />
                      <span className="text-sm font-medium text-foreground">Card</span>
                    </button>
                  )}
                  <button
                    onClick={() => setPaymentMethod("split")}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-border p-4 transition-all hover:bg-secondary/50 active:bg-secondary/70",
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
                <div className="mb-5 space-y-3">
                  <Label className="text-sm font-medium">Cash Received</Label>
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
              {paymentMethod === "upi" && settings.upiEnabled && (
                <div className="mb-5 flex flex-col items-center gap-4 w-full">
                  <div className="rounded-xl bg-white p-3 sm:p-4 w-full max-w-[240px] aspect-square flex justify-center items-center overflow-hidden border border-border/50 shadow-sm">
                    <img 
                        src="/qrrrr.png" 
                        alt="Store UPI QR Code" 
                        className="w-full h-full object-contain"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground text-center break-all max-w-[280px]">
                    Scan QR code or enter UPI ID: <br/>
                    <span className="font-semibold text-foreground mt-1 inline-block">Q391636080@ybl</span>
                  </p>
                </div>
              )}

              {/* Split Payment */}
              {paymentMethod === "split" && (
                <div className="mb-5 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    {settings.cashEnabled && (
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
                    )}
                    {settings.upiEnabled && (
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
                    )}
                    {settings.cardEnabled && (
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
                    )}
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
            </div>

            {/* Served-unpaid banner */}
            {isServedUnpaid && (
              <div className="mx-4 mb-0 sm:mx-5 lg:mx-6 mt-0 flex items-center gap-2.5 rounded-lg bg-destructive/10 border border-destructive/20 p-3 sm:p-3.5">
                <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-destructive/15 shrink-0">
                  <UtensilsCrossed className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm sm:text-base font-semibold text-destructive leading-tight">Food Served — Payment Due</span>
                  <span className="text-[11px] sm:text-xs text-muted-foreground leading-snug mt-0.5">This order was served with "Pay Later". Collect payment to complete.</span>
                </div>
              </div>
            )}

            {/* Fixed Bottom Action Bar */}
            <div className="fixed bottom-16 left-0 right-0 z-30 border-t border-border bg-card p-3 md:static md:bottom-auto md:z-auto md:shrink-0 md:p-4">
              <div className="flex flex-col gap-2 md:flex-row md:gap-3">
                {/* Void Order — only for awaiting-payment */}
                {order.status === "awaiting-payment" && (
                  <AlertDialog open={showVoidDialog} onOpenChange={setShowVoidDialog}>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="gap-2 text-destructive border-destructive/50 hover:bg-destructive/10 h-11 md:h-12 text-sm">
                        <RotateCcw className="h-4 w-4" />
                        Void Order
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="w-[95vw] max-w-lg sm:max-w-md max-h-[85vh] overflow-y-auto">
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
                )}
                <Button variant="outline" className="gap-2 h-11 md:h-12 text-sm" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" />
                  Print Bill
                </Button>

                {/* Pay Later button — only for awaiting-payment orders (not served-unpaid) */}
                {order.status === "awaiting-payment" && !isSupplementary && (
                  <Button
                    variant="outline"
                    className="gap-2 h-11 md:h-12 text-sm border-chart-3/50 text-chart-3 hover:bg-chart-3/10 hover:text-chart-3 font-semibold"
                    onClick={handlePayLater}
                  >
                    <Clock className="h-4 w-4" />
                    Pay Later
                  </Button>
                )}

                <Button
                  className="flex-1 h-12 md:h-14 text-base md:text-lg font-semibold"
                  disabled={!paymentMethod || (paymentMethod === "cash" && (!cashReceived || parseFloat(cashReceived) < grandTotal)) || (paymentMethod === "split" && (parseFloat(splitAmounts.cash || "0") + parseFloat(splitAmounts.upi || "0") + parseFloat(splitAmounts.card || "0")) < grandTotal)}
                  onClick={handlePayment}
                >
                  <Receipt className="mr-2 h-5 w-5" />
                  Complete Payment
                </Button>
              </div>
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
