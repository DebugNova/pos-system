# Role Refactor — Owner / Manager / Chef

> Implementation guide for renaming existing roles and introducing a new **Manager** role.
> Hand this file to Claude in a fresh conversation and it should be able to execute end-to-end.

---

## 1. Goal (plain English)

We are collapsing the current 4-role model (`Admin`, `Cashier`, `Server`, `Kitchen`) into a new 3-role model:

| Old role  | New role  |
|-----------|-----------|
| Admin     | **Owner**   |
| Cashier   | *(removed — folded into Manager)* |
| Server    | *(removed — folded into Manager)* |
| Kitchen   | **Chef**    |
| *(new)*   | **Manager** |

### Role powers

- **Owner** — full access (identical to the current `Admin` role). Just renamed.
- **Chef** — kitchen only. Already scoped correctly today (`Kitchen` role access in [lib/roles.ts](../lib/roles.ts)). Only a rename is required.
- **Manager (NEW)** — same access as Owner **EXCEPT**:
  - ❌ **No Dashboard** (the "home" stat screen must not be visible, not in the sidebar, not as a default view, not via the More menu).
  - ❌ **No Settings** (neither the sidebar "Settings" entry on desktop/iPad, nor any Settings entry inside the mobile "More" sheet).
  - ✅ Everything else — New Order, Tables, Kitchen (view), Billing, Aggregator Inbox, Order History, **Reports**.
  - Because Reports and Data Manager are currently reachable only *through* the Dashboard (see [CLAUDE.md](../CLAUDE.md) → "Reports and Data Manager are accessed via Dashboard — not in the sidebar"), Manager needs an alternate entry point for **Reports**. Add a dedicated "Reports" item to the Manager's sidebar. Data Manager stays Owner-only (it is effectively a settings/destructive surface).

### Non-goals
- Do **not** touch the Chef (Kitchen) runtime behavior — it is already correct.
- Do **not** restructure RBAC beyond what is needed for these three roles.
- Do **not** break offline mode, sync queue, Realtime, or the pay-first order flow.
- Do **not** break existing persisted state — bump `STORE_VERSION` and add a migration.

---

## 2. Files that must change

Based on a grep for `Admin|Cashier|Server|Kitchen` across `.ts`/`.tsx`:

| # | File | What to do |
|---|------|------------|
| 1 | [lib/roles.ts](../lib/roles.ts) | Rewrite the role enum + access maps |
| 2 | [lib/store.ts](../lib/store.ts) | Update seed staff, bump `STORE_VERSION`, add migration, fix `role !== "Admin"` check |
| 3 | [components/pos/sidebar.tsx](../components/pos/sidebar.tsx) | Fallback role, nav filtering already driven by `canAccessView` — verify Manager gets a correct default view and Reports shows up |
| 4 | [components/pos/dashboard.tsx](../components/pos/dashboard.tsx) | `isAdmin` → `isOwner`; greeting "Welcome back, Admin" → "Welcome back, Owner" |
| 5 | [components/pos/new-order.tsx](../components/pos/new-order.tsx) | `isAdmin` → `isOwner` (line ~744) |
| 6 | [components/pos/billing.tsx](../components/pos/billing.tsx) | Fallback role `"Kitchen"` → `"Chef"` |
| 7 | [components/pos/settings.tsx](../components/pos/settings.tsx) | Staff role `<SelectItem>` options, default form role, fallback role |
| 8 | [components/pos/data-manager.tsx](../components/pos/data-manager.tsx) | Staff role `<SelectItem>` options, default role when creating a new staff row |
| 9 | [components/pos/kitchen-display.tsx](../components/pos/kitchen-display.tsx) | Grep for any `"Kitchen"` role literal — rename to `"Chef"` if present (view is also called "kitchen" — do NOT rename the view id) |
| 10 | [components/pos/reports.tsx](../components/pos/reports.tsx) | Grep for role literals — rename if any |
| 11 | [app/page.tsx](../app/page.tsx) | Grep for role literals — rename if any |
| 12 | Supabase **CHECK constraint** on `public.staff.role` | Must be updated before staff rows can be renamed |
| 13 | Supabase **RLS policies** that reference `'Admin'` | Rename to `'Owner'` |
| 14 | Supabase **staff rows** | Update existing rows to new role names |
| 15 | Supabase **Edge Function `pin-auth`** | If it has any literal role allowlist, update it. It embeds `role` into the JWT `user_role` claim, so the claim value will automatically flow through once DB rows are updated |

