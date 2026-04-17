/**
 * Print Service — handles dispatching print jobs to various printer types.
 *
 * Supports:
 * - Browser Print Dialog (window.print via hidden iframe)
 * - Network/IP (ESC/POS over fetch/WebSocket proxy — shows instructions)
 * - Bluetooth (Web Bluetooth API for BLE thermal printers)
 * - USB (WebUSB API for USB thermal printers)
 */

import type { PrinterConfig } from "./store";
import type { Order } from "./data";

// ----- ESC/POS Command Constants -----
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const ESCPOS = {
  INIT: new Uint8Array([ESC, 0x40]),
  CUT: new Uint8Array([GS, 0x56, 0x00]),
  ALIGN_CENTER: new Uint8Array([ESC, 0x61, 0x01]),
  ALIGN_LEFT: new Uint8Array([ESC, 0x61, 0x00]),
  BOLD_ON: new Uint8Array([ESC, 0x45, 0x01]),
  BOLD_OFF: new Uint8Array([ESC, 0x45, 0x00]),
  DOUBLE_HEIGHT_ON: new Uint8Array([ESC, 0x21, 0x10]),
  DOUBLE_WIDTH_ON: new Uint8Array([ESC, 0x21, 0x20]),
  DOUBLE_ON: new Uint8Array([ESC, 0x21, 0x30]),
  NORMAL: new Uint8Array([ESC, 0x21, 0x00]),
  FEED_LINES: (n: number) => new Uint8Array([ESC, 0x64, n]),
  SEPARATOR: (width: number) => new TextEncoder().encode("-".repeat(width) + "\n"),
};

function textToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str.substring(0, len) : str + " ".repeat(len - str.length);
}

function padLeft(str: string, len: number): string {
  return str.length >= len ? str.substring(0, len) : " ".repeat(len - str.length) + str;
}

// ----- ESC/POS Generators -----

interface CafeSettings {
  cafeName: string;
  gstNumber: string;
  address: string;
  taxRate: number;
  gstEnabled?: boolean;
}

