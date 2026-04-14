// Menu Categories and Items based on SUHASHI Cafe menu
export const defaultCategories = [
  { id: "tea", name: "Tea", icon: "leaf" },
  { id: "coffee", name: "Coffee", icon: "coffee" },
  { id: "drinks", name: "Drinks", icon: "cup-soda" },
  { id: "pastry", name: "Pastry", icon: "cake" },
  { id: "food", name: "Food", icon: "utensils" },
];

// Keep backward-compat export used in old static imports
export const categories = defaultCategories;

export type Category = { id: string; name: string; icon?: string };

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  variants?: { name: string; price: number }[];
  available: boolean;
  image_url?: string;
  bestseller?: boolean;
  /** IDs of modifiers applicable to this item. undefined/empty = all modifiers shown */
  modifierIds?: string[];
}

export const menuItems: MenuItem[] = [
  // Tea
  { id: "tea-1", name: "Red Tea", price: 60, category: "tea", available: true, image_url: "/menu/RED TEA.png" },
  { id: "tea-2", name: "Ginger Tea", price: 70, category: "tea", available: true, image_url: "/menu/GINGER TEA.png" },
  { id: "tea-3", name: "Lemongrass Tea", price: 100, category: "tea", available: true, image_url: "/menu/LEMON GINGER TEA.png" },
  { id: "tea-4", name: "Honey Ginger Tea", price: 100, category: "tea", available: true, bestseller: true, image_url: "/menu/HONEY GINGER TEA.png" },
  { id: "tea-5", name: "Lemon Tea", price: 70, category: "tea", available: true, image_url: "/menu/LEMON GINGER TEA.png" },
  
  // Coffee
  { id: "coffee-1", name: "Espresso", price: 70, category: "coffee", variants: [{ name: "Single", price: 70 }, { name: "Double", price: 90 }], available: true, image_url: "/menu/espresso.png" },
  { id: "coffee-2", name: "Cappuccino", price: 120, category: "coffee", available: true, bestseller: true, image_url: "/menu/cappucina.png" },
  { id: "coffee-3", name: "Latte", price: 120, category: "coffee", available: true, bestseller: true, image_url: "/menu/latte.png" },
  { id: "coffee-4", name: "Americano", price: 100, category: "coffee", available: true, image_url: "/menu/americano.png" },
  { id: "coffee-5", name: "Cinnamon Latte", price: 140, category: "coffee", available: true, image_url: "/menu/cianmon latte.png" },
  { id: "coffee-6", name: "Hazelnut", price: 160, category: "coffee", available: true, image_url: "/menu/hazelnut coffee.png" },
  { id: "coffee-7", name: "Caramel", price: 160, category: "coffee", available: true, image_url: "/menu/caramel coffe.png" },
  { id: "coffee-8", name: "Mocha", price: 150, category: "coffee", available: true, image_url: "/menu/mocha.png" },
  { id: "coffee-9", name: "Spanish Latte", price: 150, category: "coffee", available: true, image_url: "/menu/spanish latte.png" },
  { id: "coffee-10", name: "Vietnamese", price: 150, category: "coffee", available: true, image_url: "/menu/vietnamese coffee.png" },
  { id: "coffee-11", name: "Irish", price: 150, category: "coffee", available: true, image_url: "/menu/irish coffee.png" },
  { id: "coffee-12", name: "Hot Chocolate", price: 160, category: "coffee", available: true, image_url: "/menu/hot choclate.png" },
  
  // Drinks
  { id: "drink-1", name: "Green Apple", price: 150, category: "drinks", available: true, image_url: "/menu/GREEN APPLE DRINK.png" },
  { id: "drink-2", name: "Passion Fruit", price: 150, category: "drinks", available: true, image_url: "/menu/PASSION FRUIT DRINK.png" },
  { id: "drink-3", name: "Peach Iced Tea", price: 150, category: "drinks", available: true, image_url: "/menu/PEACH ICED TEA.png" },
  { id: "drink-4", name: "Iced Americano", price: 140, category: "drinks", available: true, image_url: "/menu/ICED AMERICANO.png" },
  { id: "drink-5", name: "Iced Latte", price: 150, category: "drinks", available: true, image_url: "/menu/ICED LATTE.png" },
  { id: "drink-6", name: "Iced Mocha", price: 170, category: "drinks", available: true, image_url: "/menu/ICED MOCHA.png" },
  
  // Pastry
  { id: "pastry-1", name: "Brown butter chocolate chip cookie", price: 45, category: "pastry", available: true },
  { id: "pastry-2", name: "Classic lamington", price: 70, category: "pastry", available: true },
  { id: "pastry-3", name: "Blueberry lamington", price: 75, category: "pastry", available: true },
  { id: "pastry-4", name: "Strawberry Lamington", price: 75, category: "pastry", available: true },
  { id: "pastry-5", name: "Matcha Strawberry", price: 85, category: "pastry", available: true },
  { id: "pastry-6", name: "Lemon white chocolate lamington", price: 80, category: "pastry", available: true },
  { id: "pastry-7", name: "Tiramisu Tub", price: 240, category: "pastry", available: true },

  // Food
  { id: "food-1", name: "Korean creamcheese bun", price: 149, category: "food", available: true },
  { id: "food-2", name: "Chicken corn puff", price: 45, category: "food", available: true },
];

