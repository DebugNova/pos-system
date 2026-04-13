# New Project Backend Migration Guide

> **Purpose:** You (the AI agent) are being handed a **freshly cloned copy** of the SUHASHI Cafe POS repo. The human has copy-pasted the source tree into a new folder as the starting point for a new startup product (working name: **"Flow POS"** — a rebrand/evolution of this codebase). Your job is to wire this new folder to a **brand-new, fully independent Supabase project**. The old project (`ycrwtvtdsbjbhdqyuptq`) **must not** be touched, referenced at runtime, or shared in any way. The two products will diverge from here; this is a one-time backend clone, not a fork that stays in sync.
>
> The frontend code stays exactly as-is. Only the backend (Supabase project, database schema, RLS, Realtime publications, Edge Functions, storage bucket, env vars) needs to be re-created from scratch against a new Supabase project.

---

## 0. Golden Rules (read these first)

1. **Do not run any write operation against the old project `ycrwtvtdsbjbhdqyuptq`.** You may *read* from it to inspect schema/migrations/edge-function source as a reference, but **no `apply_migration`, `execute_sql`, `deploy_edge_function`, or storage writes** against that project ID. If in doubt, stop and ask.
2. **Do not copy any data** (orders, staff, audit logs, shifts) from the old project. The new project starts empty except for seed rows documented below.
3. **Do not leave the old project ID anywhere in the new folder.** Grep `ycrwtvtdsbjbhdqyuptq` and replace every occurrence with the new project ID/URL. It should appear in zero files after you are done (documentation-only mentions in `CLAUDE.md` and `docs/` should be updated too).
4. **The two projects must be fully independent.** No cross-project references, no shared secrets, no shared storage buckets, no shared webhooks.
5. **Run `npm run build` after every meaningful change.** The project has a strict TS setup; catch type errors early.
6. **The new project will be on the Supabase Free plan** by default. Everything must stay within: 500 MB DB, 1 GB storage, 2 GB bandwidth, 500k Edge Function invocations/month.

---

## 1. What You Are Replicating

The source Supabase project (`ycrwtvtdsbjbhdqyuptq`, region `ap-south-1`) contains:

- **11 public tables** (with RLS on all): `staff`, `settings`, `tables`, `menu_items`, `modifiers`, `orders`, `order_items`, `supplementary_bills`, `supplementary_bill_items`, `audit_log`, `shifts`
- **6 SQL views** for reports: `v_daily_sales`, `v_hourly_revenue`, `v_payment_breakdown`, `v_top_items`, `v_staff_performance`, `v_item_details` (all with `security_invoker=on`)
- **RLS policies** keyed on `auth.jwt() ->> 'user_role'` with roles `Owner`, `Manager`, `Chef`
- **Realtime publication** (`supabase_realtime`) on: `orders`, `order_items`, `tables`, `settings`, `staff`, `modifiers`, `supplementary_bills`, `supplementary_bill_items` — all with `REPLICA IDENTITY FULL`
- **Storage bucket** `menu-images` (public, 5 MB limit, PNG/JPEG/WebP/GIF)
- **Two Edge Functions**: `pin-auth` (verify_jwt=false) and `aggregator-webhook` (verify_jwt=false)
- **Edge Function secrets**: `AGGREGATOR_WEBHOOK_SECRET` (new random value required for new project)
- **22 migrations** listed below — apply them in order, or equivalently in a single consolidated migration. **Do not re-use the old migration version timestamps.**

### Source migration list (for reference — replicate what they do, don't copy timestamps)

```
20260411054945  create_full_schema
20260411055057  enable_rls_policies
20260411062111  enable_realtime_publications
20260411063507  create_report_views
20260411064258  fix_views_security_invoker
20260411103327  add_delete_policies_for_reset
20260411110448  add_pay_later_column_to_orders
20260411110649  add_served_unpaid_to_status_check
20260411114215  add_customer_phone_to_orders
20260411133415  set_replica_identity_full
20260411133424  add_supplementary_tables_to_realtime
20260411133842  add_update_policy_supplementary_bill_items
20260412053505  refactor_roles_owner_manager_chef
20260412083158  add_payment_settings_columns
20260412095618  v_item_details
20260412111108  fix_owner_rls_claim_path
20260412112625  enable_realtime_modifiers
20260413030913  add_audit_log_auto_purge
20260413031042  fix_rls_auth_jwt_initplan
20260413031106  fix_v_item_details_security_invoker
20260413031130  fix_supplementary_bill_items_update_policy_role
```

