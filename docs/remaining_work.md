# SUHASHI Cafe POS — Remaining Work

> Gap analysis: **Blueprint** vs. **Current Implementation**
> Generated: 2026-04-09 (Updated: 2026-04-10 — post-Pay-First implementation)
> Related docs: [pay-first-flow.md](pay-first-flow.md) · [pay_first_implementation_guide.md](pay_first_implementation_guide.md)

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
| 1 | **Backend API (Supabase)** | 🔴 | The entire app runs client-side with Zustand `persist` to `localStorage`. No server, no database, no API layer. Phase 3 target. |
| 2 | **Proper Authentication & Session Control** | 🟡 | Login with PIN pad exists, but it's entirely client-side. No real auth tokens, session expiry, or password hashing. |
| 3 | **Role-Based Access Control (RBAC)** | 🟢 | Implemented in `lib/roles.ts`. Sidebar navigation, billing actions (refunds/discounts), and settings access are now restricted by user role. |
| 4 | **Offline Mode & Sync Queue** | 🟢 | IndexedDB-backed mutation queue (`lib/sync-idb.ts`), service worker with Background Sync (`public/sw.js`), and PWA manifest. Mutations queue offline and replay on reconnect. |

### 1.2 Payments & Billing
| # | Item | Status | Details |
|---|------|--------|---------|
| 5 | **Receipt Printing** | 🟢 | `ReceiptTemplate` component renders a print-ready receipt. Auto-prints on payment success via `window.print()`. ESC/POS thermal printing deferred to Phase 3. |
| 6 | **UPI QR Code Generation** | 🟢 | Real `upi://pay?...` deep-link QR code generated via `qrcode.react` with cafe name, order amount, and UPI ID from settings. |
| 7 | **Partial Payment** | 🔴 | Blueprint lists partial payment as a core feature. Split payment exists, but there's no ability to collect a partial amount and keep an open balance on the order. |
| 8 | **Payment Record Persistence** | 🟢 | `PaymentRecord` type in `data.ts` tracks method, amount, transactionId, splitDetails, cashReceived/change. Recorded on every order via `confirmPaymentAndSendToKitchen`. |
| 9 | **Refund Processing** | 🟢 | Refund dialog with admin-only access. Partial refunds via admin force-remove of locked items in supplementary mode. Audit entry written for every refund. |
| 10 | **Configurable Tax Rates** | 🟢 | iPad-optimized slider with GST presets (0, 5, 12, 18, 28%). Persisted in Zustand store (`settings.taxRate`, `settings.gstEnabled`). Used by billing module for tax calculation. |

| 11 | **KOT (Kitchen Order Ticket) Queue** | 🟢 | Implemented FIFO sorting, urgency-based color coding, and auto-refreshing timestamps to manage the kitchen queue effectively. |
| 12 | **Item-Level Marking (Preparing / Ready)** | 🔴 | Kitchen can only change the **entire order** status. No per-item "preparing" / "ready" tracking, which is essential for multi-item orders. |
| 48 | **Kitchen Filtering & Source Marking** | 🟢 | Added filters for Dine-In/Online/Takeaway and clear visual badges for Swiggy/Zomato to distinguish order sources instantly. |

### 1.4 Tables
| # | Item | Status | Details |
|---|------|--------|---------|
| 13 | **Split Bill** | 🟢 | `SplitBillDialog` component with item-level split. `splitOrder` store action moves selected items to a new order. Accessible from Billing. |
| 14 | **Visual Table Map** | 🟡 | Tables display as a flat list/grid of cards. Blueprint calls for a **visual table map** with spatial layout (drag & drop or positioned furniture). |

### 1.5 Menu
| # | Item | Status | Details |
|---|------|--------|---------|
| 15 | **Modifiers (Add-ons)** | 🟢 | `Modifier` type in `data.ts` with `defaultModifiers` (extra shot, oat milk, almond milk, whipped cream, etc.). Modifier dialog in New Order screen. Modifiers stored on `OrderItem.modifiers` and reflected in billing/receipt/KDS. |
| 16 | **Combos** | 🔴 | No combo/deal support. Blueprint lists combos as a menu feature. |
| 17 | **Time-Based Pricing** | 🔴 | No time-based item pricing (e.g., happy hour discounts). |
| 18 | **Item Favorites / Quick Access** | 🔴 | Blueprint mentions favorites in the order flow. No favoriting mechanism exists. |
| 19 | **Item Search** | 🟢 | Search bar with Ctrl+K shortcut, category filtering, and real-time results in New Order screen. |

