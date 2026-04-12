# Advanced Reports & Analytics — Plan

> A complete blueprint for turning the current Reports screen into a full-fledged analytics suite for SUHASHI Cafe POS.
> Target user: **Owner / Admin** — needs deep operational, financial, and staff insight at a glance, plus the ability to drill down.

---

## 1. Current State (Baseline)

The existing Reports screen ([components/pos/reports.tsx](../components/pos/reports.tsx)) shows:

- Total Revenue, Total Orders, Avg Order Value, Avg Prep Time (4 KPI cards)
- Hourly Revenue line chart
- Payment Methods pie chart
- Top Selling Items bar chart (top 5)
- Staff Performance bar chart
- Date range picker (from–to)
- Data comes from SQL views (`v_daily_sales`, `v_hourly_revenue`, `v_payment_breakdown`, `v_top_items`, `v_staff_performance`) with local fallback

**What's missing:** granularity, time comparisons, item-level drill-down, staff drill-down, tax/discount/refund breakdown, table analytics, aggregator analytics, inventory/COGS, customer insights, exports, and presets like Today / Week / Month / Year.

---

## 2. Goals

1. **One-click presets** — Today, Yesterday, This Week, Last Week, This Month, Last Month, This Quarter, This Year, Custom.
2. **Compare vs previous period** — every KPI shows delta % vs the equivalent prior period.
3. **Drill-down everywhere** — click a bar/row to open a details modal.
4. **Export everything** — CSV + PDF for any table or chart.
5. **Offline-safe** — all reports must have a local fallback (already the pattern).
6. **Fast** — use SQL views + materialised snapshots where possible; never block the UI.

---

## 3. Proposed Screen Layout

Replace the single scroll page with a **tabbed layout**:

```
Reports & Analytics
├── Overview          (KPIs + trends — the current screen, upgraded)
├── Sales             (revenue deep dive)
├── Items             (menu performance)
├── Staff             (performance + attendance + tips)
├── Tables            (table utilisation)
├── Payments          (method mix, settlements, refunds)
├── Aggregators       (Swiggy / Zomato)
├── Customers         (if customer capture is added)
├── Inventory & COGS  (optional — requires stock module)
└── Audit & Activity  (voids, discounts, refunds, logins)
```

Top bar (always visible on every tab):
- **Preset chips:** Today · Yesterday · 7D · 30D · MTD · QTD · YTD · Custom
- **Date range picker** (already exists)
- **Compare toggle** (vs previous period / vs same period last week / off)
- **Export button** (CSV / PDF / Excel)
- **Live badge** (already exists — keep it)

---

## 4. Tab-by-Tab — What to Add

### 4.1 Overview Tab

**KPI cards (with delta % vs previous period):**

| KPI | Formula / Source |
|---|---|
| Total Revenue | `SUM(total)` of completed orders |
| Net Revenue | Revenue − refunds − discounts |
| Total Orders | `COUNT(*)` completed |
| Avg Order Value (AOV) | Revenue / Orders |
| Avg Prep Time | Avg of `readyAt − paidAt` |
| Avg Table Turn Time | Avg of `completedAt − occupiedAt` |
| Gross Profit (if COGS) | Revenue − COGS |
| Tax Collected | `SUM(taxAmount)` |
| Discount Given | `SUM(discountAmount)` |
| Refunds | `SUM(refundedAmount)` |
| Void Count | Orders cancelled post-payment |
| Dine-in vs Takeaway vs Aggregator | 3-way split % |

**Charts:**
- **Revenue trend** — line chart, auto-granularity (hour for 1 day, day for ≤31 days, week for ≤90 days, month beyond)
- **Orders vs Revenue** — dual-axis
- **Heatmap** — day-of-week × hour-of-day (shows peak hours)
- **Top 5 items** (mini, link to Items tab)
- **Top 5 staff** (mini, link to Staff tab)

---

### 4.2 Sales Tab

