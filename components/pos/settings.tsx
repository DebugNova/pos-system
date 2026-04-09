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
} from "lucide-react";
import { format } from "date-fns";

export function Settings() {
  const { currentUser, settings, updateSettings, auditLog } = usePOSStore();
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
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Add Staff
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { name: "Admin User", role: "Admin", email: "admin@suhashi.cafe", active: true },
                { name: "Rahul Sharma", role: "Cashier", email: "rahul@suhashi.cafe", active: true },
                { name: "Priya Patel", role: "Server", email: "priya@suhashi.cafe", active: true },
                { name: "Amit Kumar", role: "Kitchen", email: "amit@suhashi.cafe", active: false },
              ].map((staff, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg bg-secondary/50 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
                      <span className="text-sm font-semibold text-primary">
                        {staff.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{staff.name}</p>
                      <p className="text-sm text-muted-foreground">{staff.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{staff.role}</Badge>
                    <Badge
                      variant="outline"
                      className={
                        staff.active
                          ? "border-success/50 text-success"
                          : "border-muted-foreground/50 text-muted-foreground"
                      }
                    >
                      {staff.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
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
