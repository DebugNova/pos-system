# Supabase Free Plan Audit — SUHASHI POS

> **Date:** 2026-04-13  
> **Project:** `suhashi-pos` (`ycrwtvtdsbjbhdqyuptq`)  
> **Region:** `ap-south-1` (Mumbai)  
> **Current DB size:** 12 MB / 500 MB  
> **Target usage:** 1 Admin + 1 Kitchen + 1 Manager (24/7 single-cafe deployment)

---

## Free Plan Limits (Reference)

| Resource                    | Free Limit             | Your Usage Status  |
|-----------------------------|------------------------|--------------------|
| Database storage            | 500 MB                 | ✅ 12 MB (~2%)     |
| File storage                | 1 GB                   | ✅ Minimal         |
| Storage bandwidth           | 2 GB / month           | ⚠️ Needs attention |
| Database bandwidth          | Unlimited (fair-use)   | ✅ Fine for now    |
| Realtime concurrent conns   | 200                    | ✅ Max ~3 devices  |
| Realtime messages           | 2 million / month      | ⚠️ **CRITICAL**    |
| Edge Function invocations   | 500,000 / month        | ⚠️ Needs attention |
| Edge Function execution time| 1,000 hours / month    | ✅ Fine            |
| Auth MAUs                   | 50,000                 | ✅ ~4 users        |
| API requests                | Unlimited (fair-use)   | ⚠️ Needs attention |

---

## 🔴 CRITICAL Issues (Must Fix)

### 1. Realtime: 8 Tables Published — Message Explosion Risk

**Problem:** All 8 tables (`orders`, `order_items`, `supplementary_bills`, `supplementary_bill_items`, `tables`, `settings`, `staff`, `modifiers`) are published to Supabase Realtime AND subscribed to in `use-realtime-sync.ts`. The free plan allows **2 million Realtime messages/month**.

**Why this is dangerous:** Every single INSERT/UPDATE/DELETE on ANY of these 8 tables generates a Realtime event sent to EVERY connected client. With 3 clients open 24/7:

- A busy café doing ~100 orders/day with ~3 items each generates:
  - ~100 order inserts + ~100 updates (status changes) + ~100 payment updates = ~300 order events
  - ~300 order_item inserts = ~300 events
  - ~100 table updates = ~100 events
  - ~300+ audit_log inserts (audit is NOT published, which is ✅ good)
  - ~3 settings/staff events = negligible
  - **= ~700 events/day × 3 clients = ~2,100 messages/day**
  - **= ~63,000 messages/month** — well within 2M limit

**Verdict:** ✅ **Actually fine for your use case.** 3 clients, ~100 orders/day is comfortably within 2M messages. However, read the note below about the `refetchAndMergeOrder` pattern doubling traffic.

### 2. Realtime Refetch Cascade — Every Event Triggers a Full API Query

**Problem:** In `use-realtime-sync.ts`, the `handleOrderChange` and `handleOrderItemChange` handlers call `refetchAndMergeOrder()` which does a **full `fetchOrderById()` query** (joining `orders` + `order_items` + `supplementary_bills` + `supplementary_bill_items`). This means:

- Every Realtime event on `orders` → 1 API call to refetch the full order
- Every Realtime event on `order_items` → 1 more API call to refetch the same order
- Every Realtime event on `supplementary_bills` → 1 more API call
- **A single order creation triggers ~3-4 Realtime events → 3-4 refetch queries**

**Impact per day (~100 orders):**
- ~700 Realtime events × 3 clients = ~2,100 refetches/day
- But debouncing (400ms) helps collapse some of these
- Realistic: ~1,000 refetch queries/day × 3 clients = ~3,000 API calls/day from Realtime alone

**Fix needed:** The 400ms debounce already helps, but we should also:
- **Avoid refetching for `order_items` when the parent `orders` event will already trigger a refetch**
- **Use the Realtime payload directly** for simple field updates (status changes) instead of refetching

