import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Order, OrderItem, OrderType, OrderStatus, Table, MenuItem, Modifier, AuditEntry, Shift, QueuedMutation, MutationKind, Category } from "./data";
import { tables as initialTables, menuItems as defaultMenuItems, defaultModifiers, defaultCategories } from "./data";
import { getDefaultView, canAccessView, type ViewId } from "./roles";
import { writeMutationToIDB, removeMutationFromIDB } from "./sync-idb";

// Version to force refresh when data structure changes
const STORE_VERSION = 21;

interface CartItem extends Omit<OrderItem, "id"> {
  tempId: string;
  originalItemId?: string;
  origin?: "main" | "supp";
  supplementaryBillId?: string;
  supplementaryBillPaid?: boolean;
}

interface User {
  name: string;
  role: string;
  pin: string;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
  pin: string;
  initials: string;
}

export interface PrinterConfig {
  id: string;
  name: string;           // e.g. "Receipt Printer", "Kitchen KOT Printer"
  type: "receipt" | "kot"; // purpose
  connectionType: "browser" | "network" | "bluetooth" | "usb";
  // Network printer settings
  ipAddress?: string;
  port?: number;
  // Bluetooth device name (for re-pairing hint)
  bluetoothDeviceName?: string;
  // USB vendor/product IDs (stored after first pairing)
  usbVendorId?: number;
  usbProductId?: number;
  // Paper width
  paperWidth: 58 | 80;    // mm
  enabled: boolean;
}

interface CafeSettings {
  cafeName: string;
  gstNumber: string;
  address: string;
  taxRate: number;          // stored as percentage (e.g. 5 means 5%)
  gstEnabled: boolean;
  upiId: string;            // for UPI QR generation later (Task 5)
  orderAlerts: boolean;
  kitchenReadyAlerts: boolean;
  autoPrintKot: boolean;
  printCustomerCopy: boolean;
  sessionTimeoutMinutes: number;  // for Task 14
  cashEnabled: boolean;
  upiEnabled: boolean;
  cardEnabled: boolean;
  upiQrCodeUrl?: string;
  installPromptDismissed?: boolean;
  printers: PrinterConfig[];
}

interface POSState {
  // Auth
  isLoggedIn: boolean;
  currentUser: User | null;
  staffMembers: StaffMember[];
  login: (user: User) => void;
  restoreSession: (user: User) => void;
  logout: () => void;
  addStaffMember: (staff: StaffMember) => void;
  updateStaffMember: (id: string, staff: Partial<StaffMember>) => void;
  deleteStaffMember: (id: string) => void;

  // Navigation
  activeView: "dashboard" | "orders" | "tables" | "kitchen" | "reports" | "settings" | "billing" | "history";
  setActiveView: (view: POSState["activeView"]) => void;

  // Settings
  settings: CafeSettings;
  updateSettings: (settings: Partial<CafeSettings>) => void;
  addPrinter: (printer: PrinterConfig) => void;
  updatePrinter: (id: string, data: Partial<PrinterConfig>) => void;
  deletePrinter: (id: string) => void;

  // Cart
  cart: CartItem[];
  orderType: OrderType;
  selectedTable: string | null;
  customerName: string;
  customerPhone: string;
  orderNotes: string;
  editingOrderId: string | null;
  editMode: "none" | "pre-payment" | "supplementary";
  lockedItemIds: string[];
  addToCart: (item: Omit<CartItem, "tempId">) => void;
  adminRemoveLockedItem: (orderId: string, itemId: string) => void;
  removeFromCart: (tempId: string) => void;
  updateQuantity: (tempId: string, quantity: number) => void;
  updateItemNotes: (tempId: string, notes: string) => void;
  updateItemVariant: (tempId: string, variant: string) => void;
  clearCart: () => void;
  setOrderType: (type: OrderType) => void;
  setSelectedTable: (tableId: string | null) => void;
  setCustomerName: (name: string) => void;
  setCustomerPhone: (phone: string) => void;
  setOrderNotes: (notes: string) => void;
  startEditOrder: (orderId: string) => void;
  saveEditOrder: () => void;
  cancelEditOrder: () => void;

  // Menu Categories
  menuCategories: Category[];
  addMenuCategory: (cat: Category) => void;
  updateMenuCategory: (id: string, data: Partial<Category>) => void;
  deleteMenuCategory: (id: string) => void;

  // Menu Items
  menuItems: MenuItem[];
  addMenuItem: (item: MenuItem) => void;
  updateMenuItem: (id: string, item: Partial<MenuItem>) => void;
  deleteMenuItem: (id: string) => void;

  // Modifiers (add-ons)
  modifiers: Modifier[];
  addModifier: (mod: Modifier) => void;
  updateModifier: (id: string, data: Partial<Modifier>) => void;
  deleteModifier: (id: string) => void;

  // Orders
  pendingBillingOrderId: string | null;
  setPendingBillingOrderId: (id: string | null) => void;
  orders: Order[];
  addOrder: (order: Omit<Order, "id" | "createdAt">, opts?: { initialStatus?: OrderStatus; skipTableLock?: boolean }) => string;
  updateOrder: (orderId: string, data: Partial<Order>, opts?: { skipDirectWrite?: boolean }) => void;
  updateOrderStatus: (orderId: string, status: Order["status"]) => void;
  deleteOrder: (orderId: string) => void;
  confirmPaymentAndSendToKitchen: (orderId: string, payment: import("./data").PaymentRecord) => void;
  sendToKitchenPayLater: (orderId: string) => void;
  confirmPaymentForServedOrder: (orderId: string, payment: import("./data").PaymentRecord) => void;
  cancelAwaitingPaymentOrder: (orderId: string, reason?: string) => void;
  cancelPlacedOrder: (orderId: string, reason?: string) => void;
  markOrderServed: (orderId: string) => void;

  // Tables
  tables: Table[];
  addTable: (table: Table) => void;
  updateTable: (tableId: string, data: Partial<Table>) => void;
  updateTableStatus: (tableId: string, status: Table["status"], orderId?: string) => void;
  deleteTable: (tableId: string) => void;
  mergeTable: (sourceTableId: string, targetTableId: string) => void;
  splitOrder: (orderId: string, itemIdsForNewOrder: string[]) => void;
  moveTable: (orderId: string, newTableId: string) => void;

  // Data Management
  clearAllData: () => Promise<void>;
  exportData: () => string;
  importData: (data: string) => boolean;

  // Audit Log
  auditLog: AuditEntry[];
  addAuditEntry: (entry: Omit<AuditEntry, "id" | "timestamp">) => void;

  // Sync / Offline Queue
  syncQueue: QueuedMutation[];
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  supabaseEnabled: boolean;
  enqueueMutation: (kind: MutationKind, payload: Record<string, unknown>) => string;
  markMutationSynced: (id: string) => void;
  markMutationFailed: (id: string, error: string) => void;
  clearSyncedMutations: () => void;

  // Cart Total
  getCartTotal: () => number;

  // Shift Tracking
  shifts: Shift[];
  currentShift: Shift | null;
  startShift: (staffId: string, staffName: string, openingCash: number) => void;
  endShift: (closingCash: number, notes?: string) => void;
}

const defaultStaffMembers: StaffMember[] = [
  { id: "065006fd-d23b-46ed-8600-9584e31bf251", name: "Admin",         role: "Owner",   pin: "1234", initials: "AD" },
  { id: "8a93ab58-a358-46c5-9c79-396370e4fd17", name: "Barista",       role: "Manager", pin: "1234", initials: "BA" },
  { id: "3670c7e0-26bd-48fe-8941-397707be9ed8", name: "Kitchen Chief", role: "Chef",    pin: "1234", initials: "KC" },
];

const defaultSettings: CafeSettings = {
  cafeName: "SUHASHI Cafe",
  gstNumber: "27AABCT1234F1ZH",
  address: "",
  taxRate: 5,
  gstEnabled: true,
  upiId: "cafe@upi",
  orderAlerts: true,
  kitchenReadyAlerts: true,
  autoPrintKot: true,
  printCustomerCopy: true,
  sessionTimeoutMinutes: 30,
  cashEnabled: true,
  upiEnabled: true,
  cardEnabled: true,
  upiQrCodeUrl: "",
  installPromptDismissed: false,
  printers: [],
};

