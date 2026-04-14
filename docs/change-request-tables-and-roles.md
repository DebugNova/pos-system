# Change Request — 7 Tables & 3 Named-by-Role Staff

> **For the AI agent:** Apply every change below. After all edits run `npm run build` and fix any type errors before reporting complete. Do **not** touch RBAC logic (role keys stay `Owner | Manager | Chef`). Only displayed names/PINs/table seed change.

---

## Part A — Tables: 5 → 7

### A1. Current state
`lib/data.ts` currently seeds 5 tables. The field `capacity` is **display-only** — nothing in the codebase blocks a larger party from sitting at a smaller table. Keep that behavior. The capacity number is just a label shown in [components/pos/table-management.tsx](components/pos/table-management.tsx) (e.g. `{table.capacity} seats`). Do **not** add any min/max-party-size check anywhere.

### A2. New seed (edit `lib/data.ts`)

Replace the `tables` export with exactly these 7 rows:

```ts
export const tables: Table[] = [
  { id: "t1", number: 1, capacity: 3, status: "available" },
  { id: "t2", number: 2, capacity: 3, status: "available" },
  { id: "t3", number: 3, capacity: 3, status: "available" },
  { id: "t4", number: 4, capacity: 2, status: "available" },
  { id: "t5", number: 5, capacity: 2, status: "available" },
  { id: "t6", number: 6, capacity: 3, status: "available" },
  { id: "t7", number: 7, capacity: 4, status: "available" },
];
```

### A3. Supabase `tables` row reset

Run this SQL against project `ycrwtvtdsbjbhdqyuptq` (use the Supabase MCP `execute_sql` tool). It wipes only the tables list and re-seeds it. **Do not run while a shift is open** — any linked order rows with `table_id` pointing at old IDs will lose their link.

```sql
-- Clear order links first so we don't violate FK, then reseed
UPDATE orders SET table_id = NULL WHERE table_id IS NOT NULL;
DELETE FROM tables;

INSERT INTO tables (id, number, capacity, status) VALUES
  ('t1', 1, 3, 'available'),
  ('t2', 2, 3, 'available'),
  ('t3', 3, 3, 'available'),
  ('t4', 4, 2, 'available'),
  ('t5', 5, 2, 'available'),
  ('t6', 6, 3, 'available'),
  ('t7', 7, 4, 'available');
```

> Verify column names with `list_tables` first — if the real column is `table_number` instead of `number`, adjust the INSERT accordingly.

### A4. Bump the store version
In [lib/store.ts](lib/store.ts) increment `STORE_VERSION` by 1 so existing browsers drop the cached 5-table state on next load.

### A5. Sanity check
- [components/pos/table-management.tsx](components/pos/table-management.tsx) — confirm all 7 tables render in both grid and compact views. No code change expected, just verify at runtime.
- [components/pos/data-manager.tsx](components/pos/data-manager.tsx) Tables tab — should list 7 rows after reset.
- Grep the repo once with `Grep` for the literal string `"t5"` and for `capacity: 6` to make sure no other file hardcodes the old seed.

---

## Part B — 3 Staff, Named by Role, All PIN = 1234

### B1. Role system — do NOT rename
The RBAC keys in [lib/roles.ts](lib/roles.ts) (`Owner`, `Manager`, `Chef`) stay **exactly as-is**. Permissions, view access, settings access — untouched. We only change the `staff.name` column (the display label shown on the login card and at the top of the app) and consolidate from 4 rows to 3.

### B2. New staff roster

| Display name    | Internal role | PIN  | Initials |
|-----------------|---------------|------|----------|
| `Admin`         | `Owner`       | 1234 | `AD`     |
| `Barista`       | `Manager`     | 1234 | `BA`     |
| `Kitchen Chief` | `Chef`        | 1234 | `KC`     |

### B3. Edit `lib/store.ts`

Replace `defaultStaffMembers` (around line 183) with:

```ts
const defaultStaffMembers: StaffMember[] = [
  { id: "065006fd-d23b-46ed-8600-9584e31bf251", name: "Admin",         role: "Owner",   pin: "1234", initials: "AD" },
  { id: "8a93ab58-a358-46c5-9c79-396370e4fd17", name: "Barista",       role: "Manager", pin: "1234", initials: "BA" },
  { id: "3670c7e0-26bd-48fe-8941-397707be9ed8", name: "Kitchen Chief", role: "Chef",    pin: "1234", initials: "KC" },
];
```

Keep the existing Admin/Barista UUIDs so any JWT claim comparisons still line up. **Drop** the `a4574ed7-...` Priya row entirely. Bump `STORE_VERSION` (same bump as A4 — one increment covers both changes).