- Daily / Weekly / Monthly revenue table with columns: Date, Orders, Gross, Discount, Tax, Net, AOV
- Revenue by **order type** (Dine-in / Takeaway / Swiggy / Zomato)
- Revenue by **category** (Coffee, Tea, Food, Desserts…)
- Revenue by **hour** (true heatmap)
- Revenue by **weekday** (Mon–Sun bar)
- **Running total** line (cumulative revenue for the period)
- **Peak hour** & **slowest hour** callouts
- Pareto chart: "80% of revenue comes from X% of orders"

---

### 4.3 Items Tab — this is the one you specifically asked about

**Master table (sortable, searchable, paginated):**

| Item | Category | Qty Sold | Gross Revenue | Discounts | Net Revenue | % of Total Revenue | Avg Price | Times in Order | Attach Rate | Trend (7d sparkline) |
|---|---|---|---|---|---|---|---|---|---|---|

Where:
- **Attach rate** = % of orders that contained this item
- **Trend** = last 7 days mini sparkline

**Extras:**
- **Top 10 & Bottom 10** toggles
- **Never sold in period** list (dead stock alert)
- **Category roll-up** — collapse/expand by category
- **Modifier performance** — which add-ons (extra shot, oat milk…) are attached most
- **Combo analysis** — "customers who bought X also bought Y" (market basket, simple co-occurrence)
- **Hourly pattern per item** — when does Espresso sell most?
- **Price elasticity hint** — if a price was changed, show before/after volume
- **Profit per item** (requires cost price in menu — add a `cost_price` column)

**Drill-down:** clicking an item opens a modal with:
- Full time-series (day-by-day qty and revenue)
- Which staff sold it most
- Which tables ordered it most
- Modifier mix
- All orders containing it (link to Order History)

---

### 4.4 Staff Tab

**Per-staff table:**

| Staff | Role | Shifts | Hours Worked | Orders Taken | Orders Served | Revenue Generated | AOV | Items Sold | Tips | Voids | Discounts Applied | Avg Service Time |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

**Charts:**
- Revenue per staff (bar)
- Orders per staff per day (stacked)
- **Shift timeline** — Gantt-style view of who worked when (pulls from `shifts` table)
- **Leaderboard** — top seller of the week/month
- **Cashier discrepancy** — opening cash vs closing cash vs expected (from shift close)

**Drill-down:** click a staff member → full profile:
- Personal trend (revenue, orders, hours)
- Items they sell most
- Time-of-day performance
- Audit log entries they triggered (refunds, voids, discounts)

---

### 4.5 Tables Tab

- **Utilisation %** per table (occupied time / available time)
- **Avg turn time** per table
- **Revenue per table** & **revenue per seat per hour** (RevPASH — the real hospitality KPI)
- **Peak occupancy** time-of-day
- **Most-merged/split** tables (operational friction indicator)
- Table heatmap on the floor plan (color = revenue)

---

### 4.6 Payments Tab

- Method mix (Cash / UPI / Card / Split) — already partially exists, expand it
- **Cash reconciliation** — expected cash vs counted cash per shift
- **UPI settlement log** — transaction IDs, amounts, timestamps
- **Card settlement log** — same
- **Failed/voided payments** count
- **Refunds** list with reason + who approved
- **Split bill stats** — how often bills get split, avg split count

---

### 4.7 Aggregators Tab

- Swiggy vs Zomato revenue split
- Commission estimate (configurable %)
- Net payout estimate per platform
- Avg prep time for aggregator orders (SLA compliance)
- Rejected/cancelled aggregator orders
- Top items ordered via each platform
- Peak hours per platform

---

### 4.8 Customers Tab *(requires phone/name capture on order — future)*

- Unique customers, repeat rate
- New vs returning split
- Top customers by spend
- Avg visits per customer
- Lifetime value (LTV)
- Last-visit list (re-engagement targets)

---

### 4.9 Inventory & COGS Tab *(future — needs stock module)*

- Stock on hand vs stock sold
- COGS per item
- Gross margin per item
- Wastage log
- Low-stock alerts
- Supplier spend

---

### 4.10 Audit & Activity Tab

Pull from existing `audit_log` table:

- Voids (who, when, which order, reason)
- Refunds (who approved, amount, reason)
- Discounts (who applied, %, reason)
- Price overrides
- Login/logout events
- Failed PIN attempts (security)
- Settings changes (who changed tax %, etc.)