You have two valid paths for recreating schema:

- **Path A (recommended):** Use Supabase MCP to read each migration's SQL from the old project via `list_migrations` + inspection, then call `apply_migration` on the new project in the same order with fresh names. This preserves history cleanly.
- **Path B:** Use `list_tables(verbose=true)` + `execute_sql("select ... from information_schema")` against the old project to reconstruct a single consolidated migration, then `apply_migration` it to the new project once. Faster but loses migration granularity.

Either is fine. **Path A is safer** because it preserves the exact SQL the live project was built from, including the later fixes (RLS initplan optimization, security_invoker on views, role refactor, etc.).

---

## 2. Step-by-Step Execution Plan

### Step 1 — Confirm context with the user before touching anything

Before any tool call, confirm with the human:
- The **new Supabase org** to create the project under (use `mcp__claude_ai_Supabase__list_organizations`).
- The **new project name** (suggested: `flow-pos` or whatever the user wants for the rebrand).
- The **region** — match the old one (`ap-south-1` / Mumbai) unless the user wants otherwise. Latency matters for a POS.
- The **DB password** — the user must provide or approve one. Never pick one silently.
- Whether **Path A or Path B** is preferred for schema replication.

Use `mcp__claude_ai_Supabase__get_cost` + `confirm_cost` before `create_project`. Free tier should be $0 but always confirm.

### Step 2 — Create the new Supabase project

1. `mcp__claude_ai_Supabase__get_cost` (type=`project`, the new org ID) → get `cost_id`.
2. `mcp__claude_ai_Supabase__confirm_cost` with that cost_id.
3. `mcp__claude_ai_Supabase__create_project` with the confirmed cost_id, the chosen name, region, and DB password.
4. Wait for it to reach `ACTIVE_HEALTHY` (poll `get_project`).
5. Record the new `project_id`, `api_url`, and `anon key` (`get_project_url`, `get_publishable_keys`). You will need these for `.env.local`.

### Step 3 — Replicate schema (Path A)

For each migration in the source list above, in order:

1. Read the source SQL — the Supabase MCP does not expose raw migration bodies directly, so use `execute_sql` against the **old** project with queries like:
   ```sql
   SELECT version, name, statements
   FROM supabase_migrations.schema_migrations
   WHERE version = '20260411054945';
   ```
   If the `statements` column isn't populated (depends on how migrations were applied), fall back to reconstructing schema from `information_schema` + `pg_policies` + `pg_publication_tables` + `pg_views` against the old project and replay that as a single consolidated migration (Path B).
2. For each migration, call `apply_migration` on the **new** project with:
   - `name`: same semantic name (e.g. `create_full_schema`, `enable_rls_policies`, …). Timestamps are assigned by Supabase — do not hardcode old ones.
   - `query`: the SQL body. **Strip any references to the old project**, but schema SQL should be project-agnostic already.
3. After each migration, run a sanity `execute_sql` (e.g. `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'`) to verify it applied.

### Step 4 — Verify schema parity

Run `list_tables(verbose=true)` on the new project and diff against the known source shape. At minimum verify:

- **11 tables** exist in `public`, with the exact columns, types, defaults, check constraints, and FKs shown in §3 below.
- **RLS is enabled** on every one of those 11 tables.
- **6 views** exist (`v_daily_sales`, `v_hourly_revenue`, `v_payment_breakdown`, `v_top_items`, `v_staff_performance`, `v_item_details`), all with `security_invoker=on`.
- The `orders.status` check constraint includes all of: `awaiting-payment, new, preparing, ready, served-unpaid, completed, cancelled`.
- The `tables.status` check constraint includes: `available, occupied, waiting-payment`.
- The `staff.role` check constraint is: `Owner, Manager, Chef` (not the older `Admin/Cashier/Server/Kitchen` — confirm the role refactor migration ran).