export function generateReceiptESCPOS(order: Order, settings: CafeSettings, paperWidth: 58 | 80 = 80): Uint8Array {
  const cols = paperWidth === 80 ? 48 : 32;
  const parts: Uint8Array[] = [];

  parts.push(ESCPOS.INIT);

  // Header
  parts.push(ESCPOS.ALIGN_CENTER);
  parts.push(ESCPOS.BOLD_ON);
  parts.push(ESCPOS.DOUBLE_ON);
  parts.push(textToBytes(settings.cafeName + "\n"));
  parts.push(ESCPOS.NORMAL);
  parts.push(ESCPOS.BOLD_OFF);

  if (settings.address) {
    parts.push(textToBytes(settings.address + "\n"));
  }
  if (settings.gstNumber) {
    parts.push(textToBytes("GST: " + settings.gstNumber + "\n"));
  }

  parts.push(ESCPOS.SEPARATOR(cols));
  parts.push(ESCPOS.ALIGN_LEFT);

  // Order info
  const dateStr = new Date(order.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  parts.push(ESCPOS.BOLD_ON);
  parts.push(textToBytes(`${order.customerName || "Guest"}\n`));
  parts.push(ESCPOS.BOLD_OFF);
  if (order.customerPhone) {
    parts.push(textToBytes(`Phone: ${order.customerPhone}\n`));
  }
  parts.push(textToBytes(`${order.id.toUpperCase()}\n`));
  parts.push(textToBytes(`Date: ${dateStr}\n`));
  parts.push(textToBytes(`Type: ${order.type}${order.tableId ? `  Table ${order.tableId.replace("t", "")}` : ""}\n`));

  parts.push(ESCPOS.SEPARATOR(cols));

  // Items
  parts.push(ESCPOS.BOLD_ON);
  parts.push(textToBytes(padRight("Qty Item", cols - 10) + padLeft("Amount", 10) + "\n"));
  parts.push(ESCPOS.BOLD_OFF);
  parts.push(ESCPOS.SEPARATOR(cols));

  const renderReceiptItem = (item: any) => {
    const modsTotal = item.modifiers?.reduce((s: number, m: any) => s + m.price, 0) || 0;
    const amount = ((item.price + modsTotal) * item.quantity).toFixed(0);
    const itemText = `${item.quantity}x ${item.name}`;
    parts.push(textToBytes(padRight(itemText, cols - 10) + padLeft(`₹${amount}`, 10) + "\n"));
    if (item.variant) {
      parts.push(textToBytes(`   (${item.variant})\n`));
    }
    if (item.modifiers && item.modifiers.length > 0) {
      parts.push(textToBytes(`   + ${item.modifiers.map((m: any) => m.name).join(", ")}\n`));
    }
  };

  for (const item of order.items) {
    renderReceiptItem(item);
  }

  if (order.supplementaryBills && order.supplementaryBills.length > 0) {
    for (let idx = 0; idx < order.supplementaryBills.length; idx++) {
      const bill = order.supplementaryBills[idx];
      parts.push(ESCPOS.SEPARATOR(cols));
      parts.push(ESCPOS.BOLD_ON);
      parts.push(textToBytes(`+ Add-on #${idx + 1}${bill.payment ? "" : " (Unpaid)"}\n`));
      parts.push(ESCPOS.BOLD_OFF);
      for (const item of bill.items) {
        renderReceiptItem(item);
      }
    }
  }

  parts.push(ESCPOS.SEPARATOR(cols));

  // Totals
  const baseSubtotal = order.subtotal || order.total || 0;
  const suppTotal = (order.supplementaryBills || []).reduce((s, b) => s + (b.total || 0), 0);
  const subtotal = baseSubtotal + suppTotal;
  const discountAmount = order.discount?.amount || 0;
  let taxAmount = order.taxAmount;
  if (taxAmount === undefined || taxAmount === null) {
    if (settings.gstEnabled && settings.taxRate > 0) {
      taxAmount = (subtotal - discountAmount) * (settings.taxRate / 100);
    } else {
      taxAmount = 0;
    }
  }
  const grandTotal = order.grandTotal !== undefined && order.grandTotal !== null
    ? order.grandTotal
    : (subtotal - discountAmount + (taxAmount || 0));

  // Balance ESC/POS breakdown when supp bills contribute to grandTotal but not taxAmount
  if (suppTotal > 0 && order.grandTotal !== undefined && order.grandTotal !== null) {
    taxAmount = order.grandTotal - (subtotal - discountAmount);
    if (taxAmount < 0) taxAmount = 0;
  }

  parts.push(textToBytes(padRight("Subtotal", cols - 12) + padLeft(`₹${subtotal.toFixed(0)}`, 12) + "\n"));

  if (discountAmount > 0) {
    parts.push(textToBytes(padRight("Discount", cols - 12) + padLeft(`-₹${discountAmount.toFixed(0)}`, 12) + "\n"));
  }
  if ((taxAmount || 0) > 0) {
    parts.push(textToBytes(padRight(`Tax (${order.taxRate || settings.taxRate}%)`, cols - 12) + padLeft(`₹${(taxAmount || 0).toFixed(0)}`, 12) + "\n"));
  }

  parts.push(ESCPOS.SEPARATOR(cols));
  parts.push(ESCPOS.BOLD_ON);
  parts.push(ESCPOS.DOUBLE_HEIGHT_ON);
  parts.push(textToBytes(padRight("TOTAL", cols - 14) + padLeft(`₹${grandTotal.toFixed(0)}`, 14) + "\n"));
  parts.push(ESCPOS.NORMAL);
  parts.push(ESCPOS.BOLD_OFF);

  if (order.payment) {
    parts.push(ESCPOS.SEPARATOR(cols));
    parts.push(textToBytes(`Paid via: ${order.payment.method.toUpperCase()}\n`));
  }

  // Footer
  parts.push(ESCPOS.ALIGN_CENTER);
  parts.push(ESCPOS.FEED_LINES(1));
  parts.push(textToBytes("Thank you for visiting!\n"));
  parts.push(ESCPOS.FEED_LINES(3));
  parts.push(ESCPOS.CUT);

  return concatBytes(...parts);
}

export function generateKOTESCPOS(order: Order, settings: CafeSettings, paperWidth: 58 | 80 = 80): Uint8Array {
  const cols = paperWidth === 80 ? 48 : 32;
  const parts: Uint8Array[] = [];

  parts.push(ESCPOS.INIT);

  // Header
  parts.push(ESCPOS.ALIGN_CENTER);
  parts.push(ESCPOS.BOLD_ON);
  parts.push(ESCPOS.DOUBLE_ON);
  parts.push(textToBytes("** KOT **\n"));
  parts.push(ESCPOS.NORMAL);
  parts.push(ESCPOS.BOLD_OFF);

  parts.push(ESCPOS.SEPARATOR(cols));
  parts.push(ESCPOS.ALIGN_LEFT);

  // Order info
  const dateStr = new Date(order.createdAt).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit" });
  parts.push(ESCPOS.BOLD_ON);
  parts.push(ESCPOS.DOUBLE_ON);
  parts.push(textToBytes(`${order.customerName || "Guest"}\n`));
  parts.push(ESCPOS.NORMAL);
  if (order.customerPhone) {
    parts.push(textToBytes(`Phone: ${order.customerPhone}\n`));
  }
  if (order.tableId) {
    parts.push(ESCPOS.DOUBLE_ON);
    parts.push(textToBytes(`TABLE ${order.tableId.replace("t", "")}\n`));
    parts.push(ESCPOS.NORMAL);
  }
  parts.push(textToBytes(`Type: ${order.type}  |  ${dateStr}\n`));
  parts.push(textToBytes(`${order.id.toUpperCase()}\n`));
  parts.push(ESCPOS.BOLD_OFF);

  parts.push(ESCPOS.SEPARATOR(cols));

  // Items — no prices, just qty and name with notes
  parts.push(ESCPOS.BOLD_ON);
  parts.push(textToBytes(padRight("Qty", 5) + "Item\n"));
  parts.push(ESCPOS.BOLD_OFF);
  parts.push(ESCPOS.SEPARATOR(cols));

  const renderKotItem = (item: any, isAddon: boolean) => {
    parts.push(ESCPOS.BOLD_ON);
    parts.push(ESCPOS.DOUBLE_HEIGHT_ON);
    const label = isAddon ? `[ADD] ${item.name}` : item.name;
    parts.push(textToBytes(padRight(String(item.quantity), 5) + label + "\n"));
    parts.push(ESCPOS.NORMAL);
    parts.push(ESCPOS.BOLD_OFF);

    if (item.variant) {
      parts.push(textToBytes(`     (${item.variant})\n`));
    }
    if (item.modifiers && item.modifiers.length > 0) {
      parts.push(textToBytes(`     + ${item.modifiers.map((m: any) => m.name).join(", ")}\n`));
    }
    if (item.notes) {
      parts.push(textToBytes(`     NOTE: ${item.notes}\n`));
    }
  };

  for (const item of order.items) {
    renderKotItem(item, false);
  }

  if (order.supplementaryBills && order.supplementaryBills.length > 0) {
    for (let idx = 0; idx < order.supplementaryBills.length; idx++) {
      const bill = order.supplementaryBills[idx];
      parts.push(ESCPOS.SEPARATOR(cols));
      parts.push(ESCPOS.BOLD_ON);
      parts.push(textToBytes(`** ADD-ON #${idx + 1} **\n`));
      parts.push(ESCPOS.BOLD_OFF);
      for (const item of bill.items) {
        renderKotItem(item, true);
      }
    }
  }

  if (order.orderNotes) {
    parts.push(ESCPOS.SEPARATOR(cols));
    parts.push(ESCPOS.BOLD_ON);
    parts.push(textToBytes(`ORDER NOTES: ${order.orderNotes}\n`));
    parts.push(ESCPOS.BOLD_OFF);
  }

  const kotSuppItems = (order.supplementaryBills || []).reduce(
    (sum, bill) => sum + bill.items.reduce((s: number, i: any) => s + i.quantity, 0),
    0
  );
  const kotTotalItems = order.items.reduce((s, i) => s + i.quantity, 0) + kotSuppItems;
  parts.push(ESCPOS.SEPARATOR(cols));
  parts.push(ESCPOS.ALIGN_CENTER);
  parts.push(textToBytes(`${kotTotalItems} items total\n`));
  parts.push(ESCPOS.FEED_LINES(3));
  parts.push(ESCPOS.CUT);

  return concatBytes(...parts);
}

// ----- HTML Generators -----

export function generateKOTHTML(order: Order, settings: CafeSettings): string {
  const dateStr = new Date(order.createdAt).toLocaleString("en-IN", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit"
  });

  const renderItemRow = (item: any, isAddon = false) => `
    <tr style="border-bottom: 1px dashed #999;">
      <td style="padding: 6px 0; font-size: 18px; font-weight: bold;">${item.quantity}</td>
      <td style="padding: 6px 4px;">
        <div style="font-size: 16px; font-weight: bold;">
          ${isAddon ? '<span style="display:inline-block;border:1px solid #000;padding:0 4px;font-size:10px;margin-right:4px;vertical-align:middle;">ADD</span>' : ""}${item.name}
        </div>
        ${item.variant ? `<div style="font-size: 12px; color: #666;">(${item.variant})</div>` : ""}
        ${item.modifiers && item.modifiers.length > 0 ? `<div style="font-size: 12px; color: #666;">+ ${item.modifiers.map((m: any) => m.name).join(", ")}</div>` : ""}
        ${item.notes ? `<div style="font-size: 12px; color: #c00; font-weight: bold;">⚠ ${item.notes}</div>` : ""}
      </td>
    </tr>
  `;

  const mainItemsHtml = order.items.map((item) => renderItemRow(item, false)).join("");
  const suppItemsHtml = (order.supplementaryBills || []).map((bill, idx) => `
    <tr><td colspan="2" style="padding: 10px 0 4px; border-top: 2px solid #000; font-weight: bold; font-size: 14px;">** ADD-ON #${idx + 1} **</td></tr>
    ${bill.items.map((item: any) => renderItemRow(item, true)).join("")}
  `).join("");
  const itemsHtml = mainItemsHtml + suppItemsHtml;

  const suppItemCount = (order.supplementaryBills || []).reduce(
    (sum, bill) => sum + bill.items.reduce((s: number, i: any) => s + i.quantity, 0),
    0
  );
  const totalItemCount = order.items.reduce((s, i) => s + i.quantity, 0) + suppItemCount;

  return `
    <!DOCTYPE html>
    <html>
    <head><title>KOT - ${order.id}</title>
    <style>
      body { font-family: 'Courier New', monospace; margin: 0; padding: 8px; width: 80mm; }
      @media print { body { margin: 0; } }
    </style>
    </head>
    <body>
      <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 8px;">
        <h1 style="margin: 0; font-size: 28px;">** KOT **</h1>
      </div>
      <div style="margin-bottom: 8px;">
        <div style="font-size: 20px; font-weight: bold;">${order.customerName || "Guest"}</div>
        ${order.customerPhone ? `<div style="font-size: 12px;">Phone: ${order.customerPhone}</div>` : ""}
        ${order.tableId ? `<div style="font-size: 24px; font-weight: bold; margin: 4px 0;">TABLE ${order.tableId.replace("t", "")}</div>` : ""}
        <div>${order.type} | ${dateStr}</div>
        <div style="font-size: 11px; color: #666;">${order.id.toUpperCase()}</div>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 2px solid #000;">
            <th style="text-align: left; padding: 4px 0; width: 40px;">Qty</th>
            <th style="text-align: left; padding: 4px;">Item</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      ${order.orderNotes ? `
        <div style="margin-top: 8px; padding: 6px; border: 1px solid #000; font-weight: bold;">
          ORDER NOTES: ${order.orderNotes}
        </div>
      ` : ""}
      <div style="text-align: center; margin-top: 12px; border-top: 1px dashed #999; padding-top: 8px;">
        ${totalItemCount} items total
      </div>
    </body>
    </html>
  `;
}

