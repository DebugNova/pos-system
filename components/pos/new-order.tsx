"use client";

import { useState } from "react";
import { usePOSStore } from "@/lib/store";
import { categories, type MenuItem } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  User,
  Edit3,
  X,
  ArrowLeft,
  Save,
  Pencil,
} from "lucide-react";

const orderTypes = [
  { id: "dine-in", label: "Dine In", icon: UtensilsCrossed },
  { id: "takeaway", label: "Takeaway", icon: ShoppingBag },
  { id: "delivery", label: "Delivery", icon: Bike },
  { id: "aggregator", label: "Online", icon: Store },
] as const;

const categoryIcons: Record<string, React.ElementType> = {
  tea: Leaf,
  coffee: Coffee,
  drinks: CupSoda,
};

const modifiers = [
  { id: "extra-shot", name: "Extra Shot", price: 30 },
  { id: "oat-milk", name: "Oat Milk", price: 40 },
  { id: "sugar-free", name: "Sugar Free", price: 0 },
  { id: "less-ice", name: "Less Ice", price: 0 },
  { id: "extra-hot", name: "Extra Hot", price: 0 },
];

export function NewOrder() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [itemNotes, setItemNotes] = useState("");
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [showModifierDialog, setShowModifierDialog] = useState(false);
  const [currentMenuItem, setCurrentMenuItem] = useState<MenuItem | null>(null);

  const {
    cart,
    orderType,
    selectedTable,
    customerName,
    orderNotes,
    editingOrderId,
    tables,
    menuItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    updateItemNotes,
    updateItemVariant,
    clearCart,
    setOrderType,
    setSelectedTable,
    setCustomerName,
    setOrderNotes,
    addOrder,
    saveEditOrder,
    cancelEditOrder,
    getCartTotal,
    setActiveView,
  } = usePOSStore();

  const isEditing = !!editingOrderId;

  const filteredItems = menuItems.filter((item) => {
    const matchesSearch = item.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCategory =
      activeCategory === "all" || item.category === activeCategory;
    return matchesSearch && matchesCategory && item.available;
  });

  // When editing, include the table currently assigned to this order as available
  const editingOrder = isEditing ? usePOSStore.getState().orders.find((o) => o.id === editingOrderId) : null;
  const availableTables = tables.filter((t) =>
    t.status === "available" || (isEditing && editingOrder?.tableId === t.id)
  );

  const handleAddItem = (item: MenuItem) => {
    if (item.variants && item.variants.length > 0) {
      setCurrentMenuItem(item);
      setSelectedVariant(item.variants[0].name);
      setShowModifierDialog(true);
    } else {
      addToCart({
        menuItemId: item.id,
        name: item.name,
        price: item.price,
        quantity: 1,
      });
    }
  };

  const handleAddWithModifiers = () => {
    if (!currentMenuItem) return;

    const variant = currentMenuItem.variants?.find((v) => v.name === selectedVariant);
    const price = variant ? variant.price : currentMenuItem.price;

    addToCart({
      menuItemId: currentMenuItem.id,
      name: currentMenuItem.name,
      price: price,
      quantity: 1,
      variant: selectedVariant || undefined,
      notes: itemNotes || undefined,
    });

    setShowModifierDialog(false);
    setCurrentMenuItem(null);
    setSelectedVariant("");
    setItemNotes("");
  };

  const handlePlaceOrder = () => {
    if (cart.length === 0) return;
    if (orderType === "dine-in" && !selectedTable) return;

    addOrder({
      type: orderType,
      status: "new",
      tableId: orderType === "dine-in" ? selectedTable || undefined : undefined,
      customerName: customerName || undefined,
      orderNotes: orderNotes || undefined,
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

  const handleSendToKitchen = () => {
    if (cart.length === 0) return;
    if (orderType === "dine-in" && !selectedTable) return;

    addOrder({
      type: orderType,
      status: "new",
      tableId: orderType === "dine-in" ? selectedTable || undefined : undefined,
      customerName: customerName || undefined,
      orderNotes: orderNotes || undefined,
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

  const handleEditItemNotes = (tempId: string) => {
    const item = cart.find((i) => i.tempId === tempId);
    if (item) {
      setEditingItem(tempId);
      setItemNotes(item.notes || "");
    }
  };

  const handleSaveItemNotes = () => {
    if (editingItem) {
      updateItemNotes(editingItem, itemNotes);
      setEditingItem(null);
      setItemNotes("");
    }
  };

  return (
    <div className="flex h-full flex-row">
      {/* Menu Section */}
      <div className="flex flex-1 flex-col border-r border-border">
        {/* Order Type Selection */}
        <div className="flex gap-2 border-b border-border p-3 lg:p-4">
          {orderTypes.map((type) => {
            const Icon = type.icon;
            const isActive = orderType === type.id;
            return (
              <Button
                key={type.id}
                variant={isActive ? "default" : "secondary"}
                size="lg"
                className={cn(
                  "flex-1 gap-1.5 h-11 text-sm lg:h-14 lg:gap-2 lg:text-base",
                  isActive && "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                )}
                onClick={() => setOrderType(type.id as typeof orderType)}
              >
                <Icon className="h-4 w-4 lg:h-5 lg:w-5" />
                <span className="hidden sm:inline">{type.label}</span>
              </Button>
            );
          })}
        </div>

        {/* Table Selection for Dine-in */}
        {orderType === "dine-in" && (
          <div className="flex gap-3 border-b border-border p-3 lg:gap-4 lg:p-4">
            <span className="flex items-center text-xs text-muted-foreground lg:text-sm">
              Table:
            </span>
            {availableTables.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 lg:gap-2">
                {availableTables.map((table) => (
                  <Button
                    key={table.id}
                    variant={selectedTable === table.id ? "default" : "outline"}
                    size="sm"
                    className="min-w-[52px] h-9 text-xs lg:min-w-[60px] lg:h-10 lg:text-sm"
                    onClick={() => setSelectedTable(table.id)}
                  >
                    T{table.number}
                  </Button>
                ))}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground lg:text-sm">
                No tables available
              </span>
            )}
          </div>
        )}

        {/* Customer Name & Order Notes (for all order types) */}
        <div className="flex flex-col gap-2 border-b border-border p-3 lg:flex-row lg:gap-4 lg:p-4">
          <div className="flex flex-1 items-center gap-2">
            <User className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              placeholder="Customer name (optional)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="flex-1 h-9 bg-secondary border-none text-sm lg:h-10"
            />
          </div>
          <div className="flex flex-1 items-center gap-2">
            <Edit3 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              placeholder="Order note (optional)"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              className="flex-1 h-9 bg-secondary border-none text-sm lg:h-10"
            />
          </div>
        </div>

        {/* Search & Categories */}
        <div className="flex gap-3 border-b border-border p-3 lg:gap-4 lg:p-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 bg-background border border-border rounded-full text-sm lg:h-12 shadow-sm focus-visible:ring-primary"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-1.5 overflow-x-auto border-b border-border px-3 py-2.5 lg:gap-2 lg:px-4 lg:py-3">
          <Button
            variant={activeCategory === "all" ? "default" : "secondary"}
            size="sm"
            onClick={() => setActiveCategory("all")}
            className="shrink-0 rounded-full font-medium"
          >
            All Items
          </Button>
          {categories.map((cat) => {
            const Icon = categoryIcons[cat.id];
            return (
              <Button
                key={cat.id}
                variant={activeCategory === cat.id ? "default" : "secondary"}
                size="sm"
                onClick={() => setActiveCategory(cat.id)}
                className="shrink-0 gap-1.5 rounded-full font-medium"
              >
                {Icon && <Icon className="h-4 w-4" />}
                {cat.name}
              </Button>
            );
          })}
        </div>

        {/* Menu Grid */}
        <div className="flex-1 overflow-y-auto p-3 lg:p-4">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 lg:gap-3">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleAddItem(item)}
                className="group relative flex flex-col items-start overflow-hidden rounded-2xl border border-border/40 bg-card shadow-sm p-3.5 text-left transition-all duration-200 hover:shadow-md hover:border-primary/40 active:scale-[0.97] lg:p-4"
              >
                {/* Subtle glow effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 transition-all duration-300 group-hover:from-primary/5 group-hover:to-primary/10" />
                
                {/* Content */}
                <div className="relative z-10 flex w-full flex-col">
                  <span className="text-sm font-semibold text-foreground transition-colors group-hover:text-primary lg:text-base">
                    {item.name}
                  </span>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-lg font-bold text-primary lg:text-xl">
                      {item.price.toLocaleString("en-IN", {
                        style: "currency",
                        currency: "INR",
                        minimumFractionDigits: 0,
                      })}
                    </span>
                    {/* Add indicator */}
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary opacity-0 transition-all group-hover:opacity-100">
                      <Plus className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  {item.variants && (
                    <Badge variant="outline" className="mt-2 w-fit border-primary/30 bg-primary/10 text-[10px] text-primary lg:text-xs">
                      {item.variants.length} variants
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cart Section */}
      <div className="flex w-72 shrink-0 flex-col bg-card shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-10 border-l border-border/50 sm:w-80 lg:w-80 xl:w-96">
        <CardHeader className="border-b border-border">
          {isEditing && (
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2">
              <Pencil className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">
                Editing {editingOrderId?.toUpperCase()}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={cancelEditOrder}
              >
                Cancel
              </Button>
            </div>
          )}
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{isEditing ? "Edit Order" : "Current Order"}</CardTitle>
            {cart.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={isEditing ? cancelEditOrder : clearCart}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <Badge variant="outline">{orderType}</Badge>
            {selectedTable && (
              <Badge variant="secondary">
                Table {selectedTable.replace("t", "")}
              </Badge>
            )}
            {customerName && (
              <Badge variant="secondary">{customerName}</Badge>
            )}
            {orderNotes && (
              <Badge variant="outline" className="max-w-[120px] truncate text-xs">
                {orderNotes}
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
                    className="rounded-lg bg-secondary/50 p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{item.name}</p>
                        {item.variant && (
                          <p className="text-xs text-muted-foreground">{item.variant}</p>
                        )}
                        <p className="text-sm text-primary">
                          {item.price.toLocaleString("en-IN", {
                            style: "currency",
                            currency: "INR",
                            minimumFractionDigits: 0,
                          })}
                        </p>
                        {item.notes && (
                          <p className="mt-1 text-xs text-muted-foreground italic">
                            Note: {item.notes}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground"
                        onClick={() => handleEditItemNotes(item.tempId)}
                      >
                        <Edit3 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
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
                      <span className="w-8 text-center font-medium text-foreground">
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
                      <span className="ml-auto font-semibold text-foreground">
                        {(item.price * item.quantity).toLocaleString("en-IN", {
                          style: "currency",
                          currency: "INR",
                          minimumFractionDigits: 0,
                        })}
                      </span>
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

            {isEditing ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1 h-14"
                  onClick={cancelEditOrder}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button
                  size="lg"
                  className="flex-1 h-14 bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={
                    cart.length === 0 ||
                    (orderType === "dine-in" && !selectedTable)
                  }
                  onClick={() => {
                    saveEditOrder();
                    setActiveView("tables");
                  }}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Update Order
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1 h-14"
                  disabled={cart.length === 0}
                  onClick={handleSendToKitchen}
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
            )}
          </div>
        </CardContent>
      </div>

      {/* Modifier Dialog */}
      <Dialog open={showModifierDialog} onOpenChange={setShowModifierDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentMenuItem?.name}</DialogTitle>
            <DialogDescription>
              Select variant and add notes
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {/* Variants */}
            {currentMenuItem?.variants && currentMenuItem.variants.length > 0 && (
              <div className="space-y-2">
                <Label>Variant</Label>
                <div className="flex flex-wrap gap-2">
                  {currentMenuItem.variants.map((variant) => (
                    <Button
                      key={variant.name}
                      variant={selectedVariant === variant.name ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedVariant(variant.name)}
                    >
                      {variant.name} - {variant.price.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label>Special Instructions</Label>
              <Textarea
                placeholder="Add notes (e.g., less sugar, extra hot)"
                value={itemNotes}
                onChange={(e) => setItemNotes(e.target.value)}
                className="bg-secondary border-none"
              />
            </div>

            {/* Quick modifiers */}
            <div className="space-y-2">
              <Label>Quick Options</Label>
              <div className="flex flex-wrap gap-2">
                {modifiers.map((mod) => (
                  <Button
                    key={mod.id}
                    variant="outline"
                    size="sm"
                    onClick={() => setItemNotes((prev) => prev ? `${prev}, ${mod.name}` : mod.name)}
                  >
                    {mod.name}
                    {mod.price > 0 && ` (+₹${mod.price})`}
                  </Button>
                ))}
              </div>
            </div>

            <Button className="w-full" onClick={handleAddWithModifiers}>
              Add to Order
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Notes Dialog */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Notes</DialogTitle>
            <DialogDescription>
              Add special instructions for this item
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Textarea
              placeholder="Add notes..."
              value={itemNotes}
              onChange={(e) => setItemNotes(e.target.value)}
              className="bg-secondary border-none"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditingItem(null)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSaveItemNotes}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
