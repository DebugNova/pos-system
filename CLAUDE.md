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

**Stack:** Next.js (App Router) · TypeScript · Zustand (state) · Tailwind CSS · shadcn/ui · Recharts · Framer Motion (Animations)

**Current state:** Frontend prototype only. All state is client-side via Zustand persisted to `localStorage`. No backend, no real auth, no live integrations yet.

---

## What to Build

### Core Modules (all required)
| Module | Purpose |
|--------|---------|
| **Dashboard** | Today's sales, active tables, pending orders, aggregator volume |
| **New Order** | Category browse + search, cart, modifiers, order type selection |
| **Tables** | Visual table map, open bills, move / merge / split table |
| **Kitchen Display** | KOT queue (FIFO), per-item status (preparing → ready), aggregator marking, urgency alerts |
| **Billing** | Cash / UPI / Card / Split payment, discounts, receipt printing |
| **Aggregator Inbox** | Swiggy & Zomato orders, status flow, accept / reject |
| **Order History** | Past orders, filters, refund access |
| **Reports** | Sales, item performance, staff stats, payment breakdown — driven by real data |
| **Settings** | Cafe profile, tax, printers, staff CRUD, integrations — all persisted |

### Order Flow (Pay-First)
`Select type → Choose table/customer → Add items + modifiers → Proceed to Payment → Take payment + print receipt → Send to Kitchen (KOT) → Prepare → Ready → Mark Served → Close & archive`

**Important:** This is a **pay-first** flow. The kitchen does **not** see an order until payment is complete. Tables are soft-locked as `waiting-payment` the moment an order is placed, and only flip to `occupied` after payment succeeds. If payment is cancelled/voided, the table returns to `available`. Aggregator orders (Swiggy/Zomato) are pre-paid and bypass the billing stop entirely. Full spec: [docs/pay-first-flow.md](docs/pay-first-flow.md).

Order status lifecycle: `awaiting-payment → new → preparing → ready → completed` (or `cancelled` at any pre-served stage). Every transition writes an audit entry.

### Key Features Still Needed
- **RBAC** — restricted screens & actions by role (Admin / Cashier / Server / Kitchen) [DONE]
- **Kitchen Flow** — FIFO sorting, urgency alerts, and aggregator source marking [DONE]
- **Pay-First Order Flow** — payment before kitchen, soft-locked tables, supplementary KOT for post-payment edits. See [docs/pay-first-flow.md](docs/pay-first-flow.md) [DONE]
- **Payment model** — record method, amount, transaction ID per order [DONE]
- **Audit log** — log refunds, voids, discounts, and every pay-first state transition (order_created, payment_recorded, order_sent_to_kitchen, status_changed, order_served) [DONE]
- **Settings persistence** — save to store, not local `useState` [DONE]
- **Real reports** — compute from actual order data, not mock arrays [DONE]
- **UPI QR generation** — real `upi://pay?...` deep-link QR code [DONE]
- **Split bill** — split bill dialog with item-level split [DONE]
- **Modifiers** — add-ons (extra shot, oat milk, whipped cream, etc.) on menu items [DONE]
- **PWA** — `manifest.json` + service worker for iPad install [DONE]
- **Offline sync queue** — IndexedDB-backed mutation queue with Background Sync API [DONE]
- **Receipt template** — printable receipt with order details, tax, payment info [DONE]
- **Shift tracking** — start/end shift with opening/closing cash [DONE]
- **Backend** (Phase 3) — **Supabase** (PostgreSQL, Auth, Realtime, Edge Functions). No custom Node.js server. Supabase handles database, authentication, real-time sync, and serverless functions. ESC/POS printing, Swiggy/Zomato webhook integration via Edge Functions.

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
│   ├── page.tsx            # Entry point — renders POS app or login
│   └── globals.css         # Global styles
│
├── components/
│   ├── pos/
│   │   ├── login.tsx           # PIN-based login + shift start
│   │   ├── sidebar.tsx         # Navigation sidebar
│   │   ├── dashboard.tsx       # Home dashboard with stats
│   │   ├── new-order.tsx       # Order creation (categories, cart, supplementary cart mode)
│   │   ├── table-management.tsx# Table map, merge, move, waiting-payment click-through
│   │   ├── kitchen-display.tsx # KOT kanban (New → Preparing → Ready → Mark Served)
│   │   ├── billing.tsx         # Payment processing (awaiting-payment filter, void, auto-print)
│   │   ├── aggregator-inbox.tsx# Swiggy / Zomato order inbox (pre-paid bypass)
│   │   ├── order-history.tsx   # Past orders + filters + supplementary bill nesting
│   │   ├── reports.tsx         # Charts and analytics
│   │   ├── settings.tsx        # All configuration tabs
│   │   ├── data-manager.tsx    # Export / import / reset data
│   │   ├── receipt-template.tsx# Printable receipt template
│   │   ├── split-bill-dialog.tsx# Split bill by items across orders
│   │   └── transition-overlay.tsx # Premium brand intro animation
│   └── ui/                 # shadcn/ui primitives (button, card, dialog, …)
│
├── lib/
│   ├── data.ts             # Types: MenuItem, Order, Table, AuditEntry, etc. + seed data
│   ├── store.ts            # Zustand store (auth, cart, orders, tables, menu, audit, sync)
│   ├── roles.ts            # RBAC configuration (permissions, role views)
│   ├── sync-idb.ts         # IndexedDB helpers for offline mutation queue
│   └── utils.ts            # cn() helper
│
├── hooks/
│   ├── use-mobile.ts
│   └── use-toast.ts
│
├── public/
│   ├── logo.png
│   ├── manifest.json       # PWA manifest
│   ├── sw.js               # Service worker (offline + Background Sync)
│   └── menu/               # Menu item images
│
├── docs/
│   ├── cafe_pos_blueprint.md          # Full product spec
│   ├── pay-first-flow.md              # Pay-first order flow — implementation spec
│   ├── pay_first_implementation_guide.md # Task-by-task implementation guide
│   └── remaining_work.md              # Gap analysis (updated post-pay-first)
├── CLAUDE.md               # This file
├── next.config.mjs
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