// ----- Print Dispatch -----

/**
 * Print via browser print dialog using a hidden iframe.
 * This avoids disrupting the main page layout.
 */
export async function printViaBrowser(htmlContent: string): Promise<void> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.style.top = "-9999px";
    iframe.style.width = "80mm";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      resolve();
      return;
    }

    doc.open();
    doc.write(htmlContent);
    doc.close();

    // Wait for content to render
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
          resolve();
        }, 500);
      }, 300);
    };

    // Fallback if onload doesn't fire
    setTimeout(() => {
      try {
        iframe.contentWindow?.print();
      } catch {
        // ignore
      }
      setTimeout(() => {
        if (iframe.parentNode) {
          document.body.removeChild(iframe);
        }
        resolve();
      }, 500);
    }, 1000);
  });
}

/**
 * Print via USB using WebUSB API.
 * Sends raw ESC/POS bytes to the printer.
 */
export async function printViaUSB(data: Uint8Array, vendorId?: number, productId?: number): Promise<{ success: boolean; error?: string; deviceName?: string; vendorId?: number; productId?: number }> {
  if (!("usb" in navigator)) {
    return { success: false, error: "WebUSB is not supported in this browser. Use Chrome or Edge." };
  }

  try {
    let device: any;
    if (vendorId && productId) {
      // Try to reconnect to a previously paired device
      const devices = await (navigator as any).usb.getDevices();
      device = devices.find((d: any) => d.vendorId === vendorId && d.productId === productId);
      if (!device) {
        // Re-prompt user
        device = await (navigator as any).usb.requestDevice({ filters: [{}] });
      }
    } else {
      device = await (navigator as any).usb.requestDevice({ filters: [{}] });
    }

    await device.open();

    // Select configuration and claim interface
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }

    const iface = device.configuration?.interfaces?.[0];
    if (!iface) {
      await device.close();
      return { success: false, error: "No USB interface found on this device." };
    }

    await device.claimInterface(iface.interfaceNumber);

    // Find the OUT endpoint
    const alt = iface.alternates?.[0];
    const outEndpoint = alt?.endpoints?.find((e: any) => e.direction === "out");

    if (!outEndpoint) {
      await device.releaseInterface(iface.interfaceNumber);
      await device.close();
      return { success: false, error: "No output endpoint found on this USB device." };
    }

    // Send data in chunks (most USB printers accept up to 64 bytes at a time)
    const chunkSize = 64;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      await device.transferOut(outEndpoint.endpointNumber, chunk);
    }

    await device.releaseInterface(iface.interfaceNumber);
    await device.close();

    return {
      success: true,
      deviceName: device.productName || "USB Printer",
      vendorId: device.vendorId,
      productId: device.productId,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "USB printing failed." };
  }
}