### Step 5 — Realtime publications

Ensure the `supabase_realtime` publication includes the following tables **with `REPLICA IDENTITY FULL`**:

```
orders
order_items
tables
settings
staff
modifiers
supplementary_bills
supplementary_bill_items
```

Sanity check:
```sql
SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' ORDER BY tablename;
```

Also:
```sql
SELECT c.relname, c.relreplident
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN (...);
```
`relreplident` should be `f` (full) for each.

### Step 6 — Storage bucket

Create the `menu-images` bucket:
- **Name:** `menu-images`
- **Public:** yes (read access is public; only authenticated Owner/Manager can write)
- **File size limit:** 5 MB
- **Allowed MIME types:** `image/png, image/jpeg, image/webp, image/gif`

Add storage RLS policies (on `storage.objects`) so that:
- `SELECT` is allowed to anyone for objects in `menu-images` (public read).
- `INSERT`/`UPDATE`/`DELETE` is allowed only when `auth.jwt() ->> 'user_role' IN ('Owner','Manager')` and `bucket_id = 'menu-images'`.

Reference the old project's storage policies via `execute_sql` on `storage.policies` / `pg_policies` to get the exact predicates if needed.

### Step 7 — Edge Functions

Deploy both functions to the new project via `mcp__claude_ai_Supabase__deploy_edge_function`. The full source for both is embedded in §4 below. Both must be deployed with `verify_jwt: false`.

