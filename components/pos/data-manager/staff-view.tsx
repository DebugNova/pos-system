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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface StaffViewProps {
  searchQuery: string;
}

export function StaffView({ searchQuery }: StaffViewProps) {
  const { staffMembers, addStaffMember, updateStaffMember, deleteStaffMember } = usePOSStore();
  
  const [editingStaff, setEditingStaff] = useState<{ id: string; name: string; role: string; pin: string; initials: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ id: string; name?: string } | null>(null);

  const filteredStaff = staffMembers.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = () => {
    if (showDeleteConfirm) {
      deleteStaffMember(showDeleteConfirm.id);
      setShowDeleteConfirm(null);
      toast.success("Staff member deleted");
    }
  };

  const handleSaveStaff = () => {
    if (!editingStaff) return;
    if (editingStaff.id.startsWith("new-")) {
      const newId = `staff-${Date.now()}`;
      addStaffMember({ ...editingStaff, id: newId });
      toast.success("Staff added");
    } else {
      updateStaffMember(editingStaff.id, editingStaff);
      toast.success("Staff updated");
    }
    setEditingStaff(null);
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <Card className="bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-lg flex-1 flex flex-col overflow-hidden">
        <CardHeader className="py-3 flex flex-row items-center justify-between border-b border-white/10 shrink-0">
          <CardTitle className="text-sm font-semibold">Staff Members ({filteredStaff.length})</CardTitle>
          <Button
            size="sm"
            className="h-8 gap-1 shadow-sm"
            onClick={() => setEditingStaff({ id: "new-" + Date.now(), name: "", role: "Manager", pin: "1111", initials: "" })}
          >
            <Plus className="h-4 w-4" /> Add Staff
          </Button>
        </CardHeader>
        <CardContent className="p-0 overflow-y-auto flex-1">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-white/10">
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Role</TableHead>
                <TableHead className="text-xs">PIN</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStaff.map((staff) => (
                <TableRow key={staff.id} className="hover:bg-white/10 dark:hover:bg-white/5 transition-colors border-b border-white/10">
                  <TableCell className="text-xs font-medium">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[11px] sm:text-xs font-semibold text-primary">
                        {staff.initials}
                      </div>
                      {staff.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="outline" className="text-[11px] sm:text-xs bg-white/5">{staff.role}</Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">****</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/10" onClick={() => setEditingStaff(staff)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setShowDeleteConfirm({ id: staff.id, name: staff.name })}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredStaff.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                    No staff found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Staff Dialog */}
      <Dialog open={!!editingStaff} onOpenChange={(open) => !open && setEditingStaff(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStaff?.id.startsWith("new-") ? "Add Staff" : "Edit Staff"}</DialogTitle>
          </DialogHeader>
          {editingStaff && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={editingStaff.name} onChange={(e) => {
                  const name = e.target.value;
                  const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
                  setEditingStaff({ ...editingStaff, name, initials });
                }} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Input value={editingStaff.role} onChange={(e) => setEditingStaff({ ...editingStaff, role: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>PIN (For Login)</Label>
                <Input type="password" maxLength={4} value={editingStaff.pin} onChange={(e) => setEditingStaff({ ...editingStaff, pin: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingStaff(null)}>Cancel</Button>
            <Button onClick={handleSaveStaff}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showDeleteConfirm} onOpenChange={(open) => !open && setShowDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Staff Member</DialogTitle></DialogHeader>
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