/**
 * Print via Bluetooth using Web Bluetooth API.
 * Connects to a BLE thermal printer and sends ESC/POS data.
 */
export async function printViaBluetooth(data: Uint8Array): Promise<{ success: boolean; error?: string; deviceName?: string }> {
  if (!("bluetooth" in navigator)) {
    return { success: false, error: "Web Bluetooth is not supported in this browser. Use Chrome or Edge." };
  }

  try {
    // Common BLE printer service UUIDs
    const printerServiceUUIDs = [
      "000018f0-0000-1000-8000-00805f9b34fb", // Common BLE printer
      "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // Some Chinese BLE printers
    ];

    const device = await (navigator as any).bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: printerServiceUUIDs,
    });

    const server = await device.gatt?.connect();
    if (!server) {
      return { success: false, error: "Could not connect to Bluetooth device." };
    }

    // Try to find a writable characteristic
    let writeChar: any = null;
    for (const uuid of printerServiceUUIDs) {
      try {
        const service = await server.getPrimaryService(uuid);
        const chars = await service.getCharacteristics();
        writeChar = chars.find((c: any) =>
          c.properties.write || c.properties.writeWithoutResponse
        ) || null;
        if (writeChar) break;
      } catch {
        // Service not found, try next
      }
    }

    if (!writeChar) {
      server.disconnect();
      return { success: false, error: "Could not find a writable characteristic on the Bluetooth printer. It may not be a supported BLE printer." };
    }

    // Send data in chunks (BLE MTU is typically 20 bytes, max 512)
    const chunkSize = 20;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      if (writeChar.properties.writeWithoutResponse) {
        await writeChar.writeValueWithoutResponse(chunk);
      } else {
        await writeChar.writeValue(chunk);
      }
      // Small delay between chunks for BLE stability
      await new Promise(r => setTimeout(r, 10));
    }

    server.disconnect();
    return { success: true, deviceName: device.name || "Bluetooth Printer" };
  } catch (err: any) {
    return { success: false, error: err?.message || "Bluetooth printing failed." };
  }
}