- **State lives in `lib/store.ts`** — all components read/write via `usePOSStore()`.
- **RBAC is centralized in `lib/roles.ts`** — use `canAccessView()` for navigation and `getPermissions(currentUser.role)` for action-level gates.
- **Seed data is in `lib/data.ts`** — menu items, initial tables, default staff, type definitions.
- **Settings are persisted in the Zustand store** — `CafeSettings` lives in the store under `settings`. Use `updateSettings()` to change values.
- **Reports and Data Manager are now accessed via Dashboard** — Removed Reports from sidebar to reduce clutter; used high-contrast distinct buttons on Dashboard.
- **Tax Settings are iPad-optimized** — Implemented a professional slider and GST presets (0%, 5%, 12%, 18%, 28%) for quick touch-based configuration.
- **Chart Contrast fixed for low-light** — Reports charts now use full foreground color for labels and tooltips, ensuring legibility on dark themes.
- **Kitchen Display is now optimized** — features FIFO sorting, status-based filters, and time-based urgency indicators.
- **Pay-first flow** — Orders do NOT enter the kitchen until payment is complete. KDS only shows orders with status `new`, `preparing`, or `ready` (all of which are already paid). Unpaid orders sit in `awaiting-payment` and are visible only in Billing. **Do not add `awaiting-payment` to any KDS filter.** See [docs/pay-first-flow.md](docs/pay-first-flow.md) and [docs/pay_first_implementation_guide.md](docs/pay_first_implementation_guide.md) before touching the order lifecycle.
- **Order lifecycle store actions** — Use the correct action for each transition:
  - `addOrder()` → creates with `awaiting-payment` (default) or `new` (aggregator bypass via `opts.initialStatus`).
  - `confirmPaymentAndSendToKitchen(orderId, payment)` → flips to `new`, records payment, writes audit.
  - `cancelAwaitingPaymentOrder(orderId, reason?)` → cancels pre-payment, releases table.
  - `updateOrderStatus(orderId, status)` → handles `new→preparing` and `preparing→ready` only. Blocked for `completed` and `awaiting-payment`.
  - `markOrderServed(orderId)` → the only path to `completed`. Releases table, writes `order_served` audit.
- **Supplementary edits (post-payment)** — `startEditOrder` detects the order's status and enters either `pre-payment` (full edit) or `supplementary` mode (add-only, locked originals). See §4.7 of pay-first-flow.md.
- **Audit everything** — Every order state transition (created, paid, sent to kitchen, preparing, ready, served, cancelled, refunded) must write to `auditLog` via `addAuditEntry`. Never mutate order status without an audit entry.
- **Offline sync** — all mutations are enqueued to `syncQueue` and mirrored to IndexedDB via `lib/sync-idb.ts`. The service worker (`public/sw.js`) registers for Background Sync.
- **Print receipts** — use `window.print()` with the `ReceiptTemplate` component (hidden, print-only CSS). ESC/POS printing deferred to Phase 3.
- Keep components focused; avoid putting business logic in JSX — extract to store actions or utility functions.
- Always check `remaining_work.md` before starting a new feature to avoid duplicate effort.
- **Animation Orchestration:** Use `window.dispatchEvent(new CustomEvent("trigger-logo-animation", { detail: { x, y } }))` to replay the brand intro transition from any component (e.g., sidebar logo). The `TransitionOverlay` in `app/page.tsx` listens for this globally.
