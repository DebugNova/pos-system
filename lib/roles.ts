// Role-based access control configuration
// Roles: Owner (full access), Manager (no dashboard, no settings), Chef (kitchen only)

export type UserRole = "Owner" | "Manager" | "Chef";

export type ViewId =
  | "dashboard"
  | "orders"
  | "tables"
  | "kitchen"
  | "reports"
  | "settings"
  | "billing"
  | "history";

export type SettingsTab =
  | "general"
  | "printers"
  | "staff"
  | "payments"
  | "audit";

// Which sidebar views each role can access
export const roleViewAccess: Record<UserRole, ViewId[]> = {
  Owner: [
    "dashboard",
    "orders",
    "tables",
    "kitchen",
    "reports",
    "settings",
    "billing",
    "history",
  ],
  // Manager = Owner minus dashboard & settings.
  // Reports is exposed directly because the dashboard entry point is hidden.
  Manager: [
    "orders",
    "tables",
    "kitchen",
    "billing",
    "history",
    "reports",
  ],
  Chef: ["kitchen"],
};

// Which settings tabs each role can see
export const roleSettingsAccess: Record<UserRole, SettingsTab[]> = {
  Owner: ["general", "printers", "staff", "payments", "audit"],
  Manager: [], // Manager cannot access settings at all
  Chef: [],
};

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
  canManageData: boolean;
}

export const rolePermissions: Record<UserRole, RolePermissions> = {
  Owner: {
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
  Manager: {
    // Manager is an operational power user: can run the floor end-to-end
    // but cannot edit menu/tax/staff/integrations or manage raw data.
    canProcessRefunds: true,
    canApplyDiscounts: true,
    canEditMenu: false,
    canEditTax: false,
    canEditIntegrations: false,
    canManageStaff: false,
    canDeleteOrders: false,
    canEditOrders: true,
    canPrintReceipts: true,
    canViewReports: true,
    canManageData: false,
  },
  Chef: {
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

export function canAccessView(role: string, view: ViewId): boolean {
  const normalizedRole = role as UserRole;
  return roleViewAccess[normalizedRole]?.includes(view) ?? false;
}

export function getDefaultView(role: string): ViewId {
  const normalizedRole = role as UserRole;
  return roleViewAccess[normalizedRole]?.[0] ?? "orders";
}

export function getPermissions(role: string): RolePermissions {
  const normalizedRole = role as UserRole;
  return rolePermissions[normalizedRole] ?? rolePermissions.Chef;
}

export function canAccessSettingsTab(role: string, tab: SettingsTab): boolean {
  const normalizedRole = role as UserRole;
  return roleSettingsAccess[normalizedRole]?.includes(tab) ?? false;
}
