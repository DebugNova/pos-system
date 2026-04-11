# Phase 3 Implementation Guide — Supabase Backend & Real Integrations

> For: AI Agent (Claude Code / Antigravity)
> Project: SUHASHI Cafe POS
> Date: 2026-04-11
> Scope: Migrate from client-only localStorage to a production Supabase backend. PostgreSQL as the source of truth, Supabase Auth for staff login, Realtime for multi-terminal sync, Edge Functions for webhooks and server logic.
> Organization: **Pos agency** (`uadjlssuufvuokfylhdv`) — Free plan, fresh start, no existing projects.
> Region: **ap-south-1** (Mumbai — closest to India).
> Prerequisites: Phase 1 (15 tasks) and Phase 2 (8 tasks) and Pay-First Flow (12 tasks) are all complete. `npm run build` passes. `STORE_VERSION` is 8.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    iPad / Browser                       │
│  ┌─────────────┐  ┌──────────┐  ┌────────────────────┐ │
│  │  Zustand     │  │ Service  │  │  Supabase Client   │ │
│  │  (UI state)  │  │ Worker   │  │  (@supabase/ssr)   │ │
│  └──────┬───────┘  └────┬─────┘  └────────┬───────────┘ │
│         │               │                 │             │
│         │  localStorage  │  IndexedDB      │ HTTPS/WSS  │
│         │  (offline      │  (bg sync       │             │
│         │   cache)       │   queue)        │             │
└─────────┼───────────────┼─────────────────┼─────────────┘
          │               │                 │
          ▼               ▼                 ▼
┌─────────────────────────────────────────────────────────┐
│                    Supabase Cloud                       │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────────┐ │
│  │ PostgREST │  │ Realtime  │  │   Edge Functions     │ │
│  │ (REST API)│  │ (WSS)     │  │   (Deno Deploy)      │ │
│  └─────┬─────┘  └─────┬─────┘  └──────────┬───────────┘ │
│        │              │                    │             │
│        ▼              ▼                    ▼             │
│  ┌──────────────────────────────────────────────────┐   │
│  │              PostgreSQL Database                  │   │
│  │  orders · order_items · tables · menu_items       │   │
│  │  staff · payments · audit_log · shifts            │   │
│  │  settings · supplementary_bills                   │   │
│  │  + RLS policies per role                          │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Key decisions:**
- **Supabase is the source of truth.** Zustand remains for local UI state (cart, selected view, edit mode) and as an offline cache. Reads/writes flow through Supabase client SDK.
- **Offline-first stays.** The Phase 2 sync queue (`lib/sync.ts`) gets a real `sendMutation` body that writes to Supabase. When offline, mutations queue locally and replay on reconnect.
- **No custom Node.js server.** All server-side logic runs as Supabase Edge Functions (Deno).
- **PIN-only auth. ABSOLUTELY NO Google, email/password, OAuth, or social login.** Each staff member gets a unique 4-digit PIN. An Edge Function validates the PIN against the `staff` table and issues a Supabase JWT. The login screen only shows a PIN pad — nothing else.
- **Realtime for multi-device sync** — subscribe to `orders`, `order_items`, `tables`, and `settings` changes so the cashier's iPad, the kitchen display, and any future terminals stay perfectly in sync without polling.
- **Every record is stored in the database** — orders, items, payments, audit log entries, shifts, settings. Nothing is localStorage-only except transient UI state (cart contents, current view, edit mode).

---

## Multi-Device Connectivity Architecture

The POS runs on **multiple devices simultaneously** — at minimum a **Cashier iPad** and a **Kitchen Display tablet**. They must stay in perfect sync via Supabase Realtime.

```
┌──────────────────────┐       ┌──────────────────────┐
│  CASHIER DEVICE      │       │  KITCHEN DEVICE      │
│  (iPad / Browser)    │       │  (Tablet / Browser)  │
│                      │       │                      │
│  Login: PIN 2345     │       │  Login: PIN 6789     │
│  Role: Cashier       │       │  Role: Kitchen       │
│                      │       │                      │
│  Views:              │       │  Views:              │
│  - New Order         │       │  - Kitchen Display   │
│  - Billing           │       │    (KDS only)        │
│  - Dashboard         │       │                      │
│  - Order History     │       │                      │
└──────────┬───────────┘       └──────────┬───────────┘
           │                              │
           │    Supabase Realtime (WSS)    │
           │    ◄────────────────────────► │
           │                              │
           ▼                              ▼
┌──────────────────────────────────────────────────────┐
│                  Supabase Cloud                      │
│  PostgreSQL ←→ Realtime (orders, tables, settings)   │
│                                                      │
│  Event flow:                                         │
│  1. Cashier creates order → status: awaiting-payment │
│  2. Cashier completes payment → status: new          │
│     → Realtime broadcasts UPDATE to all subscribers  │
│  3. Kitchen device receives event → KDS shows order  │
│  4. Kitchen marks item preparing → Realtime update   │
│  5. Kitchen marks ready → Cashier sees "ready" badge │
│  6. Server marks served → status: completed          │
│     → table released → all devices update            │
└──────────────────────────────────────────────────────┘
```

**The complete real-time flow:**

| Step | Actor | Action | DB Write | Realtime Event | Who Sees It |
|------|-------|--------|----------|----------------|-------------|
| 1 | Cashier/Server | Creates order, assigns table | `orders` INSERT, `tables` UPDATE | INSERT on orders, UPDATE on tables | All devices see table status change |
| 2 | Cashier | Takes payment | `orders` UPDATE (status→new, payment filled) | UPDATE on orders | **Kitchen device instantly sees new order in KDS** |
| 3 | Kitchen | Marks items "preparing" | `orders` UPDATE (status→preparing) | UPDATE on orders | Cashier/Server sees preparing status |
| 4 | Kitchen | Marks items "ready" | `orders` UPDATE (status→ready) | UPDATE on orders | **Cashier/Server sees ready notification** |
| 5 | Server | Marks order "served" | `orders` UPDATE (status→completed), `tables` UPDATE (→available) | UPDATE on both | All devices see table freed |

**Latency target:** < 500ms from write to display on other devices (Supabase Realtime over WSS achieves ~100-300ms in ap-south-1).

> **IMPORTANT:** The kitchen NEVER sees orders in `awaiting-payment` status. KDS filters to `new`, `preparing`, and `ready` ONLY. Payment must be completed before the kitchen knows about the order.

---

## Pre-Work Checklist

Before starting ANY task:
- [ ] Confirm Phase 1, Phase 2, and Pay-First Flow implementations are complete
- [ ] Run `npm run build` to confirm the project compiles cleanly
- [ ] Read `lib/store.ts`, `lib/data.ts`, `lib/sync.ts`, `lib/sync-idb.ts` — understand the current offline queue and data shapes
- [ ] Read `CLAUDE.md` — especially the "Notes for AI Agents" section on pay-first flow and store actions
- [ ] Have access to the Supabase MCP server tools (`execute_sql`, `apply_migration`, `deploy_edge_function`, etc.)
- [ ] Supabase org: **Pos agency** (`uadjlssuufvuokfylhdv`)
- [ ] After EVERY task, run `npm run build` to verify no type errors or broken imports

---

## Task 1: Create the Supabase Project

**Goal:** Spin up a new Supabase project in the "Pos agency" organization in the Mumbai (ap-south-1) region.

**What to do:**

1. **Use the MCP tool `get_cost`** to check the cost of creating a project under org `uadjlssuufvuokfylhdv`.

2. **Confirm the cost with the user** via `confirm_cost`.

3. **Create the project** via `create_project`:
   - Name: `suhashi-pos`
   - Region: `ap-south-1` (Mumbai — lowest latency for India)
   - Organization: `uadjlssuufvuokfylhdv`

4. **Wait for the project to initialize** — poll via `get_project` until status is `ACTIVE_HEALTHY`. This may take 2-5 minutes.

5. **Record the project details:**
   - `project_id` (project ref) — needed for all subsequent MCP calls
   - API URL — needed for the client SDK
   - Anon key (publishable key) — needed for the client SDK

6. **Retrieve the API URL** via `get_project_url`.

7. **Retrieve the publishable (anon) key** via `get_publishable_keys`.

8. **Store these values** — they'll be added to `.env.local` in Task 3.

**Verification:**
- `get_project(project_id)` returns status `ACTIVE_HEALTHY`
- API URL is accessible (e.g., `https://<ref>.supabase.co`)
- Anon key is available

---

## Task 2: Database Schema — Create All Tables

**Goal:** Create the full PostgreSQL schema that mirrors the current Zustand data model. Every table designed for the pay-first flow, with proper foreign keys, indexes, and defaults.

**What to do:**

Apply the following migration using `apply_migration`:

