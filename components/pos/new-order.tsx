"use client";

import { useState, useEffect, useRef } from "react";
import { usePOSStore } from "@/lib/store";
import { categories, type MenuItem, defaultModifiers, type Modifier } from "@/lib/data";
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
import { motion, AnimatePresence } from "framer-motion";

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



export function NewOrder() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [itemNotes, setItemNotes] = useState("");
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [selectedModifiers, setSelectedModifiers] = useState<Modifier[]>([]);
  const [showModifierDialog, setShowModifierDialog] = useState(false);
  const [currentMenuItem, setCurrentMenuItem] = useState<MenuItem | null>(null);
  const [showCustomerNote, setShowCustomerNote] = useState(false);

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
    settings,
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
      openModifierDialog(item);
    } else {
      addToCart({
        menuItemId: item.id,
        name: item.name,
        price: item.price,
        quantity: 1,
      });
    }
  };

  const openModifierDialog = (item: MenuItem) => {
    setCurrentMenuItem(item);
    setSelectedVariant(item.variants && item.variants.length > 0 ? item.variants[0].name : "");
    setSelectedModifiers([]);
    setItemNotes("");
    setShowModifierDialog(true);
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
      modifiers: selectedModifiers.length > 0 ? selectedModifiers : undefined,
    });

    setShowModifierDialog(false);
    setCurrentMenuItem(null);
    setSelectedVariant("");
    setItemNotes("");
    setSelectedModifiers([]);
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
        modifiers: item.modifiers,
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
        modifiers: item.modifiers,
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

  // Keyboard Shortcuts (UX Plan §11.2)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape — close modals / clear search
      if (e.key === 'Escape') {
        setShowModifierDialog(false);
        setEditingItem(null);
        setSearchQuery("");
      }

      // Focus Search (Ctrl+K / ⌘K)
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
      }

      // Skip remaining shortcuts when user is typing in an input
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      // Quick Table Selection (1-9)
      if (e.key >= '1' && e.key <= '9') {
        const tableNum = parseInt(e.key);
        const table = availableTables.find(t => t.number === tableNum);
        if (table) setSelectedTable(table.id);
      }

      // Ctrl+Enter → KOT, Ctrl+Shift+Enter → Place Order
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) handlePlaceOrder();
        else handleSendToKitchen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <div className="flex h-full flex-row">
      {/* Menu Section */}
      <div className="flex flex-1 flex-col min-h-0 border-r border-border bg-background">
        {/* Order Type Selection */}
        <div className="flex items-center gap-2 border-b border-border h-20 lg:h-24 px-3 lg:px-4 shrink-0">
          {orderTypes.map((type) => {
            const Icon = type.icon;
            const isActive = orderType === type.id;
            return (
              <Button
                key={type.id}
                variant={isActive ? "default" : "secondary"}
                size="lg"
                className={cn(
                  "flex-1 gap-1.5 h-12 text-sm lg:h-14 lg:gap-2 lg:text-base",
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
          <div className="flex flex-col gap-2 border-b border-border p-3 lg:gap-3 lg:p-4 bg-card/50">
            <span className="flex items-center text-xs font-semibold text-foreground lg:text-sm">
              Select Table
            </span>
            {availableTables.length > 0 ? (
              <div className="flex flex-wrap gap-2 lg:gap-3">
                {availableTables.map((table) => {
                  const isSelected = selectedTable === table.id;
                  const isOccupied = table.status === "occupied" || table.status === "waiting-payment";
                  return (
                  <button
                    key={table.id}
                    onClick={() => setSelectedTable(table.id)}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-xl border p-2 transition-all min-w-[64px] lg:min-w-[72px]",
                      isSelected 
                        ? "border-primary bg-primary text-primary-foreground shadow-md"
                        : isOccupied 
                          ? "border-warning/50 bg-warning/10 text-foreground"
                          : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-primary/5"
                    )}
                  >
                    <span className="text-sm font-bold lg:text-base">T{table.number}</span>
                    <span className="text-[10px] opacity-80">{table.capacity}p</span>
                    <div className="mt-1 flex gap-0.5">
                      {Array.from({ length: Math.min(table.capacity, 4) }).map((_, i) => (
                        <div key={i} className={cn("h-1.5 w-1.5 rounded-full", isSelected ? "bg-primary-foreground" : isOccupied ? "bg-warning" : "bg-success")} />
                      ))}
                      {table.capacity > 4 && <div className="h-1.5 w-1.5 rounded-full bg-transparent text-[8px] leading-[6px] tracking-tighter opacity-70">+</div>}
                    </div>
                  </button>
                )})}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground lg:text-sm">
                No tables available
              </span>
            )}
          </div>
        )}

        {/* Customer & Note Chip */}
        <div className="border-b border-border p-3 lg:p-4">
          {!showCustomerNote && (!customerName && !orderNotes) ? (
            <button
              onClick={() => setShowCustomerNote(true)}
              className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <Plus className="mr-1 h-4 w-4" />
              Add customer / note
            </button>
          ) : (
            <div className="flex flex-col gap-2 lg:flex-row lg:gap-4">
              <div className="flex flex-1 items-center gap-2">
                <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Input
                  placeholder="Customer name (optional)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="flex-1 h-9 bg-card border-border border text-sm lg:h-10"
                />
              </div>
              <div className="flex flex-1 items-center gap-2">
                <Edit3 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Input
                  placeholder="Order note (optional)"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="flex-1 h-9 bg-card border-border border text-sm lg:h-10"
                />
              </div>
              <Button variant="ghost" size="icon" onClick={() => { setCustomerName(""); setOrderNotes(""); setShowCustomerNote(false); }} className="h-9 w-9 shrink-0 lg:h-10 lg:w-10">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Search & Categories */}
        <div className="flex gap-3 border-b border-border p-3 lg:gap-4 lg:p-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="search-input"
              autoFocus
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-16 h-10 bg-card border border-border rounded-full text-sm lg:h-12 shadow-sm focus-visible:ring-primary/50"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1 pointer-events-none">
              <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground opacity-100">
                <span className="text-xs">⌘</span>K
              </kbd>
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-1.5 overflow-x-auto border-b border-border px-3 py-2.5 lg:gap-2 lg:px-4 lg:py-3 sticky top-0 z-10 bg-background">
          <Button
            variant={activeCategory === "all" ? "default" : "secondary"}
            size="sm"
            onClick={() => setActiveCategory("all")}
            className="shrink-0 rounded-full font-medium"
          >
            All Items
            <Badge variant="outline" className={cn("ml-1.5 h-5 px-1.5 text-[10px] bg-background/50 border-transparent", activeCategory === "all" ? "text-primary-foreground" : "text-muted-foreground")}>{menuItems.length}</Badge>
          </Button>
          {categories.map((cat) => {
            const Icon = categoryIcons[cat.id];
            const catCount = menuItems.filter(m => m.category === cat.id).length;
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
                <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px] bg-background/50 border-transparent", activeCategory === cat.id ? "text-primary-foreground" : "text-muted-foreground")}>{catCount}</Badge>
              </Button>
            );
          })}
        </div>

        {/* Menu Grid */}
        <div className="flex-1 overflow-y-auto p-3 lg:p-4 min-h-0 bg-[#FAF6F1] dark:bg-[#1A1410]">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 lg:gap-4">
            {filteredItems.map((item) => {
              const isCoffee = item.category === "coffee";
              const isTea = item.category === "tea";
              const emoji = isCoffee ? "☕" : isTea ? "🍵" : "🥤";
              
              return (
              <motion.div
                whileTap={{ scale: 0.96 }}
                key={item.id}
                onClick={() => handleAddItem(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleAddItem(item);
                  }
                }}
                className="group cursor-pointer relative flex flex-col items-start overflow-hidden rounded-2xl bg-card shadow-sm border border-border/40 text-left transition-all duration-200 hover:shadow-md hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                {/* Image or Gradient Placeholder */}
                <div className="relative w-full aspect-[4/3] shrink-0 overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5">
                  {item.image_url ? (
                    <img 
                      src={item.image_url} 
                      alt={item.name} 
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 group-active:scale-95" 
                      loading="lazy"
                      onError={(e) => e.currentTarget.src = '/menu/_fallback.png'}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-4xl opacity-50">{emoji}</div>
                  )}
                  
                  {/* Ribbons */}
                  {item.bestseller && (
                    <div className="absolute top-0 left-0 bg-primary/95 text-primary-foreground text-[10px] uppercase font-bold px-2 py-1 rounded-br-lg shadow-sm backdrop-blur-sm z-10">
                      Bestseller
                    </div>
                  )}
                </div>
                
                {/* Content */}
                <div className="flex flex-1 w-full flex-col p-3 lg:p-4">
                  <span className="text-sm font-semibold text-foreground leading-tight lg:text-base">
                    {item.name}
                  </span>
                  
                  <div className="mt-auto pt-3 flex items-center justify-between w-full">
                    <span className="text-sm font-bold text-primary lg:text-base">
                      {item.price.toLocaleString("en-IN", {
                        style: "currency",
                        currency: "INR",
                        minimumFractionDigits: 0,
                      })}
                    </span>
                    {item.variants && item.variants.length > 0 ? (
                      <Badge variant="secondary" className="text-[10px] font-medium bg-secondary text-secondary-foreground">
                        Options
                      </Badge>
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary opacity-0 transition-all group-hover:opacity-100 group-focus:opacity-100 hidden">
                        <Plus className="h-4 w-4" />
                      </div>
                    )}
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="h-7 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); openModifierDialog(item); }}
                    >
                      Customize
                    </Button>
                  </div>
                </div>
              </motion.div>
            )})}
          </div>
        </div>
      </div>

      {/* Cart Section */}
      <div className="flex w-72 shrink-0 flex-col bg-card shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-10 border-l border-border/50 sm:w-80 lg:w-80 xl:w-96">
        <CardHeader className="flex flex-col justify-center border-b border-border h-20 lg:h-24 px-5 py-3 shrink-0 bg-background/50 backdrop-blur-sm space-y-1">
          {isEditing && (
            <div className="mb-1 flex items-center gap-2 rounded-md bg-primary/10 px-2.5 py-1.5 shadow-sm">
              <Pencil className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-primary">
                Editing {editingOrderId?.toUpperCase()}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-6 px-2 text-[10px] font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={cancelEditOrder}
              >
                Cancel
              </Button>
            </div>
          )}
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold tracking-tight lg:text-xl text-foreground">
              {isEditing ? "Edit Order" : "Current Order"}
            </CardTitle>
            {cart.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={isEditing ? cancelEditOrder : clearCart}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8 rounded-full transition-colors"
                title="Clear Cart"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            <Badge 
              variant="secondary" 
              className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-primary/10 text-primary hover:bg-primary/20 border-transparent transition-colors"
            >
              {orderType.replace("-", " ")}
            </Badge>
            {selectedTable && (
              <Badge 
                variant="secondary" 
                className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-secondary border-transparent text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                Table {selectedTable.replace("t", "")}
              </Badge>
            )}
            {customerName && (
              <Badge variant="outline" className="px-2 py-0.5 text-[10px] font-medium border-border/80 text-foreground">
                {customerName}
              </Badge>
            )}
            {orderNotes && (
              <Badge variant="outline" className="px-2 py-0.5 max-w-[100px] truncate text-[10px] font-medium border-dashed border-border/80 text-muted-foreground">
                {orderNotes}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col p-0">
          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4">
            {cart.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-muted-foreground p-6 text-center">
                <div className="relative mb-6 h-32 w-32 opacity-80">
                  <div className="absolute inset-0 animate-pulse bg-primary/10 rounded-full blur-xl" />
                  {/* Using UtensilsCrossed as empty state fallback */}
                  <UtensilsCrossed className="absolute inset-0 h-full w-full object-contain p-4 drop-shadow-sm text-primary/40" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">Tap something delicious &rarr;</h3>
                <p className="text-sm mb-4">Top sellers today:</p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button variant="outline" size="sm" className="rounded-full bg-background border-border shadow-sm text-foreground hover:bg-secondary/80" onClick={() => handleAddItem(menuItems.find(m => m.id === "coffee-2")!)}>Cappuccino</Button>
                  <Button variant="outline" size="sm" className="rounded-full bg-background border-border shadow-sm text-foreground hover:bg-secondary/80" onClick={() => handleAddItem(menuItems.find(m => m.id === "tea-4")!)}>Ginger Tea</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {cart.map((item) => (
                    <motion.div
                      key={item.tempId}
                      layout
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -20, scale: 0.9 }}
                      transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                      className="rounded-lg bg-secondary/50 p-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{item.name}</p>
                          {item.variant && (
                            <p className="text-xs text-muted-foreground">{item.variant}</p>
                          )}
                          {item.modifiers && item.modifiers.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {item.modifiers.map(m => m.name).join(", ")}
                            </p>
                          )}
                          <p className="text-sm font-semibold text-primary">
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
                          className="h-6 w-6 text-muted-foreground active:scale-90 transition-transform"
                          onClick={() => handleEditItemNotes(item.tempId)}
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 active:scale-90 transition-transform"
                          onClick={() => {
                            if (item.quantity > 1) {
                              navigator.vibrate?.(8);
                            }
                            updateQuantity(item.tempId, item.quantity - 1);
                          }}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center font-medium text-foreground">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 active:scale-90 transition-transform"
                          onClick={() => {
                            navigator.vibrate?.(8);
                            updateQuantity(item.tempId, item.quantity + 1);
                          }}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <span className="ml-auto font-bold text-foreground">
                          {((item.price + (item.modifiers?.reduce((s, m) => s + m.price, 0) || 0)) * item.quantity).toLocaleString("en-IN", {
                            style: "currency",
                            currency: "INR",
                            minimumFractionDigits: 0,
                          })}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
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
                <span className="text-muted-foreground">Tax ({settings.gstEnabled ? `${settings.taxRate}%` : "disabled"})</span>
                <span className="text-foreground">
                  {(getCartTotal() * (settings.gstEnabled ? settings.taxRate / 100 : 0)).toLocaleString("en-IN", {
                    style: "currency",
                    currency: "INR",
                    minimumFractionDigits: 0,
                  })}
                </span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span className="text-foreground">Total</span>
                <span className="text-primary">
                  {(getCartTotal() * (1 + (settings.gstEnabled ? settings.taxRate / 100 : 0))).toLocaleString("en-IN", {
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
                  className={cn("flex-1 h-14", cart.length > 0 && "animate-pulse-subtle border-primary/50 text-foreground")}
                  disabled={cart.length === 0}
                  onClick={handleSendToKitchen}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  KOT
                </Button>
                <Button
                  size="lg"
                  className={cn(
                    "flex-1 h-14 bg-primary text-primary-foreground hover:bg-primary/90 transition-all",
                    cart.length > 0 && "shadow-[0_4px_14px_0_rgba(245,158,11,0.39)] animate-pulse-subtle"
                  )}
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

            {/* Modifiers */}
            <div className="space-y-2">
              <Label>Add-ons</Label>
              <div className="flex flex-wrap gap-2">
                {defaultModifiers.map((mod) => {
                  const isSelected = selectedModifiers.some(m => m.id === mod.id);
                  return (
                  <Button
                    key={mod.id}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedModifiers(selectedModifiers.filter(m => m.id !== mod.id));
                      } else {
                        setSelectedModifiers([...selectedModifiers, mod]);
                      }
                    }}
                  >
                    {mod.name}
                    {mod.price > 0 && ` (+₹${mod.price})`}
                  </Button>
                )})}
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
