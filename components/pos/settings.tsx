"use client";

import { useState } from "react";
import { usePOSStore } from "@/lib/store";
import { getPermissions } from "@/lib/roles";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {
  Store,
  Printer,
  Users,
  CreditCard,
  Bell,
  Wifi,
  CheckCircle2,
  XCircle,
  Plus,
  ShieldAlert,
  Search,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";

export function Settings() {
  const { currentUser, settings, updateSettings, auditLog, staffMembers, addStaffMember, updateStaffMember, deleteStaffMember } = usePOSStore();
  
  const [isStaffDialogOpen, setIsStaffDialogOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [staffForm, setStaffForm] = useState({ name: "", role: "Server", pin: "" });

  const permissions = getPermissions(currentUser?.role || "Kitchen");

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure your POS system preferences
        </p>
      </div>

      <Tabs defaultValue="general" className="flex-1">
        <TabsList className="mb-6 bg-secondary">
          <TabsTrigger value="general" className="gap-2">
            <Store className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="printers" className="gap-2">
            <Printer className="h-4 w-4" />
            Printers
          </TabsTrigger>
          <TabsTrigger value="staff" className="gap-2">
            <Users className="h-4 w-4" />
            Staff
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Payments
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Wifi className="h-4 w-4" />
            Integrations
          </TabsTrigger>
          {permissions.canManageStaff && (
            <TabsTrigger value="audit" className="gap-2">
              <ShieldAlert className="h-4 w-4" />
              Audit Log
            </TabsTrigger>
          )}
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Cafe Information</CardTitle>
              <CardDescription>
                Basic details about your cafe
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cafeName">Cafe Name</Label>
                  <Input
                    id="cafeName"
                    value={settings.cafeName}
                    onChange={(e) => updateSettings({ cafeName: e.target.value })}
                    className="bg-secondary border-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gst">GST Number</Label>
                  <Input
                    id="gst"
                    value={settings.gstNumber}
                    onChange={(e) => updateSettings({ gstNumber: e.target.value })}
                    className="bg-secondary border-none"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  placeholder="Enter cafe address"
                  value={settings.address}
                  onChange={(e) => updateSettings({ address: e.target.value })}
                  className="bg-secondary border-none"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Tax Settings</CardTitle>
              <CardDescription>
                Configure tax rates for billing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Enable GST</Label>
                  <p className="text-sm text-muted-foreground">
                    Apply GST to all orders
                  </p>
                </div>
                <Switch
                  checked={settings.gstEnabled}
                  onCheckedChange={(checked) => updateSettings({ gstEnabled: checked })}
                />
              </div>
              
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Applicable Tax Rate</Label>
                    <p className="text-xs text-muted-foreground lg:text-sm">
                      Slide or select a preset rate
                    </p>
                  </div>
                  <div className="flex items-center justify-center bg-primary/10 text-primary border border-primary/20 px-5 py-2 rounded-xl font-bold text-2xl shadow-inner min-w-[5rem]">
                    {settings.taxRate}%
                  </div>
                </div>
                
                <div className="px-2 pt-6 pb-4">
                  <Slider
                    value={[settings.taxRate]}
                    max={28}
                    step={1}
                    onValueChange={(vals) => updateSettings({ taxRate: vals[0] })}
                    className="w-full cursor-pointer"
                  />
                  <div className="flex justify-between mt-2 text-xs text-muted-foreground font-medium px-1">
                    <span>0%</span>
                    <span>14%</span>
                    <span>28%</span>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-2 pt-2">
                  {[0, 5, 12, 18, 28].map((rate) => (
                    <Button
                      key={rate}
                      variant="outline"
                      size="sm"
                      onClick={() => updateSettings({ taxRate: rate })}
                      className={`rounded-lg transition-all h-10 ${
                        settings.taxRate === rate
                          ? "bg-primary text-primary-foreground border-primary shadow ring-2 ring-primary/20"
                          : "hover:bg-secondary/80 bg-secondary/30"
                      }`}
                    >
                      {rate}%
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Notifications</CardTitle>
              <CardDescription>
                Configure alert preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  <div className="space-y-0.5">
                    <Label>Order Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Sound notification for new orders
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.orderAlerts}
                  onCheckedChange={(checked) => updateSettings({ orderAlerts: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  <div className="space-y-0.5">
                    <Label>Kitchen Ready Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Notify when order is ready
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.kitchenReadyAlerts}
                  onCheckedChange={(checked) => updateSettings({ kitchenReadyAlerts: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Printer Settings */}
        <TabsContent value="printers" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Connected Printers</CardTitle>
              <CardDescription>
                Manage receipt and kitchen printers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/20">
                    <Printer className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Receipt Printer</p>
                    <p className="text-sm text-muted-foreground">
                      Epson TM-T82II &bull; USB
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="gap-1.5 border-success/50 text-success">
                  <CheckCircle2 className="h-3 w-3" />
                  Connected
                </Badge>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/20">
                    <Printer className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Kitchen Printer</p>
                    <p className="text-sm text-muted-foreground">
                      Epson TM-U220 &bull; Network
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="gap-1.5 border-success/50 text-success">
                  <CheckCircle2 className="h-3 w-3" />
                  Connected
                </Badge>
              </div>

              <Button variant="outline" className="w-full gap-2">
                <Plus className="h-4 w-4" />
                Add Printer
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Print Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-print KOT</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically print kitchen tickets
                  </p>
                </div>
                <Switch
                  checked={settings.autoPrintKot}
                  onCheckedChange={(checked) => updateSettings({ autoPrintKot: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Print Customer Copy</Label>
                  <p className="text-sm text-muted-foreground">
                    Print receipt for customer
                  </p>
                </div>
                <Switch
                  checked={settings.printCustomerCopy}
                  onCheckedChange={(checked) => updateSettings({ printCustomerCopy: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Staff Settings */}
        <TabsContent value="staff" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Staff Members</CardTitle>
                <CardDescription>
                  Manage staff accounts and permissions
                </CardDescription>
              </div>
              <Button size="sm" className="gap-1.5" onClick={() => {
                setStaffForm({ name: "", role: "Server", pin: "" });
                setEditingStaffId(null);
                setIsStaffDialogOpen(true);
              }}>
                <Plus className="h-4 w-4" />
                Add Staff
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {staffMembers.map((staff) => {
                const isActive = staff.name === currentUser?.name;
                return (
                  <div
                    key={staff.id}
                    className="flex items-center justify-between rounded-lg bg-secondary/50 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 cursor-pointer" onClick={() => {
                          setStaffForm({ name: staff.name, role: staff.role, pin: staff.pin });
                          setEditingStaffId(staff.id);
                          setIsStaffDialogOpen(true);
                      }}>
                        <span className="text-sm font-semibold text-primary">
                          {staff.initials || staff.name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="cursor-pointer" onClick={() => {
                          setStaffForm({ name: staff.name, role: staff.role, pin: staff.pin });
                          setEditingStaffId(staff.id);
                          setIsStaffDialogOpen(true);
                      }}>
                        <p className="font-medium text-foreground">{staff.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">PIN: {staff.pin.replace(/./g, '*')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">{staff.role}</Badge>
                      <Badge
                        variant="outline"
                        className={
                          isActive
                            ? "border-success/50 text-success"
                            : "border-muted-foreground/50 text-muted-foreground"
                        }
                      >
                        {isActive ? "Active" : "Inactive"}
                      </Badge>
                      {!isActive && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Staff Member</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete {staff.name}? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteStaffMember(staff.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Dialog open={isStaffDialogOpen} onOpenChange={setIsStaffDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingStaffId ? "Edit Staff Member" : "Add Staff Member"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="staffName">Name</Label>
                  <Input 
                    id="staffName" 
                    value={staffForm.name} 
                    onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })} 
                    placeholder="e.g. Rahul Sharma" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staffRole">Role</Label>
                  <Select value={staffForm.role} onValueChange={(val) => setStaffForm({ ...staffForm, role: val })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Admin">Admin</SelectItem>
                      <SelectItem value="Cashier">Cashier</SelectItem>
                      <SelectItem value="Server">Server</SelectItem>
                      <SelectItem value="Kitchen">Kitchen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staffPin">PIN (for login)</Label>
                  <Input 
                    id="staffPin" 
                    value={staffForm.pin} 
                    onChange={(e) => setStaffForm({ ...staffForm, pin: e.target.value.replace(/\D/g, '') })} 
                    maxLength={4} 
                    placeholder="4-digit PIN" 
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsStaffDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => {
                  if (!staffForm.name || !staffForm.pin || staffForm.pin.length < 4) return;
                  
                  if (editingStaffId) {
                    updateStaffMember(editingStaffId, staffForm);
                  } else {
                    const initials = staffForm.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
                    addStaffMember({
                      id: `staff-${Date.now()}`,
                      name: staffForm.name,
                      role: staffForm.role,
                      pin: staffForm.pin,
                      initials
                    });
                  }
                  setIsStaffDialogOpen(false);
                }}>
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Payment Settings */}
        <TabsContent value="payments" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Payment Methods</CardTitle>
              <CardDescription>
                Configure accepted payment methods
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <div className="space-y-0.5">
                    <Label>Cash</Label>
                    <p className="text-sm text-muted-foreground">Accept cash payments</p>
                  </div>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    <div className="space-y-0.5">
                      <Label>UPI</Label>
                      <p className="text-sm text-muted-foreground">
                        Accept UPI payments (PhonePe, GPay, etc.)
                      </p>
                    </div>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="pl-8 space-y-2">
                  <Label>UPI ID</Label>
                  <Input
                    id="upiId"
                    value={settings.upiId}
                    onChange={(e) => updateSettings({ upiId: e.target.value })}
                    placeholder="e.g. cafe@upi"
                    className="bg-secondary border-none"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <div className="space-y-0.5">
                    <Label>Card</Label>
                    <p className="text-sm text-muted-foreground">
                      Accept debit/credit cards
                    </p>
                  </div>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations */}
        <TabsContent value="integrations" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Aggregator Integrations</CardTitle>
              <CardDescription>
                Connect with food delivery platforms
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#fc8019]">
                    <span className="text-lg font-bold text-white">S</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Swiggy</p>
                    <p className="text-sm text-muted-foreground">
                      Receive orders from Swiggy
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="gap-1.5 border-success/50 text-success">
                  <CheckCircle2 className="h-3 w-3" />
                  Connected
                </Badge>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e23744]">
                    <span className="text-lg font-bold text-white">Z</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Zomato</p>
                    <p className="text-sm text-muted-foreground">
                      Receive orders from Zomato
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="gap-1.5 border-muted-foreground/50 text-muted-foreground">
                  <XCircle className="h-3 w-3" />
                  Not Connected
                </Badge>
              </div>

              <Button variant="outline" className="w-full gap-2">
                <Plus className="h-4 w-4" />
                Add Integration
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Log (Admin Only) */}
        {permissions.canManageStaff && (
          <TabsContent value="audit" className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-primary" />
                  System Audit Log
                </CardTitle>
                <CardDescription>
                  Track all critical actions performed in the system
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-border">
                  <div className="flex bg-secondary p-3 text-sm font-medium text-muted-foreground border-b border-border">
                    <div className="w-[180px]">Timestamp</div>
                    <div className="w-[150px]">User</div>
                    <div className="w-[150px]">Action</div>
                    <div className="flex-1">Details</div>
                  </div>
                  <div className="max-h-[500px] overflow-y-auto">
                    {auditLog.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        No audit records found
                      </div>
                    ) : (
                      [...auditLog]
                        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                        .map((entry, index) => (
                          <div 
                            key={index}
                            className="flex items-center p-3 text-sm border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors"
                          >
                            <div className="w-[180px] text-muted-foreground whitespace-nowrap">
                              {format(entry.timestamp, "dd MMM yy, hh:mm a")}
                            </div>
                            <div className="w-[150px] font-medium text-foreground">
                              {entry.userId}
                            </div>
                            <div className="w-[150px]">
                              <Badge variant="outline" className="capitalize">
                                {entry.action.replace("_", " ")}
                              </Badge>
                            </div>
                            <div className="flex-1 text-muted-foreground flex flex-col items-start gap-1">
                              <span>{entry.details}</span>
                              {entry.orderId && (
                                <Badge variant="secondary" className="text-[10px]">
                                  Order: {entry.orderId}
                                </Badge>
                              )}
                            </div>
                          </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