/**
 * Print via Network (ESC/POS over HTTP proxy).
 * This requires a small local proxy server to forward raw TCP to the printer.
 * Falls back to showing instructions if the proxy isn't available.
 */
export async function printViaNetwork(ip: string, port: number, data: Uint8Array): Promise<{ success: boolean; error?: string }> {
  // Try to send via a local print proxy (common setup for POS systems)
  const proxyUrls = [
    `http://localhost:9100/print`,
    `http://127.0.0.1:9100/print`,
  ];

  for (const proxyUrl of proxyUrls) {
    try {
      const response = await fetch(proxyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Printer-IP": ip,
          "X-Printer-Port": String(port),
        },
        body: data,
      });

      if (response.ok) {
        return { success: true };
      }
    } catch {
      // Proxy not available, try next
    }
  }

  return {
    success: false,
    error: `Could not reach the network printer at ${ip}:${port}. For network printing, you need a local print proxy running on port 9100. Consider using Browser Print mode instead.`
  };
}

// ----- Main Print Dispatcher -----

export async function printOrder(
  printer: PrinterConfig,
  order: Order,
  settings: CafeSettings,
  docType: "receipt" | "kot"
): Promise<{ success: boolean; error?: string }> {
  try {
    if (printer.connectionType === "browser") {
      // Use browser print dialog with HTML content
      const html = docType === "kot"
        ? generateKOTHTML(order, settings)
        : generateReceiptHTML(order, settings);
      await printViaBrowser(html);
      return { success: true };
    }

    // For raw printer connections, generate ESC/POS data
    const escposData = docType === "kot"
      ? generateKOTESCPOS(order, settings, printer.paperWidth)
      : generateReceiptESCPOS(order, settings, printer.paperWidth);

    if (printer.connectionType === "usb") {
      return await printViaUSB(escposData, printer.usbVendorId, printer.usbProductId);
    }

    if (printer.connectionType === "bluetooth") {
      return await printViaBluetooth(escposData);
    }

    if (printer.connectionType === "network") {
      if (!printer.ipAddress) {
        return { success: false, error: "No IP address configured for this printer." };
      }
      return await printViaNetwork(printer.ipAddress, printer.port || 9100, escposData);
    }

    return { success: false, error: "Unknown connection type." };
  } catch (err: any) {
    return { success: false, error: err?.message || "Printing failed." };
  }
}

