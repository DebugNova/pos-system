# SUHASHI Cafe POS — Remaining Work

> Gap analysis: **Blueprint** vs. **Current Implementation**
> Generated: 2026-04-09 (Updated: 2026-04-11 — post-Phase 3 Supabase backend complete)
> Related docs: [pay-first-flow.md](pay-first-flow.md) · [phase3_implementation_guide.md](phase3_implementation_guide.md)

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
| 1 | **Backend API (Supabase)** | 🟢 | Full Supabase backend: PostgreSQL (11 tables + 5 report views), RLS, Edge Functions (`pin-auth`, `aggregator-webhook`), Realtime, Storage. Project: `ycrwtvtdsbjbhdqyuptq` (ap-south-1). |
| 2 | **Proper Authentication & Session Control** | 🟢 | PIN-based auth via `pin-auth` Edge Function. Returns Supabase JWT with `user_role` claim. Session persists across reloads via Supabase client. |
| 3 | **Role-Based Access Control (RBAC)** | 🟢 | Implemented in `lib/roles.ts`. RLS policies enforce `user_role` from JWT claims. |
| 4 | **Offline Mode & Sync Queue** | 🟢 | IndexedDB-backed mutation queue (`lib/sync-idb.ts`), service worker with Background Sync, Zustand persistence as offline cache. Mutations queue offline and replay on reconnect via `lib/sync.ts`. |

### 1.2 Payments & Billing
| # | Item | Status | Details |
|---|------|--------|---------|
| 5 | **Receipt Printing** | 🟢 | `ReceiptTemplate` component + `window.print()`. ESC/POS thermal printing deferred to Phase 4. |
| 6 | **UPI QR Code Generation** | 🟢 | Real `upi://pay?...` deep-link QR code. |
| 7 | **Partial Payment** | 🔴 | Split payment exists, but no partial payment with open balance. |
| 8 | **Payment Record Persistence** | 🟢 | `PaymentRecord` type recorded on every order, synced to Supabase. |
| 9 | **Refund Processing** | 🟢 | Refund dialog with admin-only access. |
| 10 | **Configurable Tax Rates** | 🟢 | GST presets (0, 5, 12, 18, 28%). |

### 1.3 Kitchen
| 11 | **KOT Queue** | 🟢 | FIFO sorting, urgency-based color coding, Realtime audio/visual alerts for new orders. |
| 12 | **Item-Level Marking (Preparing / Ready)** | 🔴 | Kitchen can only change **entire order** status. No per-item tracking. |
| 48 | **Kitchen Filtering & Source Marking** | 🟢 | Filters for Dine-In/Online/Takeaway + Swiggy/Zomato badges. |

### 1.4 Tables
| # | Item | Status | Details |
|---|------|--------|---------|
| 13 | **Split Bill** | 🟢 | `SplitBillDialog` component. |
| 14 | **Visual Table Map** | 🟡 | Tables display as flat grid. No spatial drag-and-drop layout. |

### 1.5 Menu
| # | Item | Status | Details |
|---|------|--------|---------|
| 15 | **Modifiers (Add-ons)** | 🟢 | Full modifier support. |
| 16 | **Combos** | 🔴 | No combo/deal support. |
| 17 | **Time-Based Pricing** | 🔴 | No time-based item pricing. |
| 18 | **Item Favorites / Quick Access** | 🔴 | No favoriting. |
| 19 | **Item Search** | 🟢 | Search + Ctrl+K + category filtering. |

---

## 2. Major Gaps (MVP 2 features)

| # | Item | Status | Details |
|---|------|--------|---------|
| 20 | **Real Swiggy / Zomato API Integration** | 🟡 | `aggregator-webhook` Edge Function accepts orders via HTTP POST. No direct Swiggy/Zomato API polling — requires their merchant portal integration. |
| 21 | **External Order ID Mapping** | 🟢 | `externalId` field in webhook payload maps to `payment.transactionId`. |
| 22 | **Aggregator Status Flow (Packed, Handed Over)** | 🟡 | Missing `packed` and `handed-over` statuses. |
| 23 | **Menu Mapping (External → Internal)** | 🔴 | No external menu item mapping. |
| 24 | **Advanced Reporting** | 🟢 | Server-side SQL views + Recharts. |
| 25 | **Staff Performance Reports** | 🟢 | `v_staff_performance` view tracks orders/revenue per staff. |
| 26 | **Customer Profiles** | 🔴 | No customer database. |
| 27 | **Staff Shifts** | 🟢 | Full shift tracking. |
| 28 | **Analytics Dashboard** | 🟡 | Real stats. Lacks trend comparisons. |

