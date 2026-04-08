"use client";

import { POSSidebar } from "@/components/pos/sidebar";
import { Dashboard } from "@/components/pos/dashboard";
import { NewOrder } from "@/components/pos/new-order";
import { TableManagement } from "@/components/pos/table-management";
import { KitchenDisplay } from "@/components/pos/kitchen-display";

import { Settings } from "@/components/pos/settings";
import { AggregatorInbox } from "@/components/pos/aggregator-inbox";
import { Billing } from "@/components/pos/billing";
import { OrderHistory } from "@/components/pos/order-history";
import { Login } from "@/components/pos/login";
import { usePOSStore } from "@/lib/store";

export default function POSApp() {
  const { activeView, isLoggedIn, login } = usePOSStore();

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
        {activeView === "aggregator" && <AggregatorInbox />}
        {activeView === "billing" && <Billing />}
        {activeView === "history" && <OrderHistory />}
        {activeView === "settings" && <Settings />}
      </main>
    </div>
  );
}