/**
 * Print to all enabled printers of a given type.
 */
export async function printToAllPrinters(
  printers: PrinterConfig[],
  order: Order,
  settings: CafeSettings,
  docType: "receipt" | "kot"
): Promise<{ results: Array<{ printer: string; success: boolean; error?: string }> }> {
  const enabledPrinters = printers.filter(p => p.enabled && p.type === docType);
  const results = await Promise.allSettled(
    enabledPrinters.map(async (printer) => {
      const result = await printOrder(printer, order, settings, docType);
      return { printer: printer.name, ...result };
    })
  );

  return {
    results: results.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      return { printer: enabledPrinters[i].name, success: false, error: r.reason?.message || "Unknown error" };
    })
  };
}

// ----- Receipt HTML (reuses existing CSS print styles) -----

export function generateReceiptHTML(order: Order, settings: CafeSettings): string {
  const dateStr = new Date(order.createdAt).toLocaleString("en-IN", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit"
  });

  const baseSubtotal = order.subtotal || order.total || 0;
  const suppTotal = (order.supplementaryBills || []).reduce((s, b) => s + (b.total || 0), 0);
  const subtotal = baseSubtotal + suppTotal;
  const discountAmount = order.discount?.amount || 0;
  let taxAmount = order.taxAmount;
  if (taxAmount === undefined || taxAmount === null) {
    if (settings.gstEnabled && settings.taxRate > 0) {
      taxAmount = (subtotal - discountAmount) * (settings.taxRate / 100);
    } else {
      taxAmount = 0;
    }
  }
  const grandTotal = order.grandTotal !== undefined && order.grandTotal !== null
    ? order.grandTotal
    : (subtotal - discountAmount + (taxAmount || 0));

  // Balance printed breakdown when supp bills contribute to grandTotal but not taxAmount
  if (suppTotal > 0 && order.grandTotal !== undefined && order.grandTotal !== null) {
    taxAmount = order.grandTotal - (subtotal - discountAmount);
    if (taxAmount < 0) taxAmount = 0;
  }

  const renderReceiptRow = (item: any) => {
    const modsTotal = item.modifiers?.reduce((s: number, m: any) => s + m.price, 0) || 0;
    const amt = ((item.price + modsTotal) * item.quantity).toFixed(0);
    return `
      <tr>
        <td style="padding: 3px 0;">
          ${item.quantity}x ${item.name}
          ${item.variant ? `<br><span style="font-size: 11px; color: #666; margin-left: 16px;">(${item.variant})</span>` : ""}
          ${item.modifiers && item.modifiers.length > 0 ? `<br><span style="font-size: 11px; color: #666; margin-left: 16px;">+ ${item.modifiers.map((m: any) => m.name).join(", ")}</span>` : ""}
        </td>
        <td style="padding: 3px 0; text-align: right;">₹${amt}</td>
      </tr>
    `;
  };
  const mainReceiptRows = order.items.map(renderReceiptRow).join("");
  const suppReceiptRows = (order.supplementaryBills || []).map((bill, idx) => `
    <tr><td colspan="2" style="padding: 6px 0 2px; border-top: 1px dashed #999; font-size: 11px; font-weight: bold;">+ Add-on #${idx + 1}${bill.payment ? "" : " (Unpaid)"}</td></tr>
    ${bill.items.map(renderReceiptRow).join("")}
  `).join("");
  const itemsHtml = mainReceiptRows + suppReceiptRows;

  return `
    <!DOCTYPE html>
    <html>
    <head><title>Receipt - ${order.id}</title>
    <style>
      body { font-family: 'Courier New', monospace; margin: 0; padding: 8px; width: 80mm; font-size: 13px; }
      @media print { body { margin: 0; } @page { margin: 0; } }
    </style>
    </head>
    <body>
      <div style="text-align: center; margin-bottom: 12px;">
        <h1 style="margin: 0 0 4px; font-size: 20px;">${settings.cafeName}</h1>
        ${settings.address ? `<div>${settings.address}</div>` : ""}
        ${settings.gstNumber ? `<div>GST: ${settings.gstNumber}</div>` : ""}
      </div>
      <div style="border-top: 1px dashed #999; border-bottom: 1px dashed #999; padding: 6px 0; margin-bottom: 8px;">
        <div style="font-weight: bold; font-size: 16px;">${order.customerName || "Guest"}</div>
        ${order.customerPhone ? `<div style="font-size: 12px;">Phone: ${order.customerPhone}</div>` : ""}
        <div style="font-size: 11px; color: #666;">${order.id.toUpperCase()} | ${dateStr}</div>
        <div>Type: ${order.type}${order.tableId ? ` | Table ${order.tableId.replace("t", "")}` : ""}</div>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <thead><tr style="border-bottom: 1px dashed #999;"><th style="text-align: left;">Item</th><th style="text-align: right;">Amt</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <div style="border-top: 1px dashed #999; margin-top: 8px; padding-top: 8px;">
        <div style="display: flex; justify-content: space-between;"><span>Subtotal</span><span>₹${subtotal.toFixed(0)}</span></div>
        ${discountAmount > 0 ? `<div style="display: flex; justify-content: space-between;"><span>Discount</span><span>-₹${discountAmount.toFixed(0)}</span></div>` : ""}
        ${(taxAmount || 0) > 0 ? `<div style="display: flex; justify-content: space-between;"><span>Tax (${order.taxRate || settings.taxRate}%)</span><span>₹${(taxAmount || 0).toFixed(0)}</span></div>` : ""}
        <div style="border-top: 1px solid #000; margin-top: 6px; padding-top: 6px; display: flex; justify-content: space-between; font-weight: bold; font-size: 16px;">
          <span>TOTAL</span><span>₹${grandTotal.toFixed(0)}</span>
        </div>
      </div>
      ${order.payment ? `
        <div style="border-top: 1px dashed #999; margin-top: 8px; padding-top: 6px;">
          Paid via: ${order.payment.method.toUpperCase()}
        </div>
      ` : ""}
      <div style="text-align: center; margin-top: 16px; border-top: 1px dashed #999; padding-top: 12px;">
        <strong>Thank you for visiting!</strong>
      </div>
    </body>
    </html>
  `;
}