export interface Modifier {
  id: string;
  name: string;
  price: number;
}

export const defaultModifiers: Modifier[] = [
  { id: "extra-shot", name: "Extra Shot", price: 30 },
  { id: "oat-milk", name: "Oat Milk", price: 40 },
  { id: "almond-milk", name: "Almond Milk", price: 40 },
  { id: "sugar-free", name: "Sugar Free", price: 0 },
  { id: "less-ice", name: "Less Ice", price: 0 },
  { id: "extra-hot", name: "Extra Hot", price: 0 },
  { id: "whipped-cream", name: "Whipped Cream", price: 20 },
];

export interface Table {
  id: string;
  number: number;
  capacity: number;
  status: "available" | "occupied" | "waiting-payment";
  orderId?: string;
}

export const tables: Table[] = [
  { id: "t1", number: 1, capacity: 3, status: "available" },
  { id: "t2", number: 2, capacity: 3, status: "available" },
  { id: "t3", number: 3, capacity: 3, status: "available" },
  { id: "t4", number: 4, capacity: 2, status: "available" },
  { id: "t5", number: 5, capacity: 2, status: "available" },
  { id: "t6", number: 6, capacity: 3, status: "available" },
  { id: "t7", number: 7, capacity: 4, status: "available" },
];

export type OrderType = "dine-in" | "takeaway" | "delivery";
export type OrderStatus = "awaiting-payment" | "new" | "preparing" | "ready" | "served-unpaid" | "completed" | "cancelled";

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  variant?: string;
  notes?: string;
  modifiers?: Modifier[];
}

export type PaymentMethod = "cash" | "upi" | "card" | "split";

export interface PaymentRecord {
  method: PaymentMethod;
  amount: number;
  transactionId?: string;
  splitDetails?: {
    cash: number;
    upi: number;
    card: number;
  };
  cashReceived?: number;
  change?: number;
}

export interface Order {
  id: string;
  type: OrderType;
  status: OrderStatus;
  tableId?: string;
  items: OrderItem[];
  supplementaryBills?: {
    id: string;
    items: OrderItem[];
    total: number;
    createdAt: Date;
    paidAt?: Date;
    payment?: PaymentRecord;
  }[];
  total: number;
  createdAt: Date;
  customerName?: string;
  customerPhone?: string;
  orderNotes?: string;
  platform?: string;
  payment?: PaymentRecord;
  subtotal?: number;
  discount?: {
    type: "percent" | "amount";
    value: number;
    amount: number;
  };
  taxRate?: number;
  taxAmount?: number;
  grandTotal?: number;
  paidAt?: Date;
  paidBy?: string;
  refund?: {
    amount: number;
    reason?: string;
    refundedAt: Date;
    refundedBy: string;
  };
  createdBy?: string;
  payLater?: boolean;
}

export interface Shift {
  id: string;
  staffId: string;
  staffName: string;
  startedAt: Date;
  endedAt?: Date;
  openingCash: number;
  closingCash?: number;
  totalSales?: number;
  totalOrders?: number;
  notes?: string;
}

export const sampleOrders: Order[] = [];

export interface AuditEntry {
  id: string;
  timestamp: Date;
  action: "login" | "logout" | "refund" | "void" | "discount" | "order_created" | "order_edited" | "order_sent_to_kitchen" | "order_served" | "payment_recorded" | "status_changed" | "data_clear" | "data_import" | "settings_changed" | "staff_added" | "staff_deleted";
  userId: string;
  details: string;
  orderId?: string;
  metadata?: Record<string, unknown>;
}

export type MutationKind =
  | "order.create"
  | "order.update"
  | "order.delete"
  | "order.refund"
  | "payment.record"
  | "table.update"
  | "shift.start"
  | "shift.end"
  | "audit.append"
  | "settings.update"
  | "staff.upsert"
  | "staff.delete"
  | "menu.upsert"
  | "menu.delete"
  | "modifier.upsert"
  | "modifier.delete"
  | "table.upsert"
  | "table.delete";

export interface QueuedMutation {
  id: string;
  kind: MutationKind;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  lastAttemptAt?: string;
  lastError?: string;
  status: "pending" | "syncing" | "synced" | "failed";
}
