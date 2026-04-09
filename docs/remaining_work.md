# SUHASHI Cafe POS — Remaining Work

> Gap analysis: **Blueprint** vs. **Current Implementation**
> Generated: 2026-04-09 (Updated after Premium Brand Intro Animation)

---

## Status Legend

| Icon | Meaning |
|------|---------|
| 🔴 | **Missing** — Not implemented at all |
| 🟡 | **Partial / Stub** — UI exists but core logic is incomplete |
| 🟢 | **Done** — Fully functional |

---

## 1. Critical Missing Features (MVP 1 gaps)

These are items the blueprint marks as **MVP 1** deliverables that are either missing or only stubbed.

### 1.1 Backend & Database
| # | Item | Status | Details |
|---|------|--------|---------|
| 1 | **Backend API (Node.js + PostgreSQL)** | 🔴 | The entire app runs client-side with Zustand `persist` to `localStorage`. There is no server, no database, and no API layer. |
| 2 | **Proper Authentication & Session Control** | 🟡 | Login with PIN pad exists, but it's entirely client-side. No real auth tokens, session expiry, or password hashing. |
| 3 | **Role-Based Access Control (RBAC)** | 🟢 | Implemented in `lib/roles.ts`. Sidebar navigation, billing actions (refunds/discounts), and settings access are now restricted by user role. |
| 4 | **Offline Mode & Sync Queue** | 🔴 | Blueprint requires offline-first with a local queue + auto-sync. Current app uses `localStorage` persistence but has **no offline queue, no sync mechanism, and no service worker / PWA setup**. |

### 1.2 Payments & Billing
| # | Item | Status | Details |
|---|------|--------|---------|
| 5 | **Actual Receipt Printing** | 🟡 | "Print Receipt" and "Print Bill" buttons exist but are **no-op**. No thermal printer integration (ESC/POS commands, WebUSB, or print API). |
| 6 | **UPI QR Code Generation** | 🟡 | UPI payment screen shows a static `<QrCode>` icon placeholder. No actual QR code generated with UPI deep-link (`upi://pay?...`). |
| 7 | **Partial Payment** | 🔴 | Blueprint lists partial payment as a core feature. Split payment exists, but there's no ability to collect a partial amount and keep an open balance on the order. |
| 8 | **Payment Record Persistence** | 🔴 | No `Payment` data model. When an order is "paid," the status just flips to `completed`. No record of *how* it was paid (method, amount, transaction ID). |
| 9 | **Refund Processing** | 🟡 | Refund dialog exists and access is restricted to Admin role, but `handleRefund` is still a no-op logic-wise. |
| 10 | **Configurable Tax Rates** | 🟡 | Revamped UI with a professional **iPad-optimized slider** and **GST presets** (0, 5, 12, 18, 28%). However, still uses **local `useState`** — the value is not yet saved to the store or used by the billing module. |

| 11 | **KOT (Kitchen Order Ticket) Queue** | 🟢 | Implemented FIFO sorting, urgency-based color coding, and auto-refreshing timestamps to manage the kitchen queue effectively. |
| 12 | **Item-Level Marking (Preparing / Ready)** | 🔴 | Kitchen can only change the **entire order** status. No per-item "preparing" / "ready" tracking, which is essential for multi-item orders. |
| 48 | **Kitchen Filtering & Source Marking** | 🟢 | Added filters for Dine-In/Online/Takeaway and clear visual badges for Swiggy/Zomato to distinguish order sources instantly. |

### 1.4 Tables
| # | Item | Status | Details |
|---|------|--------|---------|
| 13 | **Split Table / Split Bill** | 🟡 | `splitTable` in the store is a stub: `console.log("Split table:", tableId)`. No UI or logic to split items across bills. |
| 14 | **Visual Table Map** | 🟡 | Tables display as a flat list/grid of cards. Blueprint calls for a **visual table map** with spatial layout (drag & drop or positioned furniture). |

### 1.5 Menu
| # | Item | Status | Details |
|---|------|--------|---------|
| 15 | **Modifiers (Toppings, Spice Level, etc.)** | 🔴 | Data model has no `Modifier` entity. The `MenuItem` type supports `variants` (e.g., Single/Double espresso), but there are no **modifiers** (add-ons like toppings, extra shot, spice level). |
| 16 | **Combos** | 🔴 | No combo/deal support. Blueprint lists combos as a menu feature. |
| 17 | **Time-Based Pricing** | 🔴 | No time-based item pricing (e.g., happy hour discounts). |
| 18 | **Item Favorites / Quick Access** | 🔴 | Blueprint mentions favorites in the order flow. No favoriting mechanism exists. |
| 19 | **Item Search** | 🟡 | New-order screen has a search bar, but the blueprint emphasizes "quick search" as a first-class citizen. Need to verify this works well for large menus. |