```sql
-- ============================================================
-- SUHASHI Cafe POS — Full Database Schema
-- ============================================================

-- 1. Staff Members
CREATE TABLE public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'Cashier', 'Server', 'Kitchen')),
  pin TEXT NOT NULL,
  initials TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  -- UNIQUE PIN per active staff member (enforced at application level too)
  -- Each staff person MUST have their own distinct PIN — no sharing.
  CONSTRAINT unique_active_pin UNIQUE (pin)
);

-- 2. Cafe Settings (singleton — one row per cafe/branch)
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_name TEXT NOT NULL DEFAULT 'SUHASHI Cafe',
  gst_number TEXT DEFAULT '',
  address TEXT DEFAULT '',
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  gst_enabled BOOLEAN DEFAULT true,
  upi_id TEXT DEFAULT 'cafe@upi',
  order_alerts BOOLEAN DEFAULT true,
  kitchen_ready_alerts BOOLEAN DEFAULT true,
  auto_print_kot BOOLEAN DEFAULT true,
  print_customer_copy BOOLEAN DEFAULT true,
  session_timeout_minutes INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tables (physical cafe tables)
CREATE TABLE public.tables (
  id TEXT PRIMARY KEY, -- e.g., 't1', 't2' — matches frontend IDs
  number INTEGER NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'waiting-payment')),
  order_id TEXT, -- references orders.id (loose FK — order may not exist yet during offline sync)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Menu Items
CREATE TABLE public.menu_items (
  id TEXT PRIMARY KEY, -- e.g., 'coffee-1' — matches frontend IDs
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  category TEXT NOT NULL,
  variants JSONB DEFAULT '[]'::jsonb, -- [{name, price}]
  available BOOLEAN DEFAULT true,
  image_url TEXT,
  bestseller BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Modifiers (add-ons available for menu items)
CREATE TABLE public.modifiers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Orders (the core entity)
CREATE TABLE public.orders (
  id TEXT PRIMARY KEY, -- e.g., 'ord-1712345678'
  type TEXT NOT NULL CHECK (type IN ('dine-in', 'takeaway', 'delivery', 'aggregator')),
  status TEXT NOT NULL DEFAULT 'awaiting-payment' CHECK (status IN ('awaiting-payment', 'new', 'preparing', 'ready', 'completed', 'cancelled')),
  table_id TEXT REFERENCES public.tables(id) ON DELETE SET NULL,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  customer_name TEXT,
  order_notes TEXT,
  platform TEXT CHECK (platform IN ('swiggy', 'zomato', NULL)),
  
  -- Payment fields (populated after payment)
  subtotal NUMERIC(10,2),
  discount_type TEXT CHECK (discount_type IN ('percent', 'amount', NULL)),
  discount_value NUMERIC(10,2),
  discount_amount NUMERIC(10,2),
  tax_rate NUMERIC(5,2),
  tax_amount NUMERIC(10,2),
  grand_total NUMERIC(10,2),
  
  -- Payment record (JSONB for flexibility — method, amount, txn id, split details)
  payment JSONB,
  paid_at TIMESTAMPTZ,
  paid_by TEXT,
  
  -- Refund (if applicable)
  refund JSONB, -- {amount, reason, refundedAt, refundedBy}
  
  -- Attribution
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Order Items (line items within an order)
CREATE TABLE public.order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  variant TEXT,
  notes TEXT,
  modifiers JSONB DEFAULT '[]'::jsonb, -- [{id, name, price}]
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Supplementary Bills (post-payment additions)
CREATE TABLE public.supplementary_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment JSONB,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Supplementary Bill Items
CREATE TABLE public.supplementary_bill_items (
  id TEXT PRIMARY KEY,
  bill_id UUID NOT NULL REFERENCES public.supplementary_bills(id) ON DELETE CASCADE,
  menu_item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  variant TEXT,
  notes TEXT,
  modifiers JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Audit Log
CREATE TABLE public.audit_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  user_id TEXT NOT NULL, -- staff name (or UUID in future)
  details TEXT NOT NULL,
  order_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Shifts
CREATE TABLE public.shifts (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  opening_cash NUMERIC(10,2) NOT NULL DEFAULT 0,
  closing_cash NUMERIC(10,2),
  total_sales NUMERIC(10,2),
  total_orders INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDEXES for query performance
-- ============================================================

CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX idx_orders_table_id ON public.orders(table_id);
CREATE INDEX idx_orders_type ON public.orders(type);
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_supplementary_bills_order_id ON public.supplementary_bills(order_id);
CREATE INDEX idx_supplementary_bill_items_bill_id ON public.supplementary_bill_items(bill_id);
CREATE INDEX idx_audit_log_action ON public.audit_log(action);
CREATE INDEX idx_audit_log_order_id ON public.audit_log(order_id);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX idx_shifts_staff_id ON public.shifts(staff_id);
CREATE INDEX idx_shifts_started_at ON public.shifts(started_at DESC);
CREATE INDEX idx_staff_pin ON public.staff(pin);
CREATE INDEX idx_menu_items_category ON public.menu_items(category);

-- ============================================================
-- TRIGGERS for updated_at auto-refresh
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_staff_updated_at
  BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_tables_updated_at
  BEFORE UPDATE ON public.tables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_menu_items_updated_at
  BEFORE UPDATE ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Verification:**
- `list_tables` shows all 11 tables with correct columns
- `execute_sql` with `SELECT count(*) FROM public.orders` returns 0
- All indexes are created (check via `execute_sql` with `SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`)

---

## Task 3: Seed Default Data

**Goal:** Populate the database with default staff, settings, tables, menu items, and modifiers so the app works out of the box when connected.

**What to do:**

Use `execute_sql` to insert the seed data:

```sql
-- Default staff — EACH STAFF MEMBER HAS THEIR OWN UNIQUE PIN
-- In production, the Admin changes these via Settings > Staff Management.
-- PINs must be unique across all active staff (enforced by DB constraint).
INSERT INTO public.staff (id, name, role, pin, initials) VALUES
  (gen_random_uuid(), 'Admin', 'Admin', '1234', 'AD'),
  (gen_random_uuid(), 'Rahul S.', 'Cashier', '2345', 'RS'),
  (gen_random_uuid(), 'Priya P.', 'Server', '3456', 'PP'),
  (gen_random_uuid(), 'Amit K.', 'Kitchen', '6789', 'AK');

-- Default settings (one row)
INSERT INTO public.settings (cafe_name, gst_number, tax_rate, gst_enabled, upi_id)
VALUES ('SUHASHI Cafe', '27AABCT1234F1ZH', 5.00, true, 'cafe@upi');

-- Default tables
INSERT INTO public.tables (id, number, capacity, status) VALUES
  ('t1', 1, 2, 'available'),
  ('t2', 2, 2, 'available'),
  ('t3', 3, 4, 'available'),
  ('t4', 4, 4, 'available'),
  ('t5', 5, 6, 'available');

-- Default menu items (matching lib/data.ts)
INSERT INTO public.menu_items (id, name, price, category, available, image_url, bestseller, variants) VALUES
  ('tea-1', 'Red Tea', 60, 'tea', true, '/menu/RED TEA.png', false, '[]'),
  ('tea-2', 'Ginger Tea', 70, 'tea', true, '/menu/GINGER TEA.png', false, '[]'),
  ('tea-3', 'Lemongrass Tea', 100, 'tea', true, '/menu/LEMON GINGER TEA.png', false, '[]'),
  ('tea-4', 'Honey Ginger Tea', 100, 'tea', true, '/menu/HONEY GINGER TEA.png', true, '[]'),
  ('tea-5', 'Lemon Tea', 70, 'tea', true, '/menu/LEMON GINGER TEA.png', false, '[]'),
  ('coffee-1', 'Espresso', 70, 'coffee', true, '/menu/espresso.png', false, '[{"name":"Single","price":70},{"name":"Double","price":90}]'),
  ('coffee-2', 'Cappuccino', 120, 'coffee', true, '/menu/cappucina.png', true, '[]'),
  ('coffee-3', 'Latte', 120, 'coffee', true, '/menu/latte.png', true, '[]'),
  ('coffee-4', 'Americano', 100, 'coffee', true, '/menu/americano.png', false, '[]'),
  ('coffee-5', 'Cinnamon Latte', 140, 'coffee', true, '/menu/cianmon latte.png', false, '[]'),
  ('coffee-6', 'Hazelnut', 160, 'coffee', true, '/menu/hazelnut coffee.png', false, '[]'),
  ('coffee-7', 'Caramel', 160, 'coffee', true, '/menu/caramel coffe.png', false, '[]'),
  ('coffee-8', 'Mocha', 150, 'coffee', true, '/menu/mocha.png', false, '[]'),
  ('coffee-9', 'Spanish Latte', 150, 'coffee', true, '/menu/spanish latte.png', false, '[]'),
  ('coffee-10', 'Vietnamese', 150, 'coffee', true, '/menu/vietnamese coffee.png', false, '[]'),
  ('coffee-11', 'Irish', 150, 'coffee', true, '/menu/irish coffee.png', false, '[]'),
  ('coffee-12', 'Hot Chocolate', 160, 'coffee', true, '/menu/hot choclate.png', false, '[]'),
  ('drink-1', 'Green Apple', 150, 'drinks', true, '/menu/GREEN APPLE DRINK.png', false, '[]'),
  ('drink-2', 'Passion Fruit', 150, 'drinks', true, '/menu/PASSION FRUIT DRINK.png', false, '[]'),
  ('drink-3', 'Peach Iced Tea', 150, 'drinks', true, '/menu/PEACH ICED TEA.png', false, '[]'),
  ('drink-4', 'Iced Americano', 140, 'drinks', true, '/menu/ICED AMERICANO.png', false, '[]'),
  ('drink-5', 'Iced Latte', 150, 'drinks', true, '/menu/ICED LATTE.png', false, '[]'),
  ('drink-6', 'Iced Mocha', 170, 'drinks', true, '/menu/ICED MOCHA.png', false, '[]');

-- Default modifiers
INSERT INTO public.modifiers (id, name, price) VALUES
  ('extra-shot', 'Extra Shot', 30),
  ('oat-milk', 'Oat Milk', 40),
  ('almond-milk', 'Almond Milk', 40),
  ('sugar-free', 'Sugar Free', 0),
  ('less-ice', 'Less Ice', 0),
  ('extra-hot', 'Extra Hot', 0),
  ('whipped-cream', 'Whipped Cream', 20);