> ⚠️ The sidebar already uses `canAccessView(userRole, view)` to drive filtering, and the More sheet just slices the same `visibleNavItems` array ([sidebar.tsx:187-192](../components/pos/sidebar.tsx#L187-L192)). That means **once `lib/roles.ts` is correct, the mobile More menu automatically hides Settings for Manager.** No separate More-menu logic needs patching.

---

## 3. Step-by-step implementation

### Step 1 — Rewrite `lib/roles.ts`

Replace the file with the new 3-role model:

```ts
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
```

Notes:
- `Manager`'s first view is `orders` → that becomes the landing page after login.
- `Chef`'s fallback stays kitchen (the view id remains `"kitchen"` even though the role is now `Chef` — do NOT rename the view id).
- I added `canEditIntegrations` to `Owner` because the old file had it missing on the Admin block (it was only present on the other three) — harmless fix while we are here.

### Step 2 — Update `lib/store.ts`

1. Find the seed staff at [lib/store.ts:152-155](../lib/store.ts#L152-L155) and change to:
   ```ts
   { id: "1", name: "Owner",   role: "Owner",   pin: "1111", initials: "OW" },
   { id: "2", name: "Rahul S.", role: "Manager", pin: "1111", initials: "RS" },
   { id: "3", name: "Priya P.", role: "Manager", pin: "1111", initials: "PP" },
   { id: "4", name: "Amit K.",  role: "Chef",    pin: "1111", initials: "AK" },
   ```
   (Rename "Admin" staff member's name to "Owner" as well, matching the login screen the user showed.)

2. Find the check `currentUser?.role !== "Admin"` at [lib/store.ts:334](../lib/store.ts#L334) and change to `currentUser?.role !== "Owner"`.

3. **Bump `STORE_VERSION`** (e.g. `+1`) and add a Zustand `migrate` step that rewrites any persisted `currentUser.role` / `staff[].role`:
   - `"Admin"`   → `"Owner"`
   - `"Cashier"` → `"Manager"`
   - `"Server"`  → `"Manager"`
   - `"Kitchen"` → `"Chef"`

   This prevents existing users from getting locked out after deploy because their cached `currentUser` still has the old role string. Do the same rewrite inside any persisted `staff` list.

### Step 3 — Update components with literal role checks

Rename literals and fallbacks:

- [components/pos/dashboard.tsx:31](../components/pos/dashboard.tsx#L31): `currentUser?.role === "Admin"` → `=== "Owner"`, rename local `isAdmin` → `isOwner`, and change the greeting on line 79 to `"Welcome back, Owner."`. Also update the block comments/gating on lines 224-226.
- [components/pos/new-order.tsx:744](../components/pos/new-order.tsx#L744): same `isAdmin` → `isOwner` rename.
- [components/pos/billing.tsx:75](../components/pos/billing.tsx#L75): `getPermissions(currentUser?.role || "Kitchen")` → `|| "Chef"`.
- [components/pos/settings.tsx](../components/pos/settings.tsx):
  - Line 41 default `role: "Server"` → `role: "Manager"`.
  - Line 43 fallback `"Kitchen"` → `"Chef"`.
  - Line 358 reset `role: "Server"` → `role: "Manager"`.
  - Lines 458-461 `<SelectItem>` options — replace with just:
    ```tsx
    <SelectItem value="Owner">Owner</SelectItem>
    <SelectItem value="Manager">Manager</SelectItem>
    <SelectItem value="Chef">Chef</SelectItem>
    ```
- [components/pos/data-manager.tsx](../components/pos/data-manager.tsx):
  - Line 587 new staff default `role: "Cashier"` → `role: "Manager"`.
  - Lines 923-926 `<SelectItem>` options — same three-option list as above.
- [components/pos/sidebar.tsx:172](../components/pos/sidebar.tsx#L172): fallback `"Kitchen"` → `"Chef"`.
- [components/pos/kitchen-display.tsx](../components/pos/kitchen-display.tsx), [components/pos/reports.tsx](../components/pos/reports.tsx), [app/page.tsx](../app/page.tsx): grep each for the literal strings `"Admin"`, `"Cashier"`, `"Server"`, `"Kitchen"` **inside role context** (not the view id `"kitchen"`). Rename only role-context hits.

### Step 4 — Update Supabase schema + data

The `staff.role` column has a CHECK constraint that currently allows only `Admin | Cashier | Server | Kitchen`. Verified with:

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.staff'::regclass;
-- staff_role_check = CHECK (role = ANY (ARRAY['Admin','Cashier','Server','Kitchen']))
```

Order of operations matters (constraint must be relaxed before rows can be updated):

```sql
-- 1. Drop old constraint
ALTER TABLE public.staff DROP CONSTRAINT staff_role_check;

-- 2. Migrate existing rows
UPDATE public.staff SET role = 'Owner'   WHERE role = 'Admin';
UPDATE public.staff SET role = 'Manager' WHERE role IN ('Cashier', 'Server');
UPDATE public.staff SET role = 'Chef'    WHERE role = 'Kitchen';

-- 3. Optional: rename the "Admin" staff member's display name to match the login screen
UPDATE public.staff SET name = 'Owner', initials = 'OW' WHERE name = 'Admin';

-- 4. Re-add the constraint with the new allowlist
ALTER TABLE public.staff
  ADD CONSTRAINT staff_role_check
  CHECK (role = ANY (ARRAY['Owner','Manager','Chef']));
```

**RLS policies** currently reference `'Admin'` literally. Verified with:
```sql
SELECT policyname, tablename, qual FROM pg_policies
WHERE schemaname='public' AND qual LIKE '%Admin%';
```
Affected policies (as of this writing):
- `menu_items`: "Admin can update menu items", "Admin can delete menu items"
- `modifiers`: "Admin can update modifiers", "Admin can delete modifiers"
- `settings`: "Admin can update settings"
- `staff`: "Admin can update staff", "Admin can delete staff"
- `tables`: "Admin can delete tables"

For each one, drop and recreate pointing at `'Owner'`. Example:
```sql
DROP POLICY "Admin can update menu items" ON public.menu_items;
CREATE POLICY "Owner can update menu items" ON public.menu_items
  FOR UPDATE USING ((auth.jwt() ->> 'user_role') = 'Owner');
-- repeat for each policy above
```

Run this migration via `mcp__claude_ai_Supabase__apply_migration` (not raw execute_sql), so it is tracked.

**Edge Function `pin-auth`**: it reads `role` from the `staff` table and copies it into the JWT `user_role` claim. Once rows are updated, the claim will automatically carry the new values — no code change required **unless** the function has a hardcoded allowlist. Fetch it with `get_edge_function` and verify; if it hardcodes roles, redeploy with the new allowlist.

### Step 5 — Verify everything

1. `npm run lint`
2. `npm run build` — this will catch any leftover `"Admin" | "Cashier" | "Server" | "Kitchen"` literals because the `UserRole` union no longer accepts them. Fix any type errors the compiler surfaces (that is the authoritative catch-all list).
3. `npm run dev` and log in as each of the three users:
   - **Owner** — verify Dashboard, Reports, Settings, Data Manager all load exactly as before.
   - **Manager** — verify:
     - Sidebar shows: New Order, Tables, Kitchen, Billing, History, Reports.
     - Sidebar does NOT show: Dashboard, Settings.
     - On mobile, the "More" sheet does NOT contain a Settings entry.
     - Default landing view after login is New Order (`orders`).
     - Billing, refunds, discounts, receipt printing all work.
     - Reports page loads with live SQL-view data.
   - **Chef** — verify only the Kitchen view is reachable and KDS Realtime still fires audio + "NEW!" badges.
4. Realtime sanity: place an order from Manager on one device, confirm it appears on the Chef's KDS in real time.
5. Offline sanity: go offline, place an order as Manager, come back online, confirm the mutation queue drains.

---

## 4. Acceptance checklist

- [ ] `lib/roles.ts` only knows about `Owner | Manager | Chef`.
- [ ] `STORE_VERSION` bumped; persisted-state migration rewrites old role strings.
- [ ] Every `"Admin" | "Cashier" | "Server" | "Kitchen"` literal removed from `.ts`/`.tsx` (except the view id `"kitchen"`).
- [ ] Supabase `staff_role_check` constraint allows only the new three.
- [ ] All `staff` rows use the new role names.
- [ ] All RLS policies that referenced `'Admin'` now reference `'Owner'`.
- [ ] `pin-auth` Edge Function still issues valid JWTs for all three new roles.
- [ ] Manager user can NOT see Dashboard or Settings anywhere (sidebar, More sheet, or by URL).
- [ ] Manager user CAN see and use Reports, Orders, Tables, Kitchen, Billing, History.
- [ ] Chef user still sees only the Kitchen view, with Realtime alerts working.
- [ ] Owner user retains full access identical to the pre-refactor Admin.
- [ ] `npm run build` passes.
- [ ] Pay-first flow still works end-to-end (place order → pay → KDS → ready → served).

---

## 5. Risks & gotchas

- **Lockout from stale cache.** If you forget the `STORE_VERSION` bump + migration, users whose browsers still hold `currentUser.role = "Admin"` will hit the fallback permissions and be locked out. The migration is mandatory.
- **Order of SQL operations.** The CHECK constraint must be dropped before the `UPDATE` — otherwise the update fails.
- **Do not rename the view id `"kitchen"`.** Only the *role* is renamed. The view id is referenced everywhere (sidebar, routing, KDS filters) and is unrelated to the role name.
- **Data Manager stays Owner-only.** It is destructive (import / export / reset) and should not be handed to Manager, even though Manager sees Reports.
- **Free-tier Supabase.** A few UPDATE + DROP POLICY statements are trivial, no quota impact.
- **Audit log entries.** Historical `auditLog` entries may contain `by: "Admin"` / `by: "Cashier"` etc. Leave them as-is — they are a historical record, not a live role check.