**Severity:** 🟡 Medium — you have headroom, but this is wasteful bandwidth.

### 3. Hydrate Storm — Full Re-hydrate Every 5 Minutes

**Problem:** In `hydrate.ts`, `startBackgroundSync()` calls `hydrateStoreFromSupabase()` every 5 minutes, which fetches **ALL data from ALL 6 tables simultaneously**:

```typescript
const [orders, tables, menuItems, staffMembers, settings, modifiers] = await Promise.all([
  fetchOrders(500),  // ← fetches up to 500 orders with all items + supplementary bills
  fetchTables(),
  fetchMenuItems(),
  fetchStaff(),
  fetchSettings(),
  fetchModifiers(),
]);
```

**Impact:**
- Every 5 minutes × 3 clients = **864 full re-hydrations/day**
- `fetchOrders(500)` is the heavy one — it does a full join across 4 tables for up to 500 orders
- Over a month: **~26,000 full re-hydrations**

**Fix needed:**
- ✅ The Realtime subscription already gives you live updates. **The 5-minute full re-hydrate is redundant.**
- Change to re-hydrate only on visibility change (already done) and remove the 5-minute timer.
- Or extend the interval from 5 minutes to 30 minutes as a safety net.

**Severity:** 🔴 High — needless bandwidth drain, easy fix.

### 4. `fetchOrders(500)` on Every Hydration — Over-fetching Orders

**Problem:** Every hydration call fetches up to 500 orders with their items and supplementary bills. For a café doing ~100 orders/day, after 5 days you're fetching 500 orders with all associated data.

**Fix needed:**
- Only fetch **active orders** (status NOT IN `completed`, `cancelled`) during hydration
- Completed/cancelled orders are already persisted in localStorage and only needed for reports
- For reports, fetch on-demand using the existing `v_daily_sales` view (already implemented)

**Severity:** 🔴 High — fetching 500 orders every 5 minutes is the single biggest bandwidth drain.

---

## 🟡 MODERATE Issues (Should Fix)

### 5. Dual Write Pattern — Sync Queue + Direct Write = Double Writes

**Problem:** Every mutation goes through BOTH:
1. `enqueueMutation()` → queued for background sync (30-second cycle)
2. Direct write-through to Supabase (immediate)

When both succeed, the sync queue replay writes the **same data again** to Supabase. The dedup logic in `sync.ts` helps for `order.update` mutations, but `order.create`, `audit.append`, `shift.start`, `table.update`, etc. are NOT deduped.

**Impact:**
- ~700 mutations/day (from normal operations)
- ~50-70% are eventually written TWICE (once direct, once via sync queue)
- The `23505` unique violation handler catches duplicate inserts, but each failed attempt still counts as an API request

**Fix needed:**
- When the direct write succeeds, immediately mark the queued mutation as synced
- Add dedup for ALL mutation kinds, not just `order.update`

**Severity:** 🟡 Medium — wastes API calls but doesn't cause data issues.

### 6. Menu Image Storage & Bandwidth

**Problem:** The `menu-images` storage bucket is public with a 5MB file limit. Images are loaded via `<img src={item.image_url}>` with `loading="lazy"`.

**Good things you're already doing:**
- ✅ `loading="lazy"` — images only load when scrolled into view
- ✅ Service worker has `CacheFirst` strategy for menu images (30-day cache, 200 max entries)
- ✅ `cacheControl: "3600"` on upload (1 hour browser cache)

**Problems:**
- ⚠️ `cacheControl: "3600"` (1 hour) is too short — menu images rarely change. Switch to `86400` (1 day) or `604800` (1 week) or even `31536000` (1 year with cache-busting via filename)
- ⚠️ Images are uploaded as-is with no compression/resizing. A 5MB DSLR photo would eat bandwidth fast
- ⚠️ Storage bandwidth limit is only **2 GB/month** on free plan