export const usePOSStore = create<POSState>()(
  persist(
    (set, get) => ({
      // Audit Log
      auditLog: [],
      addAuditEntry: (entry) => {
        const fullEntry = {
          ...entry,
          id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date()
        };
        set((state) => ({
          auditLog: [fullEntry, ...state.auditLog]
        }));
        // Use timeout to prevent getting undefined `enqueueMutation` during initial store setup 
        setTimeout(() => get().enqueueMutation("audit.append", { entry: fullEntry }), 0);
      },

      // Sync Queue
      syncQueue: [],
      isOnline: true,
      isSyncing: false,
      lastSyncedAt: null,
      supabaseEnabled: false,

      enqueueMutation: (kind, payload) => {
        const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `mut-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const mutation: QueuedMutation = {
          id,
          kind,
          payload,
          createdAt: new Date().toISOString(),
          attempts: 0,
          status: "pending"
        };
        set((state) => ({
          syncQueue: [...state.syncQueue, mutation]
        }));
        
        // Mirror to IndexedDB for Background Sync (SW can replay even without an open page)
        if (typeof window !== "undefined" && typeof indexedDB !== "undefined") {
          writeMutationToIDB({ id, kind, payload, createdAt: mutation.createdAt }).catch(console.error);
        }

        if (typeof window !== "undefined" && "serviceWorker" in navigator && "SyncManager" in window) {
          navigator.serviceWorker.ready.then((reg: any) => {
            if (reg.sync) reg.sync.register("sync-mutations").catch(console.error);
          });
        }
        return id;
      },
      markMutationSynced: (id) => {
        set((state) => ({
          syncQueue: state.syncQueue.map((m) =>
            m.id === id ? { ...m, status: "synced" as const } : m
          )
        }));
        // Remove from IndexedDB since it's been synced
        if (typeof window !== "undefined" && typeof indexedDB !== "undefined") {
          removeMutationFromIDB(id).catch(console.error);
        }
      },
      markMutationFailed: (id, error) => {
        set((state) => ({
          syncQueue: state.syncQueue.map((m) =>
            m.id === id ? { ...m, status: "failed" as const, lastError: error, attempts: m.attempts + 1, lastAttemptAt: new Date().toISOString() } : m
          )
        }));
      },
      clearSyncedMutations: () => {
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        set((state) => ({
          syncQueue: state.syncQueue.filter((m) =>
            m.status !== "synced" || new Date(m.createdAt) >= oneDayAgo
          )
        }));
      },

      // Auth
      isLoggedIn: false,
      currentUser: null,
      staffMembers: defaultStaffMembers,
      login: (user) => {
        set({
          isLoggedIn: true,
          currentUser: user,
          activeView: getDefaultView(user.role) as POSState["activeView"],
        });
        get().addAuditEntry({ action: "login", userId: user.name, details: `${user.name} logged in` });
      },
      restoreSession: (user) => {
        // Reload-path login: no audit entry, no shift side effects.
        // Validate the rehydrated activeView against the user's role; if the
        // persisted view isn't accessible (or is missing), fall back to the
        // role's default landing view.
        const persistedView = get().activeView;
        const safeView = canAccessView(user.role, persistedView as ViewId)
          ? persistedView
          : (getDefaultView(user.role) as POSState["activeView"]);
        set({
          isLoggedIn: true,
          currentUser: user,
          activeView: safeView,
        });
      },
      logout: () => {
        const userName = get().currentUser?.name || "Unknown";
        set({ isLoggedIn: false, currentUser: null, activeView: "dashboard" });
        get().addAuditEntry({ action: "logout", userId: userName, details: `${userName} logged out` });

        // Clear session-scoped caches and revoke the Supabase session.
        // Dynamic import avoids a circular dep between store.ts and auth.ts.
        if (typeof window !== "undefined") {
          import("./auth").then(({ logoutFromSupabase, clearCachedCurrentUser }) => {
            clearCachedCurrentUser();
            logoutFromSupabase().catch(() => {});
          });
        }
      },
      addStaffMember: (staff) => {
        set((state) => ({ staffMembers: [...state.staffMembers, staff] }));
        const mutId = get().enqueueMutation("staff.upsert", { staff });
        if (typeof window !== "undefined") {
          import("./supabase-queries").then(({ upsertStaff }) => upsertStaff(staff).then(() => get().markMutationSynced(mutId))).catch(console.error);
        }
        get().addAuditEntry({ action: "staff_added", userId: get().currentUser?.name || "System", details: `Staff member ${staff.name} added` });
      },
      updateStaffMember: (id, data) => {
        set((state) => ({
          staffMembers: state.staffMembers.map((s) => s.id === id ? { ...s, ...data } : s)
        }));
        const updatedStaff = get().staffMembers.find((s) => s.id === id);
        if (updatedStaff) {
          const mutId = get().enqueueMutation("staff.upsert", { staff: updatedStaff });
          if (typeof window !== "undefined") {
            import("./supabase-queries").then(({ upsertStaff }) => upsertStaff(updatedStaff).then(() => get().markMutationSynced(mutId))).catch(console.error);
          }
        }
      },
      deleteStaffMember: (id) => {
        const staff = get().staffMembers.find((s) => s.id === id);
        set((state) => ({
          staffMembers: state.staffMembers.filter((s) => s.id !== id)
        }));
        const mutId = get().enqueueMutation("staff.delete", { id });
        if (typeof window !== "undefined") {
          import("./supabase-queries").then(({ deleteStaff }) => deleteStaff(id).then(() => get().markMutationSynced(mutId))).catch(console.error);
        }
        if (staff) {
          get().addAuditEntry({ action: "staff_deleted", userId: get().currentUser?.name || "System", details: `Staff member ${staff.name} deleted` });
        }
      },

      // Navigation
      activeView: "dashboard",
      setActiveView: (view) => set({ activeView: view }),

      // Settings
      settings: defaultSettings,
      updateSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings }
        }));
        
        // Push settings update to Supabase
        const finalSettings = get().settings;
        setTimeout(() => get().enqueueMutation("settings.update", { changes: finalSettings }), 0);

        get().addAuditEntry({ action: "settings_changed", userId: get().currentUser?.name || "System", details: "Settings updated" });
      },

      addPrinter: (printer) => {
        set((state) => ({
          settings: { ...state.settings, printers: [...state.settings.printers, printer] }
        }));
        const finalSettings = get().settings;
        setTimeout(() => get().enqueueMutation("settings.update", { changes: finalSettings }), 0);
        get().addAuditEntry({ action: "settings_changed", userId: get().currentUser?.name || "System", details: `Printer "${printer.name}" added (${printer.connectionType})` });
      },

      updatePrinter: (id, data) => {
        set((state) => ({
          settings: {
            ...state.settings,
            printers: state.settings.printers.map((p) => p.id === id ? { ...p, ...data } : p)
          }
        }));
        const finalSettings = get().settings;
        setTimeout(() => get().enqueueMutation("settings.update", { changes: finalSettings }), 0);
      },

      deletePrinter: (id) => {
        const printer = get().settings.printers.find((p) => p.id === id);
        set((state) => ({
          settings: {
            ...state.settings,
            printers: state.settings.printers.filter((p) => p.id !== id)
          }
        }));
        const finalSettings = get().settings;
        setTimeout(() => get().enqueueMutation("settings.update", { changes: finalSettings }), 0);
        if (printer) {
          get().addAuditEntry({ action: "settings_changed", userId: get().currentUser?.name || "System", details: `Printer "${printer.name}" removed` });
        }
      },

      // Cart
      cart: [],
      orderType: "dine-in",
      selectedTable: null,
      customerName: "",
      customerPhone: "",
      orderNotes: "",
      editingOrderId: null,
      editMode: "none",
      lockedItemIds: [],

      addToCart: (item) => {
        const tempId = `cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        set((state) => ({
          cart: [...state.cart, { ...item, tempId }],
        }));
      },

      adminRemoveLockedItem: (orderId, itemId) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order || get().currentUser?.role !== "Owner") return;

        const itemToRemove = order.items.find((i) => i.id === itemId);
        if (!itemToRemove) return;

        const modsTotal = itemToRemove.modifiers?.reduce((s, m) => s + m.price, 0) || 0;
        const refundAmount = (itemToRemove.price + modsTotal) * itemToRemove.quantity;

        const updatedItems = order.items.filter((i) => i.id !== itemId);
        const newTotal = order.total - refundAmount;

        const existingRefundAmount = order.refund?.amount || 0;

        set((state) => ({
            orders: state.orders.map((o) => {
                if (o.id === orderId) {
                    return {
                        ...o,
                        items: updatedItems,
                        total: newTotal,
                        refund: {
                           amount: existingRefundAmount + refundAmount,
                           reason: `Owner force removed ${itemToRemove.name}`,
                           refundedAt: new Date(),
                           refundedBy: get().currentUser?.name || "System"
                        }
                    };
                }
                return o;
            })
        }));

        get().addAuditEntry({
            action: "refund",
            userId: get().currentUser?.name || "System",
            details: `Owner forced removed ${itemToRemove.name}`,
            orderId,
            metadata: { reason: "admin_force_remove", itemId, amount: refundAmount }
        });

        if (get().editingOrderId === orderId) {
            set((state) => ({
               cart: state.cart.filter(c => c.originalItemId !== itemId),
               lockedItemIds: state.lockedItemIds.filter(id => id !== itemId)
            }));
        }
      },

      removeFromCart: (tempId) => {
        set((state) => ({
          cart: state.cart.filter((item) => item.tempId !== tempId),
        }));
      },

      updateQuantity: (tempId, quantity) => {
        if (quantity < 1) {
          get().removeFromCart(tempId);
          return;
        }
        set((state) => ({
          cart: state.cart.map((item) =>
            item.tempId === tempId ? { ...item, quantity } : item
          ),
        }));
      },

      updateItemNotes: (tempId, notes) => {
        set((state) => ({
          cart: state.cart.map((item) =>
            item.tempId === tempId ? { ...item, notes } : item
          ),
        }));
      },

      updateItemVariant: (tempId, variant) => {
        set((state) => ({
          cart: state.cart.map((item) =>
            item.tempId === tempId ? { ...item, variant } : item
          ),
        }));
      },

      clearCart: () => set({ cart: [], selectedTable: null, customerName: "", customerPhone: "", orderNotes: "", editingOrderId: null, editMode: "none", lockedItemIds: [] }),

      startEditOrder: (orderId) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order || order.status === "completed" || order.status === "cancelled") return;

        let editMode: POSState["editMode"] = "pre-payment";
        let lockedItemIds: string[] = [];

        if (order.status === "new" || order.status === "preparing" || order.status === "ready") {
          editMode = "supplementary";
          // Only PAID supplementary bill items stay locked (they're sealed transactions
          // with their own payment record). Main paid items are editable — any net
          // reduction produces a refund, any net increase is added to the balance-due bill.
          lockedItemIds = [
            ...(order.supplementaryBills || [])
              .filter((b) => !!b.payment)
              .flatMap((b) => b.items.map((i) => i.id)),
          ];
        }

        // Load main order items into cart
        const cartItems: CartItem[] = order.items.map((item) => ({
          tempId: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          menuItemId: item.menuItemId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          variant: item.variant,
          notes: item.notes,
          modifiers: item.modifiers,
          originalItemId: editMode === "supplementary" ? item.id : undefined,
          origin: "main" as const,
        }));

        // Load supplementary bill items into cart (only in supplementary mode)
        if (editMode === "supplementary" && order.supplementaryBills) {
          for (const bill of order.supplementaryBills) {
            for (const item of bill.items) {
              cartItems.push({
                tempId: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                menuItemId: item.menuItemId,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                variant: item.variant,
                notes: item.notes,
                modifiers: item.modifiers,
                originalItemId: item.id,
                origin: "supp" as const,
                supplementaryBillId: bill.id,
                supplementaryBillPaid: !!bill.payment,
              });
            }
          }
        }

        set({
          editingOrderId: orderId,
          cart: cartItems,
          orderType: order.type,
          selectedTable: order.tableId || null,
          customerName: order.customerName || "",
          customerPhone: order.customerPhone || "",
          orderNotes: order.orderNotes || "",
          activeView: "orders",
          editMode,
          lockedItemIds,
        });
      },

      saveEditOrder: () => {
        const { editingOrderId, cart, orderType, selectedTable, customerName, customerPhone, orderNotes, editMode, lockedItemIds } = get();
        if (!editingOrderId) return;
        // In supplementary mode, cart always has locked items; only bail if truly empty in pre-payment mode
        if (cart.length === 0 && editMode !== "supplementary") return;

        const oldOrder = get().orders.find((o) => o.id === editingOrderId);
        if (!oldOrder) return;

        if (editMode === "supplementary") {
          // === DIFF LOGIC: compare cart vs order's current supp bills ===

          // Helper to compute item total
          const calcTotal = (items: { price: number; quantity: number; modifiers?: { price: number }[] }[]) =>
            items.reduce((sum, item) => {
              const modsTotal = item.modifiers?.reduce((s, m) => s + m.price, 0) || 0;
              return sum + (item.price + modsTotal) * item.quantity;
            }, 0);

          // Helper to check if two items differ
          const itemsDiffer = (a: any, b: any) =>
            a.quantity !== b.quantity ||
            a.price !== b.price ||
            (a.variant || "") !== (b.variant || "") ||
            (a.notes || "") !== (b.notes || "") ||
            JSON.stringify(a.modifiers || []) !== JSON.stringify(b.modifiers || []);

          const existingBills = oldOrder.supplementaryBills || [];

          // 1. Collect new items (no originalItemId = brand new additions)
          const brandNewItems = cart.filter((c) => !c.originalItemId);

          // 2. Group current cart supp items by bill ID
          const cartSuppByBill = new Map<string, typeof cart>();
          for (const c of cart) {
            if (c.origin === "supp" && c.supplementaryBillId) {
              if (!cartSuppByBill.has(c.supplementaryBillId)) {
                cartSuppByBill.set(c.supplementaryBillId, []);
              }
              cartSuppByBill.get(c.supplementaryBillId)!.push(c);
            }
          }

          // 3. Diff each existing unpaid bill
          const billUpdates: { billId: string; items: OrderItem[]; total: number }[] = [];
          const billDeletes: string[] = [];
          const auditChanges: { added: string[]; removed: string[]; modified: string[] } = { added: [], removed: [], modified: [] };

          for (const bill of existingBills) {
            if (bill.payment) continue; // paid bills are untouchable

            const currentItems = cartSuppByBill.get(bill.id) || [];

            if (currentItems.length === 0) {
              // All items in this unpaid bill were removed → delete the bill
              billDeletes.push(bill.id);
              for (const item of bill.items) auditChanges.removed.push(item.name);
              continue;
            }

            // Check if anything changed in this bill
            let billChanged = currentItems.length !== bill.items.length;
            if (!billChanged) {
              for (const ci of currentItems) {
                const orig = bill.items.find((i) => i.id === ci.originalItemId);
                if (!orig || itemsDiffer(ci, orig)) { billChanged = true; break; }
              }
            }

            if (billChanged) {
              const updatedItems: OrderItem[] = currentItems.map((ci, idx) => ({
                id: ci.originalItemId || `oi-${Date.now()}-supp-${idx}`,
                menuItemId: ci.menuItemId,
                name: ci.name,
                price: ci.price,
                quantity: ci.quantity,
                variant: ci.variant,
                notes: ci.notes,
                modifiers: ci.modifiers,
              }));
              billUpdates.push({ billId: bill.id, items: updatedItems, total: calcTotal(updatedItems) });

              for (const ci of currentItems) {
                const orig = bill.items.find((i) => i.id === ci.originalItemId);
                if (orig && itemsDiffer(ci, orig)) auditChanges.modified.push(ci.name);
              }
              for (const r of bill.items.filter((orig) => !currentItems.some((ci) => ci.originalItemId === orig.id))) {
                auditChanges.removed.push(r.name);
              }
            }
          }

          // 4. Build new supp bill for brand-new items.
          //    UX unification: if there's already an UNPAID supp bill, APPEND the
          //    new items to it instead of creating a 2nd unpaid bill. This keeps
          //    the order at most ONE "balance due" surface in billing + edit views.
          let newBill: { id: string; items: OrderItem[]; total: number; createdAt: Date } | null = null;
          let mergedBillUpdate: { billId: string; items: OrderItem[]; total: number } | null = null;
          if (brandNewItems.length > 0) {
            const newItems = brandNewItems.map((item, index) => ({
              id: `oi-${Date.now()}-${index}`,
              menuItemId: item.menuItemId,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              variant: item.variant,
              notes: item.notes,
              modifiers: item.modifiers,
            }));
            for (const ni of newItems) auditChanges.added.push(ni.name);

            // Find an existing unpaid bill that we're KEEPING (not in billDeletes)
            // and that we haven't already queued for full-replacement. Priority:
            // (1) a bill in billUpdates (merge with its new items), else
            // (2) any other unpaid bill that survived unchanged.
            const keptUpdate = billUpdates.find((u) => !billDeletes.includes(u.billId));
            const keptUnchangedBill = existingBills.find(
              (b) => !b.payment && !billDeletes.includes(b.id) && !billUpdates.some((u) => u.billId === b.id)
            );

            if (keptUpdate) {
              const combined = [...keptUpdate.items, ...newItems];
              keptUpdate.items = combined;
              keptUpdate.total = calcTotal(combined);
            } else if (keptUnchangedBill) {
              const combined = [...keptUnchangedBill.items, ...newItems];
              mergedBillUpdate = {
                billId: keptUnchangedBill.id,
                items: combined,
                total: calcTotal(combined),
              };
              billUpdates.push(mergedBillUpdate);
            } else {
              newBill = {
                id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `bill-${Date.now()}`,
                items: newItems,
                total: calcTotal(newItems),
                createdAt: new Date(),
              };
            }
          }

          // 4b. MAIN-ITEM DIFF — paid main items are now editable.
          //     Net reduction → accumulate refund on order.refund.
          //     Net increase → inject "Order Adjustment" into the balance-due bill.
          //     Order.items + order.total are replaced to mirror the cart.
          const mainCartItems = cart.filter((c) => c.origin === "main");
          const newMainItems: OrderItem[] = mainCartItems.map((ci, idx) => ({
            id: ci.originalItemId || `oi-${Date.now()}-main-${idx}`,
            menuItemId: ci.menuItemId,
            name: ci.name,
            price: ci.price,
            quantity: ci.quantity,
            variant: ci.variant,
            notes: ci.notes,
            modifiers: ci.modifiers,
          }));
          const oldMainItems = oldOrder.items;
          const oldMainTotal = calcTotal(oldMainItems);
          const newMainTotal = calcTotal(newMainItems);
          let mainChanged = oldMainItems.length !== newMainItems.length;
          if (!mainChanged) {
            for (const orig of oldMainItems) {
              const now = newMainItems.find((n) => n.id === orig.id);
              if (!now || itemsDiffer(now, orig)) { mainChanged = true; break; }
            }
          }

          let updatedMainItems: OrderItem[] | null = null;
          let updatedOrderTotal: number | null = null;
          let accumulatedRefund: any = null;
          let refundDelta = 0;
          let upchargeAmount = 0;

          if (mainChanged) {
            updatedMainItems = newMainItems;
            updatedOrderTotal = newMainTotal;

            for (const orig of oldMainItems) {
              const now = newMainItems.find((n) => n.id === orig.id);
              if (!now) auditChanges.removed.push(orig.name);
              else if (itemsDiffer(now, orig)) auditChanges.modified.push(now.name);
            }

            const delta = oldMainTotal - newMainTotal;
            if (delta > 0.001) {
              refundDelta = delta;
              const existing = oldOrder.refund;
              accumulatedRefund = {
                amount: (existing?.amount || 0) + delta,
                reason: existing?.reason
                  ? `${existing.reason}; Item edit refund`
                  : "Order items edited — refund for reduction",
                refundedAt: new Date(),
                refundedBy: get().currentUser?.name || "System",
              };
            } else if (delta < -0.001) {
              upchargeAmount = -delta;
              const adjustmentItem: OrderItem = {
                id: `oi-${Date.now()}-adj`,
                menuItemId: "__adjustment__",
                name: "Order Adjustment",
                price: Math.round(upchargeAmount * 100) / 100,
                quantity: 1,
              };
              const targetUpdate = billUpdates.find((u) => !billDeletes.includes(u.billId));
              if (targetUpdate) {
                targetUpdate.items = [...targetUpdate.items, adjustmentItem];
                targetUpdate.total = calcTotal(targetUpdate.items);
              } else if (newBill) {
                newBill.items = [...newBill.items, adjustmentItem];
                newBill.total = calcTotal(newBill.items);
              } else {
                newBill = {
                  id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `bill-${Date.now()}`,
                  items: [adjustmentItem],
                  total: adjustmentItem.price,
                  createdAt: new Date(),
                };
              }
              auditChanges.added.push(`Order Adjustment (+₹${Math.round(upchargeAmount)})`);
            }
          }

          // 5. Bail if nothing changed
          if (!newBill && billUpdates.length === 0 && billDeletes.length === 0 && !mainChanged) {
            set({ cart: [], editingOrderId: null, selectedTable: null, customerName: "", customerPhone: "", orderNotes: "", editMode: "none", lockedItemIds: [] });
            return;
          }

          // 6. Apply all changes to local state
          set((state) => {
            const order = state.orders.find((o) => o.id === editingOrderId);
            if (!order) return {};

            let updatedBills = [...(order.supplementaryBills || [])];
            updatedBills = updatedBills.filter((b) => !billDeletes.includes(b.id));
            for (const update of billUpdates) {
              updatedBills = updatedBills.map((b) =>
                b.id === update.billId ? { ...b, items: update.items, total: update.total } : b
              );
            }
            if (newBill) updatedBills.push(newBill);

            return {
              orders: state.orders.map((o) =>
                o.id === editingOrderId
                  ? {
                      ...o,
                      supplementaryBills: updatedBills,
                      ...(updatedMainItems ? { items: updatedMainItems } : {}),
                      ...(updatedOrderTotal != null ? { total: updatedOrderTotal } : {}),
                      ...(accumulatedRefund ? { refund: accumulatedRefund } : {}),
                    }
                  : o
              ),
              cart: [],
              editingOrderId: null,
              selectedTable: null,
              customerName: "",
              customerPhone: "",
              orderNotes: "",
              editMode: "none",
              lockedItemIds: [],
            };
          });

          // 7. Audit entry
          get().addAuditEntry({
            action: "order_edited",
            userId: get().currentUser?.name || "System",
            details: `Order ${editingOrderId.toUpperCase()} supplementary edit`,
            orderId: editingOrderId,
            metadata: { mode: "supplementary", changes: auditChanges },
          });

          // 8. Sync to Supabase — enqueue mutations + direct write-through
          for (const billId of billDeletes) {
            const mutId = get().enqueueMutation("supplementary-bill.delete", { billId });
            if (get().supabaseEnabled) {
              import("./supabase-queries").then(({ deleteSupplementaryBill: delBill }) => {
                delBill(billId)
                  .then(() => get().markMutationSynced(mutId))
                  .catch((err) => console.warn("[store] supp bill delete failed:", err?.message || err?.code));
              });
            }
          }

          for (const update of billUpdates) {
            const mutId = get().enqueueMutation("supplementary-bill.replace-items", {
              billId: update.billId, items: update.items, total: update.total,
            });
            if (get().supabaseEnabled) {
              import("./supabase-queries").then(({ replaceSupplementaryBillItems: replItems, updateSupplementaryBillTotal: updTotal }) => {
                Promise.all([replItems(update.billId, update.items), updTotal(update.billId, update.total)])
                  .then(() => get().markMutationSynced(mutId))
                  .catch((err) => console.warn("[store] supp bill update failed:", err?.message || err?.code));
              });
            }
          }

          if (newBill) {
            const suppMutId = get().enqueueMutation("supplementary-bill.create", {
              orderId: editingOrderId,
              bill: {
                id: newBill.id,
                items: newBill.items,
                total: newBill.total,
                createdAt: newBill.createdAt instanceof Date ? newBill.createdAt.toISOString() : newBill.createdAt,
              },
            });
            if (get().supabaseEnabled) {
              import("./supabase-queries").then(({ insertSupplementaryBill }) => {
                insertSupplementaryBill(editingOrderId, newBill!)
                  .then(() => get().markMutationSynced(suppMutId))
                  .catch((err) => console.warn("[store] new supp bill create failed:", err?.message || err?.code));
              });
            }
          }

          // Main-item edit: persist new items + updated total (+ refund if any)
          if (updatedMainItems) {
            const orderChanges: Record<string, any> = { total: updatedOrderTotal };
            if (accumulatedRefund) {
              orderChanges.refund = {
                ...accumulatedRefund,
                refundedAt: accumulatedRefund.refundedAt instanceof Date
                  ? accumulatedRefund.refundedAt.toISOString()
                  : accumulatedRefund.refundedAt,
              };
            }
            const mainMutId = get().enqueueMutation("order.full-edit", {
              id: editingOrderId,
              changes: orderChanges,
              items: updatedMainItems,
            });
            if (get().supabaseEnabled) {
              import("./supabase-queries").then(({ updateOrderInDb, replaceOrderItems }) => {
                Promise.all([
                  updateOrderInDb(editingOrderId, orderChanges),
                  replaceOrderItems(editingOrderId, updatedMainItems!),
                ])
                  .then(() => get().markMutationSynced(mainMutId))
                  .catch((err) => console.warn("[store] main-items edit failed:", err?.message || err?.code));
              });
            }

            if (refundDelta > 0) {
              get().addAuditEntry({
                action: "refund",
                userId: get().currentUser?.name || "System",
                details: `Order ${editingOrderId.toUpperCase()} — items reduced, ₹${Math.round(refundDelta)} refund recorded`,
                orderId: editingOrderId,
                metadata: { amount: refundDelta, reason: "main_items_edit_reduction" },
              });
            } else if (upchargeAmount > 0) {
              get().addAuditEntry({
                action: "order_edited",
                userId: get().currentUser?.name || "System",
                details: `Order ${editingOrderId.toUpperCase()} — items increased, ₹${Math.round(upchargeAmount)} added to balance due`,
                orderId: editingOrderId,
                metadata: { amount: upchargeAmount, reason: "main_items_edit_upcharge" },
              });
            }
          }

          get().setPendingBillingOrderId(editingOrderId);
          return;
        }

        const newTotal = cart.reduce((sum, item) => {
          const modsTotal = item.modifiers?.reduce((modSum, mod) => modSum + mod.price, 0) || 0;
          return sum + (item.price + modsTotal) * item.quantity;
        }, 0);
        const newItems = cart.map((item, index) => ({
          id: `oi-${Date.now()}-${index}`,
          menuItemId: item.menuItemId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          variant: item.variant,
          notes: item.notes,
          modifiers: item.modifiers,
        }));

        const oldTableId = oldOrder?.tableId;
        const newTableId = orderType === "dine-in" ? selectedTable || undefined : undefined;

        set((state) => ({
          orders: state.orders.map((order) =>
            order.id === editingOrderId
              ? {
                  ...order,
                  items: newItems,
                  total: newTotal,
                  type: orderType,
                  tableId: newTableId,
                  customerName: customerName || undefined,
                  customerPhone: customerPhone || undefined,
                  orderNotes: orderNotes || undefined,
                }
              : order
          ),
          cart: [],
          editingOrderId: null,
          selectedTable: null,
          customerName: "",
          customerPhone: "",
          orderNotes: "",
          editMode: "none",
          lockedItemIds: [],
        }));

        if (oldTableId !== newTableId) {
          if (oldTableId) {
            get().updateTableStatus(oldTableId, "available");
          }
          if (newTableId) {
            get().updateTableStatus(newTableId, oldOrder?.status === "awaiting-payment" ? "waiting-payment" : "occupied", editingOrderId);
          }
        }

        get().addAuditEntry({
          action: "order_edited",
          userId: get().currentUser?.name || "System",
          details: `Order ${editingOrderId.toUpperCase()} was edited`,
          orderId: editingOrderId,
        });

        // Bug #1 fix: sync pre-payment edit to Supabase.
        // Previously only local Zustand state was updated, so on reload or
        // any other device the order still showed pre-edit items.
        // Use `null` (not undefined) for cleared fields so mapLocalOrderToDb
        // actually writes the clearing value instead of skipping the key.
        const orderChanges: Record<string, any> = {
          total: newTotal,
          type: orderType,
          tableId: newTableId ?? null,
          customerName: customerName || null,
          customerPhone: customerPhone || null,
          orderNotes: orderNotes || null,
        };
        const mutId = get().enqueueMutation("order.full-edit", {
          id: editingOrderId,
          changes: orderChanges,
          items: newItems,
        });
        if (get().supabaseEnabled) {
          import("./supabase-queries").then(({ updateOrderInDb, replaceOrderItems }) => {
            Promise.all([
              updateOrderInDb(editingOrderId, orderChanges),
              replaceOrderItems(editingOrderId, newItems),
            ])
              .then(() => get().markMutationSynced(mutId))
              .catch(err => {
                console.warn("[store] Direct write failed for pre-payment edit, queued mutation will retry:", err?.message || err?.code || JSON.stringify(err));
              });
          });
        }

        get().setPendingBillingOrderId(editingOrderId);
      },

      cancelEditOrder: () => {
        set({
          editingOrderId: null,
          cart: [],
          selectedTable: null,
          customerName: "",
          customerPhone: "",
          orderNotes: "",
          editMode: "none",
          lockedItemIds: [],
        });
      },

      setOrderType: (type) => set({ orderType: type }),
      setSelectedTable: (tableId) => set({ selectedTable: tableId }),
      setCustomerName: (name) => set({ customerName: name }),
      setCustomerPhone: (phone) => set({ customerPhone: phone }),
      setOrderNotes: (notes) => set({ orderNotes: notes }),

      // Menu Categories
      menuCategories: defaultCategories,
      addMenuCategory: (cat) => {
        set((state) => ({ menuCategories: [...state.menuCategories, cat] }));
        const cats = get().menuCategories;
        get().enqueueMutation("settings.update", { changes: { menuCategories: cats } });
        if (typeof window !== "undefined") {
          import("./supabase-queries").then(({ updateSettingsInDb }) =>
            updateSettingsInDb({ menuCategories: cats }).catch(console.error)
          );
        }
      },
      updateMenuCategory: (id, data) => {
        set((state) => ({
          menuCategories: state.menuCategories.map((c) => c.id === id ? { ...c, ...data } : c),
        }));
        const cats = get().menuCategories;
        get().enqueueMutation("settings.update", { changes: { menuCategories: cats } });
        if (typeof window !== "undefined") {
          import("./supabase-queries").then(({ updateSettingsInDb }) =>
            updateSettingsInDb({ menuCategories: cats }).catch(console.error)
          );
        }
      },
      deleteMenuCategory: (id) => {
        set((state) => ({ menuCategories: state.menuCategories.filter((c) => c.id !== id) }));
        const cats = get().menuCategories;
        get().enqueueMutation("settings.update", { changes: { menuCategories: cats } });
        if (typeof window !== "undefined") {
          import("./supabase-queries").then(({ updateSettingsInDb }) =>
            updateSettingsInDb({ menuCategories: cats }).catch(console.error)
          );
        }
      },

      // Menu Items
      menuItems: defaultMenuItems,
      addMenuItem: (item) => {
        set((state) => ({ menuItems: [...state.menuItems, item] }));
        // Direct write-through so the item is in DB before the next hydration
        if (typeof window !== "undefined") {
          import("./supabase-queries").then(({ upsertMenuItem }) => upsertMenuItem(item)).catch(console.error);
        }
        setTimeout(() => get().enqueueMutation("menu.upsert", { item }), 0);
      },
      updateMenuItem: (id, data) => {
        set((state) => ({
          menuItems: state.menuItems.map((item) => item.id === id ? { ...item, ...data } : item)
        }));
        const updatedItem = get().menuItems.find(i => i.id === id);
        if (updatedItem) {
          if (typeof window !== "undefined") {
            import("./supabase-queries").then(({ upsertMenuItem }) => upsertMenuItem(updatedItem)).catch(console.error);
          }
          setTimeout(() => get().enqueueMutation("menu.upsert", { item: updatedItem }), 0);
        }
      },
      deleteMenuItem: (id) => {
        set((state) => ({
          menuItems: state.menuItems.filter((item) => item.id !== id)
        }));
        if (typeof window !== "undefined") {
          import("./supabase-queries").then(({ deleteMenuItemFromDb }) => deleteMenuItemFromDb(id)).catch(console.error);
        }
        setTimeout(() => get().enqueueMutation("menu.delete", { id }), 0);
      },

      // Modifiers (add-ons)
      modifiers: defaultModifiers,
      addModifier: (mod) => {
        set((state) => ({ modifiers: [...state.modifiers, mod] }));
        const mutId = get().enqueueMutation("modifier.upsert", { modifier: mod });
        if (typeof window !== "undefined") {
          import("./supabase-queries").then(({ upsertModifier }) => upsertModifier(mod).then(() => get().markMutationSynced(mutId))).catch(console.error);
        }
      },
      updateModifier: (id, data) => {
        set((state) => ({
          modifiers: state.modifiers.map((m) => m.id === id ? { ...m, ...data } : m),
        }));
        const updated = get().modifiers.find((m) => m.id === id);
        if (updated) {
          const mutId = get().enqueueMutation("modifier.upsert", { modifier: updated });
          if (typeof window !== "undefined") {
            import("./supabase-queries").then(({ upsertModifier }) => upsertModifier(updated).then(() => get().markMutationSynced(mutId))).catch(console.error);
          }
        }
      },
      deleteModifier: (id) => {
        set((state) => ({
          modifiers: state.modifiers.filter((m) => m.id !== id),
        }));
        const mutId = get().enqueueMutation("modifier.delete", { id });
        if (typeof window !== "undefined") {
          import("./supabase-queries").then(({ deleteModifierFromDb }) => deleteModifierFromDb(id).then(() => get().markMutationSynced(mutId))).catch(console.error);
        }
      },

      // Orders
      pendingBillingOrderId: null,
      setPendingBillingOrderId: (id) => set({ pendingBillingOrderId: id }),
      orders: [],

      addOrder: (orderData, opts) => {
        const id = `ord-${Date.now()}`;
        const initialStatus = opts?.initialStatus || "awaiting-payment";
        const newOrder: Order = {
          ...orderData,
          id,
          status: initialStatus,
          createdAt: new Date(),
          createdBy: get().currentUser?.name || "System",
        };
        set((state) => ({
          orders: [newOrder, ...state.orders],
        }));

        const mutId = get().enqueueMutation("order.create", { order: newOrder });

        // Direct write-through: push order to Supabase immediately for instant Realtime broadcast
        if (get().supabaseEnabled) {

          import("./supabase-queries").then(({ upsertOrder }) => {
            upsertOrder(newOrder).then(() => {
              // Direct write succeeded — mark the queued mutation as synced so the
              // background sync loop doesn't replay it (fixes dual-write waste).
              get().markMutationSynced(mutId);
            }).catch(err => {
              console.warn("[store] Direct write failed for addOrder, queued mutation will retry:", err?.message || err?.code || JSON.stringify(err));
            });
          });
        }

        get().addAuditEntry({ action: "order_created", userId: newOrder.createdBy || "System", details: `Order ${id} created`, orderId: id });

        // Update table status if dine-in
        if (orderData.type === "dine-in" && orderData.tableId && !opts?.skipTableLock) {
          get().updateTableStatus(orderData.tableId, initialStatus === "awaiting-payment" ? "waiting-payment" : "occupied", id);
        }

        // Clear cart after order
        get().clearCart();
        return id;
      },

      updateOrder: (orderId, data, opts?: { skipDirectWrite?: boolean }) => {
        set((state) => ({
          orders: state.orders.map((order) =>
            order.id === orderId ? { ...order, ...data } : order
          ),
        }));
        const mutId = get().enqueueMutation("order.update", { id: orderId, changes: data });

        // Direct write-through for instant cross-device sync
        // skipDirectWrite: when a follow-up action (e.g. confirmPayment) will immediately
        // do its own direct write with a merged payload, skip here to avoid race conditions.
        if (get().supabaseEnabled && !opts?.skipDirectWrite) {

          import("./supabase-queries").then(({ updateOrderInDb }) => {
            updateOrderInDb(orderId, data).then(() => {
              get().markMutationSynced(mutId);
            }).catch(err => {
              console.warn("[store] Direct write failed for updateOrder, queued mutation will retry:", err?.message || err?.code || JSON.stringify(err));
            });
          });
        }
      },

      updateOrderStatus: (orderId, status) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order) return;
        
        const fromStatus = order.status;
        
        // Prevent completed via this action (must use markOrderServed)
        if (status === "completed") return;

        // Prevent moving out of awaiting-payment except via specific actions
        if (fromStatus === "awaiting-payment") return;

        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === orderId ? { ...o, status } : o
          ),
        }));
        const mutId = get().enqueueMutation("order.update", { id: orderId, changes: { status } });

        // Task 14: Direct write-through for real-time KDS updates
        if (get().supabaseEnabled) {
          // Mark own write to prevent Realtime feedback loop

          import("./supabase-queries").then(({ updateOrderInDb }) => {
            updateOrderInDb(orderId, { status }).then(() => {
              get().markMutationSynced(mutId);
            }).catch(err => {
              console.warn("[store] Direct write failed for updateOrderStatus, queued mutation will retry:", err?.message || err?.code || JSON.stringify(err));
            });
          });
        }

        get().addAuditEntry({ 
          action: "status_changed", 
          userId: get().currentUser?.name || "System", 
          details: `Order ${orderId.toUpperCase()} status changed from ${fromStatus} to ${status}`, 
          orderId,
          metadata: { fromStatus, toStatus: status }
        });
      },

      deleteOrder: (orderId) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (order?.tableId) {
          get().updateTableStatus(order.tableId, "available");
        }
        set((state) => ({
          orders: state.orders.filter((o) => o.id !== orderId)
        }));
        const mutId = get().enqueueMutation("order.delete", { id: orderId });

        // Direct write-through for instant cross-device sync
        if (get().supabaseEnabled) {
          import("./supabase-queries").then(({ deleteOrderFromDb }) => {
            deleteOrderFromDb(orderId).then(() => {
              get().markMutationSynced(mutId);
            }).catch(err => {
              console.warn("[store] Direct write failed for deleteOrder, queued mutation will retry:", err?.message || err?.code || JSON.stringify(err));
            });
          });
        }

        get().addAuditEntry({
          action: "void",
          userId: get().currentUser?.name || "System",
          details: `Order ${orderId.toUpperCase()} was voided/deleted`,
          orderId: orderId,
        });
      },

      confirmPaymentAndSendToKitchen: (orderId, payment) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order || order.status !== "awaiting-payment") return;

        const userName = get().currentUser?.name || "System";
        const paidAtISO = new Date().toISOString();
        
        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === orderId ? { 
              ...o, 
              status: "new",
              payment,
              paidAt: new Date(),
              paidBy: userName,
              subtotal: o.total,
            } : o
          ),
        }));
        const mutId = get().enqueueMutation("order.update", { 
          id: orderId, 
          changes: { status: "new", payment, paidAt: paidAtISO, paidBy: userName } 
        });

        // CRITICAL direct write — single merged payload with billing fields + payment
        // This replaces the separate updateOrder direct-write to avoid race conditions
        if (get().supabaseEnabled) {

          // Read the latest order state which includes billing fields set by the
          // preceding updateOrder() call (subtotal, discount, taxRate, etc.)
          const latestOrder = get().orders.find((o) => o.id === orderId);
          const mergedPayload: Record<string, any> = {
            status: "new", 
            payment, 
            paidAt: paidAtISO, 
            paidBy: userName,
            subtotal: latestOrder?.subtotal ?? order.total,
          };
          // Include billing fields if they were set
          if (latestOrder?.discount) mergedPayload.discount = latestOrder.discount;
          if (latestOrder?.taxRate !== undefined) mergedPayload.taxRate = latestOrder.taxRate;
          if (latestOrder?.taxAmount !== undefined) mergedPayload.taxAmount = latestOrder.taxAmount;
          if (latestOrder?.grandTotal !== undefined) mergedPayload.grandTotal = latestOrder.grandTotal;

          import("./supabase-queries").then(({ updateOrderInDb }) => {
            updateOrderInDb(orderId, mergedPayload).then(() => {
              get().markMutationSynced(mutId);
            }).catch(err => {
              console.warn("[store] Direct write failed for confirmPayment, queued mutation will retry:", err?.message || err?.code || JSON.stringify(err));
            });
          });
        }

        if (order.type === "dine-in" && order.tableId) {
          get().updateTableStatus(order.tableId, "occupied", orderId);
        }

        get().addAuditEntry({ 
          action: "payment_recorded", 
          userId: userName, 
          details: `Payment of ₹${payment.amount} recorded for order ${orderId}`, 
          orderId,
          metadata: { method: payment.method, amount: payment.amount, transactionId: payment.transactionId, cashier: userName }
        });

        get().addAuditEntry({ 
          action: "order_sent_to_kitchen", 
          userId: userName, 
          details: `Order ${orderId.toUpperCase()} sent to kitchen`, 
          orderId,
          metadata: { table: order.tableId, sentBy: userName }
        });
      },

      sendToKitchenPayLater: (orderId) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order || order.status !== "awaiting-payment") return;

        const userName = get().currentUser?.name || "System";

        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === orderId ? {
              ...o,
              status: "new" as const,
              payLater: true,
              subtotal: o.total,
            } : o
          ),
        }));
        const mutId = get().enqueueMutation("order.update", {
          id: orderId,
          changes: { status: "new", payLater: true }
        });

        // Direct write-through for real-time KDS
        if (get().supabaseEnabled) {

          import("./supabase-queries").then(({ updateOrderInDb }) => {
            updateOrderInDb(orderId, {
              status: "new",
              payLater: true,
              subtotal: order.total,
            }).then(() => {
              get().markMutationSynced(mutId);
            }).catch(err => {
              console.warn("[store] Direct write failed for sendToKitchenPayLater:", err?.message || err?.code || JSON.stringify(err));
            });
          });
        }

        if (order.type === "dine-in" && order.tableId) {
          get().updateTableStatus(order.tableId, "occupied", orderId);
        }

        get().addAuditEntry({
          action: "order_sent_to_kitchen",
          userId: userName,
          details: `Order ${orderId.toUpperCase()} sent to kitchen (Pay Later)`,
          orderId,
          metadata: { table: order.tableId, sentBy: userName, payLater: true }
        });
      },

      confirmPaymentForServedOrder: (orderId, payment) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order || order.status !== "served-unpaid") return;

        const userName = get().currentUser?.name || "System";
        const paidAtISO = new Date().toISOString();

        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === orderId ? {
              ...o,
              status: "completed" as const,
              payment,
              paidAt: new Date(),
              paidBy: userName,
              payLater: false,
            } : o
          ),
        }));
        const mutId = get().enqueueMutation("order.update", {
          id: orderId,
          changes: { status: "completed", payment, paidAt: paidAtISO, paidBy: userName, payLater: false }
        });

        // Merged direct write — includes billing fields set by preceding updateOrder()
        if (get().supabaseEnabled) {

          const latestOrder = get().orders.find((o) => o.id === orderId);
          const mergedPayload: Record<string, any> = {
            status: "completed",
            payment,
            paidAt: paidAtISO,
            paidBy: userName,
            payLater: false,
          };
          if (latestOrder?.subtotal !== undefined) mergedPayload.subtotal = latestOrder.subtotal;
          if (latestOrder?.discount) mergedPayload.discount = latestOrder.discount;
          if (latestOrder?.taxRate !== undefined) mergedPayload.taxRate = latestOrder.taxRate;
          if (latestOrder?.taxAmount !== undefined) mergedPayload.taxAmount = latestOrder.taxAmount;
          if (latestOrder?.grandTotal !== undefined) mergedPayload.grandTotal = latestOrder.grandTotal;

          import("./supabase-queries").then(({ updateOrderInDb }) => {
            updateOrderInDb(orderId, mergedPayload).then(() => {
              get().markMutationSynced(mutId);
            }).catch(err => {
              console.warn("[store] Direct write failed for confirmPaymentForServedOrder:", err?.message || err?.code || JSON.stringify(err));
            });
          });
        }

        if (order.tableId) {
          get().updateTableStatus(order.tableId, "available");
        }

        get().addAuditEntry({
          action: "payment_recorded",
          userId: userName,
          details: `Payment of ₹${payment.amount} recorded for pay-later order ${orderId}`,
          orderId,
          metadata: { method: payment.method, amount: payment.amount, transactionId: payment.transactionId, cashier: userName, payLater: true }
        });
      },

      cancelAwaitingPaymentOrder: (orderId, reason) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order || order.status !== "awaiting-payment") return;

        const userName = get().currentUser?.name || "System";

        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === orderId ? { ...o, status: "cancelled" } : o
          ),
        }));
        const mutId = get().enqueueMutation("order.update", { id: orderId, changes: { status: "cancelled" } });

        // Direct write-through for instant cross-device sync
        if (get().supabaseEnabled) {

          import("./supabase-queries").then(({ updateOrderInDb }) => {
            updateOrderInDb(orderId, { status: "cancelled" }).then(() => {
              get().markMutationSynced(mutId);
            }).catch(err => {
              console.warn("[store] Direct write failed for cancelAwaitingPaymentOrder, queued mutation will retry:", err?.message || err?.code || JSON.stringify(err));
            });
          });
        }

        if (order.type === "dine-in" && order.tableId) {
          get().updateTableStatus(order.tableId, "available");
        }

        get().addAuditEntry({
          action: "void",
          userId: userName,
          details: reason ? `Order ${orderId.toUpperCase()} voided: ${reason}` : `Order ${orderId.toUpperCase()} voided`,
          orderId,
          metadata: { reason }
        });
      },

      cancelPlacedOrder: (orderId, reason) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order) return;
        // Valid for any post-payment pre-service status (kitchen stages).
        if (order.status !== "new" && order.status !== "preparing" && order.status !== "ready") return;

        const userName = get().currentUser?.name || "System";
        const nowIso = new Date().toISOString();

        // Compute refund: full grand total (or total) for paid orders.
        // Pay-later orders have no payment yet, so no refund entry.
        const isPaid = !!order.payment && !order.payLater;
        const paidTotal = order.grandTotal ?? order.total ?? 0;
        const suppPaidTotal = (order.supplementaryBills || [])
          .filter((b) => !!b.payment)
          .reduce((s, b) => s + (b.total || 0), 0);
        const refundAmount = isPaid ? paidTotal + suppPaidTotal : 0;

        const refundEntry = refundAmount > 0
          ? {
              amount: refundAmount,
              reason,
              refundedAt: new Date(),
              refundedBy: userName,
            }
          : undefined;

        // Any unpaid supp bills on this order must be removed so they don't
        // keep appearing as "Balance Due" in the billing list after cancel.
        const unpaidSuppBillIds = (order.supplementaryBills || [])
          .filter((b) => !b.payment)
          .map((b) => b.id);

        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status: "cancelled",
                  supplementaryBills: (o.supplementaryBills || []).filter((b) => !unpaidSuppBillIds.includes(b.id)),
                  ...(refundEntry ? { refund: refundEntry } : {}),
                }
              : o
          ),
        }));

        // Sync unpaid supp bill deletions to Supabase.
        for (const billId of unpaidSuppBillIds) {
          const bMutId = get().enqueueMutation("supplementary-bill.delete", { billId });
          if (get().supabaseEnabled) {
            import("./supabase-queries").then(({ deleteSupplementaryBill: delBill }) => {
              delBill(billId)
                .then(() => get().markMutationSynced(bMutId))
                .catch((err) => console.warn("[store] supp bill delete on cancel failed:", err?.message || err?.code));
            });
          }
        }

        const changes: Record<string, any> = { status: "cancelled" };
        if (refundEntry) {
          changes.refund = {
            ...refundEntry,
            refundedAt: refundEntry.refundedAt.toISOString(),
          };
        }
        const mutId = get().enqueueMutation("order.update", { id: orderId, changes });

        if (get().supabaseEnabled) {
          import("./supabase-queries").then(({ updateOrderInDb }) => {
            updateOrderInDb(orderId, changes).then(() => {
              get().markMutationSynced(mutId);
            }).catch(err => {
              console.warn("[store] Direct write failed for cancelPlacedOrder, queued mutation will retry:", err?.message || err?.code || JSON.stringify(err));
            });
          });
        }

        if (order.tableId) {
          get().updateTableStatus(order.tableId, "available");
        }

        if (refundEntry) {
          get().addAuditEntry({
            action: "refund",
            userId: userName,
            details: `Order ${orderId.toUpperCase()} cancelled after kitchen — refunded ₹${refundAmount}${reason ? `: ${reason}` : ""}`,
            orderId,
            metadata: { reason, amount: refundAmount, fromStatus: order.status },
          });
        } else {
          get().addAuditEntry({
            action: "void",
            userId: userName,
            details: `Order ${orderId.toUpperCase()} cancelled from ${order.status}${reason ? `: ${reason}` : ""}`,
            orderId,
            metadata: { reason, fromStatus: order.status, payLater: !!order.payLater },
          });
        }
      },

      markOrderServed: (orderId) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order) return;

        const userName = get().currentUser?.name || "System";

        // Bug #6 fix: block completion when supplementary bills are still unpaid.
        // Route the cashier to billing to collect payment first so revenue is
        // never lost by archiving an order with outstanding add-ons.
        const hasUnpaidSupp = order.supplementaryBills?.some(b => !b.payment);
        if (hasUnpaidSupp) {
          get().setPendingBillingOrderId(orderId);
          get().setActiveView("billing");
          get().addAuditEntry({
            action: "order_served",
            userId: userName,
            details: `Order ${orderId.toUpperCase()} cannot be completed — supplementary bill unpaid. Routed to billing.`,
            orderId,
            metadata: { reason: "unpaid_supplementary_bill" }
          });
          return;
        }

        // If this is a pay-later order, move to served-unpaid instead of completed
        if (order.payLater) {
          set((state) => ({
            orders: state.orders.map((o) =>
              o.id === orderId ? { ...o, status: "served-unpaid" as const } : o
            ),
          }));
          const mutId = get().enqueueMutation("order.update", { id: orderId, changes: { status: "served-unpaid" } });

          if (get().supabaseEnabled) {

            import("./supabase-queries").then(({ updateOrderInDb }) => {
              updateOrderInDb(orderId, { status: "served-unpaid" }).then(() => {
                get().markMutationSynced(mutId);
              }).catch(err => {
                console.warn("[store] Direct write failed for markOrderServed (pay-later):", err?.message || err?.code || JSON.stringify(err));
              });
            });
          }

          // Keep table occupied — customer hasn't paid yet
          // Redirect to billing
          get().setPendingBillingOrderId(orderId);
          get().setActiveView("billing");

          get().addAuditEntry({
            action: "order_served",
            userId: userName,
            details: `Order ${orderId.toUpperCase()} served (awaiting post-service payment)`,
            orderId,
            metadata: { table: order.tableId, servedBy: userName, payLater: true }
          });
          return;
        }

        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === orderId ? { ...o, status: "completed" } : o
          ),
        }));
        const mutId = get().enqueueMutation("order.update", { id: orderId, changes: { status: "completed" } });

        // Task 14: Direct write-through for table release visibility
        if (get().supabaseEnabled) {

          import("./supabase-queries").then(({ updateOrderInDb }) => {
            updateOrderInDb(orderId, { status: "completed" }).then(() => {
              get().markMutationSynced(mutId);
            }).catch(err => {
              console.warn("[store] Direct write failed for markOrderServed, queued mutation will retry:", err?.message || err?.code || JSON.stringify(err));
            });
          });
        }

        if (order.tableId) {
          get().updateTableStatus(order.tableId, "available");
        }

        get().addAuditEntry({ 
          action: "order_served", 
          userId: userName, 
          details: `Order ${orderId.toUpperCase()} served`, 
          orderId,
          metadata: { table: order.tableId, servedBy: userName }
        });
      },

      // Tables
      tables: initialTables,

      addTable: (table) => {
        set((state) => ({ tables: [...state.tables, table] }));
        const mutId = get().enqueueMutation("table.upsert", { table });
        if (typeof window !== "undefined") {
          import("./supabase-queries").then(({ upsertTable }) => upsertTable(table).then(() => get().markMutationSynced(mutId))).catch(console.error);
        }
      },

      updateTable: (tableId, data) => {
        set((state) => ({
          tables: state.tables.map((table) => table.id === tableId ? { ...table, ...data } : table)
        }));
        const updatedTable = get().tables.find((t) => t.id === tableId);
        if (updatedTable) {
          const mutId = get().enqueueMutation("table.upsert", { table: updatedTable });
          if (typeof window !== "undefined") {
            import("./supabase-queries").then(({ upsertTable }) => upsertTable(updatedTable).then(() => get().markMutationSynced(mutId))).catch(console.error);
          }
        }
      },

      updateTableStatus: (tableId, status, orderId) => {
        set((state) => ({
          tables: state.tables.map((table) =>
            table.id === tableId
              ? { ...table, status, orderId: orderId || undefined }
              : table
          ),
        }));
        const mutId = get().enqueueMutation("table.update", { id: tableId, status, orderId });

        // Direct write-through for instant cross-device table sync
        if (get().supabaseEnabled) {
          import("./supabase-queries").then(({ updateTableInDb }) => {
            updateTableInDb(tableId, { status, orderId }).then(() => {
              get().markMutationSynced(mutId);
            }).catch(err => {
              console.warn("[store] Direct write failed for updateTableStatus, queued mutation will retry:", err?.message || err?.code || JSON.stringify(err));
            });
          });
        }
      },

      deleteTable: (tableId) => {
        set((state) => ({ tables: state.tables.filter((t) => t.id !== tableId) }));
        const mutId = get().enqueueMutation("table.delete", { id: tableId });
        if (typeof window !== "undefined") {
          import("./supabase-queries").then(({ deleteTableFromDb }) => deleteTableFromDb(tableId).then(() => get().markMutationSynced(mutId))).catch(console.error);
        }
      },

      mergeTable: (sourceTableId, targetTableId) => {
        const tables = get().tables;
        const sourceTable = tables.find((t) => t.id === sourceTableId);
        const targetTable = tables.find((t) => t.id === targetTableId);

        if (!sourceTable || !targetTable) return;

        // Move order from source to target if exists
        if (sourceTable.orderId) {
          set((state) => ({
            orders: state.orders.map((order) =>
              order.id === sourceTable.orderId
                ? { ...order, tableId: targetTableId }
                : order
            ),
            tables: state.tables.map((table) => {
              if (table.id === sourceTableId) {
                return { ...table, status: "available" as const, orderId: undefined };
              }
              if (table.id === targetTableId) {
                return { ...table, orderId: sourceTable.orderId };
              }
              return table;
            }),
          }));
        }
      },

      splitOrder: (orderId, itemIdsForNewOrder) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order || itemIdsForNewOrder.length === 0) return;

        const remainingItems = order.items.filter((item) => !itemIdsForNewOrder.includes(item.id));
        const splitItems = order.items.filter((item) => itemIdsForNewOrder.includes(item.id));

        if (remainingItems.length === 0) return; // Cannot split all items

        const calculateTotal = (items: OrderItem[]) => items.reduce((sum, item) => {
          const modTotal = item.modifiers?.reduce((mSum, mod) => mSum + mod.price, 0) || 0;
          return sum + (item.price + modTotal) * item.quantity;
        }, 0);

        const newOrderId = `ord-${Date.now()}`;
        const newOrder: Order = {
          ...order,
          id: newOrderId,
          items: splitItems,
          total: calculateTotal(splitItems),
          createdAt: new Date(),
          createdBy: get().currentUser?.name || "System",
          tableId: undefined, // Assign to takeaway by default
          type: "takeaway",
        };

        set((state) => ({
          orders: [
            newOrder,
            ...state.orders.map((o) =>
              o.id === orderId
                ? { ...o, items: remainingItems, total: calculateTotal(remainingItems) }
                : o
            ),
          ],
        }));

        get().addAuditEntry({
          action: "order_edited",
          userId: get().currentUser?.name || "System",
          details: `Order ${orderId.toUpperCase()} split into ${newOrderId.toUpperCase()}`,
          orderId: orderId,
        });
        
        get().addAuditEntry({
          action: "order_created",
          userId: get().currentUser?.name || "System",
          details: `Order ${newOrderId.toUpperCase()} created from split`,
          orderId: newOrderId,
        });
      },

      moveTable: (orderId, newTableId) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order || !order.tableId) return;

        const oldTableId = order.tableId;

        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === orderId ? { ...o, tableId: newTableId } : o
          ),
          tables: state.tables.map((table) => {
            if (table.id === oldTableId) {
              return { ...table, status: "available" as const, orderId: undefined };
            }
            if (table.id === newTableId) {
              return { ...table, status: "occupied" as const, orderId };
            }
            return table;
          }),
        }));
      },

      // Data Management
      clearAllData: async () => {
        // 1. Wipe Supabase FIRST (while session is still valid).
        //    Must await so re-hydration after reset reads empty tables,
        //    not stale server data.
        if (get().supabaseEnabled) {
          try {
            const { nukeAllData } = await import("./supabase-queries");
            await nukeAllData();
          } catch (err) {
            console.error("[store] Failed to nuke Supabase data:", err);
          }
        }

        // 2. Clear the offline mutation queue in IndexedDB so pending
        //    writes don't replay and resurrect deleted data.
        try {
          const { clearAllMutationsFromIDB } = await import("./sync-idb");
          await clearAllMutationsFromIDB();
        } catch (err) {
          console.error("[store] Failed to clear IDB sync queue:", err);
        }

        // 3. Reset local state. Keep the current user logged in — the
        //    Admin just authorized this action, kicking them to login is
        //    disruptive and also races with re-hydration.
        set({
          orders: [],
          tables: initialTables,
          menuCategories: defaultCategories,
          menuItems: defaultMenuItems,
          staffMembers: defaultStaffMembers,
          modifiers: defaultModifiers,
          cart: [],
          selectedTable: null,
          customerName: "",
          customerPhone: "",
          orderNotes: "",
          editingOrderId: null,
          editMode: "none",
          lockedItemIds: [],
          auditLog: [],
          syncQueue: [],
          shifts: [],
          currentShift: null,
          settings: defaultSettings,
        });

        // 4. Broadcast the reset to all other logged-in devices via the
        //    pos-control Realtime broadcast channel. Listeners on other
        //    terminals hard-reset their local state + re-hydrate from the
        //    (now empty) database. Cascade DELETE events alone are not
        //    enough because audit/shifts/categories aren't covered.
        //    Uses the already-subscribed channel owned by useRealtimeSync,
        //    which guarantees the sender and receivers are on the same
        //    channel name ("pos-control").
        if (get().supabaseEnabled) {
          try {
            const { sendPosControlBroadcast } = await import("./realtime-control");
            await sendPosControlBroadcast("nuke", { at: Date.now() });
          } catch (err) {
            console.error("[store] Failed to broadcast nuke event:", err);
          }
        }
      },

      exportData: () => {
        const state = get();
        const exportObj = {
          orders: state.orders,
          tables: state.tables,
          menuItems: state.menuItems,
          staffMembers: state.staffMembers,
          settings: state.settings,
          auditLog: state.auditLog,
          exportedAt: new Date().toISOString(),
        };
        return JSON.stringify(exportObj, null, 2);
      },

      importData: (dataString) => {
        try {
          const data = JSON.parse(dataString);
          if (data.orders) {
            // Convert date strings back to Date objects
            data.orders = data.orders.map((o: Order) => ({
              ...o,
              createdAt: new Date(o.createdAt),
              ...(o.paidAt && { paidAt: new Date(o.paidAt) }),
              ...(o.refund && {
                refund: {
                  ...o.refund,
                  refundedAt: new Date(o.refund.refundedAt)
                }
              }),
              ...(o.supplementaryBills && {
                supplementaryBills: o.supplementaryBills.map((sb: any) => ({
                  ...sb,
                  createdAt: new Date(sb.createdAt),
                  ...(sb.paidAt && { paidAt: new Date(sb.paidAt) })
                }))
              })
            }));
          }
          if (data.auditLog) {
            data.auditLog = data.auditLog.map((a: AuditEntry) => ({
              ...a,
              timestamp: new Date(a.timestamp),
            }));
          }
          set({
            orders: data.orders || [],
            tables: data.tables || initialTables,
            menuItems: data.menuItems || defaultMenuItems,
            staffMembers: data.staffMembers || defaultStaffMembers,
            settings: data.settings || defaultSettings,
            auditLog: data.auditLog || [],
          });
          get().addAuditEntry({ action: "data_import", userId: get().currentUser?.name || "System", details: "Data imported" });
          return true;
        } catch {
          return false;
        }
      },

      getCartTotal: () => {
        return get().cart.reduce((sum, item) => {
          const modsTotal = item.modifiers?.reduce((mSum, mod) => mSum + mod.price, 0) || 0;
          return sum + (item.price + modsTotal) * item.quantity;
        }, 0);
      },

      // Shift Tracking
      shifts: [],
      currentShift: null,
      startShift: (staffId, staffName, openingCash) => {
        const newShift: Shift = {
          id: `shift-${Date.now()}`,
          staffId,
          staffName,
          startedAt: new Date(),
          openingCash,
        };
        set({ currentShift: newShift });
        get().enqueueMutation("shift.start", { shift: newShift });
        get().addAuditEntry({ action: "settings_changed", userId: staffName, details: `Shift started with opening cash ₹${openingCash}` }); // using settings_changed or login? Let's use login context if appropriate. We can just add custom text. Note: action is typed, "login" is probably better but we didn't add "shift_start" to action union.
      },
      endShift: (closingCash, notes) => {
        const { currentShift, orders } = get();
        if (!currentShift) return;

        // Calculate totals for this shift
        const shiftOrders = orders.filter(
          (o) => o.createdAt >= currentShift.startedAt && o.status === "completed"
        );
        const totalSales = shiftOrders.reduce((sum, o) => sum + o.total, 0);
        const totalOrders = shiftOrders.length;

        const completedShift: Shift = {
          ...currentShift,
          endedAt: new Date(),
          closingCash,
          totalSales,
          totalOrders,
          notes,
        };

        set((state) => ({
          shifts: [completedShift, ...state.shifts],
          currentShift: null,
        }));
        get().enqueueMutation("shift.end", { shift: completedShift });
        
        get().addAuditEntry({ action: "logout", userId: currentShift.staffName, details: `Shift ended. Total sales: ₹${totalSales}` });

        set({ isLoggedIn: false, currentUser: null, activeView: "dashboard" });
        if (typeof window !== "undefined") {
          import("./auth").then(({ logoutFromSupabase, clearCachedCurrentUser }) => {
            clearCachedCurrentUser();
            logoutFromSupabase().catch(() => {});
          });
        }
      },
    }),
    {
      name: "suhashi-pos-storage",
      version: STORE_VERSION,
      partialize: (state) => ({
        activeView: state.activeView,
        pendingBillingOrderId: state.pendingBillingOrderId,
        orders: state.orders,
        tables: state.tables,
        menuCategories: state.menuCategories,
        menuItems: state.menuItems,
        modifiers: state.modifiers,
        staffMembers: state.staffMembers,
        settings: state.settings,
        auditLog: state.auditLog.slice(0, 500),
        shifts: state.shifts,
        currentShift: state.currentShift,
        syncQueue: state.syncQueue,
        lastSyncedAt: state.lastSyncedAt,
        supabaseEnabled: state.supabaseEnabled,
      }),
      migrate: (persistedState: any, version) => {
        let state = persistedState as any;
        
        if (version < 11) {
          const roleMap: Record<string, string> = {
            "Admin": "Owner",
            "Cashier": "Manager",
            "Server": "Manager",
            "Kitchen": "Chef"
          };
          if (state.currentUser?.role && roleMap[state.currentUser.role]) {
            state.currentUser.role = roleMap[state.currentUser.role];
          }
          if (Array.isArray(state.staffMembers)) {
            state.staffMembers = state.staffMembers.map((staff: any) => ({
               ...staff,
               role: roleMap[staff.role] || staff.role
            }));
          }
        }

        // Ensure printers array exists on settings for older stores
        if (state.settings && !Array.isArray(state.settings.printers)) {
          state.settings = { ...state.settings, printers: [] };
        }

        // Reset tables and menuItems to default when version changes
        if (version < STORE_VERSION) {
          return {
            ...state,
            tables: initialTables,
            menuItems: defaultMenuItems,
            menuCategories: defaultCategories,
            modifiers: defaultModifiers,
          } as any;
        }

        // Ensure menuCategories exists for older persisted states
        if (!state.menuCategories || !Array.isArray(state.menuCategories) || state.menuCategories.length === 0) {
          state.menuCategories = defaultCategories;
        }
        return state;
      },
      onRehydrateStorage: () => (state) => {
        // Convert date strings back to Date objects after rehydration
        if (state?.orders) {
          state.orders = state.orders.map((o) => ({
            ...o,
            createdAt: new Date(o.createdAt),
            ...(o.paidAt && { paidAt: new Date(o.paidAt) }),
            ...(o.refund && {
              refund: {
                ...o.refund,
                refundedAt: new Date(o.refund.refundedAt)
              }
            }),
            ...(o.supplementaryBills && {
              supplementaryBills: o.supplementaryBills.map((sb: any) => ({
                ...sb,
                createdAt: new Date(sb.createdAt),
                ...(sb.paidAt && { paidAt: new Date(sb.paidAt) })
              }))
            })
          }));
        }
        if (state?.auditLog) {
          state.auditLog = state.auditLog.map((a) => ({
            ...a,
            timestamp: new Date(a.timestamp)
          }));
        }
        if (state?.shifts) {
          state.shifts = state.shifts.map((s) => ({
            ...s,
            startedAt: new Date(s.startedAt),
            ...(s.endedAt && { endedAt: new Date(s.endedAt) }),
          }));
        }
        if (state?.currentShift) {
          state.currentShift = {
            ...state.currentShift,
            startedAt: new Date(state.currentShift.startedAt),
            ...(state.currentShift.endedAt && { endedAt: new Date(state.currentShift.endedAt) }),
          };
        }
      },
    }
  )
);
