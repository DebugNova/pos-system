# CLAUDE.md

> Guidance for AI agents (Claude Code, Antigravity, etc.) working in this repository.

---

## Developer

**Kaustab Borah** — 21 years old, B.Tech CSE 3rd year student.
Builds products and websites using AI agents and Claude Code as the primary development workflow.

---

## Project Overview

**SUHASHI Cafe POS** — A touch-first Point of Sale system for a cafe, designed primarily for iPad.
Handles dine-in billing, table management, kitchen display, online orders (Swiggy / Zomato), payments, and reporting from a single interface.

**Stack:** Next.js (App Router) · TypeScript · Zustand (local state + offline cache) · Tailwind CSS · shadcn/ui · Recharts · Framer Motion · **Supabase** (PostgreSQL, Auth, Realtime, Edge Functions, Storage)

**Current state:** Full-stack POS with Supabase backend. Supabase is the **source of truth**. Zustand + localStorage serve as the offline cache. The app works fully offline and syncs when reconnected.

**Deployment:** [https://suhashico.vercel.app/](https://suhashico.vercel.app/) (Vercel)

---

## Backend (Supabase — Phase 3 ✅ COMPLETE)

| Detail | Value |
|--------|-------|
| **Project ID** | `ycrwtvtdsbjbhdqyuptq` |
| **Region** | `ap-south-1` (Mumbai) |
| **API URL** | `https://ycrwtvtdsbjbhdqyuptq.supabase.co` |
| **Database** | PostgreSQL with RLS on all tables |
| **Auth** | PIN-based via Edge Function → JWT |
| **Realtime** | Enabled on `orders`, `order_items`, `tables`, `settings`, `staff` |
| **Storage** | `menu-images` bucket (public, 5MB, PNG/JPEG/WebP/GIF) |
| **Edge Functions** | `pin-auth`, `aggregator-webhook` |

### Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` + Vercel | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` + Vercel | Supabase anon/public key |
| `AGGREGATOR_WEBHOOK_SECRET` | Supabase Edge Function secrets | Shared secret for webhook auth |

### Database Tables (11 tables)

`orders`, `order_items`, `supplementary_bills`, `supplementary_bill_items`, `tables`, `staff`, `settings`, `audit_log`, `shifts`, `menu_items` (reserved), `modifiers` (reserved)

### SQL Views (5 report views)

`v_daily_sales`, `v_hourly_revenue`, `v_payment_breakdown`, `v_top_items`, `v_staff_performance`

### Edge Functions

| Function | Purpose | JWT Required |
|----------|---------|--------------|
| `pin-auth` | Validates staff PIN, returns Supabase JWT with `user_role` claim | No (pre-login) |
| `aggregator-webhook` | Accepts Swiggy/Zomato orders via HTTP POST | No (uses `X-Webhook-Secret` header) |

---

## What to Build

### Core Modules (all required)
| Module | Purpose |
|--------|---------|
| **Dashboard** | Today's sales, active tables, pending orders, aggregator volume |
| **New Order** | Category browse + search, cart, modifiers, order type selection |
| **Tables** | Visual table map, open bills, move / merge / split table |
| **Kitchen Display** | KOT queue (FIFO), per-item status (preparing → ready), aggregator marking, urgency alerts, **Realtime audio/visual alerts** |
| **Billing** | Cash / UPI / Card / Split payment, discounts, receipt printing |
| **Aggregator Inbox** | Swiggy & Zomato orders, status flow, accept / reject |
| **Order History** | Past orders, filters, refund access |
| **Reports** | Sales, item performance, staff stats, payment breakdown — **driven by SQL views** |
| **Settings** | Cafe profile, tax, printers, staff CRUD, menu image upload |

### Order Flow (Pay-First)
`Select type → Choose table/customer → Add items + modifiers → Proceed to Payment → Take payment + print receipt → Send to Kitchen (KOT) → Prepare → Ready → Mark Served → Close & archive`

**Important:** This is a **pay-first** flow. The kitchen does **not** see an order until payment is complete. Tables are soft-locked as `waiting-payment` the moment an order is placed, and only flip to `occupied` after payment succeeds. If payment is cancelled/voided, the table returns to `available`. Aggregator orders (Swiggy/Zomato) are pre-paid and bypass the billing stop entirely. Full spec: [docs/pay-first-flow.md](docs/pay-first-flow.md).

Order status lifecycle: `awaiting-payment → new → preparing → ready → completed` (or `cancelled` at any pre-served stage). Every transition writes an audit entry.

### Key Features [DONE]
- **RBAC** — restricted screens & actions by role (Admin / Cashier / Server / Kitchen) ✅
- **Kitchen Flow** — FIFO sorting, urgency alerts, aggregator source marking, **Realtime audio/visual alerts** ✅
- **Pay-First Order Flow** — payment before kitchen, soft-locked tables, supplementary KOT for post-payment edits ✅
- **Payment model** — record method, amount, transaction ID per order ✅
- **Audit log** — log refunds, voids, discounts, and every pay-first state transition ✅
- **Settings persistence** — save to store + Supabase ✅
- **Real reports** — computed from **SQL views** (server-side), with local fallback ✅
- **UPI QR generation** — real `upi://pay?...` deep-link QR code ✅
- **Split bill** — split bill dialog with item-level split ✅
- **Modifiers** — add-ons (extra shot, oat milk, whipped cream, etc.) ✅
- **PWA** — `manifest.json` + service worker for iPad install ✅
- **Offline sync queue** — IndexedDB-backed mutation queue with Background Sync API ✅
- **Receipt template** — printable receipt with order details, tax, payment info ✅
- **Shift tracking** — start/end shift with opening/closing cash ✅
- **Backend (Phase 3)** — Supabase (PostgreSQL, Auth, Realtime, Edge Functions, Storage) ✅
- **Realtime multi-terminal sync** — orders, tables, KDS update across all devices ✅
- **KDS reactive alerts** — audio bell + visual "NEW!" badges on incoming orders ✅
- **Write-through store** — critical actions write directly to Supabase for instant Realtime ✅
- **Aggregator webhook** — Swiggy/Zomato orders ingested via Edge Function ✅
- **SQL report views** — server-side analytics with local fallback ✅
- **Menu image storage** — upload to Supabase Storage with image preview ✅

### User Roles
| Role | Access |
|------|--------|
| Admin | Everything — menu, reports, tax, staff, integrations, refunds |
| Cashier | Billing, payments, approved discounts, receipts |
| Server | Create orders, take them to payment, manage table status, mark served |
| Kitchen | View KOT queue (paid orders only), mark items preparing / ready |

---

## Project Structure

```
POS system/
├── app/
│   ├── layout.tsx          # Root layout, font, theme provider
│   ├── page.tsx            # Entry point — renders POS app or login, hydration + Realtime
│   ├── sw.ts               # Service worker source (Serwist)
│   └── globals.css         # Global styles
│
├── components/
│   ├── pos/
│   │   ├── login.tsx           # PIN-based login → Supabase Edge Function auth
│   │   ├── sidebar.tsx         # Navigation sidebar
│   │   ├── dashboard.tsx       # Home dashboard with stats
│   │   ├── new-order.tsx       # Order creation (categories, cart, supplementary cart mode)
│   │   ├── table-management.tsx# Table map, merge, move, waiting-payment click-through
│   │   ├── kitchen-display.tsx # KOT kanban + Realtime alerts (audio + visual)
│   │   ├── billing.tsx         # Payment processing (awaiting-payment filter, void, auto-print)
│   │   ├── aggregator-inbox.tsx# Swiggy / Zomato order inbox (pre-paid bypass)
│   │   ├── order-history.tsx   # Past orders + filters + supplementary bill nesting
│   │   ├── reports.tsx         # Charts — SQL views (server) with local fallback
│   │   ├── settings.tsx        # All configuration tabs
│   │   ├── data-manager.tsx    # Export / import / reset data + menu image upload
│   │   ├── receipt-template.tsx# Printable receipt template
│   │   ├── split-bill-dialog.tsx# Split bill by items across orders
│   │   └── transition-overlay.tsx # Premium brand intro animation
│   └── ui/                 # shadcn/ui primitives (button, card, dialog, …)
│
├── lib/
│   ├── data.ts             # Types: MenuItem, Order, Table, AuditEntry, etc. + seed data
│   ├── store.ts            # Zustand store (auth, cart, orders, tables, menu, audit, sync)
│   ├── roles.ts            # RBAC configuration (permissions, role views)
│   ├── supabase.ts         # Supabase client singleton (browser client)
│   ├── supabase-types.ts   # Auto-generated TypeScript types from Supabase schema
│   ├── supabase-queries.ts # Data access layer: CRUD + mappers + report queries + image upload
│   ├── auth.ts             # PIN auth: loginWithPin() → Edge Function → JWT session
│   ├── hydrate.ts          # Initial data hydration from Supabase on login
│   ├── sync.ts             # Mutation queue processor — replays queued writes to Supabase
│   ├── sync-idb.ts         # IndexedDB helpers for offline mutation persistence
│   └── utils.ts            # cn() helper
│
├── hooks/
│   ├── use-mobile.ts         # Mobile breakpoint detection
│   ├── use-online-status.ts  # Online/offline status tracker
│   ├── use-realtime-sync.ts  # Supabase Realtime subscriptions (multi-terminal sync)
│   └── use-toast.ts          # Toast notification hook
│
├── public/
│   ├── logo.png
│   ├── manifest.json       # PWA manifest
│   ├── sw.js               # Compiled service worker (offline + Background Sync)
│   └── menu/               # Local menu item images (offline fallback)
│
├── docs/
│   ├── cafe_pos_blueprint.md               # Full product spec
│   ├── pay-first-flow.md                   # Pay-first order flow spec
│   ├── pay_first_implementation_guide.md   # Pay-first implementation guide
│   ├── phase1_implementation_guide.md      # Phase 1 tasks
│   ├── phase2_implementation_guide.md      # Phase 2 tasks
│   ├── phase3_implementation_guide.md      # Phase 3 tasks (Supabase backend)
│   ├── remaining_work.md                   # Gap analysis & roadmap
│   └── system_audit.md                     # System audit
│
├── .env.local              # NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
├── CLAUDE.md               # This file
├── next.config.mjs         # Next.js config (Serwist PWA + Supabase image domains)
├── tsconfig.json
└── package.json
```

---

## Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm run lint     # ESLint
npm run build    # Production build
```

---

## Notes for AI Agents

### Architecture
- **Supabase is the source of truth.** All persistent data lives in PostgreSQL via Supabase. Zustand + localStorage is the offline cache.
- **All writes go through two paths simultaneously:**
  1. **Mutation queue** (`lib/sync.ts`) — queues writes to IndexedDB, replays to Supabase. This is the safety net for offline support.
  2. **Direct write-through** (for critical paths) — `confirmPaymentAndSendToKitchen`, `updateOrderStatus`, and `markOrderServed` also call Supabase directly (fire-and-forget) for instant Realtime propagation.
- **Realtime subscriptions** (`hooks/use-realtime-sync.ts`) keep all terminals in sync. Changes from other devices merge into the Zustand store automatically.
- **Own-write detection** prevents feedback loops — when a terminal writes to Supabase, it marks the write so the Realtime echo from Supabase doesn't cause duplicate state updates.

### Authentication
- **PIN-only auth** via the `pin-auth` Edge Function. Staff enter a 4-digit PIN → Edge Function validates against the `staff` table → returns a Supabase JWT with `user_role` in the claims.
- **Never access the `service_role` key** from the client. It stays in Edge Functions only.
- **RLS policies** use `auth.jwt() ->> 'user_role'` to enforce access control. All client queries use the `anon` key.

### Offline-First
- The POS **must work offline**. If Supabase is unreachable, the app functions exactly as before. Only syncing pauses.
- All mutations are enqueued to `syncQueue` in the Zustand store and mirrored to IndexedDB via `lib/sync-idb.ts`.
- The service worker (`app/sw.ts` → `public/sw.js`) registers for Background Sync to replay mutations even when the page is closed.

### Data Flow
- **State lives in `lib/store.ts`** — all components read/write via `usePOSStore()`.
- **RBAC is centralized in `lib/roles.ts`** — use `canAccessView()` for navigation and `getPermissions(currentUser.role)` for action-level gates.
- **Seed data is in `lib/data.ts`** — menu items, initial tables, default staff, type definitions.
- **Settings are persisted in the Zustand store** — `CafeSettings` lives in the store under `settings`. Use `updateSettings()` to change values.
- **Database column convention:** `snake_case` in PostgreSQL, `camelCase` in frontend. The mapper functions in `lib/supabase-queries.ts` handle conversion (`mapDbOrderToLocal`, `mapLocalOrderToDb`, etc.).
- **Date handling:** Stored as `TIMESTAMPTZ` in PostgreSQL (UTC), converted to JS `Date` on read, converted to ISO 8601 string on write. All date rendering uses `Asia/Kolkata` timezone.

### Reports
- **Reports load from SQL views** (`v_daily_sales`, `v_hourly_revenue`, `v_payment_breakdown`, `v_top_items`, `v_staff_performance`) when online.
- **Local fallback** — when Supabase is unreachable, reports compute from the local orders array (old behavior).
- A "Live" badge with Database icon appears when server data is being used.

### Menu Images
- Menu images can be uploaded to Supabase Storage (`menu-images` bucket) via the Data Manager.
- Local images in `public/menu/` serve as the offline fallback.
- `next.config.mjs` allows `*.supabase.co` as a remote image pattern.

### Key Rules
- **Reports and Data Manager are accessed via Dashboard** — not in the sidebar.
- **Pay-first flow** — Orders do NOT enter the kitchen until payment is complete. KDS only shows orders with status `new`, `preparing`, or `ready`. **Do not add `awaiting-payment` to any KDS filter.** See [docs/pay-first-flow.md](docs/pay-first-flow.md).
- **Order lifecycle store actions** — Use the correct action for each transition:
  - `addOrder()` → creates with `awaiting-payment` (default) or `new` (aggregator bypass via `opts.initialStatus`).
  - `confirmPaymentAndSendToKitchen(orderId, payment)` → flips to `new`, records payment, writes audit, **direct Supabase write for Realtime**.
  - `cancelAwaitingPaymentOrder(orderId, reason?)` → cancels pre-payment, releases table.
  - `updateOrderStatus(orderId, status)` → handles `new→preparing` and `preparing→ready` only. **Direct Supabase write for Realtime.**
  - `markOrderServed(orderId)` → the only path to `completed`. Releases table, **direct Supabase write for Realtime.**
- **Supplementary edits (post-payment)** — `startEditOrder` detects the order's status and enters either `pre-payment` (full edit) or `supplementary` mode (add-only, locked originals).
- **Audit everything** — Every order state transition must write to `auditLog` via `addAuditEntry`. Never mutate order status without an audit entry.
- **Bump `STORE_VERSION`** in `lib/store.ts` when adding new persisted fields.
- **Run `npm run build` after every task.** Build errors from type mismatches are common — catch them early.
- **Free tier limits** — the project is on the Supabase Free plan. Monitor usage (500MB DB, 1GB storage, 2GB bandwidth, 500K Edge Function invocations/month).
- Keep components focused; avoid putting business logic in JSX — extract to store actions or utility functions.
- **Animation Orchestration:** Use `window.dispatchEvent(new CustomEvent("trigger-logo-animation", { detail: { x, y } }))` to replay the brand intro transition from any component.
