"use client";

import { useState } from "react";
import { usePOSStore } from "@/lib/store";
import { categories, menuItems, type MenuItem } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  UtensilsCrossed,
  ShoppingBag,
  Bike,
  Store,
  Leaf,
  Coffee,
  CupSoda,
  Printer,
  CreditCard,
} from "lucide-react";

const orderTypes = [
  { id: "dine-in", label: "Dine In", icon: UtensilsCrossed },
  { id: "takeaway", label: "Takeaway", icon: ShoppingBag },
  { id: "delivery", label: "Delivery", icon: Bike },
  { id: "aggregator", label: "Online", icon: Store },
] as const;

const categoryIcons = {
  tea: Leaf,
  coffee: Coffee,
  drinks: CupSoda,
};

export function NewOrder() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const {
    cart,
    orderType,
    selectedTable,
    tables,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    setOrderType,
    setSelectedTable,
    addOrder,
    getCartTotal,
    setActiveView,
  } = usePOSStore();

  const filteredItems = menuItems.filter((item) => {
    const matchesSearch = item.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCategory =
      activeCategory === "all" || item.category === activeCategory;
    return matchesSearch && matchesCategory && item.available;
  });

  const availableTables = tables.filter((t) => t.status === "available");

  const handleAddItem = (item: MenuItem) => {
    addToCart({
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
    });
  };

  const handlePlaceOrder = () => {
    if (cart.length === 0) return;
    if (orderType === "dine-in" && !selectedTable) return;

    addOrder({
      type: orderType,
      status: "new",
      tableId: orderType === "dine-in" ? selectedTable || undefined : undefined,
      items: cart.map((item, index) => ({
        id: `oi-${Date.now()}-${index}`,
        menuItemId: item.menuItemId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        variant: item.variant,
        notes: item.notes,
      })),
      total: getCartTotal(),
    });

    setActiveView("kitchen");
  };

  return (
    <div className="flex h-full">
      {/* Menu Section */}
      <div className="flex flex-1 flex-col border-r border-border">
        {/* Order Type Selection */}
        <div className="flex gap-2 border-b border-border p-4">
          {orderTypes.map((type) => {
            const Icon = type.icon;
            const isActive = orderType === type.id;
            return (
              <Button
                key={type.id}
                variant={isActive ? "default" : "secondary"}
                size="lg"
                className={cn(
                  "flex-1 gap-2 h-14 text-base",
                  isActive && "bg-primary text-primary-foreground"
                )}
                onClick={() => setOrderType(type.id as typeof orderType)}
              >
                <Icon className="h-5 w-5" />
                {type.label}
              </Button>
            );
          })}
        </div>

        {/* Table Selection for Dine-in */}
        {orderType === "dine-in" && (
          <div className="flex gap-2 overflow-x-auto border-b border-border p-4">
            <span className="flex items-center text-sm text-muted-foreground">
              Table:
            </span>
            {availableTables.length > 0 ? (
              availableTables.map((table) => (
                <Button
                  key={table.id}
                  variant={selectedTable === table.id ? "default" : "outline"}
                  size="sm"
                  className="min-w-[60px]"
                  onClick={() => setSelectedTable(table.id)}
                >
                  T{table.number}
                </Button>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">
                No tables available
              </span>
            )}
          </div>
        )}

        {/* Search & Categories */}
        <div className="flex gap-4 border-b border-border p-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 bg-secondary border-none"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto border-b border-border px-4 py-3">
          <Button
            variant={activeCategory === "all" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveCategory("all")}
            className="shrink-0"
          >
            All Items
          </Button>
          {categories.map((cat) => {
            const Icon = categoryIcons[cat.id];
            return (
              <Button
                key={cat.id}
                variant={activeCategory === cat.id ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveCategory(cat.id)}
                className="shrink-0 gap-1.5"
              >
                <Icon className="h-4 w-4" />
                {cat.name}
              </Button>
            );
          })}
        </div>

        {/* Menu Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleAddItem(item)}
                className="flex flex-col items-start rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/50 hover:bg-secondary/50 active:scale-[0.98]"
              >
                <span className="text-base font-medium text-foreground">
                  {item.name}
                </span>
                <span className="mt-1 text-lg font-bold text-primary">
                  {item.price.toLocaleString("en-IN", {
                    style: "currency",
                    currency: "INR",
                    minimumFractionDigits: 0,
                  })}
                </span>
                {item.variants && (
                  <Badge variant="secondary" className="mt-2 text-xs">
                    {item.variants.length} variants
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cart Section */}
      <div className="flex w-96 flex-col bg-card">
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Current Order</CardTitle>
            {cart.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCart}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{orderType}</Badge>
            {selectedTable && (
              <Badge variant="secondary">
                Table {selectedTable.replace("t", "")}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col p-0">
          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4">
            {cart.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                <ShoppingBag className="mb-2 h-12 w-12 opacity-30" />
                <p>No items in cart</p>
                <p className="text-sm">Tap items to add</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.tempId}
                    className="flex items-center justify-between rounded-lg bg-secondary/50 p-3"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{item.name}</p>
                      <p className="text-sm text-primary">
                        {item.price.toLocaleString("en-IN", {
                          style: "currency",
                          currency: "INR",
                          minimumFractionDigits: 0,
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          updateQuantity(item.tempId, item.quantity - 1)
                        }
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center font-medium text-foreground">
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          updateQuantity(item.tempId, item.quantity + 1)
                        }
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Summary */}
          <div className="border-t border-border p-4">
            <div className="mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-foreground">
                  {getCartTotal().toLocaleString("en-IN", {
                    style: "currency",
                    currency: "INR",
                    minimumFractionDigits: 0,
                  })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax (5%)</span>
                <span className="text-foreground">
                  {(getCartTotal() * 0.05).toLocaleString("en-IN", {
                    style: "currency",
                    currency: "INR",
                    minimumFractionDigits: 0,
                  })}
                </span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span className="text-foreground">Total</span>
                <span className="text-primary">
                  {(getCartTotal() * 1.05).toLocaleString("en-IN", {
                    style: "currency",
                    currency: "INR",
                    minimumFractionDigits: 0,
                  })}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="lg"
                className="flex-1 h-14"
                disabled={cart.length === 0}
              >
                <Printer className="mr-2 h-4 w-4" />
                KOT
              </Button>
              <Button
                size="lg"
                className="flex-1 h-14 bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={
                  cart.length === 0 ||
                  (orderType === "dine-in" && !selectedTable)
                }
                onClick={handlePlaceOrder}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Place Order
              </Button>
            </div>
          </div>
        </CardContent>
      </div>
    </div>
  );
}
