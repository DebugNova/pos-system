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
  RefreshCw,
  Download,
} from "lucide-react";
import { format } from "date-fns";
import { syncPendingMutations } from "@/lib/sync";

export function Settings() {
  const { currentUser, settings, updateSettings, auditLog, staffMembers, addStaffMember, updateStaffMember, deleteStaffMember } = usePOSStore();
  
  const [isStaffDialogOpen, setIsStaffDialogOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [staffForm, setStaffForm] = useState({ name: "", role: "Manager", pin: "" });

  const permissions = getPermissions(currentUser?.role || "Chef");

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 sm:p-6 lg:p-8 w-full max-w-5xl mx-auto scroll-smooth">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure your POS system preferences
        </p>
      </div>

      <Tabs defaultValue="general" className="flex-1 w-full flex flex-col">
        <TabsList className="mb-6 bg-secondary/80 flex overflow-x-auto flex-nowrap w-full justify-start md:justify-start h-auto min-h-[60px] p-1.5 gap-2 snap-x snap-mandatory scrollbar-none rounded-2xl border border-border/40">
          <TabsTrigger value="general" className="flex items-center justify-center shrink-0 snap-start h-12 w-14 sm:w-16 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-primary/50 text-foreground/70 data-[state=active]:text-primary">
            <Store className="h-5 w-5" />
          </TabsTrigger>
          <TabsTrigger value="printers" className="flex items-center justify-center shrink-0 snap-start h-12 w-14 sm:w-16 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-primary/50 text-foreground/70 data-[state=active]:text-primary">
            <Printer className="h-5 w-5" />
          </TabsTrigger>
          <TabsTrigger value="staff" className="flex items-center justify-center shrink-0 snap-start h-12 w-14 sm:w-16 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-primary/50 text-foreground/70 data-[state=active]:text-primary">
            <Users className="h-5 w-5" />
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center justify-center shrink-0 snap-start h-12 w-14 sm:w-16 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-primary/50 text-foreground/70 data-[state=active]:text-primary">
            <CreditCard className="h-5 w-5" />
          </TabsTrigger>
          {permissions.canManageStaff && (
            <TabsTrigger value="audit" className="flex items-center justify-center shrink-0 snap-start h-12 w-14 sm:w-16 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-primary/50 text-foreground/70 data-[state=active]:text-primary">
              <ShieldAlert className="h-5 w-5" />
            </TabsTrigger>
          )}
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6 outline-none focus-visible:ring-0 mt-0 pb-10">
          <Card className="bg-card border-border overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold tracking-tight">Cafe Information</CardTitle>
              <CardDescription className="text-sm">
                Basic details about your cafe
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2.5 flex flex-col items-start w-full">
                  <Label htmlFor="cafeName" className="text-sm font-medium w-full text-left">Cafe Name</Label>
                  <Input
                    id="cafeName"
                    value={settings.cafeName}
                    onChange={(e) => updateSettings({ cafeName: e.target.value })}
                    className="bg-secondary/70 border-border/60 h-12 w-full px-4 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/50 text-base sm:text-sm"
                  />
                </div>
                <div className="space-y-2.5 flex flex-col items-start w-full">
                  <Label htmlFor="gst" className="text-sm font-medium w-full text-left">GST Number</Label>
                  <Input
                    id="gst"
                    value={settings.gstNumber}
                    onChange={(e) => updateSettings({ gstNumber: e.target.value })}
                    className="bg-secondary/70 border-border/60 h-12 w-full px-4 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/50 text-base sm:text-sm"
                  />
                </div>
              </div>
              <div className="space-y-2.5 flex flex-col items-start w-full">
                <Label htmlFor="address" className="text-sm font-medium w-full text-left">Address</Label>
                <Input
                  id="address"
                  placeholder="Enter cafe address"
                  value={settings.address}
                  onChange={(e) => updateSettings({ address: e.target.value })}
                  className="bg-secondary/70 border-border/60 h-12 w-full px-4 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/50 text-base sm:text-sm"
                />
              </div>

              {/* Install App Settings */}
              <div className="pt-6 border-t border-border/60">
                <div className="flex flex-row items-center justify-between gap-4 w-full">
                  <div className="space-y-1.5 flex-1 min-w-0 pr-2 text-left">
                    <h3 className="font-medium text-foreground text-sm sm:text-base tracking-tight truncate">App Installation</h3>
                    <p className="text-sm text-muted-foreground leading-snug break-words">Show prompt to install POS on your device.</p>
                  </div>
                  <Button onClick={() => updateSettings({ installPromptDismissed: false })} variant="outline" className="gap-2 shrink-0 h-11 px-4 sm:px-5 rounded-xl border-border/60 shadow-sm whitespace-nowrap">
                    <Download className="h-4 w-4" />
                    Install App
                  </Button>
                </div>
              </div>

              {/* Sync settings if admin */}
              {permissions.canManageStaff && (
                <div className="pt-6 border-t border-border/60">
                  <div className="flex flex-row items-center justify-between gap-4 w-full">
                    <div className="space-y-1.5 flex-1 min-w-0 pr-2 text-left">
                      <h3 className="font-medium text-foreground text-sm sm:text-base tracking-tight truncate">Advanced Data Sync</h3>
                      <p className="text-sm text-muted-foreground leading-snug break-words">Force retry synchronization for pending actions.</p>
                    </div>
                    <Button onClick={() => syncPendingMutations()} variant="outline" className="gap-2 shrink-0 h-11 px-4 sm:px-5 rounded-xl border-border/60 shadow-sm whitespace-nowrap">
                      <RefreshCw className="h-4 w-4" />
                      Retry Sync
                    </Button>
                  </div>
                </div>
              )}
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
                setStaffForm({ name: "", role: "Manager", pin: "" });
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
                          <AlertDialogContent className="w-[95vw] max-w-lg sm:max-w-md max-h-[85vh] overflow-y-auto">
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
              <div className="space-y-5 py-4">
                <div className="space-y-2.5 flex flex-col items-start w-full">
                  <Label htmlFor="staffName" className="text-left w-full text-sm font-medium">Name</Label>
                  <Input 
                    id="staffName" 
                    value={staffForm.name} 
                    onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })} 
                    placeholder="e.g. Rahul Sharma"
                    className="bg-secondary/70 border-border/60 h-12 w-full px-4 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/50 text-base sm:text-sm"
                  />
                </div>
                <div className="space-y-2.5 flex flex-col items-start w-full">
                  <Label htmlFor="staffRole" className="text-left w-full text-sm font-medium">Role</Label>
                  <Select value={staffForm.role} onValueChange={(val) => setStaffForm({ ...staffForm, role: val })}>
                    <SelectTrigger className="bg-secondary/70 border-border/60 h-12 w-full px-4 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/50 text-base sm:text-sm">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Owner">Owner</SelectItem>
                      <SelectItem value="Manager">Manager</SelectItem>
                      <SelectItem value="Chef">Chef</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2.5 flex flex-col items-start w-full">
                  <Label htmlFor="staffPin" className="text-left w-full text-sm font-medium">PIN (for login)</Label>
                  <Input 
                    id="staffPin" 
                    value={staffForm.pin} 
                    onChange={(e) => setStaffForm({ ...staffForm, pin: e.target.value.replace(/\D/g, '') })} 
                    maxLength={4} 
                    placeholder="4-digit PIN"
                    className="bg-secondary/70 border-border/60 h-12 w-full px-4 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/50 text-base sm:text-sm"
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
                <div className="pl-1 sm:pl-8 space-y-2.5 w-full flex flex-col items-start pt-2">
                  <Label className="text-sm font-medium w-full text-left">UPI ID</Label>
                  <Input
                    id="upiId"
                    value={settings.upiId}
                    onChange={(e) => updateSettings({ upiId: e.target.value })}
                    placeholder="e.g. cafe@upi"
                    className="bg-secondary/70 border-border/60 h-12 w-full px-4 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/50 text-base sm:text-sm"
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
                <div className="rounded-md border border-border overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <div className="min-w-[600px]">
                    <div className="flex bg-secondary p-3 text-sm font-medium text-muted-foreground border-b border-border">
                      <div className="min-w-[140px] whitespace-nowrap px-2">Timestamp</div>
                      <div className="min-w-[100px] whitespace-nowrap px-2">User</div>
                      <div className="min-w-[100px] whitespace-nowrap px-2">Action</div>
                      <div className="flex-1 px-2">Details</div>
                    </div>
                    <div className="max-h-[300px] sm:max-h-[500px] overflow-y-auto">
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
                              <div className="min-w-[140px] px-2 text-muted-foreground whitespace-nowrap">
                                {format(entry.timestamp, "dd MMM yy, hh:mm a")}
                              </div>
                              <div className="min-w-[100px] px-2 font-medium text-foreground whitespace-nowrap">
                                {entry.userId}
                              </div>
                              <div className="min-w-[100px] px-2 whitespace-nowrap">
                                <Badge variant="outline" className="capitalize">
                                  {entry.action.replace("_", " ")}
                                </Badge>
                              </div>
                              <div className="flex-1 px-2 text-muted-foreground flex flex-col items-start gap-1">
                                <span>{entry.details}</span>
                                {entry.orderId && (
                                  <Badge variant="secondary" className="text-[11px] sm:text-xs">
                                    Order: {entry.orderId}
                                  </Badge>
                                )}
                              </div>
                            </div>
                        ))
                      )}
                    </div>
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