```

**Verification:**
- `SELECT count(*) FROM public.staff` → 4
- `SELECT count(*) FROM public.menu_items` → 23
- `SELECT count(*) FROM public.tables` → 5
- `SELECT count(*) FROM public.settings` → 1
- `SELECT count(*) FROM public.modifiers` → 7

---

## Task 4: Enable Row Level Security (RLS)

**Goal:** Protect every table with RLS. For Phase 3, the POS is a single-cafe, trusted-staff system. RLS ensures only authenticated users can read/write, and enforces role-based restrictions where critical.

**Design decisions:**
- All staff can read all data (they need it to operate the POS).
- Write restrictions: only Admin/Cashier for orders, only Admin for settings/staff management.
- The `anon` key gives NO access — all requests must carry a valid JWT from the PIN-auth Edge Function (Task 5).
- RLS policies use the `auth.jwt()` function to extract the staff role from the JWT claims.

**What to do:**

Apply migration:

```sql
-- ============================================================
-- Enable RLS on all tables
-- ============================================================

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplementary_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplementary_bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- READ policies — all authenticated staff can read everything
-- ============================================================

CREATE POLICY "Staff can read staff" ON public.staff
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can read settings" ON public.settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can read tables" ON public.tables
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can read menu items" ON public.menu_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can read modifiers" ON public.modifiers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can read orders" ON public.orders
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can read order items" ON public.order_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can read supplementary bills" ON public.supplementary_bills
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can read supplementary bill items" ON public.supplementary_bill_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can read audit log" ON public.audit_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can read shifts" ON public.shifts
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- WRITE policies — role-gated where appropriate
-- ============================================================

-- Orders: any authenticated staff can create/update (Server creates, Cashier pays)
CREATE POLICY "Staff can insert orders" ON public.orders
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Staff can update orders" ON public.orders
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Only Admin can delete orders
CREATE POLICY "Admin can delete orders" ON public.orders
  FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'Admin');

-- Order Items: follow parent order permissions
CREATE POLICY "Staff can insert order items" ON public.order_items
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Staff can update order items" ON public.order_items
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Staff can delete order items" ON public.order_items
  FOR DELETE TO authenticated USING (true);

-- Supplementary Bills: same as orders
CREATE POLICY "Staff can insert supplementary bills" ON public.supplementary_bills
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Staff can update supplementary bills" ON public.supplementary_bills
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Staff can delete supplementary bill items" ON public.supplementary_bill_items
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Staff can insert supplementary bill items" ON public.supplementary_bill_items
  FOR INSERT TO authenticated WITH CHECK (true);

-- Tables: any staff can update (table assignment happens across roles)
CREATE POLICY "Staff can update tables" ON public.tables
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin can insert tables" ON public.tables
  FOR INSERT TO authenticated WITH CHECK ((auth.jwt() ->> 'user_role') = 'Admin');

CREATE POLICY "Admin can delete tables" ON public.tables
  FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'Admin');

-- Menu Items: only Admin can CUD
CREATE POLICY "Admin can insert menu items" ON public.menu_items
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'Admin');

CREATE POLICY "Admin can update menu items" ON public.menu_items
  FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'Admin')
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'Admin');

CREATE POLICY "Admin can delete menu items" ON public.menu_items
  FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'Admin');

-- Modifiers: only Admin
CREATE POLICY "Admin can insert modifiers" ON public.modifiers
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'Admin');

CREATE POLICY "Admin can update modifiers" ON public.modifiers
  FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'Admin')
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'Admin');

CREATE POLICY "Admin can delete modifiers" ON public.modifiers
  FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'Admin');

-- Settings: only Admin can modify
CREATE POLICY "Admin can update settings" ON public.settings
  FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'Admin')
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'Admin');

-- Staff: only Admin can CUD
CREATE POLICY "Admin can insert staff" ON public.staff
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'Admin');

CREATE POLICY "Admin can update staff" ON public.staff
  FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'Admin')
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'Admin');

CREATE POLICY "Admin can delete staff" ON public.staff
  FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'Admin');

-- Audit Log: any staff can insert (audit entries are created by store actions)
CREATE POLICY "Staff can insert audit entries" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- Shifts: staff can insert their own, only admin can delete
CREATE POLICY "Staff can insert shifts" ON public.shifts
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Staff can update shifts" ON public.shifts
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- Allow anon to read staff table for PIN login (before auth)
-- The Edge Function handles actual auth, but the client needs 
-- to know which staff exist for the login screen.
-- IMPORTANT: Only expose name, role, initials — NOT pin.
-- ============================================================

-- We'll handle this via an Edge Function instead — anon gets NO direct table access.
-- The login screen will call the PIN-auth Edge Function which has service_role access.
```

**Verification:**
- Run `get_advisors` with type `security` — should show no critical warnings about missing RLS
- Attempt a query with the anon key (no JWT) — should return empty or error (RLS blocks it)

---

## Task 5: PIN-Based Auth via Edge Function

**Goal:** Staff log in by entering their **unique personal PIN** (4 digits). An Edge Function validates the PIN against the `staff` table and returns a Supabase JWT with custom claims (`user_role`, `staff_name`, `staff_id`). The frontend stores this session.

> **CRITICAL: NO Google, OAuth, email/password, or social login. PIN pad ONLY.**
> Each staff member has a **unique PIN** assigned by the Admin. The login screen shows a numeric PIN pad. The staff enters their PIN, the Edge Function looks it up, and returns a JWT. That's it. No email field, no password field, no "Sign in with Google" button.

**Why an Edge Function?** Supabase Auth doesn't natively support PIN-only login. The Edge Function acts as a custom sign-in provider. It uses the `service_role` key to create/sign-in auth users linked to staff records. Each staff member gets a deterministic auth user (email: `staff-{uuid}@suhashi.local`) that is never visible to the user.

**What to do:**

1. **Deploy the `pin-auth` Edge Function:**

```typescript
// Edge Function: pin-auth
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