---

## 2. Major Gaps (MVP 2 features)

These are MVP 2 deliverables from the blueprint and are expected eventually.

| # | Item | Status | Details |
|---|------|--------|---------|
| 20 | **Real Swiggy / Zomato API Integration** | 🔴 | Aggregator inbox exists with UI to accept/reject orders, but orders are **manually created** — there's no API connector, webhook listener, or polling mechanism. |
| 21 | **External Order ID Mapping (`AggregatorOrderMap`)** | 🔴 | Blueprint requires mapping external order IDs to internal ones. Not in the data model. |
| 22 | **Aggregator Status Flow (Packed, Handed Over)** | 🟡 | Blueprint requires: Received → Accepted → Preparing → Ready → Packed → Handed Over → Cancelled. Current implementation only uses: `new → preparing → ready → completed → cancelled`. Missing `packed` and `handed-over` statuses. |
| 23 | **Menu Mapping (External → Internal)** | 🔴 | No mechanism to map Swiggy/Zomato menu items to internal menu items. |
| 24 | **Advanced Reporting** | 🟡 | Reports page is rendered in the main flow. Fixed **visual contrast** and legibility for charts/tooltips, but still uses **hardcoded mock data**. |
| 25 | **Staff Performance Reports** | 🔴 | No staff-linked metrics. Orders don't track which staff member created them. |
| 26 | **Customer Profiles** | 🔴 | No customer database. The `customerName` field on orders is a free-text string. |
| 27 | **Staff Shifts (Clock In / Clock Out)** | 🟡 | Login screen has a "Start Shift" flow with **premium animated transition**, but **no backend shift tracking**: no clock-out, no shift summary, no closing cash reconciliation. |
| 28 | **Analytics Dashboard** | 🟡 | Dashboard shows basic stats from actual orders, but lacks aggregate analytics, trend comparisons, and forecasting the blueprint envisions. |

---

## 3. Data Model Gaps

The blueprint specifies these entities. Here's what's missing:

| Entity | Status | Notes |
|--------|--------|-------|
| `User` | 🟡 | Exists as `StaffMember` in the store, but no backend entity, no auth tokens. |
| `Branch` | 🔴 | No multi-branch support at all. |
| `Table` | 🟢 | Implemented in store & data model. |
| `Category` | 🟢 | Exists as a const array. |
| `MenuItem` | 🟢 | Exists with variants. Missing modifiers/combos. |
| `Modifier` | 🔴 | Not in the data model. |
| `Order` | 🟢 | Exists. Missing payment method tracking and staff assignment. |
| `OrderItem` | 🟢 | Exists with notes and variant support. |
| `Payment` | 🔴 | No payment entity. Payment info is not recorded. |
| `AggregatorOrderMap` | 🔴 | Not implemented. |
| `AuditLog` | 🔴 | No audit logging for refunds, voids, discounts, or any critical action. |

---

## 4. Non-Functional & UX Gaps

| # | Item | Status | Details |
|---|------|--------|---------|
| 29 | **iPad-First Touch Optimization** | 🟢 | Heavily optimized for iPad touch. Features large targets, buttersmooth **Framer Motion transitions**, and a premium branding reveal. Responsive tray-logic for mobile/tablet scaling. |
| 30 | **PWA / Installable App** | 🔴 | No `manifest.json`, no service worker, no install prompt. Blueprint says it should work as a web app / PWA on iPad. |
| 31 | **WebSocket Realtime Updates** | 🔴 | Blueprint requires WebSockets for live order/kitchen/aggregator updates. Currently all state is local — multi-device sync is impossible. |
| 32 | **Audit Logging** | 🔴 | Critical actions (refunds, voids, discounts, order deletions) are not logged anywhere. |
| 33 | **Low-Light Readability** | 🟢 | Fixed **chart contrast issues** where text was illegible. Dark mode is now fully readable and high-contrast for busy/low-light environments. |
| 34 | **Sound Notifications** | 🔴 | Settings has toggles for "Order Alerts" and "Kitchen Ready Alerts," but no actual audio notification system exists. |
| 35 | **Session Timeout / Auto-Lock** | 🔴 | No session timeout. Once logged in, the user stays logged in indefinitely (even across browser restarts due to `localStorage`). |
| 49 | **Premium UI Transitions & Branding** | 🟢 | Implemented high-end 4.8s cinematic intro transition with "SUHASHI" letter-reveal, animated cat mascot (blinking/scratching), and responsive target landing from any origin. |

