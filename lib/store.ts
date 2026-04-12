import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Order, OrderItem, OrderType, OrderStatus, Table, MenuItem, AuditEntry, Shift, QueuedMutation, MutationKind } from "./data";
import { tables as initialTables, menuItems as defaultMenuItems } from "./data";
import { getDefaultView } from "./roles";
import { writeMutationToIDB, removeMutationFromIDB } from "./sync-idb";

// Version to force refresh when data structure changes
const STORE_VERSION = 10;

interface CartItem extends Omit<OrderItem, "id"> {
  tempId: string;
  originalItemId?: string;
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
  installPromptDismissed?: boolean;
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

  // Menu Items
  menuItems: MenuItem[];
  addMenuItem: (item: MenuItem) => void;
  updateMenuItem: (id: string, item: Partial<MenuItem>) => void;
  deleteMenuItem: (id: string) => void;

  // Orders
  pendingBillingOrderId: string | null;
  setPendingBillingOrderId: (id: string | null) => void;
  orders: Order[];
  addOrder: (order: Omit<Order, "id" | "createdAt">, opts?: { initialStatus?: OrderStatus; skipTableLock?: boolean }) => string;
  updateOrder: (orderId: string, data: Partial<Order>) => void;
  updateOrderStatus: (orderId: string, status: Order["status"]) => void;
  deleteOrder: (orderId: string) => void;
  confirmPaymentAndSendToKitchen: (orderId: string, payment: import("./data").PaymentRecord) => void;
  sendToKitchenPayLater: (orderId: string) => void;
  confirmPaymentForServedOrder: (orderId: string, payment: import("./data").PaymentRecord) => void;
  cancelAwaitingPaymentOrder: (orderId: string, reason?: string) => void;
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
  clearAllData: () => void;
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
  enqueueMutation: (kind: MutationKind, payload: Record<string, unknown>) => void;
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
  { id: "1", name: "Admin", role: "Admin", pin: "1111", initials: "AD" },
  { id: "2", name: "Rahul S.", role: "Cashier", pin: "1111", initials: "RS" },
  { id: "3", name: "Priya P.", role: "Server", pin: "1111", initials: "PP" },
  { id: "4", name: "Amit K.", role: "Kitchen", pin: "1111", initials: "AK" },
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
  installPromptDismissed: false,
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
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        set((state) => ({
          syncQueue: state.syncQueue.filter((m) =>
            m.status !== "synced" || new Date(m.createdAt) >= sevenDaysAgo
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
        set({
          isLoggedIn: true,
          currentUser: user,
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
        get().addAuditEntry({ action: "staff_added", userId: get().currentUser?.name || "System", details: `Staff member ${staff.name} added` });
      },
      updateStaffMember: (id, data) => set((state) => ({
        staffMembers: state.staffMembers.map((s) => s.id === id ? { ...s, ...data } : s)
      })),
      deleteStaffMember: (id) => {
        const staff = get().staffMembers.find((s) => s.id === id);
        set((state) => ({
          staffMembers: state.staffMembers.filter((s) => s.id !== id)
        }));
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
        get().addAuditEntry({ action: "settings_changed", userId: get().currentUser?.name || "System", details: "Settings updated" });
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
        if (!order || get().currentUser?.role !== "Admin") return;

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
                           reason: `Admin force removed ${itemToRemove.name}`,
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
            details: `Admin forced removed ${itemToRemove.name}`,
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
          lockedItemIds = order.items.map((i) => i.id);
        }

        // Load order items into cart
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
        }));

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
        if (!editingOrderId || cart.length === 0) return;

        const oldOrder = get().orders.find((o) => o.id === editingOrderId);
        if (!oldOrder) return;

        if (editMode === "supplementary") {
          const newCartItems = cart.filter(item => !item.originalItemId || !lockedItemIds.includes(item.originalItemId));
          if (newCartItems.length === 0) return;

          const computedTotal = newCartItems.reduce((sum, item) => {
            const modsTotal = item.modifiers?.reduce((modSum, mod) => modSum + mod.price, 0) || 0;
            return sum + (item.price + modsTotal) * item.quantity;
          }, 0);

          const newItems = newCartItems.map((item, index) => ({
            id: `oi-${Date.now()}-${index}`,
            menuItemId: item.menuItemId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            variant: item.variant,
            notes: item.notes,
            modifiers: item.modifiers,
          }));

          const newBill = {
            id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `bill-${Date.now()}`,
            items: newItems,
            total: computedTotal,
            createdAt: new Date(),
          };

          set((state) => ({
            orders: state.orders.map((order) =>
              order.id === editingOrderId
                ? {
                    ...order,
                    supplementaryBills: [...(order.supplementaryBills || []), newBill],
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

          get().addAuditEntry({
            action: "order_edited",
            userId: get().currentUser?.name || "System",
            details: `Order ${editingOrderId.toUpperCase()} received a supplementary bill`,
            orderId: editingOrderId,
            metadata: { mode: "supplementary", addedItems: newItems }
          });

          // Direct write-through: push supplementary bill to Supabase immediately
          if (get().supabaseEnabled) {
            if (typeof window !== "undefined" && (window as any).__posMarkOwnWrite) {
              (window as any).__posMarkOwnWrite(editingOrderId);
            }
            import("./supabase-queries").then(({ insertSupplementaryBill }) => {
              insertSupplementaryBill(editingOrderId, newBill).catch(err => {
                console.error("[store] Direct write failed for supplementary bill, will sync later:", err);
              });
            });
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

      // Menu Items
      menuItems: defaultMenuItems,
      addMenuItem: (item) => set((state) => ({ menuItems: [...state.menuItems, item] })),
      updateMenuItem: (id, data) => set((state) => ({
        menuItems: state.menuItems.map((item) => item.id === id ? { ...item, ...data } : item)
      })),
      deleteMenuItem: (id) => set((state) => ({
        menuItems: state.menuItems.filter((item) => item.id !== id)
      })),

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

        get().enqueueMutation("order.create", { order: newOrder });

        // Direct write-through: push order to Supabase immediately for instant Realtime broadcast
        if (get().supabaseEnabled) {
          if (typeof window !== "undefined" && (window as any).__posMarkOwnWrite) {
            (window as any).__posMarkOwnWrite(id);
          }
          import("./supabase-queries").then(({ upsertOrder }) => {
            upsertOrder(newOrder).catch(err => {
              console.error("[store] Direct write failed for addOrder, queued mutation will retry:", err);
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

      updateOrder: (orderId, data) => {
        set((state) => ({
          orders: state.orders.map((order) =>
            order.id === orderId ? { ...order, ...data } : order
          ),
        }));
        get().enqueueMutation("order.update", { id: orderId, changes: data });

        // Direct write-through for instant cross-device sync
        if (get().supabaseEnabled) {
          if (typeof window !== "undefined" && (window as any).__posMarkOwnWrite) {
            (window as any).__posMarkOwnWrite(orderId);
          }
          import("./supabase-queries").then(({ updateOrderInDb }) => {
            updateOrderInDb(orderId, data).catch(err => {
              console.error("[store] Direct write failed for updateOrder, queued mutation will retry:", err);
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
        get().enqueueMutation("order.update", { id: orderId, changes: { status } });

        // Task 14: Direct write-through for real-time KDS updates
        if (get().supabaseEnabled) {
          // Mark own write to prevent Realtime feedback loop
          if (typeof window !== "undefined" && (window as any).__posMarkOwnWrite) {
            (window as any).__posMarkOwnWrite(orderId);
          }
          import("./supabase-queries").then(({ updateOrderInDb }) => {
            updateOrderInDb(orderId, { status }).catch(err => {
              console.error("[store] Direct write failed for updateOrderStatus, queued mutation will retry:", err);
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
        get().enqueueMutation("order.delete", { id: orderId });

        // Direct write-through for instant cross-device sync
        if (get().supabaseEnabled) {
          import("./supabase-queries").then(({ deleteOrderFromDb }) => {
            deleteOrderFromDb(orderId).catch(err => {
              console.error("[store] Direct write failed for deleteOrder, queued mutation will retry:", err);
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
        get().enqueueMutation("order.update", { 
          id: orderId, 
          changes: { status: "new", payment, paidAt: paidAtISO, paidBy: userName } 
        });

        // Task 14: CRITICAL direct write — this triggers Realtime so KDS sees the order immediately
        if (get().supabaseEnabled) {
          if (typeof window !== "undefined" && (window as any).__posMarkOwnWrite) {
            (window as any).__posMarkOwnWrite(orderId);
          }
          import("./supabase-queries").then(({ updateOrderInDb }) => {
            updateOrderInDb(orderId, { 
              status: "new", 
              payment, 
              paidAt: paidAtISO, 
              paidBy: userName,
              subtotal: order.total,
            }).catch(err => {
              console.error("[store] Direct write failed for confirmPayment, queued mutation will retry:", err);
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
        get().enqueueMutation("order.update", {
          id: orderId,
          changes: { status: "new", payLater: true }
        });

        // Direct write-through for real-time KDS
        if (get().supabaseEnabled) {
          if (typeof window !== "undefined" && (window as any).__posMarkOwnWrite) {
            (window as any).__posMarkOwnWrite(orderId);
          }
          import("./supabase-queries").then(({ updateOrderInDb }) => {
            updateOrderInDb(orderId, {
              status: "new",
              payLater: true,
              subtotal: order.total,
            }).catch(err => {
              console.error("[store] Direct write failed for sendToKitchenPayLater:", err);
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
        get().enqueueMutation("order.update", {
          id: orderId,
          changes: { status: "completed", payment, paidAt: paidAtISO, paidBy: userName, payLater: false }
        });

        // Direct write-through
        if (get().supabaseEnabled) {
          if (typeof window !== "undefined" && (window as any).__posMarkOwnWrite) {
            (window as any).__posMarkOwnWrite(orderId);
          }
          import("./supabase-queries").then(({ updateOrderInDb }) => {
            updateOrderInDb(orderId, {
              status: "completed",
              payment,
              paidAt: paidAtISO,
              paidBy: userName,
              payLater: false,
            }).catch(err => {
              console.error("[store] Direct write failed for confirmPaymentForServedOrder:", err);
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
        get().enqueueMutation("order.update", { id: orderId, changes: { status: "cancelled" } });

        // Direct write-through for instant cross-device sync
        if (get().supabaseEnabled) {
          if (typeof window !== "undefined" && (window as any).__posMarkOwnWrite) {
            (window as any).__posMarkOwnWrite(orderId);
          }
          import("./supabase-queries").then(({ updateOrderInDb }) => {
            updateOrderInDb(orderId, { status: "cancelled" }).catch(err => {
              console.error("[store] Direct write failed for cancelAwaitingPaymentOrder, queued mutation will retry:", err);
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

      markOrderServed: (orderId) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order) return;

        const userName = get().currentUser?.name || "System";

        // If this is a pay-later order, move to served-unpaid instead of completed
        if (order.payLater) {
          set((state) => ({
            orders: state.orders.map((o) =>
              o.id === orderId ? { ...o, status: "served-unpaid" as const } : o
            ),
          }));
          get().enqueueMutation("order.update", { id: orderId, changes: { status: "served-unpaid" } });

          if (get().supabaseEnabled) {
            if (typeof window !== "undefined" && (window as any).__posMarkOwnWrite) {
              (window as any).__posMarkOwnWrite(orderId);
            }
            import("./supabase-queries").then(({ updateOrderInDb }) => {
              updateOrderInDb(orderId, { status: "served-unpaid" }).catch(err => {
                console.error("[store] Direct write failed for markOrderServed (pay-later):", err);
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
        get().enqueueMutation("order.update", { id: orderId, changes: { status: "completed" } });

        // Task 14: Direct write-through for table release visibility
        if (get().supabaseEnabled) {
          if (typeof window !== "undefined" && (window as any).__posMarkOwnWrite) {
            (window as any).__posMarkOwnWrite(orderId);
          }
          import("./supabase-queries").then(({ updateOrderInDb }) => {
            updateOrderInDb(orderId, { status: "completed" }).catch(err => {
              console.error("[store] Direct write failed for markOrderServed, queued mutation will retry:", err);
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

      addTable: (table) => set((state) => ({ tables: [...state.tables, table] })),
      
      updateTable: (tableId, data) => set((state) => ({
        tables: state.tables.map((table) => table.id === tableId ? { ...table, ...data } : table)
      })),

      updateTableStatus: (tableId, status, orderId) => {
        set((state) => ({
          tables: state.tables.map((table) =>
            table.id === tableId
              ? { ...table, status, orderId: orderId || undefined }
              : table
          ),
        }));
        get().enqueueMutation("table.update", { id: tableId, status, orderId });

        // Direct write-through for instant cross-device table sync
        if (get().supabaseEnabled) {
          import("./supabase-queries").then(({ updateTableInDb }) => {
            updateTableInDb(tableId, { status, orderId }).catch(err => {
              console.error("[store] Direct write failed for updateTableStatus, queued mutation will retry:", err);
            });
          });
        }
      },

      deleteTable: (tableId) => set((state) => ({
        tables: state.tables.filter((t) => t.id !== tableId)
      })),

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
      clearAllData: () => {
        set({
          orders: [],
          tables: initialTables,
          menuItems: defaultMenuItems,
          staffMembers: defaultStaffMembers,
          cart: [],
          isLoggedIn: false,
          currentUser: null,
          auditLog: [],
          syncQueue: [],
          shifts: [],
          currentShift: null,
        });

        // Wipe all data from Supabase too (global reset across all devices)
        if (get().supabaseEnabled) {
          import("./supabase-queries").then(({ nukeAllData }) => {
            nukeAllData().catch(err => {
              console.error("[store] Failed to nuke Supabase data:", err);
            });
          });
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
        pendingBillingOrderId: state.pendingBillingOrderId,
        orders: state.orders,
        tables: state.tables,
        menuItems: state.menuItems,
        staffMembers: state.staffMembers,
        settings: state.settings,
        auditLog: state.auditLog,
        shifts: state.shifts,
        currentShift: state.currentShift,
        syncQueue: state.syncQueue,
        lastSyncedAt: state.lastSyncedAt,
        supabaseEnabled: state.supabaseEnabled,
      }),
      migrate: (persistedState: any, version) => {
        // Reset tables and menuItems to default when version changes
        if (version < STORE_VERSION) {
          const state = persistedState as any;
          return {
            ...state,
            tables: initialTables,
            menuItems: defaultMenuItems,
          } as any;
        }
        return persistedState as any;
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