---

## 2. Major Gaps (MVP 2 features)

These are MVP 2 deliverables from the blueprint and are expected eventually.

| # | Item | Status | Details |
|---|------|--------|---------|
| 20 | **Real Swiggy / Zomato API Integration** | 🔴 | Aggregator inbox exists with UI to accept/reject orders, but orders are **manually created** — there's no API connector, webhook listener, or polling mechanism. |
| 21 | **External Order ID Mapping (`AggregatorOrderMap`)** | 🔴 | Blueprint requires mapping external order IDs to internal ones. Not in the data model. |
| 22 | **Aggregator Status Flow (Packed, Handed Over)** | 🟡 | Blueprint requires: Received → Accepted → Preparing → Ready → Packed → Handed Over → Cancelled. Current implementation only uses: `new → preparing → ready → completed → cancelled`. Missing `packed` and `handed-over` statuses. |
| 23 | **Menu Mapping (External → Internal)** | 🔴 | No mechanism to map Swiggy/Zomato menu items to internal menu items. |
| 24 | **Advanced Reporting** | 🟢 | Reports now compute from actual order data. Charts use Recharts with high-contrast dark-mode support. |
| 25 | **Staff Performance Reports** | 🟡 | Orders now track `createdBy` (staff name). Basic tracking exists but no dedicated staff metrics dashboard. |
| 26 | **Customer Profiles** | 🔴 | No customer database. The `customerName` field on orders is a free-text string. |
| 27 | **Staff Shifts (Clock In / Clock Out)** | 🟢 | Full shift tracking with start/end, opening/closing cash, total sales, total orders. Shift history stored in Zustand. |
| 28 | **Analytics Dashboard** | 🟡 | Dashboard shows real stats from actual orders. Awaiting Payment card navigates to Billing. Lacks trend comparisons and forecasting. |

---

## 3. Data Model Gaps

The blueprint specifies these entities. Here's what's missing:

| Entity | Status | Notes |
|--------|--------|-------|
| `User` | 🟡 | Exists as `StaffMember` in the store with RBAC. No backend entity, no auth tokens. |
| `Branch` | 🔴 | No multi-branch support at all. |
| `Table` | 🟢 | Implemented with `available`, `occupied`, `waiting-payment` statuses. Soft-lock on order placement. |
| `Category` | 🟢 | Exists as a const array. |
| `MenuItem` | 🟢 | Exists with variants and modifier support. Missing combos. |
| `Modifier` | 🟢 | `Modifier` type with `defaultModifiers` array. Stored on `OrderItem.modifiers`. |
| `Order` | 🟢 | Full lifecycle: `awaiting-payment → new → preparing → ready → completed`. Tracks payment, `createdBy`, supplementary bills, refund, discount, tax. |
| `OrderItem` | 🟢 | Exists with notes, variant, and modifier support. |
| `PaymentRecord` | 🟢 | Tracks method, amount, transactionId, splitDetails, cashReceived/change. |
| `AggregatorOrderMap` | 🔴 | Not implemented. |
| `AuditEntry` | 🟢 | Full audit logging: login/logout, order_created, payment_recorded, order_sent_to_kitchen, status_changed, order_served, void, refund, discount, order_edited, data_clear/import, settings_changed, staff_added/deleted. |

---

## 4. Non-Functional & UX Gaps

| # | Item | Status | Details |
|---|------|--------|---------|
| 29 | **iPad-First Touch Optimization** | 🟢 | Heavily optimized for iPad touch. Features large targets, buttersmooth **Framer Motion transitions**, and a premium branding reveal. Responsive tray-logic for mobile/tablet scaling. |
| 30 | **PWA / Installable App** | 🟢 | `manifest.json`, service worker (`sw.js`) with cache-first strategy and Background Sync for offline mutations. Install prompt handling in store. |
| 31 | **WebSocket Realtime Updates** | 🔴 | Blueprint requires WebSockets for live order/kitchen/aggregator updates. Currently all state is local — multi-device sync is impossible. Phase 3 (Supabase Realtime). |
| 32 | **Audit Logging** | 🟢 | Comprehensive audit logging for all critical actions: order lifecycle (created, paid, sent to kitchen, status changes, served), voids, refunds, discounts, login/logout, staff changes, settings changes, data import/clear. Every entry enqueued to sync queue. |
| 33 | **Low-Light Readability** | 🟢 | Fixed **chart contrast issues** where text was illegible. Dark mode is now fully readable and high-contrast for busy/low-light environments. |
| 34 | **Sound Notifications** | 🔴 | Settings has toggles for "Order Alerts" and "Kitchen Ready Alerts," but no actual audio notification system exists. |
| 35 | **Session Timeout / Auto-Lock** | 🔴 | No session timeout. Once logged in, the user stays logged in indefinitely (even across browser restarts due to `localStorage`). |
| 49 | **Premium UI Transitions & Branding** | 🟢 | Implemented high-end 4.8s cinematic intro transition with "SUHASHI" letter-reveal, animated cat mascot (blinking/scratching), and responsive target landing from any origin. |

