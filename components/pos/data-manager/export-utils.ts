import { format } from "date-fns";
import type { Order, MenuItem, Table as TableType, Shift, AuditEntry } from "@/lib/data";
import type { StaffMember, CafeSettings } from "@/lib/store";

interface ExportDataParams {
  currentUser: any;
  settings: CafeSettings | null;
  orders: Order[];
  menuItems: MenuItem[];
  tables: TableType[];
  staffMembers: StaffMember[];
  shifts: Shift[];
  auditLog: AuditEntry[];
}

export function exportToExcel({
  currentUser,
  settings,
  orders,
  menuItems,
  tables,
  staffMembers,
  shifts,
  auditLog,
}: ExportDataParams) {
  // Export as a styled HTML workbook that Excel opens natively with
  // full colors, borders, fonts, and badges. Saved as .xls so double-click
  // opens it in Excel / Numbers / Google Sheets.
  const BOM = "\uFEFF";

  const h = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    return String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  };

  const rupee = (n: number | null | undefined): string => {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
    return `₹${Number(n).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };
  const dt = (d: unknown): string => {
    if (!d) return "—";
    try { return format(new Date(d as string | number | Date), "dd MMM yyyy, hh:mm a"); }
    catch { return "—"; }
  };
  const dateOnly = (d: unknown): string => {
    if (!d) return "—";
    try { return format(new Date(d as string | number | Date), "dd MMM yyyy"); }
    catch { return "—"; }
  };
  const timeOnly = (d: unknown): string => {
    if (!d) return "—";
    try { return format(new Date(d as string | number | Date), "hh:mm a"); }
    catch { return "—"; }
  };
  const titleCase = (s: string) =>
    (s || "").replace(/[-_]/g, " ").replace(/\b\w/g, ch => ch.toUpperCase());

  // ─── STYLE PALETTE ───
  const BRAND       = "#4E342E"; // deep coffee brown
  const BRAND_DARK  = "#3E2723";
  const ACCENT      = "#C9A227"; // gold
  const CREAM       = "#FFF8E7";
  const LINE        = "#D7C4A3";
  const TEXT        = "#212121";
  const MUTED       = "#795548";
  const FONT        = "Calibri, 'Segoe UI', Arial, sans-serif";
  const MONO        = "'Consolas', 'Courier New', monospace";

  const S_TITLE    = `font-family:${FONT};font-size:26pt;font-weight:bold;color:${BRAND_DARK};padding:8px 4px;`;
  const S_SUBTITLE = `font-family:${FONT};font-size:11pt;color:${MUTED};font-style:italic;padding:0 4px 10px 4px;`;
  const S_META_K   = `font-family:${FONT};font-size:10pt;font-weight:bold;color:${BRAND_DARK};background:${CREAM};padding:7px 14px;border:1px solid ${LINE};`;
  const S_META_V   = `font-family:${FONT};font-size:10pt;color:${TEXT};background:#FFFFFF;padding:7px 14px;border:1px solid ${LINE};`;
  const S_SECTION  = `font-family:${FONT};font-size:14pt;font-weight:bold;color:${CREAM};background:${BRAND};padding:12px 16px;border:2px solid ${BRAND_DARK};letter-spacing:1px;`;
  const S_TH       = `font-family:${FONT};font-size:10pt;font-weight:bold;color:${CREAM};background:${BRAND};padding:9px 11px;border:1px solid ${BRAND_DARK};text-align:left;`;
  const S_TH_NUM   = `font-family:${FONT};font-size:10pt;font-weight:bold;color:${CREAM};background:${BRAND};padding:9px 11px;border:1px solid ${BRAND_DARK};text-align:right;`;
  const S_TD_ODD   = `font-family:${FONT};font-size:10pt;color:${TEXT};background:${CREAM};padding:7px 11px;border:1px solid ${LINE};`;
  const S_TD_EVEN  = `font-family:${FONT};font-size:10pt;color:${TEXT};background:#FFFFFF;padding:7px 11px;border:1px solid ${LINE};`;
  const S_TD_ODD_N = `font-family:${MONO};font-size:10pt;color:${TEXT};background:${CREAM};padding:7px 11px;border:1px solid ${LINE};text-align:right;`;
  const S_TD_EVEN_N= `font-family:${MONO};font-size:10pt;color:${TEXT};background:#FFFFFF;padding:7px 11px;border:1px solid ${LINE};text-align:right;`;
  const S_TOTAL_L  = `font-family:${FONT};font-size:11pt;font-weight:bold;color:${CREAM};background:${BRAND_DARK};padding:10px 11px;border:2px solid ${BRAND_DARK};text-align:right;letter-spacing:1px;`;
  const S_TOTAL_N  = `font-family:${MONO};font-size:11pt;font-weight:bold;color:${ACCENT};background:${BRAND_DARK};padding:10px 11px;border:2px solid ${BRAND_DARK};text-align:right;`;
  const S_SUM_K    = `font-family:${FONT};font-size:11pt;font-weight:bold;color:${BRAND_DARK};background:${CREAM};padding:12px 16px;border:1px solid ${LINE};min-width:220px;`;
  const S_SUM_V    = `font-family:${MONO};font-size:13pt;font-weight:bold;color:${BRAND_DARK};background:#FFFFFF;padding:12px 16px;border:1px solid ${LINE};text-align:right;min-width:180px;`;
  const S_FOOTER   = `font-family:${FONT};font-size:9pt;font-style:italic;color:${MUTED};text-align:center;padding:18px;`;

  const statusBadge = (status: string): string => {
    const s = (status || "").toLowerCase();
    let bg = "#E0E0E0", fg = "#424242", br = "#BDBDBD";
    if (s === "completed")             { bg = "#C8E6C9"; fg = "#1B5E20"; br = "#81C784"; }
    else if (s === "cancelled")        { bg = "#FFCDD2"; fg = "#B71C1C"; br = "#E57373"; }
    else if (s === "new")              { bg = "#BBDEFB"; fg = "#0D47A1"; br = "#64B5F6"; }
    else if (s === "preparing")        { bg = "#FFE0B2"; fg = "#E65100"; br = "#FFB74D"; }
    else if (s === "ready")            { bg = "#D1C4E9"; fg = "#311B92"; br = "#9575CD"; }
    else if (s === "awaiting-payment") { bg = "#FFF9C4"; fg = "#F57F17"; br = "#FFF176"; }
    else if (s === "available")        { bg = "#C8E6C9"; fg = "#1B5E20"; br = "#81C784"; }
    else if (s === "occupied")         { bg = "#FFCDD2"; fg = "#B71C1C"; br = "#E57373"; }
    else if (s === "waiting-payment")  { bg = "#FFF9C4"; fg = "#F57F17"; br = "#FFF176"; }
    return `background:${bg};color:${fg};font-weight:bold;padding:5px 12px;border:1px solid ${br};font-family:${FONT};font-size:9pt;`;
  };

  const typeBadge = (type: string): string => {
    const t = (type || "").toLowerCase();
    let bg = "#E1F5FE", fg = "#01579B", br = "#81D4FA";
    if (t === "takeaway") { bg = "#F3E5F5"; fg = "#4A148C"; br = "#BA68C8"; }
    else if (t === "delivery") { bg = "#FFF3E0"; fg = "#E65100"; br = "#FFB74D"; }
    return `background:${bg};color:${fg};font-weight:bold;padding:5px 12px;border:1px solid ${br};font-family:${FONT};font-size:9pt;`;
  };

  // ─── DATA COMPUTATIONS ───
  const completed   = orders.filter(o => o.status === "completed");
  const cancelled   = orders.filter(o => o.status === "cancelled");
  const pending     = orders.filter(o => !["completed", "cancelled"].includes(o.status));
  const totalRevenue= completed.reduce((s, o) => s + (o.grandTotal ?? o.total ?? 0), 0);
  const totalTax    = completed.reduce((s, o) => s + (o.taxAmount ?? 0), 0);
  const totalDiscount=completed.reduce((s, o) => s + (o.discount?.amount ?? 0), 0);
  const avgTicket   = completed.length ? totalRevenue / completed.length : 0;

  // ─── HTML BUILDER ───
  const th = (label: string, align: "left" | "right" = "left") =>
    `<th style="${align === "right" ? S_TH_NUM : S_TH}">${h(label)}</th>`;
  const zebra = (i: number, num = false) =>
    num
      ? (i % 2 === 0 ? S_TD_ODD_N : S_TD_EVEN_N)
      : (i % 2 === 0 ? S_TD_ODD : S_TD_EVEN);
  const td = (val: unknown, i: number, num = false, extra = "") =>
    `<td style="${zebra(i, num)}${extra}">${h(val)}</td>`;

  let html = "";
  html += `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">`;
  html += `<head><meta charset="UTF-8"><title>SUHASHI Cafe Data Export</title>`;
  html += `<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>SUHASHI Data</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->`;
  html += `</head><body style="background:#FAFAFA;margin:20px;">`;

  // TITLE
  html += `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;">`;
  html += `<tr><td style="${S_TITLE}">☕  SUHASHI CAFE  —  DATA EXPORT</td></tr>`;
  html += `<tr><td style="${S_SUBTITLE}">Official Point-of-Sale Records · Complete Database Snapshot</td></tr>`;
  html += `</table>`;
  html += `<br/>`;

  // META
  html += `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;">`;
  const meta: Array<[string, string]> = [
    ["Generated On", dt(new Date())],
    ["Generated By", currentUser ? `${currentUser.name} (${titleCase(currentUser.role)})` : "—"],
    ["Cafe Name", settings?.cafeName || "SUHASHI Cafe"],
    ["GST Number", settings?.gstNumber || "—"],
    ["Address", settings?.address || "—"],
  ];
  meta.forEach(([k, v]) => {
    html += `<tr><td style="${S_META_K}">${h(k)}</td><td style="${S_META_V}">${h(v)}</td></tr>`;
  });
  html += `</table><br/><br/>`;

  // SUMMARY SECTION
  html += `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;"><tr><td colspan="2" style="${S_SECTION}">◆  SUMMARY</td></tr></table>`;
  html += `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;">`;
  const sums: Array<[string, string]> = [
    ["Total Orders",           String(orders.length)],
    ["Completed Orders",       String(completed.length)],
    ["Pending / In-Progress",  String(pending.length)],
    ["Cancelled Orders",       String(cancelled.length)],
    ["Total Revenue",          rupee(totalRevenue)],
    ["Total Tax Collected",    rupee(totalTax)],
    ["Total Discounts Given",  rupee(totalDiscount)],
    ["Average Ticket Size",    rupee(avgTicket)],
    ["Menu Items",             String(menuItems.length)],
    ["Tables",                 String(tables.length)],
    ["Staff Members",          String(staffMembers.length)],
    ["Shifts Logged",          String(shifts?.length ?? 0)],
    ["Audit Entries",          String(auditLog?.length ?? 0)],
  ];
  sums.forEach(([k, v]) => {
    html += `<tr><td style="${S_SUM_K}">${h(k)}</td><td style="${S_SUM_V}">${h(v)}</td></tr>`;
  });
  html += `</table><br/><br/>`;

  // ORDERS
  html += `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;"><tr><td style="${S_SECTION}">◆  ORDERS</td></tr></table>`;
  html += `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;">`;
  html += `<tr>${[
    th("#", "right"), th("Order ID"), th("Date"), th("Time"), th("Type"), th("Status"),
    th("Table", "right"), th("Customer"), th("Phone"), th("Items"),
    th("Subtotal", "right"), th("Discount"), th("Tax", "right"), th("Grand Total", "right"),
    th("Payment"), th("Txn ID"), th("Cash Rcvd", "right"), th("Change", "right"),
    th("Paid At"), th("Paid By"), th("Created By"), th("Notes"),
  ].join("")}</tr>`;
  orders.forEach((o, i) => {
    const tableNo = o.tableId
      ? String(tables.find(t => t.id === o.tableId)?.number ?? "—")
      : "—";
    const itemSummary = (o.items || [])
      .map(it => `${it.quantity}× ${it.name}${it.variant ? ` (${it.variant})` : ""}`)
      .join("; ") || "—";
    const discountDisplay = o.discount
      ? `${o.discount.type === "percent" ? o.discount.value + "%" : rupee(o.discount.value)} (−${rupee(o.discount.amount)})`
      : "—";
    html += `<tr>`;
    html += td(i + 1, i, true);
    html += td(o.id.toUpperCase(), i, false, "font-weight:bold;");
    html += td(dateOnly(o.createdAt), i);
    html += td(timeOnly(o.createdAt), i);
    html += `<td style="${zebra(i)}"><span style="${typeBadge(o.type)}">${h(titleCase(o.type))}</span></td>`;
    html += `<td style="${zebra(i)}"><span style="${statusBadge(o.status)}">${h(titleCase(o.status))}</span></td>`;
    html += td(tableNo, i, true);
    html += td(o.customerName || "—", i);
    html += td(o.customerPhone || "—", i);
    html += td(itemSummary, i);
    html += td(rupee(o.subtotal ?? o.total), i, true);
    html += td(discountDisplay, i);
    html += td(o.taxAmount != null ? rupee(o.taxAmount) : "—", i, true);
    html += td(rupee(o.grandTotal ?? o.total), i, true, `font-weight:bold;color:${BRAND_DARK};`);
    html += td(o.payment?.method ? titleCase(o.payment.method) : "—", i);
    html += td(o.payment?.transactionId || "—", i);
    html += td(o.payment?.cashReceived != null ? rupee(o.payment.cashReceived) : "—", i, true);
    html += td(o.payment?.change != null ? rupee(o.payment.change) : "—", i, true);
    html += td(o.paidAt ? dt(o.paidAt) : "—", i);
    html += td(o.paidBy || "—", i);
    html += td(o.createdBy || "—", i);
    html += td(o.orderNotes || "—", i);
    html += `</tr>`;
  });
  // Totals row
  html += `<tr>`;
  html += `<td colspan="12" style="${S_TOTAL_L}">GRAND TOTALS</td>`;
  html += `<td style="${S_TOTAL_N}">${h(rupee(totalTax))}</td>`;
  html += `<td style="${S_TOTAL_N}">${h(rupee(totalRevenue))}</td>`;
  html += `<td colspan="8" style="${S_TOTAL_L};text-align:left;"></td>`;
  html += `</tr>`;
  html += `</table><br/><br/>`;

  // ORDER ITEMS
  html += `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;"><tr><td style="${S_SECTION}">◆  ORDER ITEMS  (LINE-BY-LINE DETAIL)</td></tr></table>`;
  html += `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;">`;
  html += `<tr>${[
    th("Order ID"), th("Date"), th("Time"), th("Status"), th("Customer"), 
    th("Item"), th("Variant"), th("Qty", "right"),
    th("Unit Price", "right"), th("Modifiers"), th("Notes"), th("Line Total", "right"),
  ].join("")}</tr>`;
  let itemIdx = 0;
  orders.forEach(o => {
    (o.items || []).forEach(it => {
      const modTotal = (it.modifiers || []).reduce((s, m) => s + (m.price || 0), 0);
      const lineTotal = (it.price + modTotal) * it.quantity;
      const mods = (it.modifiers || [])
        .map(m => `${m.name}${m.price ? ` (+${rupee(m.price)})` : ""}`)
        .join("; ") || "—";
      html += `<tr>`;
      html += td(o.id.toUpperCase(), itemIdx, false, "font-weight:bold;");
      html += td(dateOnly(o.createdAt), itemIdx);
      html += td(timeOnly(o.createdAt), itemIdx);
      html += `<td style="${zebra(itemIdx)}"><span style="${statusBadge(o.status)}">${h(titleCase(o.status))}</span></td>`;
      html += td(o.customerName || "—", itemIdx);
      html += td(it.name, itemIdx);
      html += td(it.variant || "—", itemIdx);
      html += td(it.quantity, itemIdx, true);
      html += td(rupee(it.price), itemIdx, true);
      html += td(mods, itemIdx);
      html += td(it.notes || "—", itemIdx);
      html += td(rupee(lineTotal), itemIdx, true, "font-weight:bold;");
      html += `</tr>`;
      itemIdx++;
    });
  });
  html += `</table><br/><br/>`;

  // SUPPLEMENTARY BILLS
  const ordersWithSupps = orders.filter(o => (o.supplementaryBills || []).length > 0);
  if (ordersWithSupps.length) {
    html += `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;"><tr><td style="${S_SECTION}">◆  SUPPLEMENTARY BILLS  (POST-PAYMENT ADD-ONS)</td></tr></table>`;
    html += `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;">`;
    html += `<tr>${[
      th("Parent Order"), th("Supp. ID"), th("Created"),
      th("Paid At"), th("Payment"), th("Items"), th("Total", "right"),
    ].join("")}</tr>`;
    let sIdx = 0;
    ordersWithSupps.forEach(o => {
      (o.supplementaryBills || []).forEach(sb => {
        const items = (sb.items || []).map(it => `${it.quantity}× ${it.name}`).join("; ") || "—";
        html += `<tr>`;
        html += td(o.id.toUpperCase(), sIdx, false, "font-weight:bold;");
        html += td(sb.id.toUpperCase(), sIdx);
        html += td(dt(sb.createdAt), sIdx);
        html += td(sb.paidAt ? dt(sb.paidAt) : "—", sIdx);
        html += td(sb.payment?.method ? titleCase(sb.payment.method) : "—", sIdx);
        html += td(items, sIdx);
        html += td(rupee(sb.total), sIdx, true, "font-weight:bold;");
        html += `</tr>`;
        sIdx++;
      });
    });
    html += `</table><br/><br/>`;
  }

  // MENU ITEMS
  html += `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;"><tr><td style="${S_SECTION}">◆  MENU ITEMS</td></tr></table>`;
  html += `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;">`;
  html += `<tr>${[
    th("#", "right"), th("ID"), th("Name"), th("Category"),
    th("Base Price", "right"), th("Bestseller"), th("Availability"), th("Variants"),
  ].join("")}</tr>`;
  menuItems.forEach((m, i) => {
    const variants = m.variants?.length
      ? m.variants.map(v => `${v.name}: ${rupee(v.price)}`).join("; ")
      : "—";
    const availStyle = m.available
      ? `background:#C8E6C9;color:#1B5E20;font-weight:bold;padding:5px 12px;border:1px solid #81C784;font-family:${FONT};font-size:9pt;`
      : `background:#FFCDD2;color:#B71C1C;font-weight:bold;padding:5px 12px;border:1px solid #E57373;font-family:${FONT};font-size:9pt;`;
    const bestStyle = `background:${ACCENT};color:${BRAND_DARK};font-weight:bold;padding:5px 12px;border:1px solid ${BRAND_DARK};font-family:${FONT};font-size:9pt;`;
    html += `<tr>`;
    html += td(i + 1, i, true);
    html += td(m.id, i);
    html += td(m.name, i, false, "font-weight:bold;");
    html += td(titleCase(m.category), i);
    html += td(rupee(m.price), i, true, "font-weight:bold;");
    html += `<td style="${zebra(i)}">${m.bestseller ? `<span style="${bestStyle}">★ Bestseller</span>` : "—"}</td>`;
    html += `<td style="${zebra(i)}"><span style="${availStyle}">${m.available ? "Available" : "Unavailable"}</span></td>`;
    html += td(variants, i);
    html += `</tr>`;
  });
  html += `</table><br/><br/>`;

  // TABLES
  html += `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;"><tr><td style="${S_SECTION}">◆  TABLES</td></tr></table>`;
  html += `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;">`;
  html += `<tr>${[
    th("#", "right"), th("Table No.", "right"), th("Capacity", "right"),
    th("Status"), th("Current Order"),
  ].join("")}</tr>`;
  tables.forEach((t, i) => {
    const currentOrder = t.orderId
      ? (orders.find(o => o.id === t.orderId)?.id.toUpperCase() ?? t.orderId.toUpperCase())
      : "—";
    html += `<tr>`;
    html += td(i + 1, i, true);
    html += td(t.number, i, true, "font-weight:bold;");
    html += td(t.capacity, i, true);
    html += `<td style="${zebra(i)}"><span style="${statusBadge(t.status)}">${h(titleCase(t.status))}</span></td>`;
    html += td(currentOrder, i);
    html += `</tr>`;
  });
  html += `</table><br/><br/>`;

  // STAFF
  html += `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;"><tr><td style="${S_SECTION}">◆  STAFF MEMBERS</td></tr></table>`;
  html += `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;">`;
  html += `<tr>${[
    th("#", "right"), th("Name"), th("Role"), th("Initials"), th("PIN"),
  ].join("")}</tr>`;
  staffMembers.forEach((s, i) => {
    const roleStyle = `background:${ACCENT};color:${BRAND_DARK};font-weight:bold;padding:5px 12px;border:1px solid ${BRAND_DARK};font-family:${FONT};font-size:9pt;`;
    html += `<tr>`;
    html += td(i + 1, i, true);
    html += td(s.name, i, false, "font-weight:bold;");
    html += `<td style="${zebra(i)}"><span style="${roleStyle}">${h(titleCase(s.role))}</span></td>`;
    html += td(s.initials, i);
    html += `<td style="${zebra(i, true)}">••••</td>`;
    html += `</tr>`;
  });
  html += `</table><br/><br/>`;

  // SETTINGS
  if (settings) {
    html += `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;"><tr><td style="${S_SECTION}">◆  CAFE SETTINGS</td></tr></table>`;
    html += `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;">`;
    html += `<tr>${[th("Setting"), th("Value")].join("")}</tr>`;
    const settingsRows: Array<[string, string]> = [
      ["Cafe Name",               settings.cafeName || "—"],
      ["GST Number",              settings.gstNumber || "—"],
      ["Address",                 settings.address || "—"],
      ["Tax Rate",                `${settings.taxRate ?? 0}%`],
      ["GST Enabled",             settings.gstEnabled ? "Yes" : "No"],
      ["UPI ID",                  settings.upiId || "—"],
      ["Order Alerts",            settings.orderAlerts ? "On" : "Off"],
      ["Kitchen Ready Alerts",    settings.kitchenReadyAlerts ? "On" : "Off"],
      ["Auto-Print KOT",          settings.autoPrintKot ? "On" : "Off"],
      ["Print Customer Copy",     settings.printCustomerCopy ? "On" : "Off"],
      ["Session Timeout (mins)",  String(settings.sessionTimeoutMinutes ?? "—")],
    ];
    settingsRows.forEach(([k, v], i) => {
      html += `<tr>`;
      html += td(k, i, false, "font-weight:bold;");
      html += td(v, i);
      html += `</tr>`;
    });
    html += `</table><br/><br/>`;
  }

  // SHIFTS
  if (shifts && shifts.length) {
    html += `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;"><tr><td style="${S_SECTION}">◆  SHIFT HISTORY</td></tr></table>`;
    html += `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;">`;
    html += `<tr>${[
      th("#", "right"), th("Shift ID"), th("Staff"), th("Started"), th("Ended"),
      th("Opening Cash", "right"), th("Closing Cash", "right"),
      th("Total Sales", "right"), th("Orders", "right"), th("Notes"),
    ].join("")}</tr>`;
    shifts.forEach((s, i) => {
      html += `<tr>`;
      html += td(i + 1, i, true);
      html += td(s.id, i);
      html += td(s.staffName, i, false, "font-weight:bold;");
      html += td(dt(s.startedAt), i);
      html += td(s.endedAt ? dt(s.endedAt) : "— Active —", i);
      html += td(rupee(s.openingCash), i, true);
      html += td(s.closingCash != null ? rupee(s.closingCash) : "—", i, true);
      html += td(s.totalSales != null ? rupee(s.totalSales) : "—", i, true, "font-weight:bold;");
      html += td(s.totalOrders ?? "—", i, true);
      html += td(s.notes || "—", i);
      html += `</tr>`;
    });
    html += `</table><br/><br/>`;
  }

  // AUDIT LOG
  if (auditLog && auditLog.length) {
    html += `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;"><tr><td style="${S_SECTION}">◆  AUDIT LOG</td></tr></table>`;
    html += `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;">`;
    html += `<tr>${[
      th("#", "right"), th("Timestamp"), th("User"),
      th("Action"), th("Order ID"), th("Details"),
    ].join("")}</tr>`;
    auditLog.forEach((a, i) => {
      html += `<tr>`;
      html += td(i + 1, i, true);
      html += td(dt(a.timestamp), i);
      html += td(a.userId, i);
      html += td(titleCase(a.action), i, false, "font-weight:bold;");
      html += td(a.orderId ? a.orderId.toUpperCase() : "—", i);
      html += td(a.details || "—", i);
      html += `</tr>`;
    });
    html += `</table><br/><br/>`;
  }

  // FOOTER
  html += `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;">`;
  html += `<tr><td style="${S_FOOTER}">— End of SUHASHI Cafe Data Export —</td></tr>`;
  html += `</table>`;
  html += `</body></html>`;

  const blob = new Blob([BOM + html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `suhashi-cafe-data-${format(new Date(), "yyyy-MM-dd-HHmm")}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}
