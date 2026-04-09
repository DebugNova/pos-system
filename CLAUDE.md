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

**Stack:** Next.js (App Router) · TypeScript · Zustand (state) · Tailwind CSS · shadcn/ui · Recharts

**Current state:** Frontend prototype only. All state is client-side via Zustand persisted to `localStorage`. No backend, no real auth, no live integrations yet.

---

## What to Build

### Core Modules (all required)
| Module | Purpose |
|--------|---------|
| **Dashboard** | Today's sales, active tables, pending orders, aggregator volume |
| **New Order** | Category browse + search, cart, modifiers, order type selection |
| **Tables** | Visual table map, open bills, move / merge / split table |
| **Kitchen Display** | KOT queue, per-item status (preparing → ready), aggregator marking |
| **Billing** | Cash / UPI / Card / Split payment, discounts, receipt printing |
| **Aggregator Inbox** | Swiggy & Zomato orders, status flow, accept / reject |
| **Order History** | Past orders, filters, refund access |
| **Reports** | Sales, item performance, staff stats, payment breakdown — driven by real data |
| **Settings** | Cafe profile, tax, printers, staff CRUD, integrations — all persisted |

### Order Flow
`Select type → Choose table/customer → Add items + modifiers → Send to kitchen (KOT) → Take payment → Close & archive`

### Key Features Still Needed
- **RBAC** — restrict screens & actions by role (Admin / Cashier / Server / Kitchen)
- **Payment model** — record method, amount, transaction ID per order
- **Audit log** — log refunds, voids, discounts
- **Settings persistence** — save to store, not local `useState`
- **Real reports** — compute from actual order data, not mock arrays
- **UPI QR generation** — real `upi://pay?...` deep-link QR code
- **Split bill** — fully implement `splitTable` (currently a stub)
- **Modifiers** — add-ons (spice level, toppings, extra shot) on menu items
- **PWA** — `manifest.json` + service worker for iPad install
- **Backend** (Phase 2) — Node.js + PostgreSQL, JWT auth, WebSockets, offline sync queue, printer ESC/POS, Swiggy/Zomato API

### User Roles
| Role | Access |
|------|--------|
| Admin | Everything — menu, reports, tax, staff, integrations, refunds |
| Cashier | Billing, payments, approved discounts, receipts |
| Server | Create orders, send to kitchen, manage table status |
| Kitchen | View KOT queue, mark items preparing / ready |

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
│   │   ├── new-order.tsx       # Order creation (categories, cart)
│   │   ├── table-management.tsx# Table map, merge, move
│   │   ├── kitchen-display.tsx # KOT kanban (New → Preparing → Ready)
│   │   ├── billing.tsx         # Payment processing
│   │   ├── aggregator-inbox.tsx# Swiggy / Zomato order inbox
│   │   ├── order-history.tsx   # Past orders + filters
│   │   ├── reports.tsx         # Charts and analytics
│   │   ├── settings.tsx        # All configuration tabs
│   │   └── data-manager.tsx    # Export / import / reset data
│   └── ui/                 # shadcn/ui primitives (button, card, dialog, …)
│
├── lib/
│   ├── data.ts             # Types: MenuItem, Order, Table, etc. + seed data
│   ├── store.ts            # Zustand store (auth, cart, orders, tables, menu)
│   └── utils.ts            # cn() helper
│
├── hooks/
│   ├── use-mobile.ts
│   └── use-toast.ts
│
├── styles/
│   └── globals.css
│
├── public/
│   └── logo.png
│
├── cafe_pos_blueprint.md   # Full product spec
├── remaining_work.md       # Gap analysis — 47 items tracked
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
- **Seed data is in `lib/data.ts`** — menu items, initial tables, default staff.
- **Settings are currently not persisted** — they use component-level `useState`. Fix by adding them to the Zustand store.
- **Reports use mock data** — `hourlyRevenue`, `paymentBreakdown`, `topItems` are static arrays in `reports.tsx`. Replace with computed values from `store.orders`.
- **`splitTable` is a stub** — `console.log` only. Needs full implementation.
- **Print buttons are no-ops** — implement via `window.print()` or ESC/POS when backend is ready.
- Keep components focused; avoid putting business logic in JSX — extract to store actions or utility functions.
- Always check `remaining_work.md` before starting a new feature to avoid duplicate effort.
