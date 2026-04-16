import React from "react";
import { format } from "date-fns";
import type { Order } from "@/lib/data";

interface KOTTemplateProps {
  order: Order;
}

/**
 * KOT (Kitchen Order Ticket) print template.
 * Kitchen-focused: no prices, large item names, prominent table/order info.
 * Hidden on screen, visible only when printing.
 */
export function KOTTemplate({ order }: KOTTemplateProps) {
  if (!order) return null;

  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="kot-receipt hidden print:block bg-white text-black p-4 font-mono text-sm absolute top-0 left-0 w-[80mm] min-h-screen">
      {/* Header */}
      <div className="text-center mb-4 pb-3 border-b-2 border-black">
        <h1 className="text-2xl font-bold font-sans tracking-wider">** KOT **</h1>
      </div>

      {/* Order Info */}
      <div className="mb-3 pb-3 border-b border-dashed border-gray-400">
        <div className="font-bold text-xl">{order.customerName || "Guest"}</div>
        {order.customerPhone && (
          <div className="text-xs mt-0.5">Phone: {order.customerPhone}</div>
        )}
        {order.tableId && (
          <div className="text-2xl font-bold mt-1">
            TABLE {order.tableId.replace("t", "")}
          </div>
        )}
        <div className="flex justify-between mt-1">
          <span className="uppercase">{order.type}</span>
          <span>{format(order.createdAt, "HH:mm")}</span>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {order.id.toUpperCase()} • {format(order.createdAt, "dd/MM/yy")}
          {order.createdBy && ` • By ${order.createdBy}`}
        </div>
      </div>

      {/* Items — no prices */}
      <table className="w-full mb-3">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="text-left font-bold pb-1 w-10">Qty</th>
            <th className="text-left font-bold pb-1">Item</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="align-top border-b border-dashed border-gray-300">
              <td className="py-2 text-lg font-bold">{item.quantity}</td>
              <td className="py-2">
                <div className="text-base font-bold">{item.name}</div>
                {item.variant && (
                  <div className="text-xs text-gray-500 mt-0.5">({item.variant})</div>
                )}
                {item.modifiers && item.modifiers.length > 0 && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    + {item.modifiers.map(m => m.name).join(", ")}
                  </div>
                )}
                {item.notes && (
                  <div className="text-xs text-red-600 font-bold mt-1">
                    ⚠ {item.notes}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Order Notes */}
      {order.orderNotes && (
        <div className="mb-3 p-2 border border-black font-bold text-xs">
          ORDER NOTES: {order.orderNotes}
        </div>
      )}

      {/* Footer */}
      <div className="text-center pt-3 border-t border-dashed border-gray-400">
        <p className="font-bold">{totalItems} items total</p>
      </div>
    </div>
  );
}