Filterable by actor, action type, date range.

---

## 5. New KPIs Worth Tracking

| KPI | Why it matters |
|---|---|
| **RevPASH** (Revenue per Available Seat Hour) | The gold standard for restaurant efficiency |
| **Table turn time** | Directly drives capacity |
| **Order cycle time** (place → served) | Customer experience |
| **Kitchen throughput** (items/hour) | Bottleneck detection |
| **First-item prep time** | How fast does kitchen start? |
| **Void rate %** | Operational/training issue indicator |
| **Discount rate %** | Margin leak indicator |
| **Aggregator share %** | Channel dependency risk |
| **Modifier attach rate** | Upsell effectiveness |
| **Avg items per order** | Basket size |

---

## 6. Filters (global)

Every tab should support:

- Date range (with presets + compare)
- Order type (Dine-in / Takeaway / Swiggy / Zomato / All)
- Payment method
- Staff
- Category
- Table
- Status (completed / refunded / voided)

Filters should be **URL-persisted** so a report view is shareable/bookmarkable.

---

## 7. Exports & Reporting

- **CSV export** for every table
- **PDF export** for the whole tab (branded with cafe logo from settings)
- **Excel export** for the master items/staff tables
- **Email report** (daily/weekly) — Edge Function cron → send to owner email
- **Scheduled snapshots** — store a JSON snapshot of end-of-day metrics in a new `daily_snapshots` table for fast historical queries

---

## 8. Data Layer — SQL Views to Add

Current views: `v_daily_sales`, `v_hourly_revenue`, `v_payment_breakdown`, `v_top_items`, `v_staff_performance`.

**Add:**

| View | Purpose |
|---|---|
| `v_weekly_sales` | Week-aggregated revenue/orders |
| `v_monthly_sales` | Month-aggregated |
| `v_category_sales` | Revenue grouped by menu category |
| `v_item_details` | Per-item qty, revenue, attach rate, discounts |
| `v_modifier_performance` | Modifier attach counts & revenue |
| `v_table_utilisation` | Table turn time + revenue per table |
| `v_order_type_mix` | Dine-in/Takeaway/Aggregator split |
| `v_aggregator_performance` | Swiggy/Zomato revenue, prep time, rejections |
| `v_staff_shifts` | Shift hours + revenue during shift |
| `v_refund_summary` | Refunds by reason/staff |
| `v_discount_summary` | Discounts by type/staff |
| `v_hourly_heatmap` | Day-of-week × hour matrix |
| `v_daily_snapshot` | One row per day of all KPIs (for fast trends) |

**Schema changes to consider:**
- Add `cost_price` to `menu_items` (for COGS/margin)
- Add `category` + `subcategory` to `menu_items` if not already indexed
- Add `customer_phone`, `customer_name` to `orders` (optional capture)
- Add `tip_amount` to `orders`
- Add `refund_reason`, `void_reason` to `audit_log` (likely already there — verify)
- Add `opening_cash`, `closing_cash`, `expected_cash` to `shifts` (if not already)

---

## 9. Frontend Work

1. **Split** [components/pos/reports.tsx](../components/pos/reports.tsx) into a `reports/` folder:
   ```
   components/pos/reports/
   ├── index.tsx              (tab container + global filters)
   ├── overview-tab.tsx
   ├── sales-tab.tsx
   ├── items-tab.tsx
   ├── staff-tab.tsx
   ├── tables-tab.tsx
   ├── payments-tab.tsx
   ├── aggregators-tab.tsx
   ├── audit-tab.tsx
   ├── shared/
   │   ├── kpi-card.tsx       (with delta %)
   │   ├── preset-chips.tsx
   │   ├── compare-toggle.tsx
   │   ├── export-menu.tsx
   │   ├── drill-down-modal.tsx
   │   └── sparkline.tsx
   ```
