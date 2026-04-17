import React from "react";
import { format } from "date-fns";
import type { Order } from "@/lib/data";

interface CafeSettings {
  cafeName: string;
  gstNumber: string;
  address: string;
  taxRate: number;
  gstEnabled?: boolean;
}

interface ReceiptTemplateProps {
  order: Order;
  settings: CafeSettings;
}

export function ReceiptTemplate({ order, settings }: ReceiptTemplateProps) {
  if (!order) return null;

  const baseSubtotal = order.subtotal || order.total || 0;
  const suppTotal = order.supplementaryBills?.reduce((s, b) => s + (b.total || 0), 0) || 0;
  const subtotal = baseSubtotal + suppTotal;
  const discountAmount = order.discount?.amount || 0;
  
  let taxRatePercent = order.taxRate;
  let taxAmount = order.taxAmount;

  if (taxAmount === undefined || taxAmount === null) {
    if (settings.gstEnabled && settings.taxRate > 0) {
      taxRatePercent = settings.taxRate;
      taxAmount = (subtotal - discountAmount) * (settings.taxRate / 100);
    } else {
      taxRatePercent = 0;
      taxAmount = 0;
    }
  }

  const grandTotal = order.grandTotal !== undefined && order.grandTotal !== null ? order.grandTotal : (subtotal - discountAmount + (taxAmount || 0));

  // When supplementary bills have been paid, their tax is rolled into
  // `order.grandTotal` but not into `order.taxAmount`. Derive the display
  // tax so the printed breakdown (Subtotal − Discount + Tax = Total) balances.
  if (suppTotal > 0 && order.grandTotal !== undefined && order.grandTotal !== null) {
    taxAmount = order.grandTotal - (subtotal - discountAmount);
    if (taxAmount < 0) taxAmount = 0;
    if (taxRatePercent === undefined || taxRatePercent === null) {
      taxRatePercent = settings.gstEnabled ? settings.taxRate : 0;
    }
  }

  return (
    <div className="print-receipt hidden print:block bg-white text-black p-4 font-mono text-sm absolute top-0 left-0 w-[80mm] min-h-screen">
      <div className="text-center mb-4">
        <h1 className="text-xl font-bold font-sans">{settings.cafeName}</h1>
        {settings.address && <p>{settings.address}</p>}
        {settings.gstNumber && <p>GST: {settings.gstNumber}</p>}
      </div>

      <div className="mb-4 pb-4 border-b border-dashed border-gray-400">
        <div className="font-bold text-base mb-1">{order.customerName || "Guest"}</div>
        {order.customerPhone && <div className="text-xs mb-1">Phone: {order.customerPhone}</div>}
        <div className="flex justify-between text-xs">
          <span>{order.id.toUpperCase()}</span>
          <span>{format(order.createdAt, "dd/MM/yy HH:mm")}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span>Type: {order.type}</span>
          {order.tableId && <span>Table {order.tableId.replace("t", "")}</span>}
        </div>
      </div>

      <table className="w-full mb-4">
        <thead>
          <tr className="border-b border-dashed border-gray-400">
            <th className="text-left font-normal pb-1">Qty Item</th>
            <th className="text-right font-normal pb-1">Amt</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => {
            const modsTotal = item.modifiers?.reduce((s, m) => s + m.price, 0) || 0;
            return (
            <tr key={item.id} className="align-top">
              <td className="py-1">
                <div>{item.quantity} x {item.name}</div>
                {item.variant && <div className="text-xs text-gray-500 ml-4">({item.variant})</div>}
                {item.modifiers && item.modifiers.length > 0 && (
                  <div className="text-xs text-gray-500 ml-4">
                    + {item.modifiers.map(m => m.name).join(", ")}
                  </div>
                )}
              </td>
              <td className="text-right py-1">
                {(item.quantity * (item.price + modsTotal)).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
              </td>
            </tr>
          )})}
          {order.supplementaryBills?.map((bill, billIdx) => (
            <React.Fragment key={bill.id}>
              <tr>
                <td colSpan={2} className="pt-2 pb-1 text-xs font-bold border-t border-dashed border-gray-400">
                  + Add-on #{billIdx + 1}{bill.payment ? "" : " (Unpaid)"}
                </td>
              </tr>
              {bill.items.map((item) => {
                const modsTotal = item.modifiers?.reduce((s, m) => s + m.price, 0) || 0;
                return (
                  <tr key={item.id} className="align-top">
                    <td className="py-1">
                      <div>{item.quantity} x {item.name}</div>
                      {item.variant && <div className="text-xs text-gray-500 ml-4">({item.variant})</div>}
                      {item.modifiers && item.modifiers.length > 0 && (
                        <div className="text-xs text-gray-500 ml-4">
                          + {item.modifiers.map(m => m.name).join(", ")}
                        </div>
                      )}
                    </td>
                    <td className="text-right py-1">
                      {(item.quantity * (item.price + modsTotal)).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                    </td>
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      <div className="mb-4 pt-2 border-t border-dashed border-gray-400 space-y-1">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal</span>
          <span>{subtotal.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-gray-600">
            <span>Discount</span>
            <span>-{discountAmount.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}</span>
          </div>
        )}
        {(taxAmount || 0) > 0 && (
          <div className="flex justify-between text-gray-600">
            <span>Tax ({taxRatePercent}%)</span>
            <span>{(taxAmount || 0).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-base mt-2">
          <span>Total</span>
          <span>{grandTotal.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}</span>
        </div>
      </div>

      {order.payment && (
        <div className="mb-4 pt-2 border-t border-dashed border-gray-400 space-y-1">
          <div className="flex justify-between">
            <span>Payment Method</span>
            <span className="uppercase">{order.payment.method}</span>
          </div>
          {order.payment.transactionId && (
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Txn ID:</span>
              <span className="max-w-[150px] truncate">{order.payment.transactionId}</span>
            </div>
          )}
        </div>
      )}

      <div className="text-center mt-6 pt-4 border-t border-dashed border-gray-400">
        <p className="font-bold">Thank you for visiting!</p>
      </div>
    </div>
  );
}
