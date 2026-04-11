import { getSupabase } from "./supabase";
import type { Order, OrderItem, Table, MenuItem } from "./data";

// ============================================================
// ORDERS
// ============================================================

export async function fetchOrders(limit = 100): Promise<Order[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("orders")
    .select(`
      *,
      order_items (*),
      supplementary_bills (
        *,
        supplementary_bill_items (*)
      )
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).map(mapDbOrderToLocal);
}

export async function fetchOrdersByStatus(statuses: string[]): Promise<Order[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("orders")
    .select(`*, order_items (*), supplementary_bills (*, supplementary_bill_items (*))`)
    .in("status", statuses)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(mapDbOrderToLocal);
}

export async function fetchOrderById(orderId: string): Promise<Order | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("orders")
    .select(`*, order_items (*), supplementary_bills (*, supplementary_bill_items (*))`)
    .eq("id", orderId)
    .single();

  if (error || !data) return null;
  return mapDbOrderToLocal(data);
}

export async function upsertOrder(order: any): Promise<void> {
  const supabase = getSupabase();
  const { items, supplementaryBills, ...orderData } = order;

  // Upsert the order
  const { error: orderError } = await supabase
    .from("orders")
    .upsert(mapLocalOrderToDb(orderData), { onConflict: "id" });
  if (orderError) throw orderError;

  // Upsert order items
  if (items && items.length > 0) {
    const dbItems = items.map((item: any) => ({
      ...mapLocalItemToDb(item),
      order_id: order.id,
    }));
    const { error: itemsError } = await supabase
      .from("order_items")
      .upsert(dbItems, { onConflict: "id" });
    if (itemsError) throw itemsError;
  }
}

export async function updateOrderInDb(orderId: string, changes: Record<string, any>): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("orders")
    .update(mapLocalOrderToDb(changes))
    .eq("id", orderId);
  if (error) throw error;
}

export async function deleteOrderFromDb(orderId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("orders")
    .delete()
    .eq("id", orderId);
  if (error) throw error;
}

// ============================================================
// TABLES
// ============================================================

export async function fetchTables(): Promise<Table[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("tables")
    .select("*")
    .order("number");
  if (error) throw error;
  return (data || []).map(mapDbTableToLocal);
}

export async function updateTableInDb(tableId: string, changes: Record<string, any>): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("tables")
    .update({
      status: changes.status,
      order_id: changes.orderId || changes.order_id || null,
    })
    .eq("id", tableId);
  if (error) throw error;
}

// ============================================================
// MENU ITEMS
// ============================================================

export async function fetchMenuItems(): Promise<MenuItem[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .order("category")
    .order("name");
  if (error) throw error;
  return (data || []).map(mapDbMenuItemToLocal);
}

// ============================================================
// STAFF
// ============================================================

export async function fetchStaff() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("staff")
    .select("id, name, role, pin, initials, is_active")
    .eq("is_active", true);
  if (error) throw error;
  return data || [];
}

// ============================================================
// SETTINGS
// ============================================================

export async function fetchSettings() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data ? mapDbSettingsToLocal(data) : null;
}

export async function updateSettingsInDb(changes: Record<string, any>): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("settings")
    .update(mapLocalSettingsToDb(changes))
    .not("id", "is", null); // Update the single row
  if (error) throw error;
}

// ============================================================
// AUDIT LOG
// ============================================================

export async function insertAuditEntry(entry: any): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("audit_log")
    .insert({
      id: entry.id,
      action: entry.action,
      user_id: entry.userId,
      details: entry.details,
      order_id: entry.orderId || null,
      metadata: entry.metadata || {},
      created_at: entry.timestamp?.toISOString?.() || new Date().toISOString(),
    });
  if (error) throw error;
}

// ============================================================
// SHIFTS
// ============================================================

export async function upsertShift(shift: any): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("shifts")
    .upsert({
      id: shift.id,
      staff_id: shift.staffId,
      staff_name: shift.staffName,
      started_at: shift.startedAt instanceof Date ? shift.startedAt.toISOString() : shift.startedAt,
      ended_at: shift.endedAt instanceof Date ? shift.endedAt.toISOString() : shift.endedAt || null,
      opening_cash: shift.openingCash,
      closing_cash: shift.closingCash || null,
      total_sales: shift.totalSales || null,
      total_orders: shift.totalOrders || null,
      notes: shift.notes || null,
    }, { onConflict: "id" });
  if (error) throw error;
}

// ============================================================
// REPORTS (PostgreSQL views — server-side analytics)
// ============================================================

export async function fetchDailySales(days = 30) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("v_daily_sales")
    .select("*")
    .limit(days);
  if (error) throw error;
  return (data || []).map((row: any) => ({
    saleDate: row.sale_date,
    totalOrders: Number(row.total_orders),
    totalRevenue: Number(row.total_revenue),
    avgOrderValue: Number(row.avg_order_value),
    cancelledOrders: Number(row.cancelled_orders),
  }));
}

export async function fetchHourlyRevenue(saleDate?: string) {
  const supabase = getSupabase();
  let query = supabase.from("v_hourly_revenue").select("*");
  if (saleDate) {
    query = query.eq("sale_date", saleDate);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row: any) => ({
    saleDate: row.sale_date,
    hour: Number(row.hour),
    revenue: Number(row.revenue),
    orderCount: Number(row.order_count),
  }));
}

export async function fetchPaymentBreakdown(saleDate?: string) {
  const supabase = getSupabase();
  let query = supabase.from("v_payment_breakdown").select("*");
  if (saleDate) {
    query = query.eq("sale_date", saleDate);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row: any) => ({
    saleDate: row.sale_date,
    method: row.method as string,
    count: Number(row.count),
    total: Number(row.total),
  }));
}

export async function fetchTopItems(saleDate?: string, limit = 20) {
  const supabase = getSupabase();
  let query = supabase.from("v_top_items").select("*");
  if (saleDate) {
    query = query.eq("sale_date", saleDate);
  }
  const { data, error } = await query.limit(limit);
  if (error) throw error;
  return (data || []).map((row: any) => ({
    name: row.name as string,
    menuItemId: row.menu_item_id as string,
    saleDate: row.sale_date,
    totalQuantity: Number(row.total_quantity),
    totalRevenue: Number(row.total_revenue),
  }));
}

export async function fetchStaffPerformance(saleDate?: string) {
  const supabase = getSupabase();
  let query = supabase.from("v_staff_performance").select("*");
  if (saleDate) {
    query = query.eq("sale_date", saleDate);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row: any) => ({
    saleDate: row.sale_date,
    staffName: row.staff_name as string,
    ordersCreated: Number(row.orders_created),
    ordersCompleted: Number(row.orders_completed),
    totalRevenue: Number(row.total_revenue),
  }));
}

// ============================================================
// MENU ITEM IMAGE UPLOAD (Supabase Storage)
// ============================================================

export async function uploadMenuImage(file: File, fileName: string): Promise<string> {
  const supabase = getSupabase();
  const path = `menu/${fileName}`;

  const { error } = await supabase.storage
    .from("menu-images")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });
  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from("menu-images")
    .getPublicUrl(path);

  return urlData.publicUrl;
}

export async function deleteMenuImage(path: string): Promise<void> {
  const supabase = getSupabase();
  // Extract path from full URL if needed
  const storagePath = path.includes("menu-images/")
    ? path.split("menu-images/")[1]
    : path;

  const { error } = await supabase.storage
    .from("menu-images")
    .remove([storagePath]);
  if (error) throw error;
}

// ============================================================
// NUCLEAR RESET — wipe ALL data from Supabase
// ============================================================

export async function nukeAllData(): Promise<void> {
  const supabase = getSupabase();

  // Verify we have an active session (RLS requires authenticated role)
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("No active session — cannot wipe Supabase data without authentication");
  }

  // Delete in order respecting foreign key constraints.
  // .not("id", "is", null) is the standard PostgREST pattern to match ALL rows.
  // Using console.warn (not .error) to avoid triggering Next.js dev overlay.

  // 1. supplementary_bill_items (FK → supplementary_bills)
  const { error: e1 } = await supabase.from("supplementary_bill_items").delete().not("id", "is", null);
  if (e1) console.warn("[nuke] supplementary_bill_items:", e1.message);

  // 2. supplementary_bills (FK → orders)
  const { error: e2 } = await supabase.from("supplementary_bills").delete().not("id", "is", null);
  if (e2) console.warn("[nuke] supplementary_bills:", e2.message);

  // 3. order_items (FK → orders)
  const { error: e3 } = await supabase.from("order_items").delete().not("id", "is", null);
  if (e3) console.warn("[nuke] order_items:", e3.message);

  // 4. orders
  const { error: e4 } = await supabase.from("orders").delete().not("id", "is", null);
  if (e4) console.warn("[nuke] orders:", e4.message);

  // 5. audit_log
  const { error: e5 } = await supabase.from("audit_log").delete().not("id", "is", null);
  if (e5) console.warn("[nuke] audit_log:", e5.message);

  // 6. shifts
  const { error: e6 } = await supabase.from("shifts").delete().not("id", "is", null);
  if (e6) console.warn("[nuke] shifts:", e6.message);

  // 7. Reset all tables to available, clear order_id
  const { error: e7 } = await supabase
    .from("tables")
    .update({ status: "available", order_id: null })
    .not("id", "is", null);
  if (e7) console.warn("[nuke] tables reset:", e7.message);

  console.log("[nuke] All Supabase data wiped.");
}

// ============================================================
// MAPPERS: DB (snake_case) ↔ Local (camelCase)
// ============================================================

function mapDbOrderToLocal(db: any): Order {
  return {
    id: db.id,
    type: db.type,
    status: db.status,
    tableId: db.table_id,
    items: (db.order_items || []).map(mapDbItemToLocal),
    supplementaryBills: (db.supplementary_bills || []).map((sb: any) => ({
      id: sb.id,
      items: (sb.supplementary_bill_items || []).map(mapDbItemToLocal),
      total: Number(sb.total),
      createdAt: new Date(sb.created_at),
      paidAt: sb.paid_at ? new Date(sb.paid_at) : undefined,
      payment: sb.payment || undefined,
    })),
    total: Number(db.total),
    createdAt: new Date(db.created_at),
    customerName: db.customer_name,
    orderNotes: db.order_notes,
    platform: db.platform,
    payment: db.payment || undefined,
    subtotal: db.subtotal ? Number(db.subtotal) : undefined,
    discount: db.discount_type ? {
      type: db.discount_type,
      value: Number(db.discount_value),
      amount: Number(db.discount_amount),
    } : undefined,
    taxRate: db.tax_rate ? Number(db.tax_rate) : undefined,
    taxAmount: db.tax_amount ? Number(db.tax_amount) : undefined,
    grandTotal: db.grand_total ? Number(db.grand_total) : undefined,
    paidAt: db.paid_at ? new Date(db.paid_at) : undefined,
    paidBy: db.paid_by,
    refund: db.refund || undefined,
    createdBy: db.created_by,
    payLater: db.pay_later || false,
  };
}

function mapDbItemToLocal(db: any): OrderItem {
  return {
    id: db.id,
    menuItemId: db.menu_item_id,
    name: db.name,
    price: Number(db.price),
    quantity: db.quantity,
    variant: db.variant,
    notes: db.notes,
    modifiers: db.modifiers || [],
  };
}

function mapLocalOrderToDb(order: any) {
  const mapped: any = {};
  if (order.id !== undefined) mapped.id = order.id;
  if (order.type !== undefined) mapped.type = order.type;
  if (order.status !== undefined) mapped.status = order.status;
  if (order.tableId !== undefined) mapped.table_id = order.tableId;
  if (order.total !== undefined) mapped.total = order.total;
  if (order.customerName !== undefined) mapped.customer_name = order.customerName;
  if (order.orderNotes !== undefined) mapped.order_notes = order.orderNotes;
  if (order.platform !== undefined) mapped.platform = order.platform;
  if (order.subtotal !== undefined) mapped.subtotal = order.subtotal;
  if (order.discount !== undefined) {
    mapped.discount_type = order.discount?.type;
    mapped.discount_value = order.discount?.value;
    mapped.discount_amount = order.discount?.amount;
  }
  if (order.taxRate !== undefined) mapped.tax_rate = order.taxRate;
  if (order.taxAmount !== undefined) mapped.tax_amount = order.taxAmount;
  if (order.grandTotal !== undefined) mapped.grand_total = order.grandTotal;
  if (order.payment !== undefined) mapped.payment = order.payment;
  if (order.paidAt !== undefined) mapped.paid_at = order.paidAt instanceof Date ? order.paidAt.toISOString() : order.paidAt;
  if (order.paidBy !== undefined) mapped.paid_by = order.paidBy;
  if (order.refund !== undefined) mapped.refund = order.refund;
  if (order.createdBy !== undefined) mapped.created_by = order.createdBy;
  if (order.createdAt !== undefined) mapped.created_at = order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt;
  if (order.payLater !== undefined) mapped.pay_later = order.payLater;
  return mapped;
}

function mapLocalItemToDb(item: any) {
  return {
    id: item.id,
    menu_item_id: item.menuItemId,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    variant: item.variant || null,
    notes: item.notes || null,
    modifiers: item.modifiers || [],
  };
}

function mapDbTableToLocal(db: any): Table {
  return {
    id: db.id,
    number: db.number,
    capacity: db.capacity,
    status: db.status,
    orderId: db.order_id,
  };
}

function mapDbMenuItemToLocal(db: any): MenuItem {
  return {
    id: db.id,
    name: db.name,
    price: Number(db.price),
    category: db.category,
    variants: db.variants || [],
    available: db.available,
    image_url: db.image_url,
    bestseller: db.bestseller,
  };
}

function mapDbSettingsToLocal(db: any) {
  return {
    cafeName: db.cafe_name,
    gstNumber: db.gst_number,
    address: db.address,
    taxRate: Number(db.tax_rate),
    gstEnabled: db.gst_enabled,
    upiId: db.upi_id,
    orderAlerts: db.order_alerts,
    kitchenReadyAlerts: db.kitchen_ready_alerts,
    autoPrintKot: db.auto_print_kot,
    printCustomerCopy: db.print_customer_copy,
    sessionTimeoutMinutes: db.session_timeout_minutes,
  };
}

function mapLocalSettingsToDb(settings: any) {
  const mapped: any = {};
  if (settings.cafeName !== undefined) mapped.cafe_name = settings.cafeName;
  if (settings.gstNumber !== undefined) mapped.gst_number = settings.gstNumber;
  if (settings.address !== undefined) mapped.address = settings.address;
  if (settings.taxRate !== undefined) mapped.tax_rate = settings.taxRate;
  if (settings.gstEnabled !== undefined) mapped.gst_enabled = settings.gstEnabled;
  if (settings.upiId !== undefined) mapped.upi_id = settings.upiId;
  if (settings.orderAlerts !== undefined) mapped.order_alerts = settings.orderAlerts;
  if (settings.kitchenReadyAlerts !== undefined) mapped.kitchen_ready_alerts = settings.kitchenReadyAlerts;
  if (settings.autoPrintKot !== undefined) mapped.auto_print_kot = settings.autoPrintKot;
  if (settings.printCustomerCopy !== undefined) mapped.print_customer_copy = settings.printCustomerCopy;
  if (settings.sessionTimeoutMinutes !== undefined) mapped.session_timeout_minutes = settings.sessionTimeoutMinutes;
  return mapped;
}
