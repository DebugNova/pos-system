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
import { formatDistanceToNow, differenceInDays } from "date-fns";
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
    cancelPlacedOrder,
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

  const totalPendingAmount = pendingPaymentOrders.reduce((sum, o) => {
    if (o.status === "awaiting-payment" || o.status === "served-unpaid") {
      return sum + (o.total || 0);
    }
    return sum + (o.supplementaryBills?.filter(b => !b.payment).reduce((s, b) => s + b.total, 0) || 0);
  }, 0);

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
    if (!selectedOrder || !order) return;

    if (order.status === "awaiting-payment" || order.status === "served-unpaid") {
      cancelAwaitingPaymentOrder(selectedOrder, voidReason);
    } else {
      cancelPlacedOrder(selectedOrder, voidReason);
    }

    setSelectedOrder(null);
    setShowVoidDialog(false);
    setVoidReason("");

    toast.success("Bill cancelled successfully", {
      description: `Bill for order ${selectedOrder.toUpperCase()} has been cancelled.`
    });
  };

  const quickCashAmounts = [100, 200, 500, 1000, 2000];

  return (
    <div className="flex h-full flex-col md:flex-row overflow-hidden">
      {/* Orders List */}
      <div className={cn("border-r border-border/50 bg-card flex-col w-full md:w-80 lg:w-[350px] shrink-0 h-full", selectedOrder ? "hidden md:flex" : "flex")}>
        <div className="border-b border-border/50 bg-muted/10 p-5 sm:p-6 shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
               <Receipt className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-black text-foreground tracking-tight">Pending Bills</h2>
          </div>
          <div className="flex flex-col ml-12">
            <p className="text-sm font-medium text-muted-foreground">
              {pendingPaymentOrders.length} {pendingPaymentOrders.length === 1 ? 'order' : 'orders'} waiting
            </p>
            {totalPendingAmount > 0 && (
              <p className="text-sm font-bold text-primary mt-0.5">
                Total: {totalPendingAmount.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
              </p>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-3 pb-24 md:pb-5">
          {pendingPaymentOrders.map((o) => {
            const isOverdue = differenceInDays(new Date(), new Date(o.createdAt)) >= 3;
            return (
            <button
              key={o.id}
              onClick={() => {
                setSelectedOrder(o.id);
                setPaymentMethod(null);
                setPaymentComplete(false);
              }}
              className={cn(
                "group relative w-full flex flex-col p-4 rounded-[20px] border transition-all duration-300 text-left overflow-hidden",
                selectedOrder === o.id
                  ? "border-primary/40 bg-primary/5 shadow-[0_8px_30px_0_rgba(234,117,49,0.12)] scale-[0.98] ring-1 ring-primary/20"
                  : isOverdue
                  ? "border-red-500/50 bg-red-500/5 hover:bg-red-500/10 shadow-sm"
                  : "border-border/50 bg-card hover:bg-secondary/40 hover:border-border/80 hover:shadow-sm active:scale-[0.98]"
              )}
            >
              {/* Optional selected indicator line */}
              {selectedOrder === o.id && (
                 <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-primary rounded-r-full" />
              )}
              {isOverdue && selectedOrder !== o.id && (
                 <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-red-500 rounded-r-full" />
              )}
              
              <div className="flex items-start justify-between gap-3 w-full relative z-10 pl-1">
                <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                   {/* Avatar */}
                   <div className={cn(
                     "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-bold text-base transition-colors duration-300 shadow-sm",
                     selectedOrder === o.id 
                       ? "bg-primary text-primary-foreground shadow-primary/20"
                       : "bg-secondary text-muted-foreground border border-border/50 group-hover:bg-secondary/80"
                   )}>
                      {o.customerName && o.customerName.toLowerCase() !== "guest" ? o.customerName.charAt(0).toUpperCase() : <Receipt className="h-5 w-5" />}
                   </div>
                   
                   <div className="flex flex-col gap-0.5 overflow-hidden">
                     <span className="font-bold text-foreground text-base truncate pr-2">{o.customerName || "Guest"}</span>
                     <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                        <span className="bg-secondary/50 px-1.5 py-0.5 rounded-md text-foreground">
                          {o.tableId ? `Table ${o.tableId.replace("t", "")}` : o.type}
                        </span>
                        <span className="opacity-40">•</span>
                        <span suppressHydrationWarning>{formatDistanceToNow(o.createdAt, { addSuffix: true }).replace("about ", "")}</span>
                     </span>
                     {o.customerPhone && (
                        <span className="text-[10px] font-medium text-muted-foreground mt-0.5">📞 {o.customerPhone}</span>
                     )}
                   </div>
                </div>
                
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className={cn(
                    "font-black text-lg sm:text-xl tracking-tight transition-colors duration-300",
                    selectedOrder === o.id ? "text-primary" : "text-foreground"
                  )}>
                    {((o.status === "awaiting-payment" || o.status === "served-unpaid") ? o.total : (o.supplementaryBills?.filter(b => !b.payment).reduce((sum, b) => sum + b.total, 0) || 0)).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                  </span>
                  
                  <span className={cn(
                    "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                    o.status === "served-unpaid" 
                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                  )}>
                    {o.status === "awaiting-payment" ? "Pay Now" : o.status === "served-unpaid" ? "Pay Now" : "Balance Due"}
                  </span>
                </div>
              </div>
            </button>
          )})}
          {pendingPaymentOrders.length === 0 && (
            <div className="flex flex-col h-40 items-center justify-center text-muted-foreground gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/50">
                <CheckCircle2 className="h-6 w-6 opacity-50" />
              </div>
              <span className="font-medium text-sm">No pending bills</span>
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
            <div className="flex-1 overflow-y-auto p-4 pb-44 md:pb-6 sm:p-5 lg:p-6 bg-background">
              {/* === ORDER SUMMARY & ITEMS === */}
              <div className="flex flex-col gap-4 mb-5">
                {/* Order Summary */}
                <Card className="bg-card/50 border-border/50 shadow-sm backdrop-blur-sm rounded-2xl overflow-hidden">
                  <CardHeader className="p-4 pb-3 border-b border-border/40 bg-muted/10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col min-w-0">
                        <CardTitle className="text-xl sm:text-2xl font-black tracking-tight truncate">{order.customerName || "Guest"}</CardTitle>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider bg-secondary/60 px-1.5 py-0.5">
                            #{order.id.slice(0, 6).toUpperCase()}
                          </Badge>
                          {order.tableId && (
                            <Badge variant="outline" className="border-border/80 font-bold px-1.5 py-0.5">
                              T-{order.tableId.replace("t", "")}
                            </Badge>
                          )}
                          <Badge variant="outline" className="border-border/80 text-[9px] uppercase font-bold tracking-wider text-muted-foreground px-1.5 py-0.5">
                            {order.type}
                          </Badge>
                        </div>
                        {order.customerPhone && (
                          <div className="flex items-center gap-1.5 mt-2 text-[11px] sm:text-xs font-medium text-muted-foreground">
                            <span>📞 {order.customerPhone}</span>
                          </div>
                        )}
                      </div>
                      {/* Top Right Actions */}
                      <div className="flex flex-col sm:flex-row items-center gap-1.5 shrink-0">
                        <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-border/60 shadow-sm" onClick={() => setShowSplitDialog(true)} title="Split Order">
                          <Split className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-border/60 shadow-sm" onClick={() => startEditOrder(order.id)} title="Edit Order">
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="p-4 pt-3">
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
                      <ul className="space-y-3">
                        {order.items.map((item) => {
                          const modsTotal = item.modifiers?.reduce((s, m) => s + m.price, 0) || 0;
                          return (
                            <li key={item.id} className="flex flex-col text-sm border-b border-border/30 pb-3 last:border-0 last:pb-0">
                              <div className="flex items-start justify-between gap-3">
                                <span className="text-foreground flex items-start min-w-0">
                                  <span className="font-black text-primary min-w-[24px] inline-block shrink-0">{item.quantity}x</span>
                                  <span className="font-semibold text-[14px] truncate">{item.name}</span>
                                </span>
                                <span className="text-foreground font-bold tabular-nums shrink-0">
                                  {((item.price + modsTotal) * item.quantity).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                                </span>
                              </div>
                              {item.variant && <span className="text-[11px] font-medium text-muted-foreground bg-secondary/60 px-1.5 py-0.5 rounded w-fit ml-[24px] mt-1">{item.variant}</span>}
                              {item.modifiers && item.modifiers.length > 0 && (
                                <span className="text-[11px] sm:text-xs font-medium text-muted-foreground ml-[24px] mt-1">
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
            </div> {/* END ORDER ITEMS */}

            {/* === PAYMENT SECTION === */}
            <div className="flex flex-col flex-1 gap-5 w-full min-w-0">

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
                {/* Checkout Summary Card (Totals + Quick Pay) */}
              <div className="rounded-2xl bg-secondary/40 border border-border/40 p-4 sm:p-5 space-y-3 shadow-sm backdrop-blur-sm">
                <div className="flex justify-between text-[13px] font-semibold">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground tabular-nums">
                    {subtotal.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                  </span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-[13px] font-semibold">
                    <span className="text-success">Discount</span>
                    <span className="text-success tabular-nums">
                      -{discountAmount.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-[13px] font-semibold">
                  <span className="text-muted-foreground">Tax ({settings.gstEnabled ? `${settings.taxRate}% GST` : "disabled"})</span>
                  <span className="text-foreground tabular-nums">
                    {tax.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="border-t border-border/50 my-2" />
                <div className="flex justify-between items-end pt-1 mb-4">
                  <span className="text-base sm:text-lg font-black text-foreground">Grand Total</span>
                  <span className="text-2xl sm:text-3xl font-black text-primary tabular-nums tracking-tight">
                    {grandTotal.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                  </span>
                </div>
                
                {/* Quick Pay inside summary */}
                {settings.cashEnabled && (
                  <div className="w-full">
                    <Button
                      onClick={handleQuickCash}
                      className="w-full h-12 text-[15px] font-black gap-2 bg-success text-success-foreground hover:bg-success/90 shadow-md rounded-xl transition-transform active:scale-[0.98]"
                    >
                      <Zap className="h-5 w-5" />
                      Quick Pay — Exact Cash
                    </Button>
                  </div>
                )}
              </div>

              {/* Payment Methods Pill Group */}
              <div>
                <Label className="mb-2.5 block text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Payment Method</Label>
                <div className="grid grid-cols-4 gap-2">
                  {settings.cashEnabled && (
                    <button
                      onClick={() => setPaymentMethod("cash")}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border/50 py-2.5 transition-all",
                        paymentMethod === "cash" ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/30 scale-[0.98]" : "bg-card hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Banknote className="h-5 w-5" />
                      <span className="text-[10px] font-bold">Cash</span>
                    </button>
                  )}
                  {settings.upiEnabled && (
                    <button
                      onClick={() => setPaymentMethod("upi")}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border/50 py-2.5 transition-all",
                        paymentMethod === "upi" ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/30 scale-[0.98]" : "bg-card hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Smartphone className="h-5 w-5" />
                      <span className="text-[10px] font-bold">UPI</span>
                    </button>
                  )}
                  {settings.cardEnabled && (
                    <button
                      onClick={() => setPaymentMethod("card")}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border/50 py-2.5 transition-all",
                        paymentMethod === "card" ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/30 scale-[0.98]" : "bg-card hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <CreditCard className="h-5 w-5" />
                      <span className="text-[10px] font-bold">Card</span>
                    </button>
                  )}
                  <button
                    onClick={() => setPaymentMethod("split")}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border/50 py-2.5 transition-all",
                      paymentMethod === "split" ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/30 scale-[0.98]" : "bg-card hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Split className="h-5 w-5" />
                    <span className="text-[10px] font-bold">Split</span>
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
            </div> {/* End Payment Section */}
            </div> {/* End Scrollable Content */}

            {/* Fixed Bottom Action Bar */}
            <div className="fixed bottom-16 left-0 right-0 z-30 border-t border-border/50 bg-card/90 backdrop-blur-md p-3 md:static md:bottom-auto md:z-auto md:shrink-0 md:p-4 md:bg-card">
              <div className="flex flex-col gap-2.5 md:flex-row md:gap-3 max-w-full">
                {/* Served-unpaid banner directly above actions on mobile */}
                {isServedUnpaid && (
                  <div className="flex md:hidden items-center gap-2.5 rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 mb-1">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-destructive/15 shrink-0">
                      <UtensilsCrossed className="h-3.5 w-3.5 text-destructive" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] font-bold text-destructive leading-tight">Payment Due</span>
                      <span className="text-[10px] text-muted-foreground leading-snug mt-0.5">Collect payment to complete.</span>
                    </div>
                  </div>
                )}
                {/* Cancel Bill — for any pending bill */}
                <AlertDialog open={showVoidDialog} onOpenChange={setShowVoidDialog}>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="gap-2 text-destructive border-destructive/50 hover:bg-destructive/10 h-11 md:h-12 text-sm">
                      <RotateCcw className="h-4 w-4" />
                      Cancel Bill
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="w-[95vw] max-w-lg sm:max-w-md max-h-[85vh] overflow-y-auto">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel Bill</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to cancel this bill? The order will be cancelled.
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
                            Confirm Cancel
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </div>
                    </AlertDialogContent>
                  </AlertDialog>
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
