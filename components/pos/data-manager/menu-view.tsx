"use client";

import { useState, useRef } from "react";
import { usePOSStore } from "@/lib/store";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, ImageIcon, Upload, X, Loader2 } from "lucide-react";
import type { MenuItem, Modifier, Category } from "@/lib/data";
import { uploadMenuImage } from "@/lib/supabase-queries";

interface MenuViewProps {
  searchQuery: string;
}

export function MenuView({ searchQuery }: MenuViewProps) {
  const {
    menuItems,
    menuCategories,
    modifiers,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    addMenuCategory,
    updateMenuCategory,
    deleteMenuCategory,
    addModifier,
    updateModifier,
    deleteModifier,
  } = usePOSStore();

  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
  const [editingModifier, setEditingModifier] = useState<Modifier | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: string; id: string; name?: string } | null>(null);
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredMenuItems = menuItems.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = () => {
    if (!showDeleteConfirm) return;
    const { type, id } = showDeleteConfirm;
    if (type === "menuItem") deleteMenuItem(id);
    if (type === "modifier") deleteModifier(id);
    if (type === "category") {
      deleteMenuCategory(id);
      toast.success("Category deleted");
    }
    setShowDeleteConfirm(null);
  };

  const handleSaveModifier = () => {
    if (!editingModifier) return;
    const name = editingModifier.name.trim();
    if (!name) return toast.error("Modifier name is required");
    
    const price = Number(editingModifier.price) || 0;
    if (editingModifier.id.startsWith("new-mod-")) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `mod-${Date.now()}`;
      const newId = `${slug}-${Date.now().toString(36)}`;
      addModifier({ id: newId, name, price });
      toast.success(`Added "${name}"`);
    } else {
      updateModifier(editingModifier.id, { name, price });
      toast.success(`Updated "${name}"`);
    }
    setEditingModifier(null);
  };

  const handleSaveCategory = () => {
    if (!editingCategory || !editingCategory.name.trim()) return;
    if (editingCategory.id.startsWith("new-")) {
      const newId = editingCategory.name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      addMenuCategory({ ...editingCategory, id: newId || `cat-${Date.now()}` });
      toast.success("Category added");
    } else {
      updateMenuCategory(editingCategory.id, editingCategory);
      toast.success("Category updated");
    }
    setEditingCategory(null);
  };

  const handleSaveMenuItem = async () => {
    if (!editingMenuItem) return;
    const finalItem = { ...editingMenuItem };

    if (imageFile) {
      setIsUploading(true);
      try {
        const ext = imageFile.name.split('.').pop() || 'png';
        const safeName = (finalItem.name || 'item').toLowerCase().replace(/[^a-z0-9]/g, '-');
        const fileName = `${safeName}-${Date.now()}.${ext}`;
        const publicUrl = await uploadMenuImage(imageFile, fileName);
        finalItem.image_url = publicUrl;
        toast.success("Image uploaded successfully");
      } catch (err) {
        console.error("[menu-view] Image upload failed:", err);
        toast.error("Image upload failed — saving without image");
      } finally {
        setIsUploading(false);
      }
    }

    if (finalItem.id.startsWith("new-")) {
      const newId = `${finalItem.category}-${Date.now()}`;
      addMenuItem({ ...finalItem, id: newId });
      toast.success("Item added");
    } else {
      updateMenuItem(finalItem.id, finalItem);
      toast.success("Item updated");
    }
    setEditingMenuItem(null);
    setImageFile(null);
    setImagePreview(null);
  };

  const resetImageState = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Modifiers & Categories Grids */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Modifiers Card */}
        <Card className="bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-sm flex flex-col h-[300px]">
          <CardHeader className="py-3 flex flex-row items-center justify-between border-b border-white/10 shrink-0">
            <CardTitle className="text-sm">Add-ons / Modifiers ({modifiers.length})</CardTitle>
            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setEditingModifier({ id: "new-mod-" + Date.now(), name: "", price: 0 })}>
              <Plus className="h-3 w-3" /> Add
            </Button>
          </CardHeader>
          <CardContent className="p-0 overflow-auto flex-1">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-white/10">
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Extra Price</TableHead>
                  <TableHead className="text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modifiers.map((mod) => (
                  <TableRow key={mod.id} className="hover:bg-white/10 dark:hover:bg-white/5 border-b border-white/10">
                    <TableCell className="text-xs font-medium">{mod.name}</TableCell>
                    <TableCell className="text-xs">
                      {mod.price > 0 ? mod.price.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }) : "Free"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingModifier(mod)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setShowDeleteConfirm({ type: "modifier", id: mod.id, name: mod.name })}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Categories Card */}
        <Card className="bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-sm flex flex-col h-[300px]">
          <CardHeader className="py-3 flex flex-row items-center justify-between border-b border-white/10 shrink-0">
            <CardTitle className="text-sm">Categories ({menuCategories.length})</CardTitle>
            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setEditingCategory({ id: "new-" + Date.now(), name: "", icon: "tag" })}>
              <Plus className="h-3 w-3" /> Add
            </Button>
          </CardHeader>
          <CardContent className="p-0 overflow-auto flex-1">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-white/10">
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Items</TableHead>
                  <TableHead className="text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {menuCategories.map((cat) => (
                  <TableRow key={cat.id} className="hover:bg-white/10 dark:hover:bg-white/5 border-b border-white/10">
                    <TableCell className="text-xs font-medium capitalize">
                      {cat.name}
                      <div className="text-[10px] text-muted-foreground font-mono">{cat.id}</div>
                    </TableCell>
                    <TableCell className="text-xs">{menuItems.filter(m => m.category === cat.id).length}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingCategory(cat)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setShowDeleteConfirm({ type: "category", id: cat.id, name: cat.name })}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Menu Items Table */}
      <Card className="bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-lg">
        <CardHeader className="py-3 flex flex-row items-center justify-between border-b border-white/10">
          <CardTitle className="text-sm font-semibold">Menu Items ({filteredMenuItems.length})</CardTitle>
          <Button
            size="sm"
            className="h-8 gap-1 shadow-sm"
            onClick={() => setEditingMenuItem({ id: "new-" + Date.now(), name: "", price: 0, category: menuCategories[0]?.id ?? "coffee", available: true })}
          >
            <Plus className="h-4 w-4" /> Add Item
          </Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-white/10">
                <TableHead className="text-xs">Image</TableHead>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Category</TableHead>
                <TableHead className="text-xs">Price</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs max-w-[150px]">Variants</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMenuItems.map((item) => (
                <TableRow key={item.id} className="hover:bg-white/10 dark:hover:bg-white/5 transition-colors border-b border-white/10">
                  <TableCell className="w-16">
                    <div className="h-10 w-10 rounded-lg overflow-hidden border border-white/10 bg-black/10 flex items-center justify-center shrink-0">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="font-bold">{item.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]" title={item.id}>{item.id}</div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="outline" className="text-[10px] sm:text-xs capitalize bg-white/5">{item.category}</Badge>
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    {item.price.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 })}
                  </TableCell>
                  <TableCell className="text-xs">
                    <Badge variant={item.available ? "default" : "secondary"} className="text-[10px] sm:text-xs">
                      {item.available ? "Available" : "Unavailable"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {item.variants && item.variants.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {item.variants.map((v, i) => (
                          <span key={i} className="text-[10px] bg-secondary/50 px-1.5 py-0.5 rounded text-muted-foreground">
                            {v.name} (+₹{v.price})
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10" onClick={() => setEditingMenuItem(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setShowDeleteConfirm({ type: "menuItem", id: item.id, name: item.name })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredMenuItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                    No menu items found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* --- DIALOGS --- */}
      
      {/* Edit Menu Item Dialog */}
      <Dialog open={!!editingMenuItem} onOpenChange={(open) => !open && setEditingMenuItem(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingMenuItem?.id.startsWith("new-") ? "Add Menu Item" : "Edit Menu Item"}</DialogTitle>
          </DialogHeader>
          {editingMenuItem && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Image</Label>
                <div className="flex items-center gap-3">
                  <div className="relative h-16 w-16 rounded-lg bg-secondary/50 border border-border overflow-hidden flex items-center justify-center shrink-0">
                    {(imagePreview || editingMenuItem.image_url) ? (
                      <img
                        src={imagePreview || editingMenuItem.image_url}
                        alt="Preview"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (editingMenuItem.image_url && !editingMenuItem.image_url.startsWith('/menu/')) {
                            target.src = '/menu/_fallback.png';
                          }
                        }}
                      />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setImageFile(file);
                          setImagePreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                    <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs w-24" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-3 w-3" /> {imageFile ? "Change" : "Upload"}
                    </Button>
                    {(imageFile || editingMenuItem.image_url) && (
                      <Button
                        type="button" variant="ghost" size="sm" className="h-6 gap-1 text-xs text-muted-foreground hover:text-destructive px-1 w-fit"
                        onClick={() => { resetImageState(); setEditingMenuItem({ ...editingMenuItem, image_url: undefined }); }}
                      >
                        <X className="h-3 w-3" /> Clear
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={editingMenuItem.name} onChange={(e) => setEditingMenuItem({ ...editingMenuItem, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Price (INR)</Label>
                  <Input type="number" value={editingMenuItem.price} onChange={(e) => setEditingMenuItem({ ...editingMenuItem, price: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={editingMenuItem.category} onValueChange={(value) => setEditingMenuItem({ ...editingMenuItem, category: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {menuCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Availability</Label>
                <Select value={editingMenuItem.available ? "true" : "false"} onValueChange={(value) => setEditingMenuItem({ ...editingMenuItem, available: value === "true" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Available</SelectItem>
                    <SelectItem value="false">Unavailable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <Label>Variants</Label>
                  <Button 
                    type="button" variant="outline" size="sm" className="h-7 text-xs gap-1"
                    onClick={() => setEditingMenuItem({ ...editingMenuItem, variants: [...(editingMenuItem.variants || []), { name: "", price: 0 }] })}
                  >
                    <Plus className="h-3 w-3" /> Add Variant
                  </Button>
                </div>
                {(!editingMenuItem.variants || editingMenuItem.variants.length === 0) ? (
                  <div className="text-[11px] text-muted-foreground p-3 bg-secondary/30 rounded-md border text-center">
                    No variants. Click "Add Variant" for sizes or extras.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {editingMenuItem.variants.map((v, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input 
                          placeholder="Name (e.g. Large)" className="h-8 text-xs flex-1" value={v.name}
                          onChange={(e) => {
                            const newVariants = [...editingMenuItem.variants!];
                            newVariants[i] = { ...newVariants[i], name: e.target.value };
                            setEditingMenuItem({ ...editingMenuItem, variants: newVariants });
                          }}
                        />
                        <Input 
                          type="number" placeholder="Price (₹)" className="h-8 text-xs w-24" value={v.price || ""}
                          onChange={(e) => {
                            const newVariants = [...editingMenuItem.variants!];
                            newVariants[i] = { ...newVariants[i], price: Number(e.target.value) };
                            setEditingMenuItem({ ...editingMenuItem, variants: newVariants });
                          }}
                        />
                        <Button 
                          type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0"
                          onClick={() => setEditingMenuItem({ ...editingMenuItem, variants: editingMenuItem.variants!.filter((_, index) => index !== i) })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {modifiers.length > 0 && (
                <div className="space-y-2 pt-1">
                  <Label className="text-xs font-semibold">Applicable Add-ons</Label>
                  <p className="text-[11px] text-muted-foreground">Select which add-ons customers can choose for this item.</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {modifiers.map((mod) => {
                      const selected = editingMenuItem.modifierIds?.includes(mod.id) ?? false;
                      return (
                        <button
                          key={mod.id} type="button"
                          onClick={() => {
                            const current = editingMenuItem.modifierIds ?? [];
                            const next = selected ? current.filter((id) => id !== mod.id) : [...current, mod.id];
                            setEditingMenuItem({ ...editingMenuItem, modifierIds: next });
                          }}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                            selected ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary"
                          }`}
                        >
                          {mod.name}{mod.price > 0 ? ` +₹${mod.price}` : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingMenuItem(null); resetImageState(); }}>Cancel</Button>
            <Button onClick={handleSaveMenuItem} disabled={isUploading}>
              {isUploading ? <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Uploading...</> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modifier / Category Dialogs can be identical to existing logic... */}
      <Dialog open={!!editingModifier} onOpenChange={(open) => !open && setEditingModifier(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingModifier?.id.startsWith("new-mod-") ? "Add Modifier" : "Edit Modifier"}</DialogTitle></DialogHeader>
          {editingModifier && (
            <div className="space-y-4">
              <div className="space-y-2"><Label>Name</Label><Input value={editingModifier.name} onChange={(e) => setEditingModifier({ ...editingModifier, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Extra Price (₹)</Label><Input type="number" min={0} value={editingModifier.price} onChange={(e) => setEditingModifier({ ...editingModifier, price: Number(e.target.value) })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingModifier(null)}>Cancel</Button>
            <Button onClick={handleSaveModifier}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCategory?.id.startsWith("new-") ? "Add Category" : "Edit Category"}</DialogTitle></DialogHeader>
          {editingCategory && (
            <div className="space-y-4">
              <div className="space-y-2"><Label>Category Name</Label><Input value={editingCategory.name} onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCategory(null)}>Cancel</Button>
            <Button onClick={handleSaveCategory}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showDeleteConfirm} onOpenChange={(open) => !open && setShowDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Are you sure?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete "{showDeleteConfirm?.name}". This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