**Fix needed:**
- Increase `cacheControl` to `"31536000"` (1 year) — append hash to filename for cache-busting
- Add client-side image compression before upload (resize to max 800px width, convert to WebP, target <200KB)
- Consider using Supabase image transformations (available on free plan via CDN)

**Severity:** 🟡 Medium — could hit 2GB storage bandwidth if many menu items with large images.

### 7. Audit Log Unbounded Growth

**Problem:** The `audit_log` table has 50 entries after just 1 day of testing. In production:
- Every login/logout, order creation, status change, payment, edit, etc. creates an audit entry
- ~100 orders/day × ~5 audit entries per order = ~500 entries/day
- In 6 months: ~90,000 entries

**Impact:**
- The audit log is synced to Supabase via `audit.append` mutations (fine)
- But it's included in the Zustand `partialize` — meaning it persists to localStorage
- localStorage has a ~5-10MB limit — 90,000 audit entries could approach this

**Fix needed:**
- Add automatic cleanup: keep only last 30 days of audit entries in Supabase
- In localStorage, keep only last 7 days (or last 500 entries)
- Create a PostgreSQL function to auto-purge old audit entries (pg_cron or trigger)

**Severity:** 🟡 Medium — won't hit database limits but will bloat localStorage.

### 8. `syncQueue` Persisted Unbounded in localStorage

**Problem:** The sync queue is persisted in `partialize` and only cleaned up by `clearSyncedMutations()` which keeps synced mutations for **7 days**. With ~700 mutations/day, that's ~4,900 synced mutations sitting in localStorage.

**Fix needed:**
- Reduce retention from 7 days to 1 day (or immediately remove synced mutations)
- The `clearSyncedMutations()` is only called on page load (`useEffect` in `page.tsx`) — add it to the sync loop too.

**Severity:** 🟡 Medium — localStorage bloat, not a Supabase issue.

---

## 🟢 FINE — Things Already Working Well

### 9. ✅ IndexedDB Background Sync
Well-implemented offline queue with service worker background sync. Mutations survive page closes.

### 10. ✅ Database Indexing
Good indexes on all commonly queried columns:
- `idx_orders_created_at`, `idx_orders_status`, `idx_order_items_order_id`
- `idx_audit_log_created_at`, `idx_staff_pin`
- Primary keys on all tables

### 11. ✅ RLS Policies
All tables have proper RLS enabled with role-based policies. Only `authenticated` users can access data.

### 12. ✅ PostgreSQL Views for Reports
Server-side analytics views (`v_daily_sales`, `v_hourly_revenue`, etc.) compute aggregations in the database instead of fetching raw data to the client. Very efficient.

### 13. ✅ Session Management
Using `sessionStorage` for auth state — sessions don't persist across browser restarts. Good for a shared-device POS.

### 14. ✅ Own-Write Detection
The `recentOwnWritesRef` pattern prevents Realtime feedback loops effectively.

### 15. ✅ Debounced Realtime Refetch
The 400ms debounce in `refetchAndMergeOrder` collapses rapid-fire events.

### 16. ✅ Edge Function Invocations
`pin-auth` is only called on login (~3-5 times/day). `aggregator-webhook` is passive. Well within the 500K/month limit.

---

## ⚠️ Performance Issues (Supabase Advisors)

### 17. RLS `auth.jwt()` Not Wrapped in `(select ...)`

**Problem:** 12 RLS policies across `menu_items`, `modifiers`, `settings`, `staff`, and `tables` use `auth.jwt()` directly instead of `(select auth.jwt())`. This causes the JWT to be re-evaluated **for each row** during queries.

**Affected policies:**
- `menu_items`: Owner can insert/update/delete
- `modifiers`: Owner can insert/update/delete
- `settings`: Owner can update
- `staff`: Owner can insert/update/delete
- `tables`: Owner can insert/delete

**Fix:** Wrap `auth.jwt()` in `(select ...)`:
```sql
-- BEFORE (slow):
((auth.jwt() -> 'app_metadata'::text) ->> 'user_role'::text) = 'Owner'::text

-- AFTER (fast — evaluated once):
(((select auth.jwt()) -> 'app_metadata'::text) ->> 'user_role'::text) = 'Owner'::text
```