---

## 3. Data Model Gaps

| Entity | Status | Notes |
|--------|--------|-------|
| `User` / `Staff` | 🟢 | `staff` table in Supabase. PIN auth via Edge Function. |
| `Branch` | 🔴 | No multi-branch support. |
| `Table` | 🟢 | Full lifecycle with Realtime sync. |
| `Category` | 🟢 | Const array + extensible. |
| `MenuItem` | 🟢 | With variants, modifiers, image upload to Supabase Storage. |
| `Modifier` | 🟢 | `defaultModifiers` array. |
| `Order` | 🟢 | Full lifecycle synced to Supabase with Realtime. |
| `OrderItem` | 🟢 | With notes, variant, modifier support. |
| `PaymentRecord` | 🟢 | Tracked in Supabase. |
| `AuditEntry` | 🟢 | Full audit logging synced to Supabase. |

---

## 4. Non-Functional & UX Gaps

| # | Item | Status | Details |
|---|------|--------|---------|
| 29 | **iPad-First Touch Optimization** | 🟢 | Framer Motion transitions. |
| 30 | **PWA / Installable App** | 🟢 | Serwist service worker + manifest. |
| 31 | **WebSocket Realtime Updates** | 🟢 | Supabase Realtime subscriptions on all critical tables. Multi-terminal sync verified. |
| 32 | **Audit Logging** | 🟢 | Full audit trail synced to Supabase. |
| 33 | **Low-Light Readability** | 🟢 | High-contrast dark mode. |
| 34 | **Sound Notifications** | 🟢 | Two-tone bell audio via Web Audio API in KDS for new orders. |
| 35 | **Session Timeout / Auto-Lock** | 🔴 | No session timeout. |
| 49 | **Premium UI Transitions** | 🟢 | Cinematic intro animation. |

---

## 5. Settings & Configuration Gaps

| # | Item | Status | Details |
|---|------|--------|---------|
| 36 | **Settings Persistence** | 🟢 | Zustand store + Supabase sync. |
| 37 | **Printer Management** | 🟡 | UI exists, no actual printer discovery. Receipt via `window.print()`. |
| 38 | **Staff CRUD from Settings** | 🟢 | Connected to store + Supabase. |
| 39 | **Integration Configuration** | 🟡 | Badges shown, no config UI. |
| 40 | **Device Settings** | 🔴 | Not present. |

---

## Summary: Priority Roadmap

### ✅ Phase 1: MVP 1 Complete
All MVP 1 frontend features implemented.

### ✅ Phase 2: Frontend Polish (partial)
- Sound notifications ✅ (KDS alerts)
- Date range filtering in reports ✅ (SQL views)

### ✅ Phase 3: Supabase Backend — COMPLETE
All 18 tasks completed:
1. ~~Supabase project creation~~ ✅
2. ~~Database schema (11 tables)~~ ✅
3. ~~Seed default data~~ ✅
4. ~~Enable RLS on all tables~~ ✅
5. ~~PIN-auth Edge Function~~ ✅
6. ~~Install SDK + env config~~ ✅
7. ~~Rewire authentication~~ ✅
8. ~~Data layer (supabase-queries.ts)~~ ✅
9. ~~Sync queue → Supabase~~ ✅
10. ~~Initial data hydration~~ ✅
11. ~~Realtime subscriptions~~ ✅
12. ~~KDS Realtime alerts~~ ✅
13. ~~Aggregator webhook Edge Function~~ ✅
14. ~~Write-through store actions~~ ✅
15. ~~SQL report views~~ ✅
16. ~~Supabase Storage for menu images~~ ✅
17. ~~Generate TypeScript types~~ ✅
18. ~~Documentation updates~~ ✅

### 🔧 Phase 4: Future Work
1. Item-level status tracking in kitchen (#12)
2. Visual table map with spatial layout (#14)
3. Session timeout / auto-lock (#35)
4. ESC/POS thermal receipt printing
5. Direct Swiggy/Zomato API integration
6. Customer profiles & saved addresses (#26)
7. Combos, time-based pricing (#16, #17)
8. Multi-branch support
9. Customer QR table ordering (see Phase 3 guide §Future Extensibility)
10. Advanced analytics (trends, forecasting)

---

> [!IMPORTANT]
> **Phase 3 is complete.** The POS system is now a full-stack application with Supabase backend, multi-terminal Realtime sync, offline-first architecture, and server-side reporting. The **next milestone is Phase 4** — advanced features like QR ordering, inventory management, and multi-branch support.
