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
  image_url?: string;
  bestseller?: boolean;
}

export const menuItems: MenuItem[] = [
  // Tea
  { id: "tea-1", name: "Red Tea", price: 60, category: "tea", available: true, image_url: "https://images.unsplash.com/photo-1531969179221-3946e6b5a5e7?w=400&q=80" },
  { id: "tea-2", name: "Ginger Tea", price: 70, category: "tea", available: true, image_url: "https://images.unsplash.com/photo-1558160074-4d7d8bdf4256?w=400&q=80" },
  { id: "tea-3", name: "Lemongrass Tea", price: 100, category: "tea", available: true, image_url: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80" },
  { id: "tea-4", name: "Honey Ginger Tea", price: 100, category: "tea", available: true, bestseller: true, image_url: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80" },
  { id: "tea-5", name: "Lemon Tea", price: 70, category: "tea", available: true, image_url: "https://images.unsplash.com/photo-1558160074-4d7d8bdf4256?w=400&q=80" },
  
  // Coffee
  { id: "coffee-1", name: "Espresso", price: 70, category: "coffee", variants: [{ name: "Single", price: 70 }, { name: "Double", price: 90 }], available: true, image_url: "https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=400&q=80" },
  { id: "coffee-2", name: "Cappuccino", price: 120, category: "coffee", available: true, bestseller: true, image_url: "https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&q=80" },
  { id: "coffee-3", name: "Latte", price: 120, category: "coffee", available: true, bestseller: true, image_url: "https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?w=400&q=80" },
  { id: "coffee-4", name: "Americano", price: 100, category: "coffee", available: true, image_url: "https://images.unsplash.com/photo-1551030173-122aabc4489c?w=400&q=80" },
  { id: "coffee-5", name: "Cinnamon Latte", price: 140, category: "coffee", available: true, image_url: "https://images.unsplash.com/photo-1512568400610-62da28bc8a13?w=400&q=80" },
  { id: "coffee-6", name: "Hazelnut", price: 160, category: "coffee", available: true, image_url: "https://images.unsplash.com/photo-1534040385115-33dcb3acba5b?w=400&q=80" },
  { id: "coffee-7", name: "Caramel", price: 160, category: "coffee", available: true, image_url: "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=400&q=80" },
  { id: "coffee-8", name: "Mocha", price: 150, category: "coffee", available: true, image_url: "https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&q=80" },
  { id: "coffee-9", name: "Spanish Latte", price: 150, category: "coffee", available: true, image_url: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&q=80" },
  { id: "coffee-10", name: "Vietnamese", price: 150, category: "coffee", available: true, image_url: "https://images.unsplash.com/photo-1611162458324-aae1eb4129a4?w=400&q=80" },
  { id: "coffee-11", name: "Irish", price: 150, category: "coffee", available: true, image_url: "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=400&q=80" },
  { id: "coffee-12", name: "Hot Chocolate", price: 160, category: "coffee", available: true, image_url: "https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=400&q=80" },
  
  // Drinks
  { id: "drink-1", name: "Green Apple", price: 150, category: "drinks", available: true, image_url: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400&q=80" },
  { id: "drink-2", name: "Passion Fruit", price: 150, category: "drinks", available: true, image_url: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400&q=80" },
  { id: "drink-3", name: "Peach Iced Tea", price: 150, category: "drinks", available: true, image_url: "https://images.unsplash.com/photo-1499638673689-79a0b5115d87?w=400&q=80" },
  { id: "drink-4", name: "Iced Americano", price: 140, category: "drinks", available: true, image_url: "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=400&q=80" },
  { id: "drink-5", name: "Iced Latte", price: 150, category: "drinks", available: true, image_url: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&q=80" },
  { id: "drink-6", name: "Iced Mocha", price: 170, category: "drinks", available: true, image_url: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&q=80" },
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
  { id: "t2", number: 2, capacity: 2, status: "available" },
  { id: "t3", number: 3, capacity: 4, status: "available" },
  { id: "t4", number: 4, capacity: 4, status: "available" },
  { id: "t5", number: 5, capacity: 6, status: "available" },
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
  orderNotes?: string;
  platform?: "swiggy" | "zomato";
}

export const sampleOrders: Order[] = [];
