# SUHASHI Cafe POS — Full System Audit

> Generated: 2026-04-09 | Stack: Next.js + TypeScript + Zustand + Tailwind + shadcn/ui

---

## What Is This?

SUHASHI Cafe POS is a **touch-first Point of Sale system** designed for a cafe, primarily targeting iPad. It handles:

- **Dine-in & takeaway ordering** with category browsing, search, and cart
- **Table management** — visual table map with merge, move, and status tracking
- **Kitchen Display (KDS)** — FIFO-sorted order queue with urgency alerts
- **Billing & payments** — cash/UPI/card with discount support
- **Aggregator orders** — Swiggy & Zomato inbox
- **Reports & analytics** — sales, order volume, item performance
- **Role-based access** — Admin, Cashier, Server, Kitchen roles with permission gates
- **Settings & configuration** — cafe profile, tax, printers, staff, integrations

**Current state:** Frontend prototype. All data lives in browser localStorage via Zustand. No backend, no database, no real payment or printer integrations.

---

## What's FULLY Working

| Module | Status | Details |
|--------|--------|---------|
| **Login & Auth** | 100% | PIN-based staff login, shift start dialog, persists across reloads |
| **RBAC** | 100% | 4 roles (Admin/Cashier/Server/Kitchen), view + action-level gates |
| **Sidebar Navigation** | 100% | Role-filtered views, active highlighting, aggregator badge, logout |
| **Dashboard** | 100% | Live stats from real orders — today's sales, active tables, pending orders, kitchen queue, aggregator counts |
| **New Order** | 95% | Category browse, search, cart management, variants, notes, order types. Only missing: modifiers UI |
| **Table Management** | 100% | Table status tracking, assign to orders, merge tables, move orders between tables, capacity display |
| **Kitchen Display** | 100% | 3-column kanban (New/Preparing/Ready), FIFO sorting, urgency color coding (<5m green, 5-10m amber, >10m red with pulse), filters by order type, aggregator badges |
| **Order History** | 100% | Search by ID/customer, filter by status and order type, detail modal, time elapsed |
| **Data Manager** | 100% | Export/import JSON, CRUD for orders/menu/tables/staff, search and filter |
| **Zustand Store** | 90% | Cart, orders, tables, menu, staff — all CRUD working with localStorage persistence |

---

## What's PARTIALLY Working

### Billing & Payment (60%)
- **Working:** Order selection, discount input (% or fixed), multi-payment method tabs (Cash/UPI/Card/Split), cash quick-amount buttons, change calculation, bill summary with tax, payment complete screen
- **Broken/Missing:**
  - UPI QR is a **static icon placeholder** — no actual QR code generation, no `upi://pay?...` deep-link
  - Print Receipt button is **non-functional** (no print logic at all)
  - `handleRefund()` is a **no-op** — just closes the dialog
  - **Payment method is NOT saved to the order** — order flips to "completed" but there's no record of how it was paid
  - Tax rate is **hardcoded to 5%** in billing.tsx, disconnected from settings
  - Split payment amounts not validated against total

### Reports (50%)
- **Working:** Total revenue and order count computed from real orders
- **Broken:**
  - Hourly revenue chart uses **hardcoded mock data**
  - Payment breakdown pie chart is **fake**
  - Top items table is **fake**
  - Hardcoded values added to real totals (e.g., `totalRevenue + 28500`)
  - No date range filtering
  - No staff performance metrics

### Settings (40%)
- **Working:** UI renders all tabs (General, Notifications, Printers, Staff, Integrations)
- **Broken:**
  - **Nothing persists** — ALL settings use local `useState`, reset on page reload
  - Staff list is **hardcoded**, not connected to the actual store
  - Printer list is **hardcoded** (Epson TM-T82II, TM-U220 shown as "Connected" — completely fake)
  - Swiggy shows "Connected", Zomato shows "Not Connected" — **hardcoded status**
  - Tax rate slider exists but is **disconnected** from billing calculation
  - "Add Printer", "Add Staff", "Add Integration" buttons are **non-functional**