**Severity:** 🟡 Medium — minor performance gain, but best practice.

### 18. `v_item_details` View — SECURITY DEFINER Risk

**Problem:** The `v_item_details` view is defined with `SECURITY DEFINER`, meaning it runs with the creator's permissions, bypassing RLS. Not a bandwidth issue but a security concern.

**Fix:** Recreate the view with `SECURITY INVOKER`.

**Severity:** 🟡 Medium — security, not bandwidth.

### 19. `supplementary_bill_items` UPDATE Policy — Wrong Role

**Problem:** The UPDATE policy on `supplementary_bill_items` is assigned to `{public}` role instead of `{authenticated}`. This means unauthenticated users could potentially update supplementary bill items.

**Fix:** Change the policy role to `authenticated`.

**Severity:** 🟡 Medium — security issue.

### 20. `pin-auth` Edge Function — `listUsers()` on Every Login

**Problem:** The edge function calls `supabase.auth.admin.listUsers()` on every login to check if the auth user exists. This fetches ALL users from the `auth.users` table. As Auth users grow, this becomes a bottleneck.

**Fix:** Use `supabase.auth.admin.getUserByEmail(email)` instead of listing all users and filtering.

**Severity:** 🟡 Medium — performance, not bandwidth quota.

---

## 📋 Prioritized Fix List

| Priority | Issue | Fix | Effort |
|----------|-------|-----|--------|
| 🔴 1 | 5-minute full re-hydrate | Remove or extend to 30 min | 5 min |
| 🔴 2 | `fetchOrders(500)` over-fetching | Only fetch active orders during hydrate | 15 min |
| 🔴 3 | Menu image cache too short | Change `cacheControl` to `"31536000"` | 2 min |
| 🟡 4 | Dual write → mark synced after direct write | Add synced marking logic | 30 min |
| 🟡 5 | Realtime refetch cascade | Skip `order_items` refetch if `orders` event handled | 20 min |
| 🟡 6 | Image upload — no compression | Add client-side resize/compress before upload | 45 min |
| 🟡 7 | Audit log unbounded growth | Add 30-day auto-purge | 20 min |
| 🟡 8 | Sync queue 7-day retention | Reduce to 1 day + clean in sync loop | 10 min |
| 🟡 9 | RLS `auth.jwt()` not wrapped | Migration: wrap in `(select ...)` | 15 min |
| 🟡 10 | `v_item_details` SECURITY DEFINER | Recreate as INVOKER | 5 min |
| 🟡 11 | `supplementary_bill_items` public UPDATE | Change policy to authenticated | 5 min |
| 🟡 12 | `pin-auth` listUsers() | Use getUserByEmail() | 10 min |

---

## 📊 Estimated Monthly Usage After Fixes

| Resource | Before Fixes | After Fixes | Free Limit |
|----------|-------------|-------------|------------|
| API Requests/month | ~150,000 | ~30,000 | Unlimited (fair-use) |
| Realtime Messages/month | ~63,000 | ~63,000 | 2,000,000 |
| Edge Function calls | ~150 | ~150 | 500,000 |
| Database storage | 12 MB (growing) | 12 MB (controlled) | 500 MB |
| File storage bandwidth | Varies | Minimal (after caching) | 2 GB |

---

## ✅ Verdict

**Your POS system will work fine on the free plan** for a single café with 1-3 concurrent terminals and ~100 orders/day. The architecture is sound — offline-first with sync queue, Realtime for cross-device updates, and server-side views for reports.

**The main things you MUST fix** are:
1. The 5-minute full re-hydrate timer (biggest unnecessary drain)
2. Over-fetching 500 orders during hydration (should only fetch active orders)
3. The menu image cache duration (trivial change, big bandwidth savings)

Everything else is optimization gravy — nice to have but won't break you on the free plan with your expected usage.
