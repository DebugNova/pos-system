"use client";

import { useState } from "react";
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
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Table as TableType } from "@/lib/data";

interface TablesViewProps {
  searchQuery: string;
}

export function TablesView({ searchQuery }: TablesViewProps) {
  const { tables, addTable, updateTable, deleteTable, orders } = usePOSStore();
  
  const [editingTable, setEditingTable] = useState<TableType | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ id: string; name?: string } | null>(null);

  const filteredTables = tables.filter((t) =>
    t.number.toString().includes(searchQuery) ||
    t.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = () => {
    if (showDeleteConfirm) {
      deleteTable(showDeleteConfirm.id);
      setShowDeleteConfirm(null);
      toast.success("Table deleted");
    }
  };

  const handleSaveTable = () => {
    if (!editingTable) return;
    if (editingTable.id.startsWith("new-")) {
      const newId = `t${Date.now()}`;
      addTable({ ...editingTable, id: newId });
      toast.success("Table added");
    } else {
      updateTable(editingTable.id, editingTable);
      toast.success("Table updated");
    }
    setEditingTable(null);
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <Card className="bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-lg flex-1 flex flex-col overflow-hidden">
        <CardHeader className="py-3 flex flex-row items-center justify-between border-b border-white/10 shrink-0">
          <CardTitle className="text-sm font-semibold">Tables ({filteredTables.length})</CardTitle>
          <Button
            size="sm"
            className="h-8 gap-1 shadow-sm"
            onClick={() => setEditingTable({ id: "new-" + Date.now(), number: tables.length + 1, capacity: 4, status: "available" })}
          >
            <Plus className="h-4 w-4" /> Add Table
          </Button>
        </CardHeader>
        <CardContent className="p-0 overflow-y-auto flex-1">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-white/10">
                <TableHead className="text-xs">Table No.</TableHead>
                <TableHead className="text-xs">Capacity</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Current Order</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTables.map((table) => (
                <TableRow key={table.id} className="hover:bg-white/10 dark:hover:bg-white/5 transition-colors border-b border-white/10">
                  <TableCell className="text-xs font-medium">Table {table.number}</TableCell>
                  <TableCell className="text-xs">{table.capacity} seats</TableCell>
                  <TableCell className="text-xs">
                    <Badge
                      variant="outline"
                      className={`text-[11px] sm:text-xs ${
                        table.status === "available"
                          ? "border-success text-success bg-success/10"
                          : table.status === "occupied"
                          ? "border-warning text-warning bg-warning/10"
                          : "border-destructive text-destructive bg-destructive/10"
                      }`}
                    >
                      {table.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {table.orderId ? (
                      <div className="group relative inline-block cursor-help" title={table.orderId}>
                        {table.orderId.slice(0, 8)}...
                        <div className="absolute hidden group-hover:block bottom-full left-0 mb-1 px-2 py-1 bg-black text-white text-[10px] rounded whitespace-nowrap z-50">
                          {table.orderId}
                        </div>
                      </div>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/10" onClick={() => setEditingTable(table)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setShowDeleteConfirm({ id: table.id, name: `Table ${table.number}` })}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredTables.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                    No tables found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Table Dialog */}
      <Dialog open={!!editingTable} onOpenChange={(open) => !open && setEditingTable(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTable?.id.startsWith("new-") ? "Add Table" : "Edit Table"}</DialogTitle>
          </DialogHeader>
          {editingTable && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Table Number</Label>
                <Input type="number" value={editingTable.number} onChange={(e) => setEditingTable({ ...editingTable, number: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Capacity (Seats)</Label>
                <Input type="number" value={editingTable.capacity} onChange={(e) => setEditingTable({ ...editingTable, capacity: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editingTable.status} onValueChange={(value) => setEditingTable({ ...editingTable, status: value as TableType["status"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="occupied">Occupied</SelectItem>
                    <SelectItem value="reserved">Reserved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTable(null)}>Cancel</Button>
            <Button onClick={handleSaveTable}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showDeleteConfirm} onOpenChange={(open) => !open && setShowDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Table</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to permanently delete {showDeleteConfirm?.name}? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete Permanently</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