### Aggregator Inbox (70%)
- **Working:** Platform tabs (All/Swiggy/Zomato), status tracking, accept/reject, kanban columns, platform badges
- **Missing:** No real API integration, "Refresh" button is UI-only, no webhook support

---

## What's COMPLETELY Missing

### Critical Missing Features

| Feature | Impact | Details |
|---------|--------|---------|
| **Payment Recording** | CRITICAL | Orders don't store payment method, amount, or transaction ID. Cannot generate payment reports. No `Payment` data model exists. |
| **Audit Logging** | CRITICAL | No log of refunds, voids, discounts, or any user actions. No compliance trail. |
| **Settings Persistence** | HIGH | Cafe name, GST number, tax rate, notifications, printers — none saved to store |
| **Split Bill** | HIGH | `splitTable()` in store is a `console.log()` stub. No UI for item selection or bill splitting. |
| **Modifiers / Add-ons** | HIGH | Data array defined in new-order.tsx but never rendered. No UI for toppings, spice levels, extra shots. |
| **UPI QR Generation** | HIGH | Static QR icon placeholder. Need real QR with `upi://pay?pa=...&am=...` |
| **Receipt Printing** | HIGH | Print buttons exist everywhere but do nothing. No template, no ESC/POS, no browser Print API. |
| **Refund Processing** | HIGH | Dialog exists but handler is empty. No refund amount tracking, no reversal logic. |

### Infrastructure Missing

| Feature | Details |
|---------|---------|
| **Backend / API** | No Node.js server, no Express/Fastify, no API routes |
| **Database** | No PostgreSQL, no schema, no migrations. Everything is localStorage. |
| **Authentication** | No JWT/sessions, no password hashing. PIN stored in plain text. |
| **Real-time Sync** | No WebSockets. Multi-device/multi-terminal is impossible. |
| **Offline Mode** | No service worker, no background sync, no offline queue |
| **PWA** | No manifest.json, no service worker. Can't install on iPad. |

### Business Logic Missing

| Feature | Details |
|---------|---------|
| **Customer Profiles** | `customerName` is just a free-text string. No customer DB, no saved addresses, no order history per customer. |
| **Staff Attribution** | Orders don't record who created them. No staff performance metrics possible. |
| **Shift Management** | Login has "Start Shift" but no clock-out, no shift summary, no closing cash reconciliation. |
| **Partial Payments** | Order is either fully unpaid or fully paid. No open balance tracking. |
| **Order-Level Item Status** | Entire order has one status. Can't track individual items as "preparing" vs "ready". |
| **Time-Based Pricing** | No happy hour, no time-based specials |
| **Combos / Deals** | No combo entity, no grouped item pricing |
| **Favorites / Quick Access** | No user-level favorites, no recent items panel |
| **Session Timeout** | User stays logged in forever via localStorage. No auto-lock. |
| **Multi-Branch** | Single location only. No branch entity or cross-branch analytics. |

---

## Code Quality Issues

| Issue | Location | Fix |
|-------|----------|-----|
| Tax rate hardcoded to 5% | `billing.tsx:63` | Read from store/settings |
| `console.log` in production | `store.ts:392` | Remove or implement splitTable |
| `alert()` for errors | `data-manager.tsx:144` | Use toast notification |
| Mock data mixed with real | `reports.tsx:31-57`, `reports.tsx:90` | Compute all from actual orders |
| Hardcoded staff list | `settings.tsx:308-313` | Use store staff data |
| Fake printer list | `settings.tsx:213-263` | Remove or implement discovery |
| Fake integration status | `settings.tsx:411-442` | Remove or implement real check |
| No error boundaries | Entire app | Add React error boundaries |
| No confirmation for destructive actions | Delete order, clear data, refund | Add AlertDialog confirmations |

---

## Completeness Scorecard