---

## 5. Settings & Configuration Gaps

| # | Item | Status | Details |
|---|------|--------|---------|
| 36 | **Settings Persistence** | 🔴 | All settings (cafe name, GST number, tax rate, printer config, notification toggles) use local `useState` and **reset on page reload**. They should persist to the store or backend. |
| 37 | **Printer Management** | 🟡 | UI shows hardcoded printer entries (Epson TM-T82II, TM-U220). "Add Printer" button is non-functional. No actual printer discovery or connection. |
| 38 | **Staff CRUD from Settings** | 🟡 | Settings page shows a hardcoded staff list separate from the store's `staffMembers`. "Add Staff" button is non-functional. The store has `addStaffMember`/`updateStaffMember`/`deleteStaffMember` but Settings UI doesn't use them. |
| 39 | **Integration Configuration** | 🟡 | Swiggy/Zomato shown as connected/not-connected badges. "Add Integration" button is non-functional. No way to input API keys, webhook URLs, etc. |
| 40 | **Device Settings** | 🔴 | Blueprint mentions device settings (screen brightness, display timeout, etc.). Not present. |

---

## 6. Code Quality & Architecture Improvements

| # | Item | Details |
|---|------|---------|
| 41 | **Hard-coded values everywhere** | Tax rate (5%), currency format, cafe name are scattered across components instead of being centralized config. |
| 42 | **Reports use mock data** | `hourlyRevenue`, `paymentBreakdown`, `topItems` are static const arrays, not computed from actual orders. |
| 43 | **No error boundaries** | App has no React error boundaries. A crash in any component takes down the entire POS. |
| 44 | **No loading states** | No skeleton loaders or spinners for async operations (useful once backend is integrated). |
| 45 | **No confirmation dialogs for destructive actions** | Deleting orders, clearing data, etc., should always confirm with the user. |
| 46 | **Order ID format** | Using `ord-{timestamp}` is not human-friendly. Should use sequential numbering like `#0001`, `#0002`, etc. |
| 47 | **No date range filtering in reports/history** | Order history and reports have no date picker or range selector. |

---

## Summary: Priority Roadmap

### 🔥 Phase 1: Make MVP 1 Complete (Highest Priority)
1. Persist settings to the store (#36)
2. Connect Settings UI to actual store actions (staff CRUD, tax saving) (#38, #10)
3. Implement RBAC — restrict screens/actions by role (#3) [DONE]
4. Build `Payment` model + record payment method on billing (#8)
5. Build `AuditLog` — log refunds, voids, deletes, discounts (#32)
6. Implement actual refund logic (#9)
7. Add modifiers to menu data model and new-order UI (#15)
8. Implement split-bill logic (#13)
9. Generate real UPI QR codes (#6)
10. Drive reports from actual order data instead of mock data (#24, #42)
11. Implement item-level status tracking in kitchen (#12)

### 🔧 Phase 2: Real Infrastructure
12. Build backend API (Node.js + PostgreSQL) (#1)
13. Move from localStorage to database with API calls
14. Implement real auth with JWT/sessions (#2)
15. Add WebSocket layer for multi-device real-time sync (#31)
16. Implement offline queue + sync mechanism (#4)
17. Set up PWA (manifest, service worker, install) (#30)
18. Add receipt/KOT printing via ESC/POS or browser Print API (#5, #11)

### 🚀 Phase 3: MVP 2 Features
19. Swiggy/Zomato API integration (webhooks / polling) (#20, #21, #23)
20. Extended aggregator status flow (Packed, Handed Over) (#22)
21. Customer profiles & saved addresses (#26)
22. Staff shift management (clock-in/out, closing cash) (#27)
23. Staff performance & advanced analytics (#25, #28)
24. Combos, time-based pricing, item favorites (#16, #17, #18)
25. Multi-branch support (#Branch entity)
26. Sound notification system (#34)
27. Session timeout / auto-lock (#35)

---

> [!IMPORTANT]
> The most impactful gap is **#1 — no backend**. Almost everything else (auth, RBAC, payments, audit logs, real-time sync, offline queue, aggregator integration) depends on having a proper server and database. Consider whether to build the backend next, or keep iterating on the frontend first and add the backend later.
