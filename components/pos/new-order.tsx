"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePOSStore } from "@/lib/store";
import { type MenuItem, type Modifier } from "@/lib/data";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  User,
  Edit3,
  X,
  ArrowLeft,
  Save,
  Pencil,
  Lock,
  ChevronDown,
  Phone,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const orderTypes = [
  { id: "dine-in", label: "Dine In", icon: UtensilsCrossed },
  { id: "takeaway", label: "Takeaway", icon: ShoppingBag },
  { id: "delivery", label: "Delivery", icon: Bike },
] as const;

const categoryIcons: Record<string, React.ElementType> = {
  tea: Leaf,
  coffee: Coffee,
  drinks: CupSoda,
};



export function NewOrder() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const [itemNotes, setItemNotes] = useState("");
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [selectedModifiers, setSelectedModifiers] = useState<Modifier[]>([]);
  const [showModifierDialog, setShowModifierDialog] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [currentMenuItem, setCurrentMenuItem] = useState<MenuItem | null>(null);
  const [itemToRemove, setItemToRemove] = useState<{ orderId: string, itemId: string, tempId: string, name: string } | null>(null);
  // Track which existing cart item is being customized (edit modifiers/variant/notes)
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);

  const {
    cart,
    orderType,
    selectedTable,
    customerName,
    customerPhone,
    orderNotes,
    editingOrderId,
    tables,
    orders,
    menuItems,
    menuCategories,
    modifiers: availableModifiers,
    addToCart,
    removeFromCart,
    updateQuantity,
    updateItemNotes,
    updateItemVariant,
    clearCart,
    setOrderType,
    setSelectedTable,
    setCustomerName,
    setCustomerPhone,
    setOrderNotes,
    addOrder,
    updateCartItem,
    saveEditOrder,
    cancelEditOrder,
    getCartTotal,
    setActiveView,
    settings,
    editMode,
    lockedItemIds,
    adminRemoveLockedItem,
    currentUser,
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

  // Count active orders per table (for displaying on table cards)
  const activeOrdersByTable = (tableId: string) =>
    orders.filter((o) => o.tableId === tableId && !['completed', 'cancelled'].includes(o.status));


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

  // Modifiers applicable to the current item: if item has modifierIds set, only show those; else show all
  const itemModifiers: Modifier[] = currentMenuItem?.modifierIds && currentMenuItem.modifierIds.length > 0
    ? availableModifiers.filter((m) => currentMenuItem.modifierIds!.includes(m.id))
    : availableModifiers;

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

  const handleProceedToPayment = () => {
    if (cart.length === 0) return;
    if (orderType === "dine-in" && !selectedTable) {
      toast.error("Table not selected", {
        description: "Please select a table for the dine-in order.",
      });
      return;
    }
    if (!customerName.trim()) {
      toast.error("Customer name required", {
        description: "Please enter the customer's name before proceeding.",
      });
      return;
    }

    // Create order directly as "new" (kitchen-ready) with payLater flag.
    // This skips the payment screen — the customer pays after being served.
    const newId = addOrder({
      type: orderType,
      status: "new",
      payLater: true,
      subtotal: getCartTotal(),
      tableId: orderType === "dine-in" ? selectedTable || undefined : undefined,
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
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
    }, { initialStatus: "new" });

    // Auto-print KOT
    if (settings.autoPrintKot) {
      const kotPrinters = settings.printers?.filter((p: any) => p.type === "kot" && p.enabled) || [];
      if (kotPrinters.length > 0) {
        const freshOrder = usePOSStore.getState().orders.find((o: any) => o.id === newId);
        if (freshOrder) {
          import("@/lib/print-service").then(({ printToAllPrinters }) => {
            printToAllPrinters(kotPrinters, freshOrder, settings, "kot").then(({ results }: any) => {
              const failures = results.filter((r: any) => !r.success);
              if (failures.length > 0) {
                toast.error(`KOT print failed on: ${failures.map((f: any) => f.printer).join(", ")}`);
              }
            });
          });
        }
      }
    }

    clearCart();
    setShowMobileCart(false);

    toast.success("Order sent to kitchen!", {
      description: `Order ${newId.toUpperCase()} is now being prepared. Payment will be collected later.`,
    });
  };


  // Open the full customization dialog for an existing cart item
  const handleEditCartItem = (tempId: string) => {
    const item = cart.find((i) => i.tempId === tempId);
    if (!item) return;

    // Find the corresponding menu item to get variant/modifier options
    const menuItem = menuItems.find((m) => m.id === item.menuItemId);
    if (!menuItem) {
      // Fallback: if no menu item found, just open notes editor
      setEditingCartItemId(tempId);
      setItemNotes(item.notes || "");
      setShowModifierDialog(true);
      return;
    }

    setEditingCartItemId(tempId);
    setCurrentMenuItem(menuItem);
    setSelectedVariant(item.variant || (menuItem.variants && menuItem.variants.length > 0 ? menuItem.variants[0].name : ""));
    setSelectedModifiers(item.modifiers || []);
    setItemNotes(item.notes || "");
    setShowModifierDialog(true);
  };

  // Save customization edits to an existing cart item
  const handleSaveCartItemCustomization = () => {
    if (!editingCartItemId || !currentMenuItem) return;

    const variant = currentMenuItem.variants?.find((v) => v.name === selectedVariant);
    const price = variant ? variant.price : currentMenuItem.price;

    updateCartItem(editingCartItemId, {
      variant: selectedVariant || undefined,
      modifiers: selectedModifiers.length > 0 ? selectedModifiers : undefined,
      notes: itemNotes || undefined,
      price: price,
    });

    setEditingCartItemId(null);
    setShowModifierDialog(false);
    setCurrentMenuItem(null);
    setSelectedVariant("");
    setItemNotes("");
    setSelectedModifiers([]);
  };

  const handleCloseModifierDialog = (open: boolean) => {
    setShowModifierDialog(open);
    if (!open) {
      setEditingCartItemId(null);
      setCurrentMenuItem(null);
      setSelectedVariant("");
      setItemNotes("");
      setSelectedModifiers([]);
    }
  };

  // Keyboard Shortcuts (UX Plan §11.2)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowModifierDialog(false);
        setEditingCartItemId(null);
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
        const table = tables.find(t => t.number === tableNum);
        if (table) setSelectedTable(table.id);
      }

      // Ctrl+Enter → Place Order
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleProceedToPayment();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <div className="flex h-full flex-row overflow-x-hidden">
      {/* Menu Section */}
      <div className="flex flex-1 flex-col min-h-0 min-w-0 border-r border-border bg-background">
        {/* Top Header Controls */}
        <div className="flex flex-col border-b border-border bg-background shadow-sm z-10 sticky top-0 md:static">
          
          {/* Order Type Selection (Segmented Control) */}
          <div className="p-2 sm:p-3 border-b border-border/50 bg-background/50">
            <div className="flex bg-secondary/50 p-1 rounded-xl max-w-lg mx-auto">
              {orderTypes.map((type) => {
                const Icon = type.icon;
                const isActive = orderType === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => setOrderType(type.id as typeof orderType)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg text-[11px] sm:text-[13px] font-bold transition-all duration-200",
                      isActive
                        ? "bg-background text-foreground shadow-sm ring-1 ring-border/50 scale-100"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/80 scale-95"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table Selection for Dine-in */}
          {orderType === "dine-in" && (
            <div className="flex flex-col gap-2 border-b border-border/40 p-3 md:p-4 lg:p-5 bg-gradient-to-r from-orange-50/80 via-amber-50/40 to-rose-50/80 dark:from-orange-950/20 dark:via-amber-950/10 dark:to-rose-950/20 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
              <span className="flex items-center text-xs font-bold text-foreground/80 uppercase tracking-widest relative z-10">
                Select Table
              </span>
              <div className="flex items-center gap-2.5 overflow-x-auto hide-scrollbar snap-x pb-2 pt-1 relative z-10">
                {tables.length > 0 ? (
                  tables.map((table) => {
                    const isSelected = selectedTable === table.id;
                    const tableOrders = activeOrdersByTable(table.id);
                    const hasActiveOrders = tableOrders.length > 0;
                    const statusColor = table.status === "available"
                      ? "bg-emerald-500" 
                      : table.status === "waiting-payment" 
                        ? "bg-rose-500" 
                        : "bg-amber-500";
                    return (
                      <button
                        key={table.id}
                        onClick={() => setSelectedTable(isSelected ? null : table.id)}
                        className={cn(
                          "snap-start shrink-0 flex items-center gap-2 rounded-full px-4 sm:px-5 py-2 sm:py-2.5 transition-all duration-300",
                          isSelected
                            ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-[0_4px_20px_-4px_rgba(249,115,22,0.5)] border-transparent scale-105"
                            : hasActiveOrders
                              ? "bg-white/80 dark:bg-black/60 border border-amber-500/30 text-foreground hover:border-amber-500/60 shadow-sm"
                              : "bg-white/60 dark:bg-black/40 border border-white/60 dark:border-white/10 text-foreground hover:bg-white dark:hover:bg-black hover:shadow-md shadow-sm backdrop-blur-md"
                        )}
                      >
                        <div className={cn("h-2.5 w-2.5 rounded-full shadow-inner", isSelected ? "bg-white" : statusColor)} />
                        <span className="text-[14px] sm:text-[15px] font-black tracking-tight">T{table.number}</span>
                        {hasActiveOrders && (
                          <span className={cn("ml-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm", isSelected ? "bg-white/20 text-white" : "bg-secondary text-secondary-foreground")}>
                            {tableOrders.length}
                          </span>
                        )}
                      </button>
                    )
                  })
                ) : (
                  <span className="text-xs text-muted-foreground relative z-10">No tables configured</span>
                )}
              </div>
            </div>
          )}

          {/* Customer Info (Restored to stacked layout with better styling) */}
          <div className="border-b border-border/40 p-3 md:p-4 lg:p-5 bg-gradient-to-br from-amber-50/30 to-orange-50/50 dark:from-amber-950/10 dark:to-orange-950/20 backdrop-blur-sm">
            <div className="flex flex-col gap-3 lg:gap-4 max-w-4xl">
              <div className="flex flex-col sm:flex-row gap-3 lg:gap-4">
                <div className="flex flex-1 items-center gap-3 bg-white/60 dark:bg-black/40 border border-white/60 dark:border-white/10 rounded-2xl px-4 py-1.5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] focus-within:ring-2 focus-within:ring-orange-400/50 focus-within:border-orange-400 focus-within:bg-white dark:focus-within:bg-black transition-all">
                  <User className="h-4 w-4 shrink-0 text-orange-500/70" />
                  <Input
                    placeholder="Customer name *"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className={cn("flex-1 h-10 bg-transparent border-0 shadow-none text-[14px] font-medium focus-visible:ring-0 px-0", !customerName.trim() && cart.length > 0 ? "placeholder:text-rose-400/70" : "placeholder:text-muted-foreground/60")}
                  />
                </div>
                <div className="flex flex-1 items-center gap-3 bg-white/60 dark:bg-black/40 border border-white/60 dark:border-white/10 rounded-2xl px-4 py-1.5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] focus-within:ring-2 focus-within:ring-orange-400/50 focus-within:border-orange-400 focus-within:bg-white dark:focus-within:bg-black transition-all">
                  <Phone className="h-4 w-4 shrink-0 text-orange-500/70" />
                  <Input
                    type="tel"
                    placeholder="Phone number (optional)"
                    value={customerPhone}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^\d*$/.test(value)) {
                        setCustomerPhone(value);
                      }
                    }}
                    className="flex-1 h-10 bg-transparent border-0 shadow-none text-[14px] font-medium focus-visible:ring-0 px-0 placeholder:text-muted-foreground/60"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white/60 dark:bg-black/40 border border-white/60 dark:border-white/10 rounded-2xl px-4 py-1.5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] focus-within:ring-2 focus-within:ring-orange-400/50 focus-within:border-orange-400 focus-within:bg-white dark:focus-within:bg-black transition-all">
                <Edit3 className="h-4 w-4 shrink-0 text-orange-500/70" />
                <Input
                  placeholder="Order note (optional)"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="flex-1 h-10 bg-transparent border-0 shadow-none text-[14px] font-medium focus-visible:ring-0 px-0 placeholder:text-muted-foreground/60"
                />
              </div>
            </div>
          </div>

          {/* Category Tabs (Sticky Scrolling Row) */}
          <div className="flex gap-2 px-3 py-2.5 overflow-x-auto hide-scrollbar bg-card/50 backdrop-blur">
            <button
              onClick={() => setActiveCategory("all")}
              className={cn(
                "shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 font-bold text-[13px] transition-all",
                activeCategory === "all"
                  ? "bg-foreground text-background shadow-md"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/40"
              )}
            >
              <UtensilsCrossed className="h-3.5 w-3.5" />
              <span>All Menu</span>
              <span className={cn(
                "flex items-center justify-center rounded-full text-[10px] font-bold px-1.5 min-w-[18px] h-4",
                activeCategory === "all" ? "bg-background/20 text-background" : "bg-background text-muted-foreground shadow-sm"
              )}>
                {menuItems.length}
              </span>
            </button>
            
            {menuCategories.map((cat) => {
              const Icon = categoryIcons[cat.id];
              const catCount = menuItems.filter(m => m.category === cat.id && m.available).length;
              const isActive = activeCategory === cat.id;
              const catEmoji = cat.id === 'coffee' ? '☕' : cat.id === 'tea' ? '🍵' : cat.id === 'drinks' ? '🥤' : cat.id === 'pastry' ? '🥐' : cat.id === 'food' ? '🍔' : '🍽️';

              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 font-bold text-[13px] transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/40"
                  )}
                >
                  <span className="text-base leading-none mr-0.5">{catEmoji}</span>
                  <span className="capitalize">{cat.name}</span>
                  <span className={cn(
                    "flex items-center justify-center rounded-full text-[10px] font-bold px-1.5 min-w-[18px] h-4",
                    isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-background text-muted-foreground shadow-sm"
                  )}>
                    {catCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Menu Grid */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-3 pb-20 md:pb-3 lg:p-4 min-h-0 bg-[#FAF6F1] dark:bg-[#1A1410]">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 lg:gap-4">
            {filteredItems.map((item) => {
              const isCoffee = item.category === "coffee";
              const isTea = item.category === "tea";
              const emoji = isCoffee ? "☕" : isTea ? "🍵" : "🥤"; // default fallback for any category

              return (
                <motion.div
                  whileTap={{ scale: 0.98 }}
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
                  className="group cursor-pointer relative flex flex-col overflow-hidden rounded-[20px] bg-card shadow-sm border border-border/40 text-left transition-all duration-300 hover:shadow-xl hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                  {/* Image full width edge-to-edge */}
                  <div className="relative w-full aspect-[4/3] sm:aspect-square overflow-hidden bg-muted">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        loading="lazy"
                        onError={(e) => e.currentTarget.src = '/menu/_fallback.png'}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-4xl opacity-50 bg-secondary/30">{emoji}</div>
                    )}
                    
                    {/* Dark gradient overlay for bottom text */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80" />

                    {/* Ribbons */}
                    <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                      {item.bestseller && (
                        <div className="bg-[#EA7531] text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-sm uppercase tracking-wide w-fit">
                          Bestseller
                        </div>
                      )}
                      {item.variants && item.variants.length > 0 && (
                        <div className="bg-black/60 backdrop-blur-md text-white/90 text-[9px] font-bold px-2 py-1 rounded-md shadow-sm uppercase tracking-wide border border-white/10 w-fit">
                          Customize
                        </div>
                      )}
                    </div>

                    {/* Content over image at the bottom */}
                    <div className="absolute bottom-0 left-0 right-0 p-2.5 sm:p-3 z-10">
                      <div className="flex justify-between items-end gap-2">
                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                          <h3 className="text-white font-bold text-[13px] sm:text-[14px] leading-tight line-clamp-2 drop-shadow-md">
                            {item.name}
                          </h3>
                          <span className="text-white/90 font-bold text-[12px] sm:text-[13px] drop-shadow-md">
                            {item.price.toLocaleString("en-IN", {
                              style: "currency",
                              currency: "INR",
                              minimumFractionDigits: 0,
                            })}
                          </span>
                        </div>
                        
                        <Button 
                          size="icon" 
                          className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-transform active:scale-95 shrink-0"
                          onClick={(e) => { e.stopPropagation(); item.variants?.length ? openModifierDialog(item) : handleAddItem(item); }}
                        >
                          <Plus className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.5} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Mobile Cart Floating Button */}
      {!showMobileCart && cart.length > 0 && (
        <div className="md:hidden fixed bottom-[72px] left-4 right-4 z-30 flex pointer-events-none drop-shadow-2xl">
          <Button 
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-primary to-[#D56525] text-white font-bold flex items-center justify-between px-4 pointer-events-auto active:scale-[0.98] transition-transform overflow-hidden ring-1 ring-white/20 shadow-[0_8px_30px_rgb(234,117,49,0.3)] relative"
            onClick={() => setShowMobileCart(true)}
          >
            <div className="flex items-center gap-3 z-10">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-white/20 backdrop-blur-md">
                <ShoppingBag className="h-4 w-4 text-white" strokeWidth={2.5} />
              </div>
              <div className="flex flex-col items-start justify-center gap-0.5">
                <span className="text-[14px] leading-none tracking-tight">View Cart</span>
                <span className="text-[10px] font-semibold text-white/80 uppercase tracking-widest leading-none">
                  {cart.length} {cart.length === 1 ? 'Item' : 'Items'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 z-10">
              <span className="text-[16px] tracking-tight">
                {getCartTotal().toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
              </span>
              <div className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 ml-1">
                <div className="h-2 w-2 border-t-2 border-r-2 border-white rotate-45 mr-0.5" />
              </div>
            </div>
            {/* Gloss reflection effect */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent" />
          </Button>
        </div>
      )}

      {/* Mobile Cart Overlay */}
      {showMobileCart && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setShowMobileCart(false)}
        />
      )}

      {/* Cart Section */}
      <div className={cn(
        "flex shrink-0 flex-col overflow-hidden bg-[#FDFBF7] dark:bg-[#1A1A1A] z-40 md:border-l border-border/50",
        "md:relative md:w-72 sm:w-80 lg:w-80 xl:w-96 md:transform-none md:shadow-[-10px_0_30px_rgba(0,0,0,0.03)] md:flex md:overflow-visible",
        "fixed inset-x-0 bottom-14 md:bottom-0 max-h-[75vh] md:max-h-none md:h-auto rounded-t-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-transform duration-300",
        showMobileCart ? "translate-y-0 flex" : "translate-y-full md:translate-y-0"
      )}>
        <div className="md:hidden flex justify-center pt-2 pb-1 bg-transparent">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>
        <CardHeader className="flex flex-col justify-center border-b border-dashed border-border/80 h-20 lg:h-24 px-5 py-3 pt-2 sm:pt-3 shrink-0 bg-transparent space-y-1">
          {isEditing && (
            <div className={cn("mb-1 flex items-center gap-2 rounded-md px-2.5 py-1.5 shadow-sm", editMode === "supplementary" ? "bg-warning/10" : "bg-primary/10")}>
              {editMode === "supplementary" ? <Lock className="h-3.5 w-3.5 text-warning" /> : <Pencil className="h-3.5 w-3.5 text-primary" />}
              <span className={cn("text-xs font-semibold", editMode === "supplementary" ? "text-warning" : "text-primary")}>
                {editMode === "supplementary" ? `Add to Bill: ${editingOrderId?.toUpperCase()}` : `Editing ${editingOrderId?.toUpperCase()}`}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-6 px-2 text-[11px] sm:text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={cancelEditOrder}
              >
                Cancel
              </Button>
            </div>
          )}
          {editMode === "supplementary" && (
            <div className="mb-1 rounded bg-warning/5 px-2 py-1 border border-warning/20">
              <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">
                Order is in kitchen. Edit freely — removing or reducing paid items auto-records a refund; adding items goes to the balance due.
              </p>
            </div>
          )}
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-black tracking-tight lg:text-2xl text-foreground flex items-center gap-2">
              <span className="md:hidden">
                <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2 text-muted-foreground hover:text-foreground" onClick={() => setShowMobileCart(false)}>
                  <ChevronDown className="h-5 w-5" />
                </Button>
              </span>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-600 to-rose-600 drop-shadow-sm">
                {isEditing ? "Edit Order" : "Current Order"}
              </span>
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
              className="px-2 py-0.5 text-[11px] sm:text-xs uppercase font-bold tracking-wider bg-primary/10 text-primary hover:bg-primary/20 border-transparent transition-colors"
            >
              {orderType.replace("-", " ")}
            </Badge>
            {selectedTable && (
              <Badge
                variant="secondary"
                className="px-2 py-0.5 text-[11px] sm:text-xs uppercase font-bold tracking-wider bg-secondary border-transparent text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                Table {selectedTable.replace("t", "")}
              </Badge>
            )}
            {customerName && (
              <Badge variant="outline" className="px-2 py-0.5 text-[11px] sm:text-xs font-medium border-border/80 text-foreground">
                {customerName}
              </Badge>
            )}
            {customerPhone && (
              <Badge variant="outline" className="px-2 py-0.5 text-[11px] sm:text-xs font-medium border-border/80 text-muted-foreground">
                <Phone className="h-3 w-3 mr-1" />
                {customerPhone}
              </Badge>
            )}
            {orderNotes && (
              <Badge variant="outline" className="px-2 py-0.5 max-w-[100px] truncate text-[11px] sm:text-xs font-medium border-dashed border-border/80 text-muted-foreground">
                {orderNotes}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col p-0 min-h-0 overflow-hidden">
          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto min-h-0 p-4">
            {cart.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                <div className="relative mb-8 h-40 w-40">
                  <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/20 to-rose-500/20 rounded-[40px] rotate-6 blur-xl animate-pulse" />
                  <div className="relative h-full w-full bg-white/60 dark:bg-black/40 backdrop-blur-xl rounded-[40px] border border-white/50 dark:border-white/10 shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-500">
                    <UtensilsCrossed className="h-16 w-16 text-orange-500 drop-shadow-md" />
                  </div>
                </div>
                <h3 className="mb-2 text-2xl font-black tracking-tight text-foreground">Your tray is empty</h3>
                <p className="text-sm font-medium text-muted-foreground mb-8">Tap an item to start an order, or try a favorite:</p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-[240px] sm:max-w-none mx-auto">
                  <Button variant="outline" className="h-12 rounded-xl bg-orange-50/80 dark:bg-orange-950/30 border-orange-200/50 dark:border-orange-900/50 shadow-sm text-orange-900 dark:text-orange-100 hover:bg-orange-100 dark:hover:bg-orange-900/50 hover:scale-105 transition-all w-full sm:w-auto font-bold" onClick={() => handleAddItem(menuItems.find(m => m.id === "coffee-2")!)}>
                    <span className="text-lg mr-2">☕</span> Cappuccino
                  </Button>
                  <Button variant="outline" className="h-12 rounded-xl bg-orange-50/80 dark:bg-orange-950/30 border-orange-200/50 dark:border-orange-900/50 shadow-sm text-orange-900 dark:text-orange-100 hover:bg-orange-100 dark:hover:bg-orange-900/50 hover:scale-105 transition-all w-full sm:w-auto font-bold" onClick={() => handleAddItem(menuItems.find(m => m.id === "tea-4")!)}>
                    <span className="text-lg mr-2">🍵</span> Ginger Tea
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {(() => {
                    // Build section headers for supplementary mode
                    const isSupp = editMode === "supplementary";
                    const mainItems = isSupp ? cart.filter(i => i.origin === "main" || (!i.origin && i.originalItemId)) : [];
                    const suppBillIds = isSupp ? [...new Set(cart.filter(i => i.origin === "supp").map(i => i.supplementaryBillId!))] : [];
                    const newItems = isSupp ? cart.filter(i => !i.originalItemId) : [];
                    // Track which sections have been rendered
                    const renderedHeaders = new Set<string>();
                    return cart.map((item) => {
                    const isLocked = Boolean(isEditing && editMode === "supplementary" && item.originalItemId && lockedItemIds.includes(item.originalItemId));
                    const isOwner = currentUser?.role === "Owner";
                    const isNewlyAdded = editMode === "supplementary" && !item.originalItemId;
                    const isUnpaidSupp = editMode === "supplementary" && item.origin === "supp" && !item.supplementaryBillPaid && !!item.originalItemId;
                    const isPaidSupp = editMode === "supplementary" && item.origin === "supp" && item.supplementaryBillPaid;

                    // Determine section header.
                    // UX simplification: collapse "Supp Bill #N — Paid/Unpaid" into
                    // just two sections — "Paid Items" and "Pending Payment" — so
                    // the cafe sees ONE continuous bill, not a stack of supp bills.
                    let sectionHeader: React.ReactNode = null;
                    if (isSupp) {
                      const isPendingSection = (!item.origin && !item.originalItemId) // brand new
                        || (item.origin === "supp" && !item.supplementaryBillPaid);
                      const isPaidSection = (item.origin === "main" || (!item.origin && item.originalItemId))
                        || (item.origin === "supp" && item.supplementaryBillPaid);
                      if (isPaidSection && !renderedHeaders.has("paid")) {
                        renderedHeaders.add("paid");
                        sectionHeader = <div className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider pb-1 pt-1 flex items-center gap-1.5">Paid Items (editable)</div>;
                      } else if (isPendingSection && !renderedHeaders.has("pending")) {
                        renderedHeaders.add("pending");
                        sectionHeader = <div className="text-[10px] sm:text-xs font-bold text-warning uppercase tracking-wider pb-1 pt-2 flex items-center gap-1.5">+ Pending Payment</div>;
                      }
                    }

                    return (
                      <React.Fragment key={item.tempId}>
                      {sectionHeader}
                      <motion.div
                        layout
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -20, scale: 0.9 }}
                        transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                        className={cn("rounded-lg p-3", isLocked ? "bg-muted/50 border border-border/50 opacity-80" : isUnpaidSupp ? "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50" : isNewlyAdded ? "bg-warning/10 border border-warning/30" : "bg-secondary/50")}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5">
                              {isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                              {isNewlyAdded && <Badge variant="outline" className="h-4 px-1 text-[8px] bg-warning/20 text-warning border-transparent">+ADD</Badge>}
                              {isUnpaidSupp && <Badge variant="outline" className="h-4 px-1 text-[8px] bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border-transparent">SUPP</Badge>}
                              <p className="font-medium text-foreground">{item.name}</p>
                            </div>
                            {item.variant && (
                              <p className="text-xs text-muted-foreground">{item.variant}</p>
                            )}
                            {item.modifiers && item.modifiers.length > 0 && (
                              <p className="text-xs text-muted-foreground">
                                + {item.modifiers.map(m => m.name).join(", ")}
                              </p>
                            )}
                            <p className={cn("text-sm font-semibold", isLocked ? "text-muted-foreground" : "text-primary")}>
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
                          {!isLocked && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground active:scale-90 transition-transform"
                              onClick={() => handleEditCartItem(item.tempId)}
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            disabled={isLocked}
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
                            disabled={isLocked}
                            className="h-8 w-8 active:scale-90 transition-transform"
                            onClick={() => {
                              navigator.vibrate?.(8);
                              updateQuantity(item.tempId, item.quantity + 1);
                            }}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <span className={cn("ml-auto font-bold", isLocked ? "text-muted-foreground" : "text-foreground")}>
                            {((item.price + (item.modifiers?.reduce((s, m) => s + m.price, 0) || 0)) * item.quantity).toLocaleString("en-IN", {
                              style: "currency",
                              currency: "INR",
                              minimumFractionDigits: 0,
                            })}
                          </span>
                        </div>
                        {isLocked && isOwner && editingOrderId && item.originalItemId && (
                          <div className="mt-2 text-right">
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-6 text-[11px] sm:text-xs"
                              onClick={() => {
                                if (isPaidSupp) {
                                  toast.error("Cannot remove paid item", { description: "Refund flow required — not yet supported. Contact admin." });
                                  return;
                                }
                                setItemToRemove({ orderId: editingOrderId, itemId: item.originalItemId!, tempId: item.tempId, name: item.name });
                              }}
                            >
                              Remove Item (Owner)
                            </Button>
                          </div>
                        )}
                      </motion.div>
                      </React.Fragment>
                    )
                  });
                  })()}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Cart Summary */}
          <div className="relative p-4 sm:p-5 shrink-0 bg-gradient-to-t from-orange-50/50 to-transparent dark:from-orange-950/20">
            <div className="absolute top-0 inset-x-4 h-[1px] bg-gradient-to-r from-transparent via-orange-200 dark:via-orange-900/50 to-transparent" />
            <div className="mb-5 space-y-2.5">
              <div className="flex justify-between text-sm font-medium">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-foreground">
                  {getCartTotal().toLocaleString("en-IN", {
                    style: "currency",
                    currency: "INR",
                    minimumFractionDigits: 0,
                  })}
                </span>
              </div>
              <div className="flex justify-between text-sm font-medium">
                <span className="text-muted-foreground">Tax ({settings.gstEnabled ? `${settings.taxRate}%` : "disabled"})</span>
                <span className="text-foreground">
                  {(getCartTotal() * (settings.gstEnabled ? settings.taxRate / 100 : 0)).toLocaleString("en-IN", {
                    style: "currency",
                    currency: "INR",
                    minimumFractionDigits: 0,
                  })}
                </span>
              </div>
              <div className="flex justify-between items-end pt-3 mt-1 border-t border-dashed border-orange-200 dark:border-orange-900/50">
                <span className="text-base font-bold text-foreground">Total</span>
                <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-rose-600 drop-shadow-sm">
                  {(getCartTotal() * (1 + (settings.gstEnabled ? settings.taxRate / 100 : 0))).toLocaleString("en-IN", {
                    style: "currency",
                    currency: "INR",
                    minimumFractionDigits: 0,
                  })}
                </span>
              </div>
            </div>

            {cart.length > 0 && orderType === "dine-in" && !selectedTable && (
              <div className="mb-3 flex items-center justify-center gap-2 rounded-lg bg-destructive/10 p-2 sm:p-2.5 text-xs sm:text-sm font-medium text-destructive border border-destructive/20 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                <UtensilsCrossed className="h-4 w-4 sm:h-5 sm:w-5" />
                Select a table to proceed
              </div>
            )}

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
                  className={cn("flex-1 h-14", editMode === "supplementary" ? "bg-warning hover:bg-warning/90 text-warning-foreground" : "bg-primary hover:bg-primary/90 text-primary-foreground")}
                  disabled={cart.length === 0 && editMode !== "supplementary"}
                  onClick={() => {
                    if (orderType === "dine-in" && !selectedTable) {
                      toast.error("Table not selected", {
                        description: "Please select a table to update the order.",
                      });
                      return;
                    }
                    saveEditOrder();
                    setActiveView("billing");
                  }}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {editMode === "supplementary" ? "Save Changes" : "Update Order"}
                </Button>
              </div>
            ) : (
              <div className="flex gap-2 relative z-10">
                <Button
                  size="lg"
                  className={cn(
                    "flex-1 h-14 bg-gradient-to-r from-orange-500 to-rose-500 text-white hover:from-orange-600 hover:to-rose-600 border-0 transition-all font-bold text-[17px] rounded-[16px] shadow-[0_8px_30px_rgba(249,115,22,0.3)] hover:shadow-[0_8px_40px_rgba(249,115,22,0.4)] hover:scale-[1.02] active:scale-[0.98]",
                    cart.length > 0 && "animate-pulse-subtle"
                  )}
                  disabled={cart.length === 0}
                  onClick={handleProceedToPayment}
                >
                  <UtensilsCrossed className="mr-2 h-5 w-5" />
                  Place Order
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </div>

      {/* Modifier Dialog */}
      <Dialog open={showModifierDialog} onOpenChange={handleCloseModifierDialog}>
        <DialogContent variant="bottom-sheet" showCloseButton={false} className="max-w-lg sm:max-w-md grid grid-rows-[auto_minmax(0,1fr)_auto] p-0 gap-0 border-none rounded-t-[24px] sm:rounded-[24px] bg-[#f8f9fa] dark:bg-[#121212] overflow-hidden shadow-2xl">
          
          {/* ROW 1: HEADER (Back Button + Image + Title) */}
          <div className="relative flex flex-col shrink-0 bg-background rounded-t-[24px]">
            <Button 
              size="icon"
              variant="ghost" 
              className={cn(
                "absolute top-3 left-3 z-50 h-8 w-8 rounded-full backdrop-blur-md shadow-sm border transition-all",
                currentMenuItem?.image_url 
                  ? "bg-black/40 border-white/20 text-white hover:bg-black/60" 
                  : "bg-background/90 border-border shadow-black/10 text-foreground hover:bg-secondary"
              )}
              onClick={() => handleCloseModifierDialog(false)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            {currentMenuItem?.image_url && (
              <div className="w-full h-[150px] sm:h-[220px] relative shrink-0">
                <img src={currentMenuItem.image_url} alt={currentMenuItem.name} className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              </div>
            )}
            
            <div className={cn(
               "px-5 py-4 sm:px-6 sm:py-5 shrink-0 bg-background z-10", 
               currentMenuItem?.image_url && "-mt-6 rounded-t-[24px] relative shadow-[0_-8px_20px_rgb(0,0,0,0.08)]"
            )}>
              <DialogHeader className="text-left space-y-1">
                <DialogTitle className="text-[20px] sm:text-[22px] font-black text-foreground tracking-tight leading-tight">{currentMenuItem?.name}</DialogTitle>
                <DialogDescription className="text-[13px] sm:text-sm font-medium text-muted-foreground/90">
                  {(currentMenuItem as any)?.description || "Customise as per your taste"}
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>

          {/* ROW 2: SCROLLABLE CONTENT */}
          <div className="overflow-y-auto px-5 pb-6 sm:px-6 space-y-6 bg-background outline-none scroll-smooth">
            {/* Variants */}
            {currentMenuItem?.variants && currentMenuItem.variants.length > 0 && (
              <div className="space-y-3">
                <Label className="text-[14px] sm:text-[15px] font-bold text-foreground flex items-center gap-2">
                  Variant <span className="bg-primary/10 text-primary text-[9px] sm:text-[10px] uppercase px-1.5 py-0.5 rounded-sm">Required</span>
                </Label>
                <div className="flex flex-col gap-2">
                  {currentMenuItem.variants.map((variant) => {
                    const isSelected = selectedVariant === variant.name;
                    return (
                      <div 
                        key={variant.name}
                        onClick={() => setSelectedVariant(variant.name)}
                        className={cn(
                          "flex items-center justify-between p-3.5 rounded-xl border-[1.5px] transition-all cursor-pointer select-none",
                          isSelected ? "border-[#EA7531] bg-[#EA7531]/5 shadow-sm" : "border-border/60 hover:border-border hover:bg-muted/30"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors",
                            isSelected ? "border-[#EA7531] bg-[#EA7531]" : "border-muted-foreground/40 bg-background"
                          )}>
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <span className="font-semibold text-[13px] sm:text-sm">{variant.name}</span>
                        </div>
                        <span className="font-bold text-[13px] sm:text-sm">
                          {variant.price.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Modifiers */}
            <div className="space-y-3">
              <Label className="text-[14px] sm:text-[15px] font-bold text-foreground">Add-ons</Label>
              <div className="flex flex-col gap-2">
                {itemModifiers.map((mod) => {
                  const isSelected = selectedModifiers.some(m => m.id === mod.id);
                  return (
                    <div 
                      key={mod.id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedModifiers(selectedModifiers.filter(m => m.id !== mod.id));
                        } else {
                          setSelectedModifiers([...selectedModifiers, mod]);
                        }
                      }}
                      className={cn(
                        "flex items-center justify-between p-3.5 rounded-xl border-[1.5px] transition-all cursor-pointer select-none",
                        isSelected ? "border-[#EA7531] bg-[#EA7531]/5 shadow-sm" : "border-border/60 hover:border-border hover:bg-muted/30"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-4 h-4 rounded flex items-center justify-center border-2 transition-colors",
                          isSelected ? "bg-[#EA7531] border-[#EA7531]" : "border-muted-foreground/40 bg-background"
                        )}>
                          {isSelected && <div className="w-2 h-2 bg-white rounded-[1px]" style={{ clipPath: "polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%)", transform: "scale(0.8)" }} />}
                        </div>
                        <span className="font-semibold text-[13px] sm:text-sm">{mod.name}</span>
                      </div>
                      <span className="font-bold text-[13px] sm:text-sm text-foreground/90">
                        {mod.price > 0 ? `+₹${mod.price}` : "Free"}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
            
            {/* Notes */}
            <div className="space-y-3 pt-2">
              <Label className="text-[14px] sm:text-[15px] font-bold text-foreground">Add instructions</Label>
              <Textarea
                placeholder="eg. don't make it too spicy"
                value={itemNotes}
                onChange={(e) => setItemNotes(e.target.value)}
                className="bg-muted/40 border-border/80 resize-none min-h-[80px] text-[13px] sm:text-sm focus-visible:ring-[#EA7531] rounded-xl"
              />
            </div>
          </div>
          
          {/* ROW 3: FIXED FOOTER */}
          <div className="p-4 sm:p-5 bg-background border-t border-border shadow-[0_-15px_30px_rgb(0,0,0,0.04)] z-20">
            <Button 
               className="w-full h-[52px] sm:h-14 text-[16px] sm:text-lg font-bold rounded-xl bg-[#EA7531] hover:bg-[#D56525] text-white shadow-[0_8px_20px_rgba(234,117,49,0.25)] flex justify-between px-6 active:scale-[0.98] transition-transform" 
               onClick={editingCartItemId ? handleSaveCartItemCustomization : handleAddWithModifiers}
            >
              <span className="tracking-wide">{editingCartItemId ? "Save changes" : "Add item"}</span>
              <span className="bg-white/20 px-3 py-1 rounded-md text-[15px] sm:text-[16px] tracking-tight backdrop-blur-sm">
                {((currentMenuItem?.variants?.find(v => v.name === selectedVariant)?.price || currentMenuItem?.price || 0) + selectedModifiers.reduce((acc, m) => acc + m.price, 0)).toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
              </span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>


      {/* Owner Remove Item Dialog */}
      <AlertDialog open={!!itemToRemove} onOpenChange={(open) => !open && setItemToRemove(null)}>
        <AlertDialogContent className="w-[95vw] max-w-lg sm:max-w-md max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Item (Owner)</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{itemToRemove?.name}</strong>?
              This will issue a partial refund to the order total.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (itemToRemove) {
                  adminRemoveLockedItem(itemToRemove.orderId, itemToRemove.itemId);
                }
                setItemToRemove(null);
              }}
            >
              Confirm Removal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
