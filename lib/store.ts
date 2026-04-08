import { create } from "zustand";
import type { Order, OrderItem, OrderType, Table } from "./data";
import { tables as initialTables, sampleOrders } from "./data";

interface CartItem extends Omit<OrderItem, "id"> {
  tempId: string;
}

interface POSState {
  // Navigation
  activeView: "dashboard" | "orders" | "tables" | "kitchen" | "reports" | "settings";
  setActiveView: (view: POSState["activeView"]) => void;

  // Cart
  cart: CartItem[];
  orderType: OrderType;
  selectedTable: string | null;
  customerName: string;
  addToCart: (item: Omit<CartItem, "tempId">) => void;
  removeFromCart: (tempId: string) => void;
  updateQuantity: (tempId: string, quantity: number) => void;
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

  // Cart Total
  getCartTotal: () => number;
}

export const usePOSStore = create<POSState>((set, get) => ({
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

  // Cart Total
  getCartTotal: () => {
    return get().cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  },
}));
