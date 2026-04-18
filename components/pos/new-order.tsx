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
      handleEditItemNotes(tempId);
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
        {/* Order Type Selection */}
        <div className="grid grid-cols-4 gap-1 sm:gap-2 border-b border-border p-1.5 sm:p-3 shrink-0 bg-background">
          {orderTypes.map((type) => {
            const Icon = type.icon;
            const isActive = orderType === type.id;
            return (
              <Button
                key={type.id}
                variant={isActive ? "default" : "secondary"}
                className={cn(
                  "flex-col sm:flex-row gap-0.5 sm:gap-1 h-auto py-1.5 sm:py-2 sm:h-11 px-0.5 sm:px-3 text-[9px] sm:text-xs lg:h-14 lg:gap-2 lg:py-0 lg:text-sm",
                  isActive && "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                )}
                onClick={() => setOrderType(type.id as typeof orderType)}
              >
                <Icon className="h-4 w-4 shrink-0 lg:h-5 lg:w-5" />
                <span className="truncate">{type.label}</span>
              </Button>
            );
          })}
        </div>

        {/* Table Selection for Dine-in */}
        {orderType === "dine-in" && (
          <div className="flex flex-col gap-1.5 border-b border-border p-2 md:gap-2 md:p-3 lg:gap-3 lg:p-4 bg-card/50">
            <span className="flex items-center text-xs font-semibold text-foreground lg:text-sm">
              Select Table
            </span>
            {tables.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 md:gap-2 lg:gap-3">
                {tables.map((table) => {
                  const isSelected = selectedTable === table.id;
                  const tableOrders = activeOrdersByTable(table.id);
                  const hasActiveOrders = tableOrders.length > 0;
                  const statusColor = table.status === "available"
                    ? "bg-success" 
                    : table.status === "waiting-payment" 
                      ? "bg-destructive" 
                      : "bg-warning";
                  return (
                    <button
                      key={table.id}
                      onClick={() => setSelectedTable(isSelected ? null : table.id)}
                      className={cn(
                        "flex flex-col items-center justify-center rounded-xl border p-1.5 md:p-2 transition-all min-w-[56px] md:min-w-[64px] lg:min-w-[72px] relative",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground shadow-md"
                          : hasActiveOrders
                            ? "border-warning/50 bg-warning/10 text-foreground hover:border-primary/50"
                            : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-primary/5"
                      )}
                    >
                      <span className="text-xs font-bold md:text-sm lg:text-base">T{table.number}</span>
                      {hasActiveOrders ? (
                        <span className="text-[10px] sm:text-xs opacity-80">{tableOrders.length} order{tableOrders.length > 1 ? 's' : ''}</span>
                      ) : (
                        <span className="text-[10px] sm:text-xs opacity-80">Open</span>
                      )}
                      <div className="mt-0.5 md:mt-1 flex gap-0.5">
                        <div className={cn("h-1.5 w-1.5 md:h-2 md:w-2 rounded-full", isSelected ? "bg-primary-foreground" : statusColor)} />
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground lg:text-sm">
                No tables configured
              </span>
            )}
          </div>
        )}

        {/* Customer Info (Always visible, mandatory) */}
        <div className="border-b border-border p-2 md:p-3 lg:p-4">
          <div className="flex flex-col gap-2 lg:gap-3">
            <div className="flex flex-col sm:flex-row gap-2 lg:gap-4">
              <div className="flex flex-1 items-center gap-2">
                <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Input
                  placeholder="Customer name *"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className={cn("flex-1 h-9 bg-card border text-sm lg:h-10", !customerName.trim() && cart.length > 0 ? "border-destructive/50 focus-visible:ring-destructive" : "border-border")}
                />
              </div>
              <div className="flex flex-1 items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
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
                  className="flex-1 h-9 bg-card border text-sm lg:h-10 border-border"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Edit3 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                placeholder="Order note (optional)"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                className="flex-1 h-9 bg-card border-border border text-sm lg:h-10"
              />
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-1.5 md:gap-2 md:flex-wrap border-b border-border p-1.5 sm:p-3 sticky top-0 z-10 bg-background/95 backdrop-blur overflow-x-hidden md:overflow-x-visible">
          <button
            onClick={() => setActiveCategory("all")}
            className={cn(
              "flex items-center justify-center gap-1 sm:gap-1.5 rounded-full px-2 sm:px-3 py-1 sm:py-1.5 font-semibold text-[11px] sm:text-sm transition-all",
              activeCategory === "all"
                ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary ring-offset-1 ring-offset-background"
                : "bg-secondary/70 text-secondary-foreground hover:bg-secondary border border-border/40"
            )}
          >
            <UtensilsCrossed className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span>All</span>
            <span className={cn(
              "flex items-center justify-center rounded-full text-[9px] sm:text-[11px] font-bold px-1 sm:px-1.5 min-w-[16px] sm:min-w-[18px] h-3.5 sm:h-4 transition-colors",
              activeCategory === "all" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-background shadow-sm text-muted-foreground"
            )}>
              {menuItems.length}
            </span>
          </button>
          
          {menuCategories.map((cat) => {
            const Icon = categoryIcons[cat.id];
            const catCount = menuItems.filter(m => m.category === cat.id && m.available).length;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "flex items-center justify-center gap-1 sm:gap-1.5 rounded-full px-2 sm:px-3 py-1 sm:py-1.5 font-semibold text-[11px] sm:text-sm transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary ring-offset-1 ring-offset-background"
                    : "bg-secondary/70 text-secondary-foreground hover:bg-secondary border border-border/40"
                )}
              >
                {Icon && <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
                <span className="capitalize">{cat.name}</span>
                <span className={cn(
                  "flex items-center justify-center rounded-full text-[9px] sm:text-[11px] font-bold px-1 sm:px-1.5 min-w-[16px] sm:min-w-[18px] h-3.5 sm:h-4 transition-colors",
                  isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-background shadow-sm text-muted-foreground"
                )}>
                  {catCount}
                </span>
              </button>
            );
          })}
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
                  className="group cursor-pointer relative flex flex-col items-start overflow-hidden rounded-2xl bg-card shadow-sm border border-border/40 text-left transition-all duration-200 hover:shadow-md active:shadow-sm hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                  {/* Desktop Image - Only visible on md and up */}
                  <div className="hidden md:block relative w-full aspect-[4/3] shrink-0 overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5">
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
                      <div className="absolute top-0 left-0 bg-primary/95 text-primary-foreground text-[10px] md:text-xs uppercase font-bold px-2 py-1 rounded-br-lg shadow-sm backdrop-blur-sm z-10">
                        Bestseller
                      </div>
                    )}
                  </div>

                  {/* Desktop Content - Only visible on md and up */}
                  <div className="hidden md:flex flex-1 w-full flex-col p-4">
                    <span className="text-base font-semibold text-foreground leading-tight">
                      {item.name}
                    </span>

                    <div className="mt-auto pt-3 flex items-center justify-between w-full">
                      <span className="text-base font-bold text-primary">
                        {item.price.toLocaleString("en-IN", {
                          style: "currency",
                          currency: "INR",
                          minimumFractionDigits: 0,
                        })}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-7 text-xs transition-opacity"
                        onClick={(e) => { e.stopPropagation(); openModifierDialog(item); }}
                      >
                        Customize
                      </Button>
                    </div>
                  </div>

                  {/* Mobile Content - Hidden on md and up */}
                  <div className="flex flex-col w-full md:hidden p-2.5 sm:p-3 gap-2">
                    <div className="flex gap-2.5 sm:gap-3 items-start w-full">
                      <div className="flex-1 flex flex-col justify-start min-w-0">
                        <span className="text-[14px] font-bold text-foreground leading-tight truncate">
                          {item.name}
                        </span>
                        
                        <span className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-snug pr-2">
                          {(item as any).description || "Fresh and delicious"}
                        </span>
                        
                        <div className="mt-2 flex flex-wrap items-center justify-start gap-2">
                          <span className="text-[13px] font-bold text-foreground">
                            {item.price.toLocaleString("en-IN", {
                              style: "currency",
                              currency: "INR",
                              minimumFractionDigits: 0,
                            })}
                          </span>
                          
                          <button
                            className="text-[10px] font-bold text-muted-foreground uppercase opacity-80 hover:opacity-100 active:scale-95 transition-all flex items-center ml-1"
                            onClick={(e) => { e.stopPropagation(); openModifierDialog(item); }}
                          >
                            Customize
                          </button>
                      
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-center shrink-0 mt-0.5">
                        <div className="w-[84px] h-[84px] rounded-xl overflow-hidden shadow-sm border border-border/40 relative bg-muted/30">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="absolute inset-0 w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => e.currentTarget.src = '/menu/_fallback.png'}
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-3xl opacity-50">{emoji}</div>
                          )}
                          {item.bestseller && (
                            <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[8px] uppercase font-bold px-1.5 py-0.5 rounded-bl-lg shadow-sm z-10">
                              Best
                            </div>
                          )}
                        </div>
                        
                        <Button 
                          size="sm" 
                          className="h-8 -mt-3.5 z-10 w-[72px] px-0 rounded-lg font-bold text-[11px] bg-[#EA7531] text-white shadow-md uppercase tracking-wider border-2 border-background hover:bg-[#D56525] transition-all flex items-center justify-center gap-1"
                          onClick={(e) => { e.stopPropagation(); item.variants?.length ? openModifierDialog(item) : handleAddItem(item); }}
                        >
                          ADD <Plus className="h-3 w-3" strokeWidth={3} />
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
        "flex shrink-0 flex-col overflow-hidden bg-card z-40 md:border-l border-border/50",
        "md:relative md:w-72 sm:w-80 lg:w-80 xl:w-96 md:transform-none md:shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] md:flex md:overflow-visible",
        "fixed inset-x-0 bottom-14 md:bottom-0 max-h-[75vh] md:max-h-none md:h-auto rounded-t-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-transform duration-300",
        showMobileCart ? "translate-y-0 flex" : "translate-y-full md:translate-y-0"
      )}>
        <div className="md:hidden flex justify-center pt-2 pb-1">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>
        <CardHeader className="flex flex-col justify-center border-b border-border h-20 lg:h-24 px-5 py-3 pt-2 sm:pt-3 shrink-0 bg-background/50 backdrop-blur-sm space-y-1">
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
            <CardTitle className="text-lg font-bold tracking-tight lg:text-xl text-foreground flex items-center gap-2">
              <span className="md:hidden">
                <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2 text-muted-foreground hover:text-foreground" onClick={() => setShowMobileCart(false)}>
                  <ChevronDown className="h-5 w-5" />
                </Button>
              </span>
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
          <div className="border-t border-border p-4 shrink-0">
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
              <div className="flex gap-2">
                <Button
                  size="lg"
                  className={cn(
                    "flex-1 h-14 bg-primary text-primary-foreground hover:bg-primary/90 transition-all",
                    cart.length > 0 && "shadow-[0_4px_14px_0_rgba(245,158,11,0.39)] animate-pulse-subtle"
                  )}
                  disabled={cart.length === 0}
                  onClick={handleProceedToPayment}
                >
                  <UtensilsCrossed className="mr-2 h-4 w-4" />
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
