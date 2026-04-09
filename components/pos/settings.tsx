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
} from "lucide-react";

export function Settings() {
  const { currentUser } = usePOSStore();
  const permissions = getPermissions(currentUser?.role || "Kitchen");
  const [cafeName, setCafeName] = useState("SUHASHI Cafe");
  const [gstNumber, setGstNumber] = useState("27AABCT1234F1ZH");
  const [taxRate, setTaxRate] = useState("5");

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
                    value={cafeName}
                    onChange={(e) => setCafeName(e.target.value)}
                    className="bg-secondary border-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gst">GST Number</Label>
                  <Input
                    id="gst"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value)}
                    className="bg-secondary border-none"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  placeholder="Enter cafe address"
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
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable GST</Label>
                  <p className="text-sm text-muted-foreground">
                    Apply GST to all orders
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="taxRate">Tax Rate (%)</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="bg-secondary border-none"
                  />
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
                <Switch defaultChecked />
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
                <Switch defaultChecked />
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
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Print Customer Copy</Label>
                  <p className="text-sm text-muted-foreground">
                    Print receipt for customer
                  </p>
                </div>
                <Switch defaultChecked />
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
      </Tabs>
    </div>
  );
}
