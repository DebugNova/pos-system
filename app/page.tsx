"use client";

import { useEffect } from "react";
import { POSSidebar } from "@/components/pos/sidebar";
import { Dashboard } from "@/components/pos/dashboard";
import { NewOrder } from "@/components/pos/new-order";
import { TableManagement } from "@/components/pos/table-management";
import { KitchenDisplay } from "@/components/pos/kitchen-display";
import { ReportsContent } from "@/components/pos/reports";
import { Settings } from "@/components/pos/settings";
import { AggregatorInbox } from "@/components/pos/aggregator-inbox";
import { Billing } from "@/components/pos/billing";
import { OrderHistory } from "@/components/pos/order-history";
import { Login } from "@/components/pos/login";
import { usePOSStore } from "@/lib/store";
import { canAccessView, getDefaultView, type ViewId } from "@/lib/roles";

export default function POSApp() {
  const { activeView, isLoggedIn, login, currentUser, setActiveView } = usePOSStore();

  // Enforce role-based access: if the current view isn't allowed, redirect to default
  useEffect(() => {
    if (isLoggedIn && currentUser) {
      if (!canAccessView(currentUser.role, activeView as ViewId)) {
        const defaultView = getDefaultView(currentUser.role);
        setActiveView(defaultView as typeof activeView);
      }
    }
  }, [isLoggedIn, currentUser, activeView, setActiveView]);

  if (!isLoggedIn) {
    return <Login onLogin={login} />;
  }

  return (
    <div className="flex h-screen bg-background">
      <POSSidebar />
      <main className="flex-1 overflow-auto">
        {activeView === "dashboard" && <Dashboard />}
        {activeView === "orders" && <NewOrder />}
        {activeView === "tables" && <TableManagement />}
        {activeView === "kitchen" && <KitchenDisplay />}
        {activeView === "reports" && <ReportsContent />}
        {activeView === "aggregator" && <AggregatorInbox />}
        {activeView === "billing" && <Billing />}
        {activeView === "history" && <OrderHistory />}
        {activeView === "settings" && <Settings />}
      </main>
    </div>
  );
}
