"use client";

import { useState, useRef } from "react";
import { usePOSStore } from "@/lib/store";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  Package,
  Users,
  Grid3X3,
  ShoppingBag,
  Search,
  Coffee,
  ImageIcon,
  Loader2,
  X,
} from "lucide-react";
import { format } from "date-fns";
import type { Order, MenuItem, Modifier, Table as TableType, Category } from "@/lib/data";
import { uploadMenuImage } from "@/lib/supabase-queries";

interface DataManagerProps {
  onBack: () => void;
}

export function DataManager({ onBack }: DataManagerProps) {
  const {
    orders,
    menuItems,
    menuCategories,
    addMenuCategory,
    updateMenuCategory,
    deleteMenuCategory,
    modifiers,
    addModifier,
    updateModifier,
    deleteModifier,
    tables,
    staffMembers,
    settings,
    shifts,
    auditLog,
    currentUser,
    deleteOrder,
    updateOrder,
    deleteMenuItem,
    updateMenuItem,
    addMenuItem,
    deleteTable,
    updateTable,
    addTable,
    deleteStaffMember,
    updateStaffMember,
    addStaffMember,
    clearAllData,
    exportData,
    importData,
  } = usePOSStore();

  const [activeTab, setActiveTab] = useState("orders");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
  const [editingModifier, setEditingModifier] = useState<Modifier | null>(null);
  const [editingTable, setEditingTable] = useState<TableType | null>(null);
  const [editingStaff, setEditingStaff] = useState<{ id: string; name: string; role: string; pin: string; initials: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: string; id: string; name?: string } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [importText, setImportText] = useState("");
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showCancelOrderConfirm, setShowCancelOrderConfirm] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Stats
  const totalOrders = orders.length;
  const completedOrders = orders.filter((o) => o.status === "completed").length;
  const totalRevenue = orders.filter((o) => o.status === "completed").reduce((sum, o) => sum + o.total, 0);

  // Filter functions
  const filteredOrders = orders.filter((o) =>
    o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.customerPhone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMenuItems = menuItems.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTables = tables.filter((t) =>
    t.number.toString().includes(searchQuery) ||
    t.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredStaff = staffMembers.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handlers
  const handleExport = () => {
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
  };

  const handleImport = () => {
    const success = importData(importText);
    if (success) {
      setShowImportDialog(false);
      setImportText("");
      toast.success("Data imported successfully.");
    } else {
      toast.error("Failed to import data. Please check the format.");
    }
  };

  const handleDelete = () => {
    if (!showDeleteConfirm) return;
    const { type, id } = showDeleteConfirm;
    switch (type) {
      case "order":
        deleteOrder(id);
        break;
      case "menuItem":
        deleteMenuItem(id);
        break;
      case "table":
        deleteTable(id);
        break;
      case "staff":
        deleteStaffMember(id);
        break;
      case "modifier":
        deleteModifier(id);
        break;
      case "category":
        deleteMenuCategory(id);
        toast.success("Category deleted");
        break;
    }
    setShowDeleteConfirm(null);
  };

  const handleSaveModifier = () => {
    if (!editingModifier) return;
    const name = editingModifier.name.trim();
    if (!name) {
      toast.error("Modifier name is required");
      return;
    }
    const price = Number(editingModifier.price) || 0;
    if (editingModifier.id.startsWith("new-mod-")) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `mod-${Date.now()}`;
      const newId = `${slug}-${Date.now().toString(36)}`;
      addModifier({ id: newId, name, price });
      toast.success(`Added "${name}"`);
    } else {
      updateModifier(editingModifier.id, { name, price });
      toast.success(`Updated "${name}"`);
    }
    setEditingModifier(null);
  };

  const handleSaveOrder = () => {
    if (!editingOrder) return;

    // Guard: require confirmation when changing status to cancelled
    const originalOrder = orders.find((o) => o.id === editingOrder.id);
    if (editingOrder.status === "cancelled" && originalOrder?.status !== "cancelled") {
      setShowCancelOrderConfirm(true);
      return;
    }

    updateOrder(editingOrder.id, {
      status: editingOrder.status,
      customerName: editingOrder.customerName,
      customerPhone: editingOrder.customerPhone,
    });
    setEditingOrder(null);
  };

  const handleConfirmCancelOrder = () => {
    if (!editingOrder) return;
    updateOrder(editingOrder.id, {
      status: editingOrder.status,
      customerName: editingOrder.customerName,
      customerPhone: editingOrder.customerPhone,
    });
    setShowCancelOrderConfirm(false);
    setEditingOrder(null);
    toast.success(`Order ${editingOrder.id.toUpperCase()} has been cancelled.`);
  };

  const handleSaveMenuItem = async () => {
    if (!editingMenuItem) return;

    let finalItem = { ...editingMenuItem };

    // Upload image if a file was selected
    if (imageFile) {
      setIsUploading(true);
      try {
        const ext = imageFile.name.split('.').pop() || 'png';
        const safeName = (finalItem.name || 'item').toLowerCase().replace(/[^a-z0-9]/g, '-');
        const fileName = `${safeName}-${Date.now()}.${ext}`;
        const publicUrl = await uploadMenuImage(imageFile, fileName);
        finalItem.image_url = publicUrl;
        toast.success("Image uploaded successfully");
      } catch (err) {
        console.error("[data-manager] Image upload failed:", err);
        toast.error("Image upload failed — saving without image");
      } finally {
        setIsUploading(false);
      }
    }

    if (finalItem.id.startsWith("new-")) {
      const newId = `${finalItem.category}-${Date.now()}`;
      addMenuItem({ ...finalItem, id: newId });
    } else {
      updateMenuItem(finalItem.id, finalItem);
    }
    setEditingMenuItem(null);
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSaveTable = () => {
    if (!editingTable) return;
    if (editingTable.id.startsWith("new-")) {
      const newId = `t${Date.now()}`;
      addTable({ ...editingTable, id: newId });
    } else {
      updateTable(editingTable.id, editingTable);
    }
    setEditingTable(null);
  };

  const handleSaveStaff = () => {
    if (!editingStaff) return;
    if (editingStaff.id.startsWith("new-")) {
      const newId = `staff-${Date.now()}`;
      addStaffMember({ ...editingStaff, id: newId });
    } else {
      updateStaffMember(editingStaff.id, editingStaff);
    }
    setEditingStaff(null);
  };

  const handleSaveCategory = () => {
    if (!editingCategory || !editingCategory.name.trim()) return;
    if (editingCategory.id.startsWith("new-")) {
      const newId = editingCategory.name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      addMenuCategory({ ...editingCategory, id: newId || `cat-${Date.now()}` });
      toast.success("Category added");
    } else {
      updateMenuCategory(editingCategory.id, editingCategory);
      toast.success("Category updated");
    }
    setEditingCategory(null);
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4 border-b border-border p-4 lg:p-6 lg:flex-row lg:items-center lg:justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 h-8 w-8 sm:h-9 sm:w-9 -ml-1">
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <div className="pt-1 sm:pt-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground lg:text-2xl leading-none">Data Manager</h1>
            <p className="text-[11px] sm:text-sm text-muted-foreground mt-1">View, edit, and manage all stored data</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-row items-center gap-2 mt-1 sm:mt-0 lg:w-auto">
          <Button variant="outline" onClick={handleExport} className="justify-center h-8 sm:h-9 px-3 text-[11px] sm:text-sm font-medium bg-background shadow-sm">
            <Download className="mr-1.5 h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
            Download
          </Button>
          <Button variant="outline" onClick={() => setShowImportDialog(true)} className="justify-center h-8 sm:h-9 px-3 text-[11px] sm:text-sm font-medium bg-background shadow-sm">
            <Upload className="mr-1.5 h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
            Upload
          </Button>
          <Button variant="destructive" onClick={() => setShowClearConfirm(true)} className="col-span-2 sm:col-span-1 justify-center h-8 sm:h-9 px-3 text-[11px] sm:text-sm font-medium shadow-sm">
            <RefreshCw className="mr-1.5 h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
            Reset
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-3 p-4 shrink-0 lg:gap-4 lg:p-6 xl:grid-cols-4">
          <Card className="bg-card shadow-[0_1px_3px_0_rgb(0,0,0,0.05)] border-border/60">
            <CardContent className="p-4 md:p-5 flex flex-col gap-3 lg:gap-2">
              <div className="flex flex-row items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground text-left">Total Orders</p>
                <div className="flex h-8 w-8 lg:h-9 lg:w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <ShoppingBag className="h-4 w-4 lg:h-4 lg:w-4 text-primary stroke-[2px]" />
                </div>
              </div>
              <div className="flex items-start">
                <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground text-left">{totalOrders}</h3>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card shadow-[0_1px_3px_0_rgb(0,0,0,0.05)] border-border/60">
            <CardContent className="p-4 md:p-5 flex flex-col gap-3 lg:gap-2">
              <div className="flex flex-row items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground text-left">Completed</p>
                <div className="flex h-8 w-8 lg:h-9 lg:w-9 shrink-0 items-center justify-center rounded-lg bg-success/10">
                  <Package className="h-4 w-4 lg:h-4 lg:w-4 text-success stroke-[2px]" />
                </div>
              </div>
              <div className="flex items-start">
                <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground text-left">{completedOrders}</h3>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card shadow-[0_1px_3px_0_rgb(0,0,0,0.05)] border-border/60">
            <CardContent className="p-4 md:p-5 flex flex-col gap-3 lg:gap-2">
              <div className="flex flex-row items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground text-left">Menu Items</p>
                <div className="flex h-8 w-8 lg:h-9 lg:w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                  <Coffee className="h-4 w-4 lg:h-4 lg:w-4 text-blue-500 stroke-[2px]" />
                </div>
              </div>
              <div className="flex items-start">
                <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground text-left">{menuItems.length}</h3>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card shadow-[0_1px_3px_0_rgb(0,0,0,0.05)] border-border/60">
            <CardContent className="p-4 md:p-5 flex flex-col gap-3 lg:gap-2">
              <div className="flex flex-row items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground text-left">Total Revenue</p>
                <div className="flex h-8 w-8 lg:h-9 lg:w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
                  <Grid3X3 className="h-4 w-4 lg:h-4 lg:w-4 text-orange-500 stroke-[2px]" />
                </div>
              </div>
              <div className="flex items-start">
                <h3 className="text-xl md:text-2xl xl:text-3xl font-bold tracking-tight text-foreground text-left truncate">
                  {totalRevenue.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}
                </h3>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex-1 flex flex-col p-4 pt-0 lg:p-6 lg:pt-0 pb-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col h-full min-h-[400px]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0 mb-4">
              <TabsList className="grid w-full grid-cols-4 sm:flex sm:w-auto h-12 sm:h-11 p-1 bg-muted/60 rounded-lg">
                <TabsTrigger value="orders" className="flex items-center justify-center gap-1.5 h-full rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <ShoppingBag className="h-4 w-4 sm:h-4 sm:w-4 shrink-0 transition-all" />
                  <span className="hidden sm:inline text-sm font-medium">Orders</span>
                </TabsTrigger>
                <TabsTrigger value="menu" className="flex items-center justify-center gap-1.5 h-full rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Coffee className="h-4 w-4 sm:h-4 sm:w-4 shrink-0 transition-all" />
                  <span className="hidden sm:inline text-sm font-medium">Menu</span>
                </TabsTrigger>
                <TabsTrigger value="tables" className="flex items-center justify-center gap-1.5 h-full rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Grid3X3 className="h-4 w-4 sm:h-4 sm:w-4 shrink-0 transition-all" />
                  <span className="hidden sm:inline text-sm font-medium">Tables</span>
                </TabsTrigger>
                <TabsTrigger value="staff" className="flex items-center justify-center gap-1.5 h-full rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Users className="h-4 w-4 sm:h-4 sm:w-4 shrink-0 transition-all" />
                  <span className="hidden sm:inline text-sm font-medium">Staff</span>
                </TabsTrigger>
              </TabsList>
              <div className="relative w-full sm:w-64 shrink-0">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-11 sm:h-11 bg-secondary/50 border-border/50 focus-visible:ring-1 text-sm shadow-sm rounded-lg"
                />
              </div>
            </div>

          {/* Orders Tab */}
          <TabsContent value="orders" className="mt-3 flex-1 overflow-hidden">
            <Card className="h-full bg-card border-border">
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Orders ({filteredOrders.length})</CardTitle>
              </CardHeader>
              <CardContent className="h-[calc(100%-60px)] overflow-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Order ID</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Customer</TableHead>
                      <TableHead className="text-xs max-w-[200px]">Item Details</TableHead>
                      <TableHead className="text-xs">Total</TableHead>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="text-xs font-medium">{order.id.toUpperCase()}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="text-[11px] sm:text-xs">{order.type}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge
                            variant={order.status === "completed" ? "default" : "secondary"}
                            className="text-[11px] sm:text-xs"
                          >
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{order.customerName || "-"}{order.customerPhone ? ` (${order.customerPhone})` : ""}</TableCell>
                        <TableCell className="text-xs">
                          <div className="max-w-[250px] truncate" title={order.items.map(it => `${it.quantity}x ${it.name}${it.variant ? ` (${it.variant})` : ""}`).join(", ")}>
                            {order.items.map(it => `${it.quantity}x ${it.name}${it.variant ? ` (${it.variant})` : ""}`).join(", ") || "-"}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          {order.total.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                        </TableCell>
                        <TableCell className="text-xs" suppressHydrationWarning>
                          {format(order.createdAt, "MMM d, HH:mm")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingOrder(order)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setShowDeleteConfirm({ type: "order", id: order.id, name: order.id.toUpperCase() })}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredOrders.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                          No orders found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Menu Tab */}
          <TabsContent value="menu" className="mt-3 flex-1 overflow-auto space-y-4">
            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-sm">Add-ons / Modifiers ({modifiers.length})</CardTitle>
                <Button
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => setEditingModifier({ id: "new-mod-" + Date.now(), name: "", price: 0 })}
                >
                  <Plus className="h-3 w-3" />
                  Add Modifier
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">Extra Price</TableHead>
                      <TableHead className="text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modifiers.map((mod) => (
                      <TableRow key={mod.id}>
                        <TableCell className="text-xs font-medium">{mod.name}</TableCell>
                        <TableCell className="text-xs">
                          {mod.price > 0
                            ? mod.price.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })
                            : "Free"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingModifier(mod)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setShowDeleteConfirm({ type: "modifier", id: mod.id, name: mod.name })}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {modifiers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">
                          No add-ons yet. Click "Add Modifier" to create one.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Categories Card */}
            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-sm">Categories ({menuCategories.length})</CardTitle>
                <Button
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => setEditingCategory({ id: "new-" + Date.now(), name: "", icon: "tag" })}
                >
                  <Plus className="h-3 w-3" />
                  Add Category
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">ID</TableHead>
                      <TableHead className="text-xs">Items</TableHead>
                      <TableHead className="text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {menuCategories.map((cat) => (
                      <TableRow key={cat.id}>
                        <TableCell className="text-xs font-medium capitalize">{cat.name}</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{cat.id}</TableCell>
                        <TableCell className="text-xs">{menuItems.filter(m => m.category === cat.id).length}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingCategory(cat)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                              onClick={() => setShowDeleteConfirm({ type: "category", id: cat.id, name: cat.name })}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-sm">Menu Items ({filteredMenuItems.length})</CardTitle>{/* modifier-section-break */}
                <Button
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => setEditingMenuItem({ id: "new-" + Date.now(), name: "", price: 0, category: menuCategories[0]?.id ?? "coffee", available: true })}
                >
                  <Plus className="h-3 w-3" />
                  Add Item
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">Category</TableHead>
                      <TableHead className="text-xs">Price</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMenuItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-xs font-medium">{item.name}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="text-[11px] sm:text-xs capitalize">{item.category}</Badge>
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          {item.price.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant={item.available ? "default" : "secondary"} className="text-[11px] sm:text-xs">
                            {item.available ? "Available" : "Unavailable"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingMenuItem(item)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setShowDeleteConfirm({ type: "menuItem", id: item.id, name: item.name })}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tables Tab */}
          <TabsContent value="tables" className="mt-3 flex-1 overflow-hidden">
            <Card className="h-full bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-sm">Tables ({filteredTables.length})</CardTitle>
                <Button
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => setEditingTable({ id: "new-" + Date.now(), number: tables.length + 1, capacity: 4, status: "available" })}
                >
                  <Plus className="h-3 w-3" />
                  Add Table
                </Button>
              </CardHeader>
              <CardContent className="h-[calc(100%-60px)] overflow-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Table No.</TableHead>
                      <TableHead className="text-xs">Capacity</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Current Order</TableHead>
                      <TableHead className="text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTables.map((table) => (
                      <TableRow key={table.id}>
                        <TableCell className="text-xs font-medium">Table {table.number}</TableCell>
                        <TableCell className="text-xs">{table.capacity} seats</TableCell>
                        <TableCell className="text-xs">
                          <Badge
                            variant="outline"
                            className={`text-[11px] sm:text-xs ${
                              table.status === "available"
                                ? "border-success text-success"
                                : table.status === "occupied"
                                ? "border-warning text-warning"
                                : "border-destructive text-destructive"
                            }`}
                          >
                            {table.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{table.orderId || "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingTable(table)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setShowDeleteConfirm({ type: "table", id: table.id, name: `Table ${table.number}` })}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Staff Tab */}
          <TabsContent value="staff" className="mt-3 flex-1 overflow-hidden">
            <Card className="h-full bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-sm">Staff Members ({filteredStaff.length})</CardTitle>
                <Button
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => setEditingStaff({ id: "new-" + Date.now(), name: "", role: "Manager", pin: "1111", initials: "" })}
                >
                  <Plus className="h-3 w-3" />
                  Add Staff
                </Button>
              </CardHeader>
              <CardContent className="h-[calc(100%-60px)] overflow-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">Role</TableHead>
                      <TableHead className="text-xs">PIN</TableHead>
                      <TableHead className="text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStaff.map((staff) => (
                      <TableRow key={staff.id}>
                        <TableCell className="text-xs font-medium">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[11px] sm:text-xs font-semibold text-primary">
                              {staff.initials}
                            </div>
                            {staff.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="text-[11px] sm:text-xs">{staff.role}</Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono">****</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingStaff(staff)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setShowDeleteConfirm({ type: "staff", id: staff.id, name: staff.name })}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            {/* Staff Tab Content remains same internally but requires parent div to be closed later */}
          </TabsContent>
        </Tabs>
      </div>
    </div>

      {/* Edit Order Dialog */}
      <Dialog open={!!editingOrder} onOpenChange={() => setEditingOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Order {editingOrder?.id.toUpperCase()}</DialogTitle>
          </DialogHeader>
          {editingOrder && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editingOrder.status}
                  onValueChange={(value) => setEditingOrder({ ...editingOrder, status: value as Order["status"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="preparing">Preparing</SelectItem>
                    <SelectItem value="ready">Ready</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Customer Name</Label>
                <Input
                  value={editingOrder.customerName || ""}
                  onChange={(e) => setEditingOrder({ ...editingOrder, customerName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Customer Phone</Label>
                <Input
                  type="tel"
                  value={editingOrder.customerPhone || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^\d*$/.test(value)) {
                      setEditingOrder({ ...editingOrder, customerPhone: value });
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Items</Label>
                <div className="space-y-1 rounded-lg bg-secondary/50 p-3">
                  {editingOrder.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>{item.quantity}x {item.name}</span>
                      <span className="text-muted-foreground">
                        {(item.price * item.quantity).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                      </span>
                    </div>
                  ))}
                  <div className="mt-2 border-t border-border pt-2 flex justify-between font-semibold">
                    <span>Total</span>
                    <span>{editingOrder.total.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOrder(null)}>Cancel</Button>
            <Button onClick={handleSaveOrder}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Menu Item Dialog */}
      <Dialog open={!!editingMenuItem} onOpenChange={() => setEditingMenuItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMenuItem?.id.startsWith("new-") ? "Add Menu Item" : "Edit Menu Item"}</DialogTitle>
          </DialogHeader>
          {editingMenuItem && (
            <div className="space-y-4">
              {/* Image preview and upload */}
              <div className="space-y-2">
                <Label>Image</Label>
                <div className="flex items-center gap-3">
                  <div className="relative h-16 w-16 rounded-lg bg-secondary/50 border border-border overflow-hidden flex items-center justify-center shrink-0">
                    {(imagePreview || editingMenuItem.image_url) ? (
                      <img
                        src={imagePreview || editingMenuItem.image_url}
                        alt={editingMenuItem.name || "Menu item"}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          // Fallback to local path if Supabase URL fails
                          const target = e.target as HTMLImageElement;
                          if (editingMenuItem.image_url && !editingMenuItem.image_url.startsWith('/menu/')) {
                            target.src = '/menu/_fallback.png';
                          }
                        }}
                      />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setImageFile(file);
                          setImagePreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-3 w-3" />
                      {imageFile ? "Change" : "Upload"}
                    </Button>
                    {(imageFile || editingMenuItem.image_url) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1 text-xs text-muted-foreground hover:text-destructive px-1"
                        onClick={() => {
                          setImageFile(null);
                          setImagePreview(null);
                          setEditingMenuItem({ ...editingMenuItem, image_url: undefined });
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                      >
                        <X className="h-3 w-3" />
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={editingMenuItem.name}
                  onChange={(e) => setEditingMenuItem({ ...editingMenuItem, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Price (INR)</Label>
                <Input
                  type="number"
                  value={editingMenuItem.price}
                  onChange={(e) => setEditingMenuItem({ ...editingMenuItem, price: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={editingMenuItem.category}
                  onValueChange={(value) => setEditingMenuItem({ ...editingMenuItem, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {menuCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Availability</Label>
                <Select
                  value={editingMenuItem.available ? "true" : "false"}
                  onValueChange={(value) => setEditingMenuItem({ ...editingMenuItem, available: value === "true" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Available</SelectItem>
                    <SelectItem value="false">Unavailable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <Label>Customizations / Variants</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      const newVariants = [...(editingMenuItem.variants || []), { name: "", price: 0 }];
                      setEditingMenuItem({ ...editingMenuItem, variants: newVariants });
                    }}
                  >
                    <Plus className="h-3 w-3" /> Add Option
                  </Button>
                </div>
                {(!editingMenuItem.variants || editingMenuItem.variants.length === 0) ? (
                  <div className="text-[11px] text-muted-foreground p-3 bg-secondary/30 rounded-md border border-border/50 text-center">
                    No customizations added. Click "Add Option" to add variants like sizes or extras.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {editingMenuItem.variants.map((v, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input 
                          placeholder="Option name (e.g. Large)" 
                          className="h-8 text-xs flex-1"
                          value={v.name}
                          onChange={(e) => {
                            const newVariants = [...editingMenuItem.variants!];
                            newVariants[i] = { ...newVariants[i], name: e.target.value };
                            setEditingMenuItem({ ...editingMenuItem, variants: newVariants });
                          }}
                        />
                        <Input 
                          type="number" 
                          placeholder="Price (₹)"
                          className="h-8 text-xs w-24"
                          value={v.price || ""}
                          onChange={(e) => {
                            const newVariants = [...editingMenuItem.variants!];
                            newVariants[i] = { ...newVariants[i], price: Number(e.target.value) };
                            setEditingMenuItem({ ...editingMenuItem, variants: newVariants });
                          }}
                        />
                        <Button 
                          type="button"
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive shrink-0"
                          onClick={() => {
                            const newVariants = editingMenuItem.variants!.filter((_, index) => index !== i);
                            setEditingMenuItem({ ...editingMenuItem, variants: newVariants });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modifier Assignment */}
              {modifiers.length > 0 && (
                <div className="space-y-2 pt-1">
                  <Label className="text-xs font-semibold">Applicable Add-ons</Label>
                  <p className="text-[11px] text-muted-foreground">Select which add-ons customers can choose for this item. Leave all unchecked to show every add-on.</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {modifiers.map((mod) => {
                      const selected = editingMenuItem.modifierIds?.includes(mod.id) ?? false;
                      return (
                        <button
                          key={mod.id}
                          type="button"
                          onClick={() => {
                            const current = editingMenuItem.modifierIds ?? [];
                            const next = selected
                              ? current.filter((id) => id !== mod.id)
                              : [...current, mod.id];
                            setEditingMenuItem({ ...editingMenuItem, modifierIds: next });
                          }}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                            selected
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary"
                          }`}
                        >
                          {mod.name}{mod.price > 0 ? ` +₹${mod.price}` : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingMenuItem(null); setImageFile(null); setImagePreview(null); }}>Cancel</Button>
            <Button onClick={handleSaveMenuItem} disabled={isUploading}>
              {isUploading ? (
                <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Uploading...</>
              ) : (
                editingMenuItem?.id.startsWith("new-") ? "Add Item" : "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modifier Dialog */}
      <Dialog open={!!editingModifier} onOpenChange={() => setEditingModifier(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingModifier?.id.startsWith("new-mod-") ? "Add Modifier" : "Edit Modifier"}</DialogTitle>
          </DialogHeader>
          {editingModifier && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={editingModifier.name}
                  placeholder="e.g. Extra Shot"
                  onChange={(e) => setEditingModifier({ ...editingModifier, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Extra Price (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={editingModifier.price}
                  onChange={(e) => setEditingModifier({ ...editingModifier, price: Number(e.target.value) })}
                />
                <p className="text-[11px] text-muted-foreground">Set to 0 for free add-ons like "Sugar Free" or "Less Ice".</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingModifier(null)}>Cancel</Button>
            <Button onClick={handleSaveModifier}>
              {editingModifier?.id.startsWith("new-mod-") ? "Add Modifier" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={!!editingCategory} onOpenChange={() => setEditingCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory?.id.startsWith("new-") ? "Add Category" : "Edit Category"}</DialogTitle>
          </DialogHeader>
          {editingCategory && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Category Name</Label>
                <Input
                  value={editingCategory.name}
                  placeholder="e.g. Snacks"
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                />
              </div>
              {editingCategory.id.startsWith("new-") && (
                <p className="text-[11px] text-muted-foreground">The ID will be auto-generated from the name (e.g. "Snacks" → "snacks").</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCategory(null)}>Cancel</Button>
            <Button onClick={handleSaveCategory}>
              {editingCategory?.id.startsWith("new-") ? "Add Category" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Table Dialog */}
      <Dialog open={!!editingTable} onOpenChange={() => setEditingTable(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTable?.id.startsWith("new-") ? "Add Table" : "Edit Table"}</DialogTitle>
          </DialogHeader>
          {editingTable && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Table Number</Label>
                <Input
                  type="number"
                  value={editingTable.number}
                  onChange={(e) => setEditingTable({ ...editingTable, number: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Capacity (seats)</Label>
                <Input
                  type="number"
                  value={editingTable.capacity}
                  onChange={(e) => setEditingTable({ ...editingTable, capacity: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editingTable.status}
                  onValueChange={(value) => setEditingTable({ ...editingTable, status: value as TableType["status"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="occupied">Occupied</SelectItem>
                    <SelectItem value="waiting-payment">Waiting Payment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTable(null)}>Cancel</Button>
            <Button onClick={handleSaveTable}>
              {editingTable?.id.startsWith("new-") ? "Add Table" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Staff Dialog */}
      <Dialog open={!!editingStaff} onOpenChange={() => setEditingStaff(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStaff?.id.startsWith("new-") ? "Add Staff Member" : "Edit Staff Member"}</DialogTitle>
          </DialogHeader>
          {editingStaff && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={editingStaff.name}
                  onChange={(e) => setEditingStaff({ ...editingStaff, name: e.target.value, initials: e.target.value.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() })}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={editingStaff.role}
                  onValueChange={(value) => setEditingStaff({ ...editingStaff, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Owner">Owner</SelectItem>
                    <SelectItem value="Manager">Manager</SelectItem>
                    <SelectItem value="Chef">Chef</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>PIN (4 digits)</Label>
                <Input
                  type="password"
                  maxLength={4}
                  value={editingStaff.pin}
                  onChange={(e) => setEditingStaff({ ...editingStaff, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingStaff(null)}>Cancel</Button>
            <Button onClick={handleSaveStaff}>
              {editingStaff?.id.startsWith("new-") ? "Add Staff" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <AlertDialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import Data (Overwrite)</AlertDialogTitle>
            <AlertDialogDescription>
              Paste your exported JSON data below to restore your backup. WARNING: This will overwrite and replace all current data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>JSON Data</Label>
            <textarea
              className="w-full h-48 rounded-lg bg-secondary border-none p-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='{"orders": [], "tables": [], ...}'
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowImportDialog(false);
              setImportText("");
            }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleImport} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Import & Overwrite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {showDeleteConfirm?.type === "menuItem" ? "menu item" : showDeleteConfirm?.type}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the {showDeleteConfirm?.type === "menuItem" ? "menu item" : showDeleteConfirm?.type}
              {showDeleteConfirm?.name ? ` "${showDeleteConfirm.name}"` : ""}
              {showDeleteConfirm?.type === "order" ? " and all associated data" : ""}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel/Void Order Confirmation */}
      <AlertDialog open={showCancelOrderConfirm} onOpenChange={setShowCancelOrderConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to void order {editingOrder?.id.toUpperCase()}. This will mark the order as cancelled and cannot be easily undone. This action will be logged in the audit trail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowCancelOrderConfirm(false)}>Go Back</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCancelOrder} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, Cancel Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Data Confirmation */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset All Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently wipe ALL data across all devices — orders, audit logs, shifts, and more. Tables will reset to default, and default menu items and staff will be restored. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isResetting}
              onClick={async (e) => {
                e.preventDefault();
                setIsResetting(true);
                const toastId = toast.loading("Resetting all data...");
                try {
                  await clearAllData();
                  toast.success("Factory reset complete. Starting fresh.", { id: toastId });
                  setShowClearConfirm(false);
                } catch (err) {
                  console.error("[data-manager] Reset failed:", err);
                  toast.error("Reset failed. Check console for details.", { id: toastId });
                } finally {
                  setIsResetting(false);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isResetting ? "Resetting..." : "Reset Everything"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
