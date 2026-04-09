import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Order, OrderItem, OrderType, Table, MenuItem, AuditEntry, Shift, QueuedMutation, MutationKind } from "./data";
import { tables as initialTables, menuItems as defaultMenuItems } from "./data";
import { getDefaultView } from "./roles";
import { writeMutationToIDB, removeMutationFromIDB } from "./sync-idb";

// Version to force refresh when data structure changes
const STORE_VERSION = 7;

interface CartItem extends Omit<OrderItem, "id"> {
  tempId: string;
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
  logout: () => void;
  addStaffMember: (staff: StaffMember) => void;
  updateStaffMember: (id: string, staff: Partial<StaffMember>) => void;
  deleteStaffMember: (id: string) => void;

  // Navigation
  activeView: "dashboard" | "orders" | "tables" | "kitchen" | "reports" | "settings" | "aggregator" | "billing" | "history";
  setActiveView: (view: POSState["activeView"]) => void;

  // Settings
  settings: CafeSettings;
  updateSettings: (settings: Partial<CafeSettings>) => void;

  // Cart
  cart: CartItem[];
  orderType: OrderType;
  selectedTable: string | null;
  customerName: string;
  orderNotes: string;
  editingOrderId: string | null;
  addToCart: (item: Omit<CartItem, "tempId">) => void;
  removeFromCart: (tempId: string) => void;
  updateQuantity: (tempId: string, quantity: number) => void;
  updateItemNotes: (tempId: string, notes: string) => void;
  updateItemVariant: (tempId: string, variant: string) => void;
  clearCart: () => void;
  setOrderType: (type: OrderType) => void;
  setSelectedTable: (tableId: string | null) => void;
  setCustomerName: (name: string) => void;
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
  orders: Order[];
  addOrder: (order: Omit<Order, "id" | "createdAt">) => void;
  updateOrder: (orderId: string, data: Partial<Order>) => void;
  updateOrderStatus: (orderId: string, status: Order["status"]) => void;
  deleteOrder: (orderId: string) => void;

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
      logout: () => {
        const userName = get().currentUser?.name || "Unknown";
        set({ isLoggedIn: false, currentUser: null, activeView: "dashboard" });
        get().addAuditEntry({ action: "logout", userId: userName, details: `${userName} logged out` });
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
      orderNotes: "",
      editingOrderId: null,

      addToCart: (item) => {
        const tempId = `cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        set((state) => ({
          cart: [...state.cart, { ...item, tempId }],
        }));
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

      clearCart: () => set({ cart: [], selectedTable: null, customerName: "", orderNotes: "", editingOrderId: null }),

      startEditOrder: (orderId) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order) return;

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
        }));

        set({
          editingOrderId: orderId,
          cart: cartItems,
          orderType: order.type,
          selectedTable: order.tableId || null,
          customerName: order.customerName || "",
          orderNotes: order.orderNotes || "",
          activeView: "orders",
        });
      },

      saveEditOrder: () => {
        const { editingOrderId, cart, orderType, selectedTable, customerName, orderNotes } = get();
        if (!editingOrderId || cart.length === 0) return;

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

        // Get old order to check if table changed
        const oldOrder = get().orders.find((o) => o.id === editingOrderId);
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
                  orderNotes: orderNotes || undefined,
                }
              : order
          ),
          cart: [],
          editingOrderId: null,
          selectedTable: null,
          customerName: "",
          orderNotes: "",
        }));

        // Update table assignments if table changed
        if (oldTableId !== newTableId) {
          if (oldTableId) {
            get().updateTableStatus(oldTableId, "available");
          }
          if (newTableId) {
            get().updateTableStatus(newTableId, "occupied", editingOrderId);
          }
        }

        get().addAuditEntry({
          action: "order_edited",
          userId: get().currentUser?.name || "System",
          details: `Order ${editingOrderId.toUpperCase()} was edited`,
          orderId: editingOrderId,
        });
      },

      cancelEditOrder: () => {
        set({
          editingOrderId: null,
          cart: [],
          selectedTable: null,
          customerName: "",
          orderNotes: "",
        });
      },

      setOrderType: (type) => set({ orderType: type }),
      setSelectedTable: (tableId) => set({ selectedTable: tableId }),
      setCustomerName: (name) => set({ customerName: name }),
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
      orders: [],

      addOrder: (orderData) => {
        const id = `ord-${Date.now()}`;
        const newOrder: Order = {
          ...orderData,
          id,
          createdAt: new Date(),
          createdBy: get().currentUser?.name || "System",
        };
        set((state) => ({
          orders: [newOrder, ...state.orders],
        }));

        get().enqueueMutation("order.create", { order: newOrder });

        get().addAuditEntry({ action: "order_created", userId: newOrder.createdBy || "System", details: `Order ${id} created`, orderId: id });

        // Update table status if dine-in
        if (orderData.type === "dine-in" && orderData.tableId) {
          get().updateTableStatus(orderData.tableId, "occupied", id);
        }

        // Clear cart after order
        get().clearCart();
      },

      updateOrder: (orderId, data) => {
        set((state) => ({
          orders: state.orders.map((order) =>
            order.id === orderId ? { ...order, ...data } : order
          ),
        }));
        get().enqueueMutation("order.update", { id: orderId, changes: data });
      },

      updateOrderStatus: (orderId, status) => {
        set((state) => ({
          orders: state.orders.map((order) =>
            order.id === orderId ? { ...order, status } : order
          ),
        }));
        get().enqueueMutation("order.update", { id: orderId, changes: { status } });

        // Update table status if order is completed
        if (status === "completed") {
          const order = get().orders.find((o) => o.id === orderId);
          if (order?.tableId) {
            get().updateTableStatus(order.tableId, "available");
          }
        }
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

        get().addAuditEntry({
          action: "void",
          userId: get().currentUser?.name || "System",
          details: `Order ${orderId.toUpperCase()} was voided/deleted`,
          orderId: orderId,
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
        const userName = get().currentUser?.name || "System";
        set({
          orders: [],
          tables: initialTables,
          menuItems: defaultMenuItems,
          staffMembers: defaultStaffMembers,
          cart: [],
          isLoggedIn: false,
          currentUser: null,
        });
        get().addAuditEntry({ action: "data_clear", userId: userName, details: "All data cleared" });
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
      },
    }),
    {
      name: "suhashi-pos-storage",
      version: STORE_VERSION,
      partialize: (state) => ({
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