2. Add query functions in [lib/supabase-queries.ts](../lib/supabase-queries.ts) for each new view.
3. Add a `useReportData(range, filters)` hook that handles server/local fallback + loading state uniformly.
4. Use **recharts** for everything chart-based (already in stack). Add a **heatmap** via a custom SVG component or `@nivo/heatmap` if bundle size allows.
5. **TanStack Table** for the big sortable/paginated tables (items, staff, audit) — or keep it lean with a small custom table.
6. **PDF export** via `jspdf` + `jspdf-autotable`.
7. **CSV export** via a tiny helper (no dep needed).

---

## 10. Performance Considerations

- Reports must not block the UI — wrap fetches in `Suspense` or keep the current `serverLoading` pattern.
- Cache results per (range, filters) key in a `Map` for the session.
- For ranges > 90 days, query `v_daily_snapshot` instead of raw orders.
- Debounce date-range changes (300ms) before firing queries.
- Preload **Today** on tab mount.
- All number crunching uses SQL, not JS — the local fallback is a backup only.

---

## 11. Offline Behaviour

- When offline, show a banner: "Offline — showing locally cached data. Some metrics (staff hours, aggregator commission) may be incomplete."
- All local fallbacks compute from the Zustand `orders` array (current pattern).
- Disable export-to-PDF/Excel when offline if libraries aren't in the service-worker cache — or precache them.

---

## 12. Permissions (RBAC)

Update [lib/roles.ts](../lib/roles.ts):

| Tab | Admin | Cashier | Server | Kitchen |
|---|---|---|---|---|
| Overview | ✅ | ✅ (summary only) | ❌ | ❌ |
| Sales | ✅ | ❌ | ❌ | ❌ |
| Items | ✅ | view | ❌ | ❌ |
| Staff | ✅ | ❌ | self only | ❌ |
| Tables | ✅ | ✅ | ✅ | ❌ |
| Payments | ✅ | ✅ | ❌ | ❌ |
| Aggregators | ✅ | ✅ | ❌ | ❌ |
| Audit | ✅ | ❌ | ❌ | ❌ |

---

## 13. Implementation Phases

**Phase A — Quick wins (1–2 days)**
- Add preset chips (Today / 7D / 30D / MTD / YTD)
- Add delta % vs previous period on existing KPI cards
- Add CSV export for current charts
- Add Items tab with the master table (you specifically asked for this)

**Phase B — Deeper insight (3–5 days)**
- Split into tabbed layout
- Add Sales, Staff, Tables, Payments tabs
- Add new SQL views
- Add drill-down modals
- Add revenue trend with auto-granularity + heatmap

**Phase C — Polish & automation (ongoing)**
- PDF export with branding
- Scheduled daily email report (Edge Function cron)
- Aggregators tab with commission model
- Audit tab
- Customer tab (after phone capture is added)
- Inventory/COGS (after stock module exists)

---

## 14. Nice-to-Have Ideas

- **Goal setting** — owner sets monthly revenue target; dashboard shows progress bar.
- **Anomaly alerts** — "Today's revenue is 40% below the 30-day average by 3pm" — push via toast.
- **Forecast** — simple 7-day forecast based on trailing average + weekday seasonality.
- **What-if sliders** — "If I raise Cappuccino by ₹10, projected impact: +₹X/month".
- **Weather correlation** — overlay weather on the revenue trend (fun; via open-meteo).
- **Festival/holiday markers** on the trend line.
- **Dark-mode-friendly print stylesheet** for receipts-as-reports.
- **"Share snapshot"** — generate a PNG of the overview tab for WhatsApp.
- **Voice summary** — "Hey, what were today's sales?" → TTS read-out (optional).

---

## 15. Summary — What the Owner Will See

After all of this, opening Reports gives you:

1. A **one-glance dashboard** showing how today/week/month is going vs last period.
2. A **per-item table** showing qty sold, revenue, discounts, attach rate, and a trend sparkline for every single item on the menu.
3. A **per-staff table** showing hours worked, orders, revenue, AOV, tips, voids — plus a shift Gantt.
4. **Drill-downs** on every row so you can see the story behind the number.
5. **Exports** to CSV / PDF / Excel for accounting or sharing.
6. **Automated daily email** so you don't even have to open the app to know how the day went.
7. Everything works **offline**, syncs when online, and respects **RBAC**.

This turns Reports from a basic stats page into the **actual command centre** for running the cafe.
