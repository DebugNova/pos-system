import { create } from "zustand";
import type { Order, OrderItem, OrderType, Table } from "./data";
import { tables as initialTables, sampleOrders } from "./data";

interface CartItem extends Omit<OrderItem, "id"> {
  tempId: string;
}

interface User {
  name: string;
  role: string;
  pin: string;
}

interface POSState {
  // Auth
  isLoggedIn: boolean;
  currentUser: User | null;
  login: (user: User) => void;
  logout: () => void;

  // Navigation
  activeView: "dashboard" | "orders" | "tables" | "kitchen" | "reports" | "settings" | "aggregator" | "billing" | "history";
  setActiveView: (view: POSState["activeView"]) => void;

  // Cart
  cart: CartItem[];
  orderType: OrderType;
  selectedTable: string | null;
  customerName: string;
  addToCart: (item: Omit<CartItem, "tempId">) => void;
  removeFromCart: (tempId: string) => void;
  updateQuantity: (tempId: string, quantity: number) => void;
  updateItemNotes: (tempId: string, notes: string) => void;
  updateItemVariant: (tempId: string, variant: string) => void;
  clearCart: () => void;
  setOrderType: (type: OrderType) => void;
  setSelectedTable: (tableId: string | null) => void;
  setCustomerName: (name: string) => void;

  // Orders
  orders: Order[];
  addOrder: (order: Omit<Order, "id" | "createdAt">) => void;
  updateOrderStatus: (orderId: string, status: Order["status"]) => void;

  // Tables
  tables: Table[];
  updateTableStatus: (tableId: string, status: Table["status"], orderId?: string) => void;
  mergeTable: (sourceTableId: string, targetTableId: string) => void;
  splitTable: (tableId: string) => void;
  moveTable: (orderId: string, newTableId: string) => void;

  // Cart Total
  getCartTotal: () => number;
}

export const usePOSStore = create<POSState>((set, get) => ({
  // Auth
  isLoggedIn: false,
  currentUser: null,
  login: (user) => set({ isLoggedIn: true, currentUser: user }),
  logout: () => set({ isLoggedIn: false, currentUser: null, activeView: "dashboard" }),

  // Navigation
  activeView: "dashboard",
  setActiveView: (view) => set({ activeView: view }),

  // Cart
  cart: [],
  orderType: "dine-in",
  selectedTable: null,
  customerName: "",

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

  clearCart: () => set({ cart: [], selectedTable: null, customerName: "" }),

  setOrderType: (type) => set({ orderType: type }),
  setSelectedTable: (tableId) => set({ selectedTable: tableId }),
  setCustomerName: (name) => set({ customerName: name }),

  // Orders
  orders: sampleOrders,

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

  // Tables
  tables: initialTables,

  updateTableStatus: (tableId, status, orderId) => {
    set((state) => ({
      tables: state.tables.map((table) =>
        table.id === tableId
          ? { ...table, status, orderId: orderId || undefined }
          : table
      ),
    }));
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

  // Cart Total
  getCartTotal: () => {
    return get().cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  },
}));
