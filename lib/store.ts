import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Order, OrderItem, OrderType, Table, MenuItem } from "./data";
import { tables as initialTables, menuItems as defaultMenuItems } from "./data";

// Version to force refresh when data structure changes
const STORE_VERSION = 2;

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

  // Cart
  cart: CartItem[];
  orderType: OrderType;
  selectedTable: string | null;
  customerName: string;
  orderNotes: string;
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
  splitTable: (tableId: string) => void;
  moveTable: (orderId: string, newTableId: string) => void;

  // Data Management
  clearAllData: () => void;
  exportData: () => string;
  importData: (data: string) => boolean;

  // Cart Total
  getCartTotal: () => number;
}

const defaultStaffMembers: StaffMember[] = [
  { id: "1", name: "Admin", role: "Admin", pin: "1111", initials: "AD" },
  { id: "2", name: "Rahul S.", role: "Cashier", pin: "1111", initials: "RS" },
  { id: "3", name: "Priya P.", role: "Server", pin: "1111", initials: "PP" },
  { id: "4", name: "Amit K.", role: "Kitchen", pin: "1111", initials: "AK" },
];

export const usePOSStore = create<POSState>()(
  persist(
    (set, get) => ({
      // Auth
      isLoggedIn: false,
      currentUser: null,
      staffMembers: defaultStaffMembers,
      login: (user) => set({ isLoggedIn: true, currentUser: user }),
      logout: () => set({ isLoggedIn: false, currentUser: null, activeView: "dashboard" }),
      addStaffMember: (staff) => set((state) => ({ staffMembers: [...state.staffMembers, staff] })),
      updateStaffMember: (id, data) => set((state) => ({
        staffMembers: state.staffMembers.map((s) => s.id === id ? { ...s, ...data } : s)
      })),
      deleteStaffMember: (id) => set((state) => ({
        staffMembers: state.staffMembers.filter((s) => s.id !== id)
      })),

      // Navigation
      activeView: "dashboard",
      setActiveView: (view) => set({ activeView: view }),

      // Cart
      cart: [],
      orderType: "dine-in",
      selectedTable: null,
      customerName: "",
      orderNotes: "",

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

      clearCart: () => set({ cart: [], selectedTable: null, customerName: "", orderNotes: "" }),

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
        };
        set((state) => ({
          orders: [newOrder, ...state.orders],
        }));

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
      },

      updateOrderStatus: (orderId, status) => {
        set((state) => ({
          orders: state.orders.map((order) =>
            order.id === orderId ? { ...order, status } : order
          ),
        }));

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

      splitTable: (tableId) => {
        // In a real app, this would create a new order for the split items
        console.log("Split table:", tableId);
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
      clearAllData: () => set({
        orders: [],
        tables: initialTables,
        menuItems: defaultMenuItems,
        staffMembers: defaultStaffMembers,
        cart: [],
        isLoggedIn: false,
        currentUser: null,
      }),

      exportData: () => {
        const state = get();
        const exportObj = {
          orders: state.orders,
          tables: state.tables,
          menuItems: state.menuItems,
          staffMembers: state.staffMembers,
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
              createdAt: new Date(o.createdAt)
            }));
          }
          set({
            orders: data.orders || [],
            tables: data.tables || initialTables,
            menuItems: data.menuItems || defaultMenuItems,
            staffMembers: data.staffMembers || defaultStaffMembers,
          });
          return true;
        } catch {
          return false;
        }
      },

      // Cart Total
      getCartTotal: () => {
        return get().cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
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
      }),
      migrate: (persistedState, version) => {
        // Reset tables to default when version changes
        if (version < STORE_VERSION) {
          const state = persistedState as Partial<POSState>;
          return {
            ...state,
            tables: initialTables,
          };
        }
        return persistedState as POSState;
      },
      onRehydrateStorage: () => (state) => {
        // Convert date strings back to Date objects after rehydration
        if (state?.orders) {
          state.orders = state.orders.map((o) => ({
            ...o,
            createdAt: new Date(o.createdAt)
          }));
        }
      },
    }
  )
);