// ----- Test Print -----

export function generateTestPrintESCPOS(printerName: string, paperWidth: 58 | 80 = 80): Uint8Array {
  const cols = paperWidth === 80 ? 48 : 32;
  const parts: Uint8Array[] = [];

  parts.push(ESCPOS.INIT);
  parts.push(ESCPOS.ALIGN_CENTER);
  parts.push(ESCPOS.BOLD_ON);
  parts.push(ESCPOS.DOUBLE_ON);
  parts.push(textToBytes("TEST PRINT\n"));
  parts.push(ESCPOS.NORMAL);
  parts.push(ESCPOS.BOLD_OFF);
  parts.push(ESCPOS.SEPARATOR(cols));
  parts.push(ESCPOS.ALIGN_LEFT);
  parts.push(textToBytes(`Printer: ${printerName}\n`));
  parts.push(textToBytes(`Paper Width: ${paperWidth}mm\n`));
  parts.push(textToBytes(`Time: ${new Date().toLocaleString()}\n`));
  parts.push(ESCPOS.SEPARATOR(cols));
  parts.push(ESCPOS.ALIGN_CENTER);
  parts.push(textToBytes("If you can read this,\nprinting works correctly!\n"));
  parts.push(ESCPOS.FEED_LINES(3));
  parts.push(ESCPOS.CUT);

  return concatBytes(...parts);
}

