// Role-based access control configuration
// Matches the blueprint: Admin, Cashier, Server (Waiter), Kitchen

export type UserRole = "Admin" | "Cashier" | "Server" | "Kitchen";

export type ViewId =
  | "dashboard"
  | "orders"
  | "tables"
  | "kitchen"
  | "reports"
  | "settings"
  | "aggregator"
  | "billing"
  | "history";

export type SettingsTab =
  | "general"
  | "printers"
  | "staff"
  | "payments"
  | "integrations";

// Which sidebar views each role can access
export const roleViewAccess: Record<UserRole, ViewId[]> = {
  Admin: [
    "dashboard",
    "orders",
    "tables",
    "kitchen",
    "reports",
    "settings",
    "aggregator",
    "billing",
    "history",
  ],
  Cashier: [
    "dashboard",
    "orders",
    "billing",
    "history",
  ],
  Server: [
    "dashboard",
    "orders",
    "tables",
    "kitchen",
  ],
  Kitchen: [
    "kitchen",
  ],
};

// Which settings tabs each role can see (only Admin reaches settings, but just in case)
export const roleSettingsAccess: Record<UserRole, SettingsTab[]> = {
  Admin: ["general", "printers", "staff", "payments", "integrations"],
  Cashier: [], // Cashier cannot access settings at all
  Server: [],  // Server cannot access settings at all
  Kitchen: [], // Kitchen cannot access settings at all
};

// Specific action permissions
export interface RolePermissions {
  canProcessRefunds: boolean;
  canApplyDiscounts: boolean;
  canEditMenu: boolean;
  canEditTax: boolean;
  canEditIntegrations: boolean;
  canManageStaff: boolean;
  canDeleteOrders: boolean;
  canEditOrders: boolean;
  canPrintReceipts: boolean;
  canViewReports: boolean;
  canManageData: boolean; // import/export/clear data
}

export const rolePermissions: Record<UserRole, RolePermissions> = {
  Admin: {
    canProcessRefunds: true,
    canApplyDiscounts: true,
    canEditMenu: true,
    canEditTax: true,
    canEditIntegrations: true,
    canManageStaff: true,
    canDeleteOrders: true,
    canEditOrders: true,
    canPrintReceipts: true,
    canViewReports: true,
    canManageData: true,
  },
  Cashier: {
    canProcessRefunds: false,
    canApplyDiscounts: true,
    canEditMenu: false,
    canEditTax: false,
    canEditIntegrations: false,
    canManageStaff: false,
    canDeleteOrders: false,
    canEditOrders: false,
    canPrintReceipts: true,
    canViewReports: false,
    canManageData: false,
  },
  Server: {
    canProcessRefunds: false,
    canApplyDiscounts: false,
    canEditMenu: false,
    canEditTax: false,
    canEditIntegrations: false,
    canManageStaff: false,
    canDeleteOrders: false,
    canEditOrders: true,
    canPrintReceipts: false,
    canViewReports: false,
    canManageData: false,
  },
  Kitchen: {
    canProcessRefunds: false,
    canApplyDiscounts: false,
    canEditMenu: false,
    canEditTax: false,
    canEditIntegrations: false,
    canManageStaff: false,
    canDeleteOrders: false,
    canEditOrders: false,
    canPrintReceipts: false,
    canViewReports: false,
    canManageData: false,
  },
};

// Helper to check if a role has access to a view
export function canAccessView(role: string, view: ViewId): boolean {
  const normalizedRole = role as UserRole;
  return roleViewAccess[normalizedRole]?.includes(view) ?? false;
}

// Helper to get the default view for a role (first in the list)
export function getDefaultView(role: string): ViewId {
  const normalizedRole = role as UserRole;
  return roleViewAccess[normalizedRole]?.[0] ?? "dashboard";
}

// Helper to get permissions for a role
export function getPermissions(role: string): RolePermissions {
  const normalizedRole = role as UserRole;
  return (
    rolePermissions[normalizedRole] ?? rolePermissions.Kitchen // Most restrictive as fallback
  );
}

// Helper to check if a role can access a settings tab
export function canAccessSettingsTab(
  role: string,
  tab: SettingsTab
): boolean {
  const normalizedRole = role as UserRole;
  return roleSettingsAccess[normalizedRole]?.includes(tab) ?? false;
}
