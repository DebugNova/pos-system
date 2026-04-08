"use client";

import { POSSidebar } from "@/components/pos/sidebar";
import { Dashboard } from "@/components/pos/dashboard";
import { NewOrder } from "@/components/pos/new-order";
import { TableManagement } from "@/components/pos/table-management";
import { KitchenDisplay } from "@/components/pos/kitchen-display";
import { Reports } from "@/components/pos/reports";
import { Settings } from "@/components/pos/settings";
import { usePOSStore } from "@/lib/store";

export default function POSApp() {
  const { activeView } = usePOSStore();

  return (
    <div className="flex h-screen bg-background">
      <POSSidebar />
      <main className="flex-1 overflow-hidden">
        {activeView === "dashboard" && <Dashboard />}
        {activeView === "orders" && <NewOrder />}
        {activeView === "tables" && <TableManagement />}
        {activeView === "kitchen" && <KitchenDisplay />}
        {activeView === "reports" && <Reports />}
        {activeView === "settings" && <Settings />}
      </main>
    </div>
  );
}