| Category | Score | Notes |
|----------|-------|-------|
| Core Ordering | 95% | Just needs modifiers |
| Kitchen Management | 100% | Fully working with FIFO + urgency |
| Table Management | 100% | Merge, move, status all working |
| Authentication & RBAC | 100% | PIN login + 4 roles + permission gates |
| Billing UI | 80% | UI complete, logic incomplete |
| Payment Processing | 20% | No payment recording, no QR, no print |
| Reports | 30% | Mostly mock data |
| Settings | 20% | Renders but nothing persists |
| Aggregator Integration | 40% | UI only, no real API |
| Backend / Database | 0% | Doesn't exist |
| Offline / PWA | 0% | Doesn't exist |
| Audit & Compliance | 0% | Doesn't exist |
| **Overall** | **~45%** | **Frontend prototype, not production-ready** |

---

## Recommended Roadmap

### Phase 1 — Make the Frontend Fully Functional (No Backend Needed)

These can all be done with just the Zustand store and client-side code:

1. **Persist settings to Zustand store** — cafe name, GST, tax rate, notifications
2. **Connect tax rate from settings to billing** — remove hardcoded 5%
3. **Add Payment data model** — record method, amount, transaction ID on each order
4. **Implement refund logic** — record refund, update order, create audit entry
5. **Generate real UPI QR codes** — use `qrcode.react` library with `upi://pay?...` links
6. **Implement receipt printing** — browser `window.print()` with a formatted receipt template
7. **Build modifiers UI** — add-on selection dialog in new-order, save to cart items
8. **Implement split bill** — UI to select items, create separate orders, split payment
9. **Fix reports** — compute ALL charts from actual order data, add date range filter
10. **Connect staff management in settings to store** — use existing store CRUD actions
11. **Add staff attribution** — save `createdBy` on orders, enable staff performance reports
12. **Add audit log** — log refunds, voids, discounts, and login/logout events
13. **Add shift tracking** — clock-in/clock-out, opening/closing cash, shift summary
14. **Add session timeout** — auto-lock after configurable idle period
15. **Add confirmation dialogs** — for all destructive actions (delete, refund, clear data)

### Phase 2 — PWA & Offline

16. **Create manifest.json** — app name, icons, theme color, display: standalone
17. **Add service worker** — cache static assets, enable iPad "Add to Home Screen" install
18. **Build offline queue** — queue orders when offline, sync when back online

### Phase 3 — Backend & Real Integrations

19. **Build Node.js + PostgreSQL backend** — API routes, JWT auth, data persistence
20. **Add WebSocket support** — real-time sync across multiple terminals
21. **Integrate Swiggy/Zomato APIs** — real order ingestion via webhooks
22. **Implement ESC/POS printing** — thermal printer support via USB or network
23. **Customer profiles** — save customer data, order history, preferences
24. **Multi-branch support** — branch entity, branch-level data isolation

### Phase 4 — Polish & Scale

25. **Advanced reporting** — trend analysis, forecasting, export to CSV/PDF
26. **Time-based pricing** — happy hour, scheduled specials
27. **Combos & deals** — grouped items with combo pricing
28. **Inventory tracking** — stock levels, low-stock alerts, wastage tracking
29. **Loyalty program** — points, rewards, customer tiers
30. **Multi-language support** — Hindi, regional languages

---

## Key Files Reference

| File | Lines | Purpose |
|------|-------|---------|
| `lib/store.ts` | ~499 | Zustand store — all app state and actions |
| `lib/data.ts` | ~93 | TypeScript types + seed data |
| `lib/roles.ts` | ~160 | RBAC config — roles, permissions, view access |
| `components/pos/billing.tsx` | — | Payment UI (stubs at lines 63, 86-88, 369-378) |
| `components/pos/settings.tsx` | — | Settings UI (no persistence, lines 30-32) |
| `components/pos/reports.tsx` | — | Reports (mock data at lines 31-57) |
| `components/pos/new-order.tsx` | — | Order creation (unused modifiers at lines 55-61) |
| `app/page.tsx` | ~52 | App entry + view routing |

---

*This audit covers the full codebase as of 2026-04-09. Use this as your master checklist for making SUHASHI POS production-ready.*