### B4. PIN collision — the only logic change you must make

With three staff sharing PIN `1234`, the `pin-auth` Edge Function can no longer identify who is logging in from the PIN alone. Add a `staffId` disambiguator. This is the smallest possible change and does **not** alter the RBAC model.

**B4a. Edge function** — edit `pin-auth` via the Supabase MCP (`get_edge_function` then `deploy_edge_function`):

- Accept body `{ pin: string, staffId?: string }`.
- Query `staff` with `eq('pin', pin)`; if `staffId` is provided, also `eq('id', staffId)` and expect a single row.
- Return `401` with the same error message if no row matches.
- Everything else (JWT minting, claims) stays identical.

**B4b. Client** — edit [lib/auth.ts](lib/auth.ts) `loginWithPin`:

```ts
export async function loginWithPin(
  pin: string,
  staffId?: string,
): Promise<{ session: AuthSession; user: StaffUser }> {
  // ...
  body: JSON.stringify({ pin, staffId }),
  // ...
}
```

**B4c. Login screen** — [components/pos/login.tsx](components/pos/login.tsx) already knows `selectedStaff.id` before calling the API. Change the call site to:

```ts
const { user: authUser } = await loginWithPin(pin, selectedStaff.id);
```

The existing post-auth check `authUser.id !== selectedStaff.id` becomes redundant but leave it in as defense-in-depth.

### B5. Supabase `staff` row reset

Run via MCP `execute_sql`:

```sql
-- Nuke existing staff and reseed with the three role-named rows.
-- audit_log.user_id is text (staff id), so nothing to cascade there.
DELETE FROM staff;

INSERT INTO staff (id, name, role, pin, initials, active) VALUES
  ('065006fd-d23b-46ed-8600-9584e31bf251', 'Admin',         'Owner',   '1234', 'AD', true),
  ('8a93ab58-a358-46c5-9c79-396370e4fd17', 'Barista',       'Manager', '1234', 'BA', true),
  ('3670c7e0-26bd-48fe-8941-397707be9ed8', 'Kitchen Chief', 'Chef',    '1234', 'KC', true);
```

> Use `list_tables` first to confirm real column names (`active` may be `is_active`; `pin` may be `pin_hash` if hashed). If PINs are hashed, hash `1234` with the same function the existing rows use — inspect one existing row to infer the scheme.

### B6. Things that MUST NOT change
- `lib/roles.ts` — no edits.
- `rolePermissions`, `roleViewAccess`, `roleSettingsAccess` maps — no edits.
- RLS policies keyed on `auth.jwt() ->> 'user_role'` — no edits (Owner/Manager/Chef still flow through JWT).
- Any component that reads `currentUser.role` — no edits.

---

## Part C — Verification Checklist

After all edits, run and confirm **every** item:

1. `npm run build` — zero type errors.
2. `npm run dev`, open the app in a fresh Incognito window.
3. Login screen shows exactly 3 cards: `Admin`, `Barista`, `Kitchen Chief`. No personal names anywhere.
4. Each card accepts PIN `1234` and logs into the correct view:
   - Admin → dashboard
   - Barista → orders (no dashboard, no settings)
   - Kitchen Chief → kitchen only
5. Tables view shows 7 tables numbered 1–7 with seat labels `3, 3, 3, 2, 2, 3, 4`.
6. Create a dine-in order for a party of 10 and seat them at Table 4 (capacity 2). It must go through — no blocker, no warning. This proves the capacity label is cosmetic.
7. Open the Supabase dashboard (or `list_tables` via MCP) and confirm `staff` has 3 rows and `tables` has 7 rows.
8. Log out, reload (hard refresh), log back in — persistence survives the `STORE_VERSION` bump.
9. Kitchen Chief login → verify the KDS audio/visual alert still fires on a new paid order from Admin on another tab (realtime still works).
10. Open a second browser, log in as Barista on tab A and Admin on tab B simultaneously — both sessions should be independent (they will be, because each tab holds its own `session` in sessionStorage). This proves the shared PIN + staffId disambiguator works.

## Part D — Rollback
If anything breaks, the rollback is:
1. `git checkout -- lib/data.ts lib/store.ts lib/auth.ts components/pos/login.tsx`
2. Redeploy the previous `pin-auth` function (MCP `get_edge_function` captured its source before edits — save it locally first).
3. Re-run the old staff/tables seed SQL (keep a copy of the pre-change `SELECT * FROM staff` and `SELECT * FROM tables` output before you run the DELETE statements in B5 / A3).

**Save those two SELECT outputs to a scratch file before running any DELETE.** That is your safety net.