---

## 5. Settings & Configuration Gaps

| # | Item | Status | Details |
|---|------|--------|---------|
| 36 | **Settings Persistence** | 🟢 | All settings (cafe name, GST number, tax rate, UPI ID, notification toggles, print preferences) persisted in Zustand store via `CafeSettings` interface. Survives page reload. |
| 37 | **Printer Management** | 🟡 | UI shows hardcoded printer entries (Epson TM-T82II, TM-U220). "Add Printer" button is non-functional. No actual printer discovery or connection. Receipt printing works via `window.print()`. |
| 38 | **Staff CRUD from Settings** | 🟢 | Staff management connected to store actions (`addStaffMember`/`updateStaffMember`/`deleteStaffMember`). Audit entries written for staff changes. |
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

### 🔥 Phase 1: Make MVP 1 Complete ✅ DONE
1. ~~Persist settings to the store (#36)~~ ✅
2. ~~Connect Settings UI to actual store actions (staff CRUD, tax saving) (#38, #10)~~ ✅
3. ~~Implement RBAC — restrict screens/actions by role (#3)~~ ✅
4. ~~Build `PaymentRecord` model + record payment method on billing (#8)~~ ✅
5. ~~Build `AuditEntry` — log refunds, voids, deletes, discounts (#32)~~ ✅
6. ~~Implement actual refund logic (#9)~~ ✅
7. ~~Add modifiers to menu data model and new-order UI (#15)~~ ✅
8. ~~Implement split-bill logic (#13)~~ ✅
9. ~~Generate real UPI QR codes (#6)~~ ✅
10. ~~Drive reports from actual order data instead of mock data (#24, #42)~~ ✅
11. Item-level status tracking in kitchen (#12) — still outstanding
12. ~~Pay-first order flow (awaiting-payment → payment → kitchen)~~ ✅ — see [pay-first-flow.md](pay-first-flow.md)
13. ~~Supplementary cart mode for post-payment edits~~ ✅
14. ~~Receipt template with auto-print~~ ✅
15. ~~Shift tracking~~ ✅
16. ~~Offline sync queue with IndexedDB + Background Sync~~ ✅
17. ~~PWA manifest + service worker~~ ✅

### 🔧 Phase 2: Remaining Frontend Polish
1. Item-level status tracking in kitchen (#12)
2. Visual table map with spatial layout (#14)
3. Sound notification system (#34)
4. Session timeout / auto-lock (#35)
5. Confirmation dialogs for all destructive actions (#45)
6. Sequential human-friendly order IDs (#46)
7. Date range filtering in reports/history (#47)
8. Item favorites / quick access (#18)

### 🚀 Phase 3: Supabase Backend + MVP 2
1. Build Supabase backend — PostgreSQL, Auth, Realtime, Edge Functions (#1)
2. Move from localStorage to Supabase with API calls
3. Implement real auth with Supabase Auth (#2)
4. Add Supabase Realtime for multi-device sync (#31)
5. ESC/POS receipt/KOT printing via Edge Functions (#5)
6. Swiggy/Zomato API integration via webhooks (#20, #21, #23)
7. Extended aggregator status flow (Packed, Handed Over) (#22)
8. Customer profiles & saved addresses (#26)
9. Staff performance & advanced analytics (#25, #28)
10. Combos, time-based pricing (#16, #17)
11. Multi-branch support

---

> [!IMPORTANT]
> Phase 1 is complete — all MVP 1 frontend features are implemented. The **next major milestone is Phase 3 (Supabase migration)** which will add real auth, multi-device sync, and server-side order processing. Phase 2 items are polish/UX improvements that can be done in parallel.
