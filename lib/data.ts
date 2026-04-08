// Menu Categories and Items based on SUHASHI Cafe menu
export const categories = [
  { id: "tea", name: "Tea", icon: "leaf" },
  { id: "coffee", name: "Coffee", icon: "coffee" },
  { id: "drinks", name: "Drinks", icon: "cup-soda" },
] as const;

export type Category = (typeof categories)[number];

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  variants?: { name: string; price: number }[];
  available: boolean;
}

export const menuItems: MenuItem[] = [
  // Tea
  { id: "tea-1", name: "Red Tea", price: 60, category: "tea", available: true },
  { id: "tea-2", name: "Ginger Tea", price: 70, category: "tea", available: true },
  { id: "tea-3", name: "Lemongrass Tea", price: 100, category: "tea", available: true },
  { id: "tea-4", name: "Honey Ginger Tea", price: 100, category: "tea", available: true },
  { id: "tea-5", name: "Lemon Tea", price: 70, category: "tea", available: true },
  
  // Coffee
  { id: "coffee-1", name: "Espresso", price: 70, category: "coffee", variants: [{ name: "Single", price: 70 }, { name: "Double", price: 90 }], available: true },
  { id: "coffee-2", name: "Cappuccino", price: 120, category: "coffee", available: true },
  { id: "coffee-3", name: "Latte", price: 120, category: "coffee", available: true },
  { id: "coffee-4", name: "Americano", price: 100, category: "coffee", available: true },
  { id: "coffee-5", name: "Cinnamon Latte", price: 140, category: "coffee", available: true },
  { id: "coffee-6", name: "Hazelnut", price: 160, category: "coffee", available: true },
  { id: "coffee-7", name: "Caramel", price: 160, category: "coffee", available: true },
  { id: "coffee-8", name: "Mocha", price: 150, category: "coffee", available: true },
  { id: "coffee-9", name: "Spanish Latte", price: 150, category: "coffee", available: true },
  { id: "coffee-10", name: "Vietnamese", price: 150, category: "coffee", available: true },
  { id: "coffee-11", name: "Irish", price: 150, category: "coffee", available: true },
  { id: "coffee-12", name: "Hot Chocolate", price: 160, category: "coffee", available: true },
  
  // Drinks
  { id: "drink-1", name: "Green Apple", price: 150, category: "drinks", available: true },
  { id: "drink-2", name: "Passion Fruit", price: 150, category: "drinks", available: true },
  { id: "drink-3", name: "Peach Iced Tea", price: 150, category: "drinks", available: true },
  { id: "drink-4", name: "Iced Americano", price: 140, category: "drinks", available: true },
  { id: "drink-5", name: "Iced Latte", price: 150, category: "drinks", available: true },
  { id: "drink-6", name: "Iced Mocha", price: 170, category: "drinks", available: true },
];

export interface Table {
  id: string;
  number: number;
  capacity: number;
  status: "available" | "occupied" | "waiting-payment";
  orderId?: string;
}

export const tables: Table[] = [
  { id: "t1", number: 1, capacity: 2, status: "available" },
  { id: "t2", number: 2, capacity: 2, status: "occupied", orderId: "ord-1" },
  { id: "t3", number: 3, capacity: 4, status: "available" },
  { id: "t4", number: 4, capacity: 4, status: "waiting-payment", orderId: "ord-2" },
  { id: "t5", number: 5, capacity: 6, status: "available" },
  { id: "t6", number: 6, capacity: 2, status: "occupied", orderId: "ord-3" },
  { id: "t7", number: 7, capacity: 4, status: "available" },
  { id: "t8", number: 8, capacity: 4, status: "available" },
];

export type OrderType = "dine-in" | "takeaway" | "delivery" | "aggregator";
export type OrderStatus = "new" | "preparing" | "ready" | "completed" | "cancelled";

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  variant?: string;
  notes?: string;
}

export interface Order {
  id: string;
  type: OrderType;
  status: OrderStatus;
  tableId?: string;
  items: OrderItem[];
  total: number;
  createdAt: Date;
  customerName?: string;
  platform?: "swiggy" | "zomato";
}

export const sampleOrders: Order[] = [
  {
    id: "ord-1",
    type: "dine-in",
    status: "preparing",
    tableId: "t2",
    items: [
      { id: "oi-1", menuItemId: "coffee-2", name: "Cappuccino", price: 120, quantity: 2 },
      { id: "oi-2", menuItemId: "tea-3", name: "Lemongrass Tea", price: 100, quantity: 1 },
    ],
    total: 340,
    createdAt: new Date(Date.now() - 15 * 60000),
  },
  {
    id: "ord-2",
    type: "dine-in",
    status: "ready",
    tableId: "t4",
    items: [
      { id: "oi-3", menuItemId: "coffee-8", name: "Mocha", price: 150, quantity: 1 },
      { id: "oi-4", menuItemId: "drink-5", name: "Iced Latte", price: 150, quantity: 1 },
    ],
    total: 300,
    createdAt: new Date(Date.now() - 25 * 60000),
  },
  {
    id: "ord-3",
    type: "dine-in",
    status: "new",
    tableId: "t6",
    items: [
      { id: "oi-5", menuItemId: "coffee-3", name: "Latte", price: 120, quantity: 3 },
    ],
    total: 360,
    createdAt: new Date(Date.now() - 2 * 60000),
  },
  {
    id: "ord-4",
    type: "aggregator",
    status: "new",
    platform: "swiggy",
    customerName: "Rahul S.",
    items: [
      { id: "oi-6", menuItemId: "drink-4", name: "Iced Americano", price: 140, quantity: 2 },
      { id: "oi-7", menuItemId: "coffee-7", name: "Caramel", price: 160, quantity: 1 },
    ],
    total: 440,
    createdAt: new Date(Date.now() - 5 * 60000),
  },
  {
    id: "ord-5",
    type: "takeaway",
    status: "preparing",
    customerName: "Priya M.",
    items: [
      { id: "oi-8", menuItemId: "coffee-9", name: "Spanish Latte", price: 150, quantity: 1 },
    ],
    total: 150,
    createdAt: new Date(Date.now() - 8 * 60000),
  },
];