export function generateTestPrintHTML(printerName: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><title>Test Print</title>
    <style>
      body { font-family: 'Courier New', monospace; margin: 0; padding: 16px; width: 80mm; }
      @media print { body { margin: 0; } }
    </style>
    </head>
    <body>
      <div style="text-align: center; border: 2px solid #000; padding: 20px; margin-bottom: 16px;">
        <h1 style="margin: 0; font-size: 24px;">✓ TEST PRINT</h1>
      </div>
      <div style="border-top: 1px dashed #999; padding-top: 12px;">
        <div><strong>Printer:</strong> ${printerName}</div>
        <div><strong>Time:</strong> ${new Date().toLocaleString()}</div>
      </div>
      <div style="text-align: center; margin-top: 20px; padding: 16px; border: 1px dashed #999;">
        <p style="font-size: 16px;">If you can read this,<br>printing works correctly!</p>
      </div>
    </body>
    </html>
  `;
}

export async function sendTestPrint(printer: PrinterConfig): Promise<{ success: boolean; error?: string }> {
  if (printer.connectionType === "browser") {
    const html = generateTestPrintHTML(printer.name);
    await printViaBrowser(html);
    return { success: true };
  }

  const escposData = generateTestPrintESCPOS(printer.name, printer.paperWidth);

  if (printer.connectionType === "usb") {
    return await printViaUSB(escposData, printer.usbVendorId, printer.usbProductId);
  }

  if (printer.connectionType === "bluetooth") {
    return await printViaBluetooth(escposData);
  }

  if (printer.connectionType === "network") {
    if (!printer.ipAddress) {
      return { success: false, error: "No IP address configured." };
    }
    return await printViaNetwork(printer.ipAddress, printer.port || 9100, escposData);
  }

  return { success: false, error: "Unknown connection type." };
}