After deploy, set the Edge Function secret on the new project:
- `AGGREGATOR_WEBHOOK_SECRET` — generate a **new** random hex string (e.g. `openssl rand -hex 32`). Do **not** reuse the old secret. Save it somewhere the human can find it (print it to the user; they'll need it to configure Swiggy/Zomato). `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — do not set them manually.

### Step 8 — Seed data

The app requires at least the following rows to be usable after deploy. Insert them via `execute_sql` on the new project:

1. **`settings`** — exactly one row with default values. The schema defaults handle most fields; at minimum: `INSERT INTO settings (cafe_name) VALUES ('Flow POS') ON CONFLICT DO NOTHING;` (or whatever brand name the human picks for the new product).
2. **`staff`** — at least one Owner account so someone can log in. Example:
   ```sql
   INSERT INTO staff (id, name, role, pin, initials, is_active)
   VALUES (gen_random_uuid(), 'Owner', 'Owner', '1234', 'OW', true);
   ```
   **Ask the human for the real Owner name + PIN**; do not hardcode `1234` in production. Also ask whether they want Manager/Chef seed rows.
3. **`tables`** — seed a few default dine-in tables. Look at `lib/data.ts` in the repo for the seed shape; replicate it in SQL. Example:
   ```sql
   INSERT INTO tables (id, number, capacity, status)
   VALUES ('t1',1,4,'available'),('t2',2,4,'available'),('t3',3,2,'available'),('t4',4,6,'available'),('t5',5,2,'available');
   ```
4. **`modifiers`** — seed the 7 default modifiers (extra shot, oat milk, etc.). Replicate from `lib/data.ts`.
5. **`menu_items`** — leave empty. Menu is managed from the Settings UI once the app is running. (Old project also has 0 rows here — menu lives in `lib/data.ts` for offline fallback and gets upserted on first write.)

### Step 9 — Wire the frontend

In the new folder:

1. **Replace `.env.local`**:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<NEW_PROJECT_ID>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<NEW_ANON_KEY>
   ```
   Delete every trace of the old URL/key. Also set these in Vercel env vars when the new project gets its own deployment (the human will handle Vercel separately — just remind them).
2. **Grep for hardcoded references** to the old project and fix them:
   ```bash
   grep -rIn "ycrwtvtdsbjbhdqyuptq" .
   ```
   Expected hits after fixing: **zero** (except possibly in `NEW_PROJECT_MIGRATION.md` itself if it still lives in the new folder — decide with the human whether to delete this file after migration).
3. **Regenerate TypeScript types** for the new project:
   ```
   mcp__claude_ai_Supabase__generate_typescript_types(project_id=<NEW_PROJECT_ID>)
   ```
   Write the result to `lib/supabase-types.ts`. Diff against the old file — structurally it should be identical. Any diff means schema parity failed; fix the schema, don't paper over it in code.
4. **Update branding-only strings** the human asked for (cafe name, product name in `CLAUDE.md`, etc.). This is a frontend-rebrand concern, not a backend one — do only what the human explicitly requests. Do **not** refactor code, rename components, or restructure folders as part of this migration. The rebrand is a separate task.
5. **Update `CLAUDE.md`** in the new folder: replace the `Project ID`, `API URL`, and region block with the new project's values. Leave the rest of the architecture notes intact unless the human asks to change them.
6. **Clear out `.next/`** and any build caches in the new folder before running.

### Step 10 — Validate end-to-end

1. `npm install`
2. `npm run build` — must pass with zero type errors.
3. `npm run dev` — open `http://localhost:3000`.
4. Log in with the Owner PIN you seeded. Confirm the Edge Function call to `pin-auth` returns a valid JWT and the app hydrates.
5. Create a test order → pay → verify it shows up in Kitchen → mark ready → mark served → verify it completes and writes to `orders` + `audit_log` in the **new** project (check via `execute_sql`).
6. Open the app in a second browser tab and verify Realtime sync: payments made in tab A flip the KDS in tab B instantly.
7. Test the aggregator webhook:
   ```bash
   curl -X POST https://<NEW_PROJECT_ID>.supabase.co/functions/v1/aggregator-webhook \
     -H "Content-Type: application/json" \
     -H "X-Webhook-Secret: <NEW_SECRET>" \
     -d '{"platform":"swiggy","items":[{"name":"Test Latte","price":150,"quantity":1}],"total":150,"customerName":"Webhook Test"}'
   ```
   Confirm the order appears in Aggregator Inbox.
8. Upload a menu image via Settings → Data Manager → confirm it lands in the new bucket and renders.
9. Go offline (DevTools → Network → Offline), place an order, go back online, confirm the sync queue drains and the order reaches the new Supabase project.
10. Run `mcp__claude_ai_Supabase__get_advisors(type='security')` and `(type='performance')` on the new project. Fix any new warnings before declaring done.

---

## 3. Table Schema Reference (ground truth)

Use this as your checklist after Step 4. Types, nullability, defaults, and constraints must all match.

### `staff`
- `id uuid PK default gen_random_uuid()`
- `name text NOT NULL`
- `role text NOT NULL CHECK (role IN ('Owner','Manager','Chef'))`
- `pin text NOT NULL UNIQUE`
- `initials text NOT NULL`
- `is_active boolean default true`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

### `settings` (single-row table)
- `id uuid PK default gen_random_uuid()`
- `cafe_name text NOT NULL default 'SUHASHI Cafe'` *(rebrand default to whatever the human picks)*
- `gst_number text default ''`
- `address text default ''`
- `tax_rate numeric NOT NULL default 5.00`
- `gst_enabled boolean default true`
- `upi_id text default 'cafe@upi'`
- `order_alerts boolean default true`
- `kitchen_ready_alerts boolean default true`
- `auto_print_kot boolean default true`
- `print_customer_copy boolean default true`
- `session_timeout_minutes int default 30`
- `cash_enabled boolean default true`
- `upi_enabled boolean default true`
- `card_enabled boolean default true`
- `upi_qr_code_url text`
- `printers jsonb default '[]'::jsonb`
- `created_at`, `updated_at` timestamptz default now()

### `tables`
- `id text PK`
- `number int NOT NULL`
- `capacity int NOT NULL default 4`
- `status text NOT NULL default 'available' CHECK (status IN ('available','occupied','waiting-payment'))`
- `order_id text` *(nullable — no FK, the app manages the link loosely)*
- `created_at`, `updated_at` timestamptz default now()

### `menu_items`
- `id text PK`
- `name text NOT NULL`
- `price numeric NOT NULL`
- `category text NOT NULL`
- `variants jsonb default '[]'::jsonb`
- `available boolean default true`
- `image_url text`
- `bestseller boolean default false`
- `created_at`, `updated_at`

### `modifiers`
- `id text PK`
- `name text NOT NULL`
- `price numeric NOT NULL default 0`
- `created_at timestamptz default now()`

### `orders`
- `id text PK`
- `type text NOT NULL CHECK (type IN ('dine-in','takeaway','delivery','aggregator'))`
- `status text NOT NULL default 'awaiting-payment' CHECK (status IN ('awaiting-payment','new','preparing','ready','served-unpaid','completed','cancelled'))`
- `table_id text REFERENCES tables(id)`
- `total numeric NOT NULL default 0`
- `customer_name text`
- `customer_phone text`
- `order_notes text`
- `platform text CHECK (platform IN ('swiggy','zomato') OR platform IS NULL)`
- `subtotal numeric`
- `discount_type text CHECK (discount_type IN ('percent','amount') OR discount_type IS NULL)`
- `discount_value numeric`
- `discount_amount numeric`
- `tax_rate numeric`
- `tax_amount numeric`
- `grand_total numeric`
- `payment jsonb` *(shape: `{method, amount, transactionId?}`)*
- `paid_at timestamptz`
- `paid_by text`
- `refund jsonb`
- `pay_later boolean default false`
- `created_by text`
- `created_at`, `updated_at` timestamptz default now()

### `order_items`
- `id text PK`
- `order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE`
- `menu_item_id text NOT NULL`
- `name text NOT NULL`
- `price numeric NOT NULL`
- `quantity int NOT NULL default 1`
- `variant text`
- `notes text`
- `modifiers jsonb default '[]'::jsonb`
- `created_at timestamptz default now()`

### `supplementary_bills`
- `id uuid PK default gen_random_uuid()`
- `order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE`
- `total numeric default 0`
- `payment jsonb`
- `paid_at timestamptz`
- `created_at timestamptz default now()`

### `supplementary_bill_items`
- `id text PK`
- `bill_id uuid NOT NULL REFERENCES supplementary_bills(id) ON DELETE CASCADE`
- `menu_item_id text NOT NULL`
- `name text NOT NULL`
- `price numeric NOT NULL`
- `quantity int NOT NULL default 1`
- `variant text`, `notes text`
- `modifiers jsonb default '[]'::jsonb`
- `created_at timestamptz default now()`

### `audit_log`
- `id text PK`
- `action text NOT NULL`
- `user_id text NOT NULL`
- `details text NOT NULL`
- `order_id text`
- `metadata jsonb default '{}'::jsonb`
- `created_at timestamptz default now()`
- **Auto-purge**: there is a scheduled job (from migration `add_audit_log_auto_purge`) that deletes `audit_log` rows older than ~90 days. Replicate that job on the new project (look at `pg_cron` or the SQL inside the old migration via `execute_sql` on `cron.job`).

### `shifts`
- `id text PK`
- `staff_id text NOT NULL`
- `staff_name text NOT NULL`
- `started_at timestamptz NOT NULL`
- `ended_at timestamptz`
- `opening_cash numeric NOT NULL default 0`
- `closing_cash numeric`
- `total_sales numeric`
- `total_orders int`
- `notes text`
- `created_at timestamptz default now()`

### Views (all `security_invoker=on`)

Pull the exact definitions from the old project via:
```sql
SELECT table_name, view_definition
FROM information_schema.views
WHERE table_schema='public';
```
and re-apply them verbatim to the new project. They reference `Asia/Kolkata` for date bucketing — keep that as-is unless the human changes target timezone.

### RLS policies

The exact policies are long — pull them from the old project with:
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname='public'
ORDER BY tablename, policyname;
```
and re-apply them verbatim to the new project. Key invariants to double-check after replication:
- Owner has full access to everything.
- Manager has CRUD on operational tables (orders, items, tables, shifts, audit_log) but not `staff` management or `settings` writes (confirm with the human — the role refactor is recent).
- Chef can `SELECT` orders/order_items and `UPDATE` `orders.status` transitions only (`new→preparing→ready`).
- All RLS predicates should use `(SELECT auth.jwt()) ->> 'user_role'` (wrapped in a subquery — that's the initplan fix from `fix_rls_auth_jwt_initplan`). Plain `auth.jwt() ->> 'user_role'` will work but will trigger a Supabase performance advisor warning.
- There are explicit DELETE policies for the Owner-only "Reset all data" flow (from `add_delete_policies_for_reset`). Don't skip those or the Data Manager's reset button breaks.

---

## 4. Edge Functions (full source)

Deploy both to the new project with `verify_jwt: false`. Both files expect `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to be injected by the runtime (they are, automatically). Only `aggregator-webhook` needs the extra `AGGREGATOR_WEBHOOK_SECRET` secret set manually.

### `pin-auth/index.ts`

```ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const { pin } = await req.json();
    if (!pin || typeof pin !== "string") {
      return new Response(JSON.stringify({ error: "PIN is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const { data: staffList, error: staffError } = await supabase
      .from("staff")
      .select("id, name, role, initials")
      .eq("pin", pin)
      .eq("is_active", true);

    if (staffError || !staffList || staffList.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid PIN" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const staff = staffList[0];
    const email = `staff-${staff.id}@suhashi.local`; // NOTE: change domain to match rebrand if desired (e.g. @flow.local). Purely cosmetic — must just be stable.
    const internalPassword = `pin-${pin}-${staff.id}`;

    let authUser;
    const { data: signInAttempt } = await supabase.auth.signInWithPassword({ email, password: internalPassword });

    if (signInAttempt?.user) {
      authUser = signInAttempt.user;
    } else {
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: internalPassword,
        email_confirm: true,
        user_metadata: { staff_id: staff.id, staff_name: staff.name, user_role: staff.role, initials: staff.initials },
        app_metadata: { user_role: staff.role },
      });

      if (createError) {
        if (createError.message.toLowerCase().includes("already registered") || createError.message.toLowerCase().includes("already exists")) {
          const { data: searchData } = await supabase.auth.admin.listUsers();
          const existing = searchData?.users?.find((u: any) => u.email === email);
          if (existing) {
            authUser = existing;
            await supabase.auth.admin.updateUserById(authUser.id, { password: internalPassword });
          } else {
            throw new Error("Could not create or find staff auth user.");
          }
        } else {
          throw createError;
        }
      } else {
        authUser = newUser.user;
      }
    }

    await supabase.auth.admin.updateUserById(authUser.id, {
      user_metadata: { staff_id: staff.id, staff_name: staff.name, user_role: staff.role, initials: staff.initials },
      app_metadata: { user_role: staff.role },
    });

    const { data: signInResult, error: signInErr } = await supabase.auth.signInWithPassword({ email, password: internalPassword });
    if (signInErr) throw signInErr;

    return new Response(JSON.stringify({
      session: {
        access_token: signInResult.session?.access_token,
        refresh_token: signInResult.session?.refresh_token,
        expires_at: signInResult.session?.expires_at,
        expires_in: signInResult.session?.expires_in,
      },
      user: { id: staff.id, name: staff.name, role: staff.role, initials: staff.initials },
    }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  } catch (error) {
    console.error("PIN auth error:", error);
    return new Response(JSON.stringify({ error: "Authentication failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
```

> **Rebrand note:** the synthetic email domain `@suhashi.local` is arbitrary — it never sends mail, it's just a stable identifier for the Supabase `auth.users` row. You may change it to match the new brand (e.g. `@flow.local`), but if you do, **do it before any staff log in**, because changing it later orphans existing auth users. If in doubt, leave it as `@suhashi.local` — users will never see it.

### `aggregator-webhook/index.ts`

```ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

interface WebhookItem { name: string; price: number; quantity?: number; menuItemId?: string; }
interface WebhookPayload {
  platform: "swiggy" | "zomato";
  items: WebhookItem[];
  customerName?: string;
  total: number;
  externalId?: string;
  orderNotes?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Webhook-Secret, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  try {
    const webhookSecret = req.headers.get("X-Webhook-Secret");
    const expectedSecret = Deno.env.get("AGGREGATOR_WEBHOOK_SECRET");
    if (expectedSecret && webhookSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const body: WebhookPayload = await req.json();
    const { platform, items, customerName, total, externalId, orderNotes } = body;

    if (!platform || !items || !Array.isArray(items) || items.length === 0 || !total) {
      return new Response(JSON.stringify({ error: "Missing required fields: platform, items, total" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    if (!["swiggy", "zomato"].includes(platform)) {
      return new Response(JSON.stringify({ error: "Invalid platform. Must be 'swiggy' or 'zomato'" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const now = Date.now();
    const orderId = `ord-${now}`;
    const txnId = externalId || `ext-${now}`;

    const { error: orderError } = await supabase.from("orders").insert({
      id: orderId,
      type: "aggregator",
      status: "new",
      platform,
      customer_name: customerName || "Online Customer",
      order_notes: orderNotes || null,
      total,
      grand_total: total,
      subtotal: total,
      payment: { method: "platform", amount: total, transactionId: txnId },
      paid_at: new Date().toISOString(),
      paid_by: `${platform.charAt(0).toUpperCase() + platform.slice(1)}`,
      created_by: "System",
    });
    if (orderError) throw orderError;

    const orderItems = items.map((item, i) => ({
      id: `oi-${now}-${i}`,
      order_id: orderId,
      menu_item_id: item.menuItemId || `ext-${item.name.toLowerCase().replace(/\s+/g, "-")}`,
      name: item.name,
      price: item.price,
      quantity: item.quantity || 1,
      modifiers: [],
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
    if (itemsError) {
      await supabase.from("orders").delete().eq("id", orderId);
      throw itemsError;
    }

    await supabase.from("audit_log").insert([
      { id: `audit-${now}-wh-1`, action: "order_created",        user_id: "System", details: `Aggregator order ${orderId} received from ${platform}`, order_id: orderId, metadata: { platform, externalId: txnId } },
      { id: `audit-${now}-wh-2`, action: "payment_recorded",     user_id: "System", details: `Payment of \u20B9${total} recorded via ${platform}`,      order_id: orderId, metadata: { method: "platform", amount: total, platform } },
      { id: `audit-${now}-wh-3`, action: "order_sent_to_kitchen",user_id: "System", details: `Order ${orderId} sent to kitchen (pre-paid by ${platform})`, order_id: orderId, metadata: { platform } },
    ]);

    return new Response(JSON.stringify({ success: true, orderId, message: `Order created from ${platform}` }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error) {
    console.error("[aggregator-webhook] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
```

---

## 5. Frontend Files That Touch Supabase

For reference, these are the files the app uses to talk to Supabase. **You should not need to edit any of them** — they all read the URL/key from `process.env.NEXT_PUBLIC_SUPABASE_*`, so changing `.env.local` is sufficient:

- `lib/supabase.ts` — client singleton
- `lib/supabase-types.ts` — regenerate via `generate_typescript_types` after schema is in place
- `lib/supabase-queries.ts` — CRUD + mappers + report queries + image upload
- `lib/auth.ts` — PIN login, calls `pin-auth` Edge Function via `${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/pin-auth`
- `lib/hydrate.ts` — initial data pull on login
- `lib/sync.ts` + `lib/sync-idb.ts` — offline mutation queue replay
- `hooks/use-realtime-sync.ts` — Realtime subscriptions
- `next.config.mjs` — has `images.remotePatterns` allowing `*.supabase.co`; leave as-is (wildcard covers the new project URL too)

If any of these files hardcode `ycrwtvtdsbjbhdqyuptq`, that's a bug in the source and must be fixed. As of the snapshot that produced this guide, they do not.

---

## 6. Known Gotchas

- **Free tier Edge Function invocations:** `pin-auth` is called on every login and session refresh. Session refresh is automatic in the Supabase JS client — if you burn through invocations in dev, check for a refresh loop. The `session_timeout_minutes` setting in the `settings` table affects how aggressively the client re-auths.
- **Realtime echo loop:** the app uses "own-write detection" in `hooks/use-realtime-sync.ts` to avoid feeding its own writes back into the Zustand store. If after migration you see orders duplicating or flickering, check that Realtime is publishing the same column shapes as before — a type mismatch in `supabase-types.ts` can break the dedup check.
- **REPLICA IDENTITY FULL is non-optional** for the tables that need UPDATE/DELETE Realtime events. If Realtime works for INSERTs but not UPDATEs, this is the cause.
- **`security_invoker=on` on views** is required so RLS still applies when reports query the views. If you see Supabase security advisors flagging views as `SECURITY DEFINER`, the migration did not run — re-apply.
- **`auth.jwt()` in RLS must be wrapped in a subquery** — `(SELECT auth.jwt()) ->> 'user_role'`, not `auth.jwt() ->> 'user_role'`. Without the subquery, Postgres re-evaluates JWT per row and Supabase's performance advisor flags it.
- **The `menu_items` table is empty in the source project**: the app stores the menu locally in `lib/data.ts` and upserts to Supabase lazily. Do not try to "backfill" menu items from anywhere — starting empty is correct.
- **Service role key must never appear in the client.** It lives only as an Edge Function secret. If you find yourself pasting it into `.env.local`, stop.
- **Do not rename any table or column** as part of this migration. A rebrand that changes the schema is a separate, much bigger task and should be discussed with the human first.

---

## 7. Done Criteria

You can tell the human this migration is complete when **all** of the following are true:

- [ ] New Supabase project is `ACTIVE_HEALTHY`, in the agreed region, with DB password stored by the human.
- [ ] `list_tables` on the new project shows all 11 tables with RLS enabled and schemas matching §3.
- [ ] All 6 views exist with `security_invoker=on`.
- [ ] Realtime publication includes all 8 tables listed in Step 5, all with `REPLICA IDENTITY FULL`.
- [ ] `menu-images` storage bucket exists with correct policies.
- [ ] Both Edge Functions are deployed with `verify_jwt=false`; `AGGREGATOR_WEBHOOK_SECRET` is set to a fresh value and shared with the human.
- [ ] Seed rows exist for `settings`, `staff` (at least one Owner), `tables`, `modifiers`.
- [ ] `.env.local` contains the new URL + anon key and zero references to `ycrwtvtdsbjbhdqyuptq`.
- [ ] `lib/supabase-types.ts` has been regenerated from the new project and diffs cleanly against the old one.
- [ ] `npm run build` passes.
- [ ] End-to-end manual test in Step 10 passes (login → order → pay → KDS → serve → realtime sync across tabs → webhook → image upload → offline replay).
- [ ] `get_advisors(type='security')` and `get_advisors(type='performance')` return zero new warnings on the new project.
- [ ] `grep -rI "ycrwtvtdsbjbhdqyuptq" .` in the new folder returns no matches (or only documentation-note matches the human has approved).

---

## 8. What NOT to do

- Do **not** touch the old project `ycrwtvtdsbjbhdqyuptq` with any write call. Read-only inspection is fine.
- Do **not** copy any row data from the old project. No orders, no audit log, no shifts, no staff PINs.
- Do **not** reuse the old `AGGREGATOR_WEBHOOK_SECRET`. Generate a new one.
- Do **not** refactor application code, rename components, or restructure folders. The rebrand (SUHASHI → Flow POS or whatever name) is a separate task the human will direct. This migration is backend-only plus env vars.
- Do **not** change the schema "while you're in there." If something looks wrong, flag it to the human — don't silently fix it, and definitely don't rename columns (the frontend mappers in `lib/supabase-queries.ts` will break).
- Do **not** commit `.env.local` or any secrets to git. Verify `.gitignore` still lists `.env.local` in the new folder.
- Do **not** delete this file until the human confirms the migration is complete and signed off.