Deno.serve(async (req: Request) => {
  // CORS
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

    // Look up staff by PIN — PINs are UNIQUE per active staff member
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

    // PIN is unique, so exactly 1 staff member matches
    const staff = staffList[0];

    // Create or find the auth user for this staff member
    // Use a deterministic email based on staff ID
    const email = `staff-${staff.id}@suhashi.local`;

    // Try to sign in first, create if doesn't exist
    let authUser;
    const { data: signInData, error: signInError } = await supabase.auth.admin.listUsers();
    const existingUser = signInData?.users?.find(u => u.email === email);

    if (existingUser) {
      authUser = existingUser;
    } else {
      // Create the auth user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: `pin-${pin}-${staff.id}`, // Internal password, never exposed
        email_confirm: true,
        user_metadata: {
          staff_id: staff.id,
          staff_name: staff.name,
          user_role: staff.role,
          initials: staff.initials,
        },
        app_metadata: {
          user_role: staff.role,
        },
      });
      if (createError) throw createError;
      authUser = newUser.user;
    }

    // Update user metadata (in case role changed)
    await supabase.auth.admin.updateUserById(authUser.id, {
      user_metadata: {
        staff_id: staff.id,
        staff_name: staff.name,
        user_role: staff.role,
        initials: staff.initials,
      },
      app_metadata: {
        user_role: staff.role,
      },
    });

    // Generate a session token
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (sessionError) throw sessionError;

    // Sign in the user to get actual session tokens
    const { data: signInResult, error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password: `pin-${pin}-${staff.id}`,
    });

    if (signInErr) throw signInErr;

    return new Response(JSON.stringify({
      session: {
        access_token: signInResult.session?.access_token,
        refresh_token: signInResult.session?.refresh_token,
        expires_at: signInResult.session?.expires_at,
        expires_in: signInResult.session?.expires_in,
      },
      user: {
        id: staff.id,
        name: staff.name,
        role: staff.role,
        initials: staff.initials,
      },
    }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error) {
    console.error("PIN auth error:", error);
    return new Response(JSON.stringify({ error: "Authentication failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
```

2. **Deploy with `verify_jwt: false`** — this is the login endpoint, called before auth exists.

3. **Add the `user_role` claim to the JWT** — update the JWT hook or use app_metadata. Supabase automatically includes `app_metadata` in the JWT, so `auth.jwt() ->> 'user_role'` will resolve correctly in RLS policies as long as `app_metadata.user_role` is set (which Task 5 does).

**Verification:**
- `curl -X POST <project_url>/functions/v1/pin-auth -d '{"pin":"1111"}'` → returns session tokens and user info
- Invalid PIN returns 401
- The JWT contains `user_role` in app_metadata

---

## Task 6: Install Supabase Client SDK & Environment Config

**Goal:** Add `@supabase/supabase-js` and `@supabase/ssr` to the project. Create the Supabase client singleton. Configure environment variables.

**What to do:**

1. **Install packages:**
   ```bash
   npm install @supabase/supabase-js @supabase/ssr
   ```

2. **Create `.env.local`:**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-from-task-1>
   ```
   - `NEXT_PUBLIC_` prefix makes these available client-side (required for the browser SDK).

3. **Create `lib/supabase.ts`** — the client-side Supabase singleton:
   ```typescript
   import { createBrowserClient } from "@supabase/ssr";

   let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null;

   export function getSupabase() {
     if (!supabaseInstance) {
       supabaseInstance = createBrowserClient(
         process.env.NEXT_PUBLIC_SUPABASE_URL!,
         process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
       );
     }
     return supabaseInstance;
   }

   // For use in async contexts outside React
   export const supabase = typeof window !== "undefined"
     ? getSupabase()
     : null;
   ```

4. **Create `lib/supabase-types.ts`** — generate TypeScript types:
   - Use `generate_typescript_types` MCP tool to get the latest types
   - Save to `lib/supabase-types.ts`
   - Import in `lib/supabase.ts` as a generic parameter:
     ```typescript
     import type { Database } from "./supabase-types";
     ```

5. **Add `.env.local` to `.gitignore`** (should already be there for Next.js).

6. **Update `next.config.mjs`** — add Supabase hostname to `images.remotePatterns` if storing images in Supabase Storage later:
   ```javascript
   {
     protocol: "https",
     hostname: "*.supabase.co",
   }
   ```

**Verification:**
- `npm run build` passes
- `getSupabase()` is importable from any component
- Environment variables are available at runtime

---

## Task 7: Rewire Authentication — PIN Login via Supabase

**Goal:** Replace the current localStorage-only PIN login with Supabase Auth. The login screen calls the PIN-auth Edge Function, stores the session, and uses the JWT for all subsequent API calls.

**What to do:**

1. **Create `lib/auth.ts`** — auth utilities:
   ```typescript
   import { getSupabase } from "./supabase";

   export interface AuthSession {
     access_token: string;
     refresh_token: string;
     expires_at: number;
     expires_in: number;
   }

   export interface StaffUser {
     id: string;
     name: string;
     role: string;
     initials: string;
   }

   export async function loginWithPin(pin: string): Promise<{
     session: AuthSession;
     user: StaffUser;
   }> {
     const supabase = getSupabase();
     const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

     const response = await fetch(`${projectUrl}/functions/v1/pin-auth`, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ pin }),
     });

     if (!response.ok) {
       const error = await response.json();
       throw new Error(error.error || "Login failed");
     }

     const { session, user } = await response.json();

     // Set the session in the Supabase client
     await supabase.auth.setSession({
       access_token: session.access_token,
       refresh_token: session.refresh_token,
     });

     return { session, user };
   }

   export async function logoutFromSupabase(): Promise<void> {
     const supabase = getSupabase();
     await supabase.auth.signOut();
   }

   export async function getSession() {
     const supabase = getSupabase();
     const { data: { session } } = await supabase.auth.getSession();
     return session;
   }
   ```

2. **Update `components/pos/login.tsx`:**
   - Import `loginWithPin` from `lib/auth`
   - In the `handleLogin` function, call `loginWithPin(pin)` first
   - On success, call the existing Zustand `login()` with the user data
   - On failure, show a toast error ("Invalid PIN")
   - Add a loading state while the Edge Function call is in progress
   - **Fallback for offline:** if `!navigator.onLine`, fall back to the existing localStorage PIN check (existing staff list in Zustand). This preserves offline-first behavior.

3. **Update the Zustand `logout()` action** in `lib/store.ts`:
   - Import and call `logoutFromSupabase()` before clearing local state
   - Wrap in try/catch — if offline, just clear local state

4. **Session persistence:**
   - `@supabase/ssr` automatically persists sessions in cookies/localStorage
   - On app start, check `getSession()` — if a valid session exists, auto-login without PIN
   - Add this check in `app/page.tsx` or a new `hooks/use-auth-session.ts`

**Verification:**
- Enter PIN "1111" → Edge Function called → JWT returned → session stored → app loads
- Refresh page → session persists → auto-login (no PIN re-entry)
- Logout → session cleared → back to login screen
- Offline login → falls back to localStorage check → works without network

---

## Task 8: Create the Supabase Data Layer

**Goal:** Create a clean data access layer that wraps Supabase queries. Components will call these instead of manipulating the store directly for persistent data.

**What to do:**

1. **Create `lib/supabase-queries.ts`** — query functions:
   ```typescript
   import { getSupabase } from "./supabase";
   import type { Order, OrderItem, Table, MenuItem, AuditEntry, Shift } from "./data";

   // ---- ORDERS ----
   export async function fetchOrders(limit = 100): Promise<Order[]> {
     const supabase = getSupabase();
     const { data, error } = await supabase
       .from("orders")
       .select(`
         *,
         order_items (*),
         supplementary_bills (
           *,
           supplementary_bill_items (*)
         )
       `)
       .order("created_at", { ascending: false })
       .limit(limit);

     if (error) throw error;
     return (data || []).map(mapDbOrderToLocal);
   }

   export async function fetchOrdersByStatus(statuses: string[]): Promise<Order[]> {
     const supabase = getSupabase();
     const { data, error } = await supabase
       .from("orders")
       .select(`*, order_items (*), supplementary_bills (*, supplementary_bill_items (*))`)
       .in("status", statuses)
       .order("created_at", { ascending: false });

     if (error) throw error;
     return (data || []).map(mapDbOrderToLocal);
   }

   export async function upsertOrder(order: any): Promise<void> {
     const supabase = getSupabase();
     const { items, supplementaryBills, ...orderData } = order;

     // Upsert the order
     const { error: orderError } = await supabase
       .from("orders")
       .upsert(mapLocalOrderToDb(orderData), { onConflict: "id" });
     if (orderError) throw orderError;

     // Upsert order items
     if (items && items.length > 0) {
       const dbItems = items.map((item: any) => ({
         ...mapLocalItemToDb(item),
         order_id: order.id,
       }));
       const { error: itemsError } = await supabase
         .from("order_items")
         .upsert(dbItems, { onConflict: "id" });
       if (itemsError) throw itemsError;
     }
   }

   export async function updateOrderInDb(orderId: string, changes: Record<string, any>): Promise<void> {
     const supabase = getSupabase();
     const { error } = await supabase
       .from("orders")
       .update(mapLocalOrderToDb(changes))
       .eq("id", orderId);
     if (error) throw error;
   }

   export async function deleteOrderFromDb(orderId: string): Promise<void> {
     const supabase = getSupabase();
     const { error } = await supabase
       .from("orders")
       .delete()
       .eq("id", orderId);
     if (error) throw error;
   }

   // ---- TABLES ----
   export async function fetchTables(): Promise<Table[]> {
     const supabase = getSupabase();
     const { data, error } = await supabase
       .from("tables")
       .select("*")
       .order("number");
     if (error) throw error;
     return (data || []).map(mapDbTableToLocal);
   }

   export async function updateTableInDb(tableId: string, changes: Record<string, any>): Promise<void> {
     const supabase = getSupabase();
     const { error } = await supabase
       .from("tables")
       .update({
         status: changes.status,
         order_id: changes.orderId || changes.order_id || null,
       })
       .eq("id", tableId);
     if (error) throw error;
   }

   // ---- MENU ITEMS ----
   export async function fetchMenuItems(): Promise<MenuItem[]> {
     const supabase = getSupabase();
     const { data, error } = await supabase
       .from("menu_items")
       .select("*")
       .order("category, name");
     if (error) throw error;
     return (data || []).map(mapDbMenuItemToLocal);
   }

   // ---- STAFF ----
   export async function fetchStaff() {
     const supabase = getSupabase();
     const { data, error } = await supabase
       .from("staff")
       .select("id, name, role, pin, initials, is_active")
       .eq("is_active", true);
     if (error) throw error;
     return data || [];
   }

   // ---- SETTINGS ----
   export async function fetchSettings() {
     const supabase = getSupabase();
     const { data, error } = await supabase
       .from("settings")
       .select("*")
       .single();
     if (error && error.code !== "PGRST116") throw error;
     return data ? mapDbSettingsToLocal(data) : null;
   }

   export async function updateSettingsInDb(changes: Record<string, any>): Promise<void> {
     const supabase = getSupabase();
     const { error } = await supabase
       .from("settings")
       .update(mapLocalSettingsToDb(changes))
       .not("id", "is", null); // Update the single row
     if (error) throw error;
   }

   // ---- AUDIT LOG ----
   export async function insertAuditEntry(entry: any): Promise<void> {
     const supabase = getSupabase();
     const { error } = await supabase
       .from("audit_log")
       .insert({
         id: entry.id,
         action: entry.action,
         user_id: entry.userId,
         details: entry.details,
         order_id: entry.orderId || null,
         metadata: entry.metadata || {},
         created_at: entry.timestamp?.toISOString() || new Date().toISOString(),
       });
     if (error) throw error;
   }

   // ---- SHIFTS ----
   export async function upsertShift(shift: any): Promise<void> {
     const supabase = getSupabase();
     const { error } = await supabase
       .from("shifts")
       .upsert({
         id: shift.id,
         staff_id: shift.staffId,
         staff_name: shift.staffName,
         started_at: shift.startedAt instanceof Date ? shift.startedAt.toISOString() : shift.startedAt,
         ended_at: shift.endedAt instanceof Date ? shift.endedAt.toISOString() : shift.endedAt || null,
         opening_cash: shift.openingCash,
         closing_cash: shift.closingCash || null,
         total_sales: shift.totalSales || null,
         total_orders: shift.totalOrders || null,
         notes: shift.notes || null,
       }, { onConflict: "id" });
     if (error) throw error;
   }

   // ============================================================
   // MAPPERS: DB (snake_case) ↔ Local (camelCase)
   // ============================================================

   function mapDbOrderToLocal(db: any): Order {
     return {
       id: db.id,
       type: db.type,
       status: db.status,
       tableId: db.table_id,
       items: (db.order_items || []).map(mapDbItemToLocal),
       supplementaryBills: (db.supplementary_bills || []).map((sb: any) => ({
         id: sb.id,
         items: (sb.supplementary_bill_items || []).map(mapDbItemToLocal),
         total: Number(sb.total),
         createdAt: new Date(sb.created_at),
         paidAt: sb.paid_at ? new Date(sb.paid_at) : undefined,
         payment: sb.payment || undefined,
       })),
       total: Number(db.total),
       createdAt: new Date(db.created_at),
       customerName: db.customer_name,
       orderNotes: db.order_notes,
       platform: db.platform,
       payment: db.payment || undefined,
       subtotal: db.subtotal ? Number(db.subtotal) : undefined,
       discount: db.discount_type ? {
         type: db.discount_type,
         value: Number(db.discount_value),
         amount: Number(db.discount_amount),
       } : undefined,
       taxRate: db.tax_rate ? Number(db.tax_rate) : undefined,
       taxAmount: db.tax_amount ? Number(db.tax_amount) : undefined,
       grandTotal: db.grand_total ? Number(db.grand_total) : undefined,
       paidAt: db.paid_at ? new Date(db.paid_at) : undefined,
       paidBy: db.paid_by,
       refund: db.refund || undefined,
       createdBy: db.created_by,
     };
   }

   function mapDbItemToLocal(db: any): OrderItem {
     return {
       id: db.id,
       menuItemId: db.menu_item_id,
       name: db.name,
       price: Number(db.price),
       quantity: db.quantity,
       variant: db.variant,
       notes: db.notes,
       modifiers: db.modifiers || [],
     };
   }

   function mapLocalOrderToDb(order: any) {
     const mapped: any = {};
     if (order.id !== undefined) mapped.id = order.id;
     if (order.type !== undefined) mapped.type = order.type;
     if (order.status !== undefined) mapped.status = order.status;
     if (order.tableId !== undefined) mapped.table_id = order.tableId;
     if (order.total !== undefined) mapped.total = order.total;
     if (order.customerName !== undefined) mapped.customer_name = order.customerName;
     if (order.orderNotes !== undefined) mapped.order_notes = order.orderNotes;
     if (order.platform !== undefined) mapped.platform = order.platform;
     if (order.subtotal !== undefined) mapped.subtotal = order.subtotal;
     if (order.discount !== undefined) {
       mapped.discount_type = order.discount?.type;
       mapped.discount_value = order.discount?.value;
       mapped.discount_amount = order.discount?.amount;
     }
     if (order.taxRate !== undefined) mapped.tax_rate = order.taxRate;
     if (order.taxAmount !== undefined) mapped.tax_amount = order.taxAmount;
     if (order.grandTotal !== undefined) mapped.grand_total = order.grandTotal;
     if (order.payment !== undefined) mapped.payment = order.payment;
     if (order.paidAt !== undefined) mapped.paid_at = order.paidAt instanceof Date ? order.paidAt.toISOString() : order.paidAt;
     if (order.paidBy !== undefined) mapped.paid_by = order.paidBy;
     if (order.refund !== undefined) mapped.refund = order.refund;
     if (order.createdBy !== undefined) mapped.created_by = order.createdBy;
     if (order.createdAt !== undefined) mapped.created_at = order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt;
     return mapped;
   }

   function mapLocalItemToDb(item: any) {
     return {
       id: item.id,
       menu_item_id: item.menuItemId,
       name: item.name,
       price: item.price,
       quantity: item.quantity,
       variant: item.variant || null,
       notes: item.notes || null,
       modifiers: item.modifiers || [],
     };
   }

   function mapDbTableToLocal(db: any): Table {
     return {
       id: db.id,
       number: db.number,
       capacity: db.capacity,
       status: db.status,
       orderId: db.order_id,
     };
   }

   function mapDbMenuItemToLocal(db: any): MenuItem {
     return {
       id: db.id,
       name: db.name,
       price: Number(db.price),
       category: db.category,
       variants: db.variants || [],
       available: db.available,
       image_url: db.image_url,
       bestseller: db.bestseller,
     };
   }

   function mapDbSettingsToLocal(db: any) {
     return {
       cafeName: db.cafe_name,
       gstNumber: db.gst_number,
       address: db.address,
       taxRate: Number(db.tax_rate),
       gstEnabled: db.gst_enabled,
       upiId: db.upi_id,
       orderAlerts: db.order_alerts,
       kitchenReadyAlerts: db.kitchen_ready_alerts,
       autoPrintKot: db.auto_print_kot,
       printCustomerCopy: db.print_customer_copy,
       sessionTimeoutMinutes: db.session_timeout_minutes,
     };
   }

   function mapLocalSettingsToDb(settings: any) {
     const mapped: any = {};
     if (settings.cafeName !== undefined) mapped.cafe_name = settings.cafeName;
     if (settings.gstNumber !== undefined) mapped.gst_number = settings.gstNumber;
     if (settings.address !== undefined) mapped.address = settings.address;
     if (settings.taxRate !== undefined) mapped.tax_rate = settings.taxRate;
     if (settings.gstEnabled !== undefined) mapped.gst_enabled = settings.gstEnabled;
     if (settings.upiId !== undefined) mapped.upi_id = settings.upiId;
     if (settings.orderAlerts !== undefined) mapped.order_alerts = settings.orderAlerts;
     if (settings.kitchenReadyAlerts !== undefined) mapped.kitchen_ready_alerts = settings.kitchenReadyAlerts;
     if (settings.autoPrintKot !== undefined) mapped.auto_print_kot = settings.autoPrintKot;
     if (settings.printCustomerCopy !== undefined) mapped.print_customer_copy = settings.printCustomerCopy;
     if (settings.sessionTimeoutMinutes !== undefined) mapped.session_timeout_minutes = settings.sessionTimeoutMinutes;
     return mapped;
   }
   ```

**Verification:**
- Functions are importable and type-safe
- `npm run build` passes
- Each function correctly maps between camelCase (frontend) and snake_case (database)

---

## Task 9: Rewire the Offline Sync Queue — Real `sendMutation`

**Goal:** Replace the Phase 2 stub in `lib/sync.ts` with real Supabase API calls. This is the critical integration point — every mutation queued by the store replays as a database write.

**What to do:**

1. **Rewrite `sendMutation` in `lib/sync.ts`:**
   ```typescript
   import { getSupabase } from "./supabase";
   import {
     upsertOrder,
     updateOrderInDb,
     deleteOrderFromDb,
     updateTableInDb,
     insertAuditEntry,
     upsertShift,
   } from "./supabase-queries";
   import type { QueuedMutation } from "./data";

   export async function sendMutation(m: QueuedMutation): Promise<void> {
     const supabase = getSupabase();
     if (!supabase) throw new Error("Supabase client not initialized");

     // Check we have a valid session
     const { data: { session } } = await supabase.auth.getSession();
     if (!session) {
       console.warn("[sync] No active session, skipping mutation", m.id);
       throw new Error("No active session");
     }

     switch (m.kind) {
       case "order.create":
         await upsertOrder(m.payload.order);
         break;

       case "order.update":
         await updateOrderInDb(m.payload.id as string, m.payload.changes as Record<string, any>);
         break;

       case "order.delete":
         await deleteOrderFromDb(m.payload.id as string);
         break;

       case "order.refund":
         await updateOrderInDb(m.payload.id as string, {
           refund: m.payload.refund,
           status: m.payload.status,
         });
         break;

       case "payment.record":
         await updateOrderInDb(m.payload.orderId as string, {
           payment: m.payload.payment,
           paidAt: m.payload.paidAt,
           paidBy: m.payload.paidBy,
           status: m.payload.status,
         });
         break;

       case "table.update":
         await updateTableInDb(m.payload.id as string, m.payload);
         break;

       case "shift.start":
       case "shift.end":
         await upsertShift(m.payload.shift);
         break;

       case "audit.append":
         await insertAuditEntry(m.payload.entry);
         break;

       default:
         console.warn("[sync] Unknown mutation kind:", m.kind);
     }
   }
   ```

2. **Update `replayMutationsFromIDB` in `lib/sync-idb.ts`** — replace the stub with the same `sendMutation` logic (or import `sendMutation` from `lib/sync.ts` if the IDB module can reference it).

3. **Ensure `syncPendingMutations`** in `lib/sync.ts` still handles errors gracefully — if Supabase is down but the client is "online" (e.g., DNS issue), mark mutations as `failed` and retry later.

4. **Add a retry backoff** — on failure, wait `attempts * 2` seconds before the next retry attempt.

**Verification:**
- Create an order → check Supabase dashboard → row exists in `orders` table
- Go offline → create an order → go online → queue drains → row appears in database
- Kill the network while syncing → mutations stay queued → resume on reconnect

---

## Task 10: Initial Data Load — Hydrate Zustand from Supabase

**Goal:** On app start (after successful login), fetch data from Supabase and populate the Zustand store. Supabase is the source of truth; localStorage is a cache.

**What to do:**

1. **Create `lib/hydrate.ts`:**
   ```typescript
   import { usePOSStore } from "./store";
   import { fetchOrders, fetchTables, fetchMenuItems, fetchStaff, fetchSettings } from "./supabase-queries";

   export async function hydrateStoreFromSupabase(): Promise<void> {
     try {
       const [orders, tables, menuItems, staffMembers, settings] = await Promise.all([
         fetchOrders(500),
         fetchTables(),
         fetchMenuItems(),
         fetchStaff(),
         fetchSettings(),
       ]);

       const state = usePOSStore.getState();

       // Only overwrite if we got data
       usePOSStore.setState({
         orders: orders.length > 0 ? orders : state.orders,
         tables: tables.length > 0 ? tables : state.tables,
         menuItems: menuItems.length > 0 ? menuItems : state.menuItems,
         staffMembers: staffMembers.length > 0 ? staffMembers.map(s => ({
           id: s.id,
           name: s.name,
           role: s.role,
           pin: s.pin,
           initials: s.initials,
         })) : state.staffMembers,
         settings: settings ? { ...state.settings, ...settings } : state.settings,
       });

       console.log("[hydrate] Store hydrated from Supabase",
         { orders: orders.length, tables: tables.length, menuItems: menuItems.length });
     } catch (error) {
       console.error("[hydrate] Failed to hydrate from Supabase:", error);
       // Keep existing localStorage data — offline-first behavior
     }
   }
   ```

2. **Call `hydrateStoreFromSupabase()` after login** — in `app/page.tsx` or `hooks/use-auth-session.ts`:
   - After `login()` succeeds and the session is established
   - Show a brief loading spinner while hydrating
   - On failure, fall back to localStorage data silently

3. **Background refresh** — periodically re-fetch (every 5 minutes) to catch changes made by other terminals.

4. **Offline handling** — if `!navigator.onLine` at startup, skip hydration and use localStorage data. When connectivity returns, hydrate.

**Verification:**
- Login → data loads from Supabase → store is populated
- Add a menu item directly in the Supabase dashboard → refresh the app → new item appears
- Offline login → localStorage data is used → go online → hydration happens, data merges

---

## Task 11: Enable Supabase Realtime — Multi-Terminal Sync

**Goal:** Subscribe to real-time changes on `orders`, `tables`, and `settings` tables. When one iPad updates an order status, all other iPads see it instantly.

**What to do:**

1. **Create `hooks/use-realtime-sync.ts`:**
   ```typescript
   import { useEffect, useRef } from "react";
   import { getSupabase } from "@/lib/supabase";
   import { usePOSStore } from "@/lib/store";
   import type { RealtimeChannel } from "@supabase/supabase-js";

   export function useRealtimeSync() {
     const channelRef = useRef<RealtimeChannel | null>(null);

     useEffect(() => {
       const supabase = getSupabase();
       if (!supabase) return;

       const channel = supabase
         .channel("pos-realtime")
         .on(
           "postgres_changes",
           { event: "*", schema: "public", table: "orders" },
           (payload) => {
             handleOrderChange(payload);
           }
         )
         .on(
           "postgres_changes",
           { event: "*", schema: "public", table: "tables" },
           (payload) => {
             handleTableChange(payload);
           }
         )
         .on(
           "postgres_changes",
           { event: "*", schema: "public", table: "settings" },
           (payload) => {
             handleSettingsChange(payload);
           }
         )
         .subscribe();

       channelRef.current = channel;

       return () => {
         channel.unsubscribe();
       };
     }, []);
   }

   function handleOrderChange(payload: any) {
     const { eventType, new: newRecord, old: oldRecord } = payload;
     const store = usePOSStore.getState();

     if (eventType === "INSERT" || eventType === "UPDATE") {
       // Re-fetch the full order with items
       refetchOrder(newRecord.id);
     } else if (eventType === "DELETE") {
       usePOSStore.setState((state) => ({
         orders: state.orders.filter((o) => o.id !== oldRecord.id),
       }));
     }
   }

   function handleTableChange(payload: any) {
     const { eventType, new: newRecord } = payload;

     if (eventType === "UPDATE" || eventType === "INSERT") {
       usePOSStore.setState((state) => ({
         tables: state.tables.map((t) =>
           t.id === newRecord.id
             ? {
                 ...t,
                 status: newRecord.status,
                 orderId: newRecord.order_id,
               }
             : t
         ),
       }));
     }
   }

   function handleSettingsChange(payload: any) {
     if (payload.eventType === "UPDATE") {
       const db = payload.new;
       usePOSStore.setState((state) => ({
         settings: {
           ...state.settings,
           cafeName: db.cafe_name,
           gstNumber: db.gst_number,
           address: db.address,
           taxRate: Number(db.tax_rate),
           gstEnabled: db.gst_enabled,
           upiId: db.upi_id,
         },
       }));
     }
   }

   async function refetchOrder(orderId: string) {
     try {
       const supabase = getSupabase();
       if (!supabase) return;

       const { data, error } = await supabase
         .from("orders")
         .select(`*, order_items (*), supplementary_bills (*, supplementary_bill_items (*))`)
         .eq("id", orderId)
         .single();

       if (error || !data) return;

       // Import mapper from supabase-queries
       const { fetchOrders } = await import("@/lib/supabase-queries");
       // Re-fetch just this order and merge
       const orders = await fetchOrders(1); // Simplified — ideally use a single-order fetch
       const updatedOrder = orders.find(o => o.id === orderId);
       if (!updatedOrder) return;

       usePOSStore.setState((state) => ({
         orders: state.orders.some((o) => o.id === orderId)
           ? state.orders.map((o) => (o.id === orderId ? updatedOrder : o))
           : [updatedOrder, ...state.orders],
       }));
     } catch (err) {
       console.error("[realtime] Failed to refetch order:", err);
     }
   }
   ```

2. **Enable Realtime on the required tables** — apply migration:
   ```sql
   -- Core tables that ALL devices must stay synced on
   ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
   ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
   ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;
   ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
   ALTER PUBLICATION supabase_realtime ADD TABLE public.staff;
   ```
   - `orders` + `order_items`: any status change or new item triggers updates on all devices (especially KDS)
   - `tables`: table status changes (occupied/available/waiting-payment) sync across cashier/server devices
   - `settings`: admin changes to tax, cafe name, UPI ID propagate instantly to all terminals
   - `staff`: if admin changes a staff PIN or role, other devices pick it up without manual refresh

3. **Use the hook in `app/page.tsx`** — after login, activate realtime:
   ```tsx
   import { useRealtimeSync } from "@/hooks/use-realtime-sync";

   // Inside POSApp component, after isLoggedIn check:
   useRealtimeSync();
   ```

4. **Avoid feedback loops** — when the local terminal writes an order change, it also receives the Realtime event. Detect "own writes" by checking if the incoming data matches what's already in the store. If identical, skip the update.

**Verification:**
- Open the app on two browser tabs
- Change an order status on Tab 1 → Tab 2 updates within 1-2 seconds
- Change table status → both tabs sync
- Change settings → both tabs reflect

---

## Task 12: Enable Realtime for KDS Publication

**Goal:** The Kitchen Display must live-update across terminals. When a cashier sends an order to the kitchen (pay-first flow), the KDS iPad sees it instantly.

**What to do:**

1. **The order Realtime subscription (Task 11) already covers this** — orders moving from `awaiting-payment` to `new` will trigger an update event that the KDS reads.

2. **Add a sound/visual alert** for new KDS orders:
   - In `components/pos/kitchen-display.tsx`, track the `orders` array length
   - When a new order appears with `status === "new"`, play a notification sound and flash the "New" column header
   - Use `useRef` to track the previous count and compare

3. **Add an order-focused Realtime channel** optimized for KDS:
   ```typescript
   // In kitchen-display.tsx or a dedicated hook
   const channel = supabase
     .channel("kds-orders")
     .on(
       "postgres_changes",
       {
         event: "UPDATE",
         schema: "public",
         table: "orders",
         filter: "status=in.(new,preparing,ready)",
       },
       (payload) => {
         // Refresh KDS data
       }
     )
     .subscribe();
   ```

**Verification:**
- Open KDS on one tab, Billing on another
- Complete a payment on Billing → KDS immediately shows the new order
- Mark an order as "Preparing" on KDS → other tabs reflect the change

---

## Task 13: Deploy Aggregator Webhook Edge Functions

**Goal:** Create Edge Functions that receive incoming Swiggy/Zomato webhook orders, validate them, and insert them directly into the database with `status: 'new'` (pre-paid bypass).

**What to do:**

1. **Deploy `aggregator-webhook` Edge Function:**

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Webhook-Secret",
      },
    });
  }

  try {
    // Validate webhook secret (configure per platform)
    const webhookSecret = req.headers.get("X-Webhook-Secret");
    const expectedSecret = Deno.env.get("AGGREGATOR_WEBHOOK_SECRET");
    if (expectedSecret && webhookSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const body = await req.json();
    const { platform, items, customerName, total, externalId } = body;

    if (!platform || !items || !total) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    const orderId = `ord-${Date.now()}`;

    // Create order with status 'new' (pre-paid bypass)
    const { error: orderError } = await supabase.from("orders").insert({
      id: orderId,
      type: "aggregator",
      status: "new",
      platform,
      customer_name: customerName || "Online Customer",
      total,
      payment: { method: "platform", amount: total, transactionId: externalId || `ext-${Date.now()}` },
      paid_at: new Date().toISOString(),
      paid_by: "Platform",
      created_by: "System",
    });
    if (orderError) throw orderError;

    // Insert order items
    const orderItems = items.map((item: any, i: number) => ({
      id: `oi-${Date.now()}-${i}`,
      order_id: orderId,
      menu_item_id: item.menuItemId || `ext-${item.name}`,
      name: item.name,
      price: item.price,
      quantity: item.quantity || 1,
    }));
    const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
    if (itemsError) throw itemsError;

    // Audit entries
    await supabase.from("audit_log").insert([
      {
        id: `audit-${Date.now()}-1`,
        action: "order_created",
        user_id: "System",
        details: `Aggregator order ${orderId} received from ${platform}`,
        order_id: orderId,
      },
      {
        id: `audit-${Date.now()}-2`,
        action: "payment_recorded",
        user_id: "System",
        details: `Payment of ₹${total} recorded via ${platform}`,
        order_id: orderId,
        metadata: { method: "platform", amount: total, platform },
      },
      {
        id: `audit-${Date.now()}-3`,
        action: "order_sent_to_kitchen",
        user_id: "System",
        details: `Order ${orderId} sent to kitchen (pre-paid by ${platform})`,
        order_id: orderId,
      },
    ]);

    return new Response(JSON.stringify({ success: true, orderId }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
});
```

2. **Deploy with `verify_jwt: false`** — webhooks come from external platforms, not authenticated staff.

3. **Add the webhook URL to aggregator platform dashboards** (manual step for the user):
   - Swiggy: `https://<project-ref>.supabase.co/functions/v1/aggregator-webhook`
   - Zomato: same URL
   - Each platform sends a `platform` field in the payload

**Verification:**
- `curl -X POST <url>/functions/v1/aggregator-webhook -d '{"platform":"swiggy","items":[{"name":"Burger","price":150,"quantity":2}],"total":300}'`
- Order appears in the database with `status: 'new'`
- KDS picks it up via Realtime

---

## Task 14: Update Store Actions to Write-Through to Supabase

**Goal:** Every Zustand store action that modifies persistent data should also write to Supabase. The pattern: write locally first (instant UI), then write to Supabase (background). If Supabase fails, the mutation queue catches it.

**What to do:**

This is a **refactor of the existing store actions**, not a replacement. The key change to each action:

```
Before:     set(localState) → enqueueMutation(kind, payload)
After:      set(localState) → call supabase-queries directly OR rely on enqueueMutation with real sendMutation
```

Since the mutation queue already exists and `sendMutation` (Task 9) now writes to Supabase, **the cheapest approach is to keep the queue as the write channel**. Every store action already calls `enqueueMutation`. The queue drains automatically.

**However**, for critical real-time operations (like `confirmPaymentAndSendToKitchen`), we should also do a direct write for immediacy:

1. **Add a `writeToSupabase` flag** in the store (togglable):
   ```typescript
   supabaseEnabled: boolean; // true after initial hydration succeeds
   ```

2. **For high-priority actions**, add a direct Supabase call *in addition to* the queue:
   - `confirmPaymentAndSendToKitchen` — write the order update directly so KDS gets it via Realtime immediately
   - `updateOrderStatus` — write directly for KDS real-time
   - `markOrderServed` — write directly for table release

3. **For lower-priority actions**, rely on the mutation queue:
   - `addAuditEntry` — queue is fine (audit can lag a few seconds)
   - `updateSettings` — queue is fine
   - Shift start/end — queue is fine

4. **Error handling pattern:**
   ```typescript
   // In store action:
   set(localState); // Instant UI update
   enqueueMutation(kind, payload); // Queued for sync

   // For high-priority: also fire-and-forget direct write
   if (get().supabaseEnabled) {
     updateOrderInDb(orderId, changes).catch(err => {
       console.error("[store] Direct write failed, queued mutation will retry:", err);
     });
   }
   ```

5. **Set `supabaseEnabled = true`** after `hydrateStoreFromSupabase()` succeeds in Task 10.

**Verification:**
- Create an order → it writes to both localStorage and Supabase
- Update order status → Supabase row updates within 200ms → other terminals reflect via Realtime
- Kill Supabase (simulate by blocking the domain) → local writes continue → queue grows → unblock → queue drains

---

## Task 15: Reports from PostgreSQL — SQL Views

**Goal:** Build efficient report queries that run on PostgreSQL instead of computing in the browser from the entire orders array. This makes Reports performant even with thousands of historical orders.

**What to do:**

1. **Create SQL views** via migration:

```sql
-- Daily sales summary
CREATE OR REPLACE VIEW public.v_daily_sales AS
SELECT
  DATE(created_at AT TIME ZONE 'Asia/Kolkata') AS sale_date,
  COUNT(*) FILTER (WHERE status = 'completed') AS total_orders,
  COALESCE(SUM(grand_total) FILTER (WHERE status = 'completed'), 0) AS total_revenue,
  COALESCE(AVG(grand_total) FILTER (WHERE status = 'completed'), 0) AS avg_order_value,
  COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_orders
FROM public.orders
GROUP BY DATE(created_at AT TIME ZONE 'Asia/Kolkata')
ORDER BY sale_date DESC;

-- Hourly revenue (for today)
CREATE OR REPLACE VIEW public.v_hourly_revenue AS
SELECT
  EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Kolkata')::integer AS hour,
  COALESCE(SUM(grand_total), 0) AS revenue,
  COUNT(*) AS order_count
FROM public.orders
WHERE status = 'completed'
  AND DATE(created_at AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE
GROUP BY EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Kolkata')
ORDER BY hour;

-- Payment method breakdown
CREATE OR REPLACE VIEW public.v_payment_breakdown AS
SELECT
  payment->>'method' AS method,
  COUNT(*) AS count,
  COALESCE(SUM((payment->>'amount')::numeric), 0) AS total
FROM public.orders
WHERE status = 'completed' AND payment IS NOT NULL
GROUP BY payment->>'method';

-- Top selling items
CREATE OR REPLACE VIEW public.v_top_items AS
SELECT
  oi.name,
  oi.menu_item_id,
  SUM(oi.quantity) AS total_quantity,
  SUM(oi.price * oi.quantity) AS total_revenue
FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
WHERE o.status = 'completed'
GROUP BY oi.name, oi.menu_item_id
ORDER BY total_quantity DESC
LIMIT 20;

-- Staff performance
CREATE OR REPLACE VIEW public.v_staff_performance AS
SELECT
  created_by AS staff_name,
  COUNT(*) AS orders_created,
  COUNT(*) FILTER (WHERE status = 'completed') AS orders_completed,
  COALESCE(SUM(grand_total) FILTER (WHERE status = 'completed'), 0) AS total_revenue
FROM public.orders
WHERE created_by IS NOT NULL
GROUP BY created_by
ORDER BY total_revenue DESC;
```

2. **Enable RLS on views** — views inherit the base table's RLS by default when accessed through PostgREST.

3. **Add query functions** for reports in `lib/supabase-queries.ts`:
   ```typescript
   export async function fetchDailySales(days = 30) {
     const { data, error } = await getSupabase()
       .from("v_daily_sales")
       .select("*")
       .limit(days);
     if (error) throw error;
     return data;
   }

   export async function fetchHourlyRevenue() {
     const { data, error } = await getSupabase()
       .from("v_hourly_revenue")
       .select("*");
     if (error) throw error;
     return data;
   }
   // ... similar for other views
   ```

4. **Update `components/pos/reports.tsx`** to use these queries instead of computing from local orders.

**Verification:**
- Reports page loads data from Supabase views
- Data matches what's in the database
- Performance: queries return in <500ms even with 1000+ orders
- Date range filtering works via SQL `WHERE` clauses

---

## Task 16: Supabase Storage for Menu Images

**Goal:** Upload menu item images to Supabase Storage instead of serving them from `public/menu/`. This enables dynamic menu management (add/edit items with custom photos from any terminal).

**What to do:**

1. **Create a storage bucket** — use Supabase dashboard or SQL:
   ```sql
   INSERT INTO storage.buckets (id, name, public) VALUES ('menu-images', 'menu-images', true);
   ```

2. **Upload existing images** — create a utility script or Edge Function that uploads the files from `public/menu/` to the bucket.

3. **Update menu item image URLs** — migrate from `/menu/LATTE.png` to `https://<ref>.supabase.co/storage/v1/object/public/menu-images/latte.png`.

4. **Add image upload in Settings** — when an admin adds a new menu item, they can upload an image directly to Supabase Storage.

5. **Add fallback** — if a Supabase Storage URL fails (offline), fall back to the local `public/menu/` path.

**Verification:**
- Menu images load from Supabase Storage
- Offline fallback to local images works
- Admin can upload a new image for a menu item

---

## Task 17: Generate & Save TypeScript Types

**Goal:** Generate TypeScript types from the Supabase schema for type-safe database queries.

**What to do:**

1. **Use `generate_typescript_types`** MCP tool with the project ID
2. **Save to `lib/supabase-types.ts`**
3. **Update `lib/supabase.ts`** to use the generated types:
   ```typescript
   import type { Database } from "./supabase-types";

   export function getSupabase() {
     if (!supabaseInstance) {
       supabaseInstance = createBrowserClient<Database>(
         process.env.NEXT_PUBLIC_SUPABASE_URL!,
         process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
       );
     }
     return supabaseInstance;
   }
   ```

4. **Update `lib/supabase-queries.ts`** to use typed queries

**Verification:**
- `npm run build` passes with no type errors
- IntelliSense works for Supabase queries (e.g., `.from("orders").select("*")` shows correct column types)

---

## Task 18: Update CLAUDE.md and Documentation

**Goal:** Keep the codebase documentation in sync with the backend integration.

**What to do:**

1. **Update `CLAUDE.md`:**
   - Flip the Backend Phase 3 line from description to `[DONE]`
   - Add a "Backend" section with Supabase project details (URL, region)
   - Document new files: `lib/supabase.ts`, `lib/supabase-queries.ts`, `lib/auth.ts`, `lib/hydrate.ts`, `hooks/use-realtime-sync.ts`, `lib/supabase-types.ts`
   - Update the "Notes for AI Agents" section:
     - Supabase is now the source of truth
     - All writes go through the mutation queue → `sendMutation` → Supabase
     - Realtime subscriptions keep multi-terminal in sync
     - PIN auth via Edge Function, not direct DB access
   - Document env vars needed: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

2. **Create `docs/remaining_work.md`** updates:
   - Cross off all Phase 3 items
   - Add Phase 4 items (from system_audit.md)

3. **Update the project structure** listing in CLAUDE.md

**Verification:**
- A future agent reading CLAUDE.md knows the backend is live
- All new files are documented
- Env vars are documented

---

## Implementation Order (Recommended)

Follow this order. Each step compiles and runs on its own.

```
Task 1   (Create Supabase project)               ← Foundation — everything depends on this
Task 2   (Database schema)                        ← Must exist before any data ops
Task 3   (Seed default data)                      ← Populates tables for immediate use
Task 4   (Enable RLS)                             ← Security before any client access
Task 5   (PIN-auth Edge Function)                 ← Auth before any authenticated queries
Task 6   (Install SDK + env config)               ← Client library setup
Task 17  (Generate TypeScript types)              ← Type-safe queries from here on
Task 7   (Rewire authentication)                  ← Login now uses Supabase
Task 8   (Data layer — supabase-queries.ts)       ← Query/mapper functions
Task 9   (Rewire sync queue — real sendMutation)  ← Existing queue now writes to DB
Task 10  (Initial data hydration)                 ← App loads data from Supabase
Task 11  (Realtime subscriptions)                 ← Multi-terminal sync
Task 12  (KDS Realtime publication)               ← Kitchen live updates
Task 14  (Write-through store actions)            ← Direct writes for critical paths
Task 13  (Aggregator webhook Edge Function)       ← External order ingestion
Task 15  (Reports SQL views)                      ← Efficient server-side analytics
Task 16  (Supabase Storage for menu images)       ← Optional — can defer
Task 18  (Documentation updates)                  ← After all code lands
```

**Critical dependencies:**
- Tasks 1–4 must be sequential (project → schema → data → RLS)
- Task 5 must come before Task 7 (auth function before auth client code)
- Task 6 must come before all client-side Supabase work (7–17)
- Task 9 can be done alongside Task 10 — they're independent
- Task 11 must come before Task 12 (base Realtime before KDS-specific)
- Task 13 is independent — can be done anytime after Task 4
- Task 18 should be last

---

## Global Rules for Phase 3

1. **Never expose the `service_role` key** to the client. It stays in Edge Functions only.
2. **All client-side queries use the `anon` key** — RLS enforces access control.
3. **The existing localStorage persistence stays** — it's the offline cache. Don't remove `partialize` or `onRehydrateStorage`.
4. **Zustand remains for local UI state** — cart, selected view, edit mode, pending billing order ID. These don't need to be in the database.
5. **Bump `STORE_VERSION`** when adding new persisted fields (e.g., `supabaseEnabled`).
6. **Use `snake_case` for database columns**, `camelCase` for frontend. The mapper functions in `lib/supabase-queries.ts` handle conversion.
7. **Every write goes through the mutation queue** (background sync) AND, for critical paths, a direct Supabase call (fire-and-forget). The queue is the safety net.
8. **Date handling:** Store as `TIMESTAMPTZ` in PostgreSQL, convert to JS `Date` on read, convert to ISO 8601 string on write.
9. **Never `console.log` sensitive data** (PINs, service role keys, session tokens) in production.
10. **Test with at least 2 browser tabs** after Task 11 to verify multi-terminal sync.
11. **Run `npm run build` after every task.** Build errors from Supabase type mismatches are common — catch them early.
12. **Run `get_advisors` with type `security`** after Tasks 4 and 5 to verify RLS coverage.
13. **The POS must work offline.** If Supabase is unreachable, the app should function exactly as it did in Phase 2. Only syncing pauses.
14. **India timezone** — all date rendering uses `Asia/Kolkata`. SQL views use `AT TIME ZONE 'Asia/Kolkata'`. The database stores UTC.
15. **Free tier limits** — the Pos agency org is on the Free plan. Monitor usage. Each project gets 500MB database, 1GB storage, 2GB bandwidth, 500K Edge Function invocations/month.

---

## Files That Will Be Modified

| File | Tasks |
|------|-------|
| `package.json` | 6 |
| `.env.local` (new) | 6 |
| `next.config.mjs` | 6 |
| `lib/store.ts` | 7, 14 |
| `lib/sync.ts` | 9 |
| `lib/sync-idb.ts` | 9 |
| `components/pos/login.tsx` | 7 |
| `components/pos/reports.tsx` | 15 |
| `components/pos/settings.tsx` | 16 |
| `app/page.tsx` | 7, 10, 11 |
| `CLAUDE.md` | 18 |

## New Files to Create

| File | Task |
|------|------|
| `lib/supabase.ts` | 6 |
| `lib/supabase-types.ts` | 17 |
| `lib/supabase-queries.ts` | 8 |
| `lib/auth.ts` | 7 |
| `lib/hydrate.ts` | 10 |
| `hooks/use-realtime-sync.ts` | 11 |
| `.env.local` | 6 |

## Edge Functions to Deploy

| Function | Task | JWT Required |
|----------|------|-------------|
| `pin-auth` | 5 | No (pre-login) |
| `aggregator-webhook` | 13 | No (external webhook) |

---

## Verification Checklist (End of Phase 3)

- [ ] Supabase project is `ACTIVE_HEALTHY` in ap-south-1
- [ ] All 11 tables exist with correct schema
- [ ] RLS is enabled on all tables — `get_advisors` shows no critical issues
- [ ] PIN login via Edge Function works (returns JWT)
- [ ] JWT contains `user_role` in claims → RLS policies work
- [ ] App loads data from Supabase on login
- [ ] Creating an order writes to both localStorage and Supabase
- [ ] Order status changes reflect across multiple browser tabs (Realtime)
- [ ] KDS receives new orders immediately after payment (Realtime)
- [ ] Aggregator webhook Edge Function creates orders correctly
- [ ] Reports load from SQL views (not client-side computation)
- [ ] Offline mode works — orders/changes queue locally and sync on reconnect
- [ ] Session persists across page reloads (auto-login)
- [ ] All existing Phase 1/2/Pay-First features still work (full regression)
- [ ] `npm run build` passes with no errors
- [ ] CLAUDE.md and docs are updated

---

## Future Extensibility: Customer QR Table Ordering (Phase 4+)

The schema and architecture are designed to support **customer self-ordering via QR code** in a future phase. Here's how it would work and what's already prepared:

**Concept:** Each table has a QR code. A customer scans it with their phone, sees the menu, and places an order directly. The order flows into the POS as `awaiting-payment` (or pre-paid via UPI), then to the kitchen.

**What's already in place:**
- `tables.id` is stable (e.g., `t1`, `t2`) — QR codes encode this table ID
- `orders.type` supports `dine-in` — customer orders use this type
- `orders.customer_name` can store the customer's name from the QR flow
- The pay-first flow already enforces payment before kitchen visibility
- Supabase Realtime already broadcasts order changes to all devices
- Edge Functions can handle unauthenticated customer requests

**What Phase 4 would add:**
1. A `customer_sessions` table linking a QR scan to a table and a temporary session
2. A public-facing Edge Function (`customer-order`) that:
   - Validates the table QR token
   - Returns the menu (read from `menu_items`)
   - Accepts an order submission → inserts into `orders` with `status: awaiting-payment`
3. A lightweight customer-facing web page (separate Next.js route or standalone) showing the menu
4. Optional: customer pre-pays via UPI (Razorpay/Cashfree integration), order goes straight to kitchen
5. RLS policy for `anon` role to INSERT orders (with strict `WITH CHECK` on the customer session token)

**Schema-ready columns for Phase 4:**
```sql
-- These would be added in Phase 4, NOT now:
ALTER TABLE public.tables ADD COLUMN qr_token TEXT UNIQUE;
ALTER TABLE public.orders ADD COLUMN customer_session_id UUID;
CREATE TABLE public.customer_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id TEXT REFERENCES public.tables(id),
  customer_name TEXT,
  phone TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '2 hours'),
  is_active BOOLEAN DEFAULT true
);
```

> **Do NOT implement any of this in Phase 3.** This section exists purely to confirm that the current schema design does not block future QR ordering. The architecture is ready.

---

## Authentication: What We Use and What We DON'T

| Method | Used? | Notes |
|--------|-------|-------|
| **PIN pad (4-digit numeric)** | ✅ YES | The ONLY login method. Each staff has a unique PIN. |
| Google OAuth | ❌ NO | Not applicable for cafe staff workflow |
| Email/Password | ❌ NO | Too slow for shift-based cafe operations |
| Magic Link | ❌ NO | Staff don't have individual emails |
| Phone OTP | ❌ NO | Unnecessary friction for a trusted-staff POS |
| Biometric | ❌ NO | Future consideration, not Phase 3 |

The PIN system is designed for **speed** — a cashier taps 4 digits and they're in. The Edge Function translates this PIN into a secure Supabase JWT behind the scenes. The staff never sees or deals with emails, passwords, or any traditional auth flow.

**PIN management:**
- Admin assigns/changes PINs via Settings > Staff Management
- PINs must be unique across all active staff (enforced by DB constraint `unique_active_pin`)
- When a staff member is deactivated (`is_active = false`), their PIN is freed for reuse
- PIN changes propagate to all devices via Realtime subscription on the `staff` table

---

*This guide covers Phase 3 completely — 18 tasks bringing SUHASHI POS from a client-only prototype to a production-ready, multi-terminal, real-time, offline-capable cafe POS system backed by Supabase. Phase 4 (advanced reporting, inventory, loyalty, QR table ordering, multi-branch) builds on this foundation.*
