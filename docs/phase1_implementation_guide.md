# Phase 1 Implementation Guide — Make the Frontend Fully Functional

> For: AI Agent (Claude Code)
> Project: SUHASHI Cafe POS
> Date: 2026-04-09
> Scope: All 15 tasks are client-side only. No backend needed.
> Backend plan: Phase 3 will migrate to **Supabase** (PostgreSQL, Auth, Realtime, Edge Functions). Design data models in Phase 1 with Supabase migration in mind — use string UUIDs for IDs, ISO 8601 timestamps, and flat relational-friendly structures.

---

## Pre-Work Checklist

Before starting ANY task:
- [ ] Run `npm run build` to confirm the project compiles cleanly
- [ ] Read `lib/store.ts`, `lib/data.ts`, `lib/roles.ts` for current state shape
- [ ] All state goes through `usePOSStore()` — never create separate stores
- [ ] Preserve the existing dark theme / Tailwind / shadcn/ui styling conventions
- [ ] Bump `STORE_VERSION` in `lib/store.ts` when changing persisted state shape
- [ ] Update the `partialize` function in store when adding new persisted fields
- [ ] After EVERY task, run `npm run build` to verify no type errors or broken imports

---

## Task 1: Persist Settings to Zustand Store

**Goal:** Cafe name, GST number, address, tax rate, notification toggles — all saved to the Zustand store, surviving page reloads.

**Current state:**
- `components/pos/settings.tsx:30-32` uses local `useState` for `cafeName`, `gstNumber`, `taxRate`
- Notification switches use `defaultChecked` — no state at all
- NOTHING persists across reloads

**What to do:**

1. **Add a `settings` object to the store interface in `lib/store.ts`:**
   ```ts
   interface CafeSettings {
     cafeName: string;
     gstNumber: string;
     address: string;
     taxRate: number;          // stored as percentage (e.g. 5 means 5%)
     gstEnabled: boolean;
     upiId: string;            // for UPI QR generation later (Task 5)
     orderAlerts: boolean;
     kitchenReadyAlerts: boolean;
     autoPrintKot: boolean;
     printCustomerCopy: boolean;
     sessionTimeoutMinutes: number;  // for Task 14
   }
   ```

2. **Add default values:**
   ```ts
   const defaultSettings: CafeSettings = {
     cafeName: "SUHASHI Cafe",
     gstNumber: "27AABCT1234F1ZH",
     address: "",
     taxRate: 5,
     gstEnabled: true,
     upiId: "cafe@upi",
     orderAlerts: true,
     kitchenReadyAlerts: true,
     autoPrintKot: true,
     printCustomerCopy: true,
     sessionTimeoutMinutes: 30,
   };
   ```

3. **Add to POSState interface:**
   ```ts
   settings: CafeSettings;
   updateSettings: (settings: Partial<CafeSettings>) => void;
   ```

4. **Add to the store implementation:**
   ```ts
   settings: defaultSettings,
   updateSettings: (newSettings) => set((state) => ({
     settings: { ...state.settings, ...newSettings }
   })),
   ```

5. **Add `settings` to the `partialize` function** so it persists to localStorage.

6. **Bump STORE_VERSION** to 3.

7. **Update `components/pos/settings.tsx`:**
   - Remove all `useState` for settings values
   - Read from `usePOSStore().settings`
   - Write via `usePOSStore().updateSettings()`
   - Replace all `defaultChecked` on switches with `checked={settings.xxx}` and `onCheckedChange`
   - The address input currently has no state — connect it

8. **Also include `settings` in `exportData` and `importData` in the store.**

**Verification:**
- Change cafe name in settings → refresh page → name persists
- Change tax rate → refresh → rate persists
- Toggle all switches → refresh → toggles persist

---

## Task 2: Connect Tax Rate from Settings to Billing

**Goal:** Remove the hardcoded `0.05` tax rate in billing.tsx and new-order.tsx. Read it from the store settings.

**Current state:**
- `components/pos/billing.tsx:63` — `const taxRate = 0.05;` (hardcoded)
- `components/pos/billing.tsx:267` — displays "Tax (5% GST)" hardcoded string
- `components/pos/new-order.tsx:523` — `Tax (5%)` hardcoded
- `components/pos/new-order.tsx:528` — `getCartTotal() * 0.05` hardcoded
- `components/pos/new-order.tsx:538` — `getCartTotal() * 1.05` hardcoded

**What to do:**

1. **In `billing.tsx`:**
   - Import settings from store: `const { settings } = usePOSStore()`
   - Replace `const taxRate = 0.05` with `const taxRate = settings.gstEnabled ? settings.taxRate / 100 : 0`
   - Update the display string from "Tax (5% GST)" to dynamic: `Tax (${settings.taxRate}% GST)` or "Tax (disabled)" if GST is off

2. **In `new-order.tsx`:**
   - Import settings from store
   - Replace all hardcoded `0.05` and `1.05` with dynamic tax rate from settings
   - Update the "Tax (5%)" label to be dynamic

**Verification:**
- Change tax rate in settings to 18% → go to billing → verify tax calculates at 18%
- Disable GST in settings → verify tax shows 0
- Check new-order cart summary also reflects the updated rate

---

## Task 3: Add Payment Data Model

**Goal:** When an order is paid, record HOW it was paid (method, amount, transaction ID). Enable payment reports.

**Current state:**
- `lib/data.ts` — `Order` interface has no payment fields at all
- `components/pos/billing.tsx:70-73` — `handlePayment()` just sets `paymentComplete = true`
- `components/pos/billing.tsx:75-84` — `handleCompleteBilling()` just updates status to "completed" with no payment data
- No `Payment` type exists anywhere

**What to do:**

1. **Add payment types to `lib/data.ts`:**
   ```ts
   export type PaymentMethod = "cash" | "upi" | "card" | "split";

   export interface PaymentRecord {
     method: PaymentMethod;
     amount: number;
     transactionId?: string;
     // For split payments:
     splitDetails?: {
       cash: number;
       upi: number;
       card: number;
     };
   }
   ```

2. **Extend the `Order` interface in `lib/data.ts`:**
   ```ts
   export interface Order {
     // ... existing fields ...
     payment?: PaymentRecord;
     subtotal: number;        // item total before tax/discount
     discount?: {
       type: "percent" | "amount";
       value: number;
       amount: number;        // computed discount amount
     };
     taxRate: number;          // the GST rate applied (e.g. 5)
     taxAmount: number;        // computed tax
     grandTotal: number;       // final amount after discount + tax
     paidAt?: Date;
     paidBy?: string;          // staff member who processed payment
   }
   ```

3. **Update `handlePayment()` and `handleCompleteBilling()` in `billing.tsx`:**
   - Build a `PaymentRecord` object from the selected payment method, amounts, and split details
   - Call `updateOrder(orderId, { payment, subtotal, discount, taxRate, taxAmount, grandTotal, paidAt, paidBy })` when completing billing
   - For cash: include cashReceived and change in the record
   - For split: validate that splitAmounts total >= grandTotal before allowing payment
   - Generate a simple transaction ID: `txn-${Date.now()}`

4. **Update `addOrder` in `lib/store.ts`** to accept the new optional fields.

5. **Handle serialization in `onRehydrateStorage`** — convert `paidAt` date strings back to Date objects.

**Verification:**
- Complete a cash payment → check order in Order History → payment method should be recorded
- Complete a UPI payment → verify transaction ID is stored
- Complete a split payment → verify split breakdown is stored
- All amounts (subtotal, discount, tax, grandTotal) stored on the order

---

## Task 4: Implement Refund Logic

**Goal:** The refund button actually processes refunds — records the refund, updates the order, creates an audit entry (for Task 12).

**Current state:**
- `components/pos/billing.tsx:86-89` — `handleRefund()` is empty, just closes dialog

**What to do:**

1. **Add refund fields to `Order` in `lib/data.ts`:**
   ```ts
   export interface Order {
     // ... existing fields ...
     refund?: {
       amount: number;
       reason?: string;
       refundedAt: Date;
       refundedBy: string;
     };
   }
   ```

2. **Add a refund reason input to the refund dialog in `billing.tsx`:**
   - Add a textarea for reason
   - Allow partial refund (input for amount, defaulting to grandTotal)

3. **Implement `handleRefund()` in `billing.tsx`:**
   - Update the order with refund data via `updateOrder()`
   - Set order status to "cancelled" (or keep as "completed" with refund marker)
   - Free the table if it was dine-in
   - Add to audit log (connects to Task 12 — for now, at minimum store the refund on the order)
   - Show a toast notification confirming the refund

4. **Handle `refundedAt` date in `onRehydrateStorage`.**

**Verification:**
- Open a completed order → click Refund → enter reason → confirm
- Order should show refund details in Order History
- Table should be freed if dine-in

---

## Task 5: Generate Real UPI QR Codes

**Goal:** Replace the static QR icon placeholder with an actual scannable QR code using `upi://pay?...` deep-links.

**Current state:**
- `components/pos/billing.tsx:369-378` — shows a `<QrCode />` Lucide icon inside a white box. Not a real QR.

**What to do:**

1. **Install `qrcode.react`:**
   ```bash
   npm install qrcode.react
   ```

2. **Build a UPI deep-link string:**
   ```ts
   const upiLink = `upi://pay?pa=${settings.upiId}&pn=${encodeURIComponent(settings.cafeName)}&am=${grandTotal.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Order ${order.id}`)}`;
   ```

3. **Replace the placeholder in `billing.tsx`:**
   ```tsx
   import { QRCodeSVG } from "qrcode.react";

   {paymentMethod === "upi" && (
     <div className="mb-6 flex flex-col items-center gap-4">
       <div className="rounded-xl bg-white p-4">
         <QRCodeSVG value={upiLink} size={192} />
       </div>
       <p className="text-sm text-muted-foreground">
         Scan QR code or enter UPI ID: {settings.upiId}
       </p>
     </div>
   )}
   ```

4. **Add UPI ID to settings** (already part of Task 1's `CafeSettings`).

5. **Add UPI ID config field in settings.tsx** under the Payments tab — input for `upiId`.

**Verification:**
- Select UPI payment → verify a real QR code appears (not an icon)
- Scan the QR with any UPI app → verify the deep-link opens with correct payee, amount, and note
- Change UPI ID in settings → verify QR updates

---

## Task 6: Implement Receipt Printing

**Goal:** "Print Receipt" and "Print Bill" buttons actually print a formatted receipt using the browser's print API.

**Current state:**
- `components/pos/billing.tsx:169-171` — "Print Receipt" button, no onClick handler
- `components/pos/billing.tsx:467-469` — "Print Bill" button, no onClick handler
- Multiple other components have print buttons that do nothing

**What to do:**

1. **Create a receipt template component:** `components/pos/receipt-template.tsx`
   - Accepts an order (with payment data) as prop
   - Renders a print-optimized layout:
     - Cafe name, address, GST number (from settings)
     - Order ID, date/time, table number, order type
     - Itemized list with quantities, prices, variants
     - Subtotal, discount (if any), tax, grand total
     - Payment method and transaction ID
     - "Thank you for visiting!" footer
   - Style with `@media print` — hide non-receipt content, thermal-receipt width (80mm/302px)

2. **Create a `printReceipt(order, settings)` utility function in `lib/utils.ts`:**
   - Opens a new window or creates a hidden iframe
   - Renders the receipt HTML
   - Calls `window.print()` on it
   - Alternative: Use a hidden div approach with `@media print` CSS

3. **Wire up the buttons in `billing.tsx`:**
   - "Print Receipt" (after payment) → prints receipt with payment info
   - "Print Bill" (before payment) → prints bill without payment info (just items + total)

4. **Add print CSS to `globals.css`:**
   ```css
   @media print {
     body * { visibility: hidden; }
     .print-receipt, .print-receipt * { visibility: visible; }
     .print-receipt { position: absolute; left: 0; top: 0; width: 80mm; }
   }
   ```

**Verification:**
- Click "Print Bill" → browser print dialog opens with formatted bill
- Complete payment → click "Print Receipt" → receipt includes payment method
- Receipt shows cafe name, GST number from settings (not hardcoded)

---

## Task 7: Build Modifiers UI

**Goal:** Add-on selection (extra shot, oat milk, spice level, etc.) that affects item price and shows on the order.

**Current state:**
- `components/pos/new-order.tsx:55-61` — `modifiers` array is defined but only used as "Quick Options" text buttons that append to notes. No price impact.
- Modifiers are not part of the `OrderItem` data model

**What to do:**

1. **Add modifiers to the data model in `lib/data.ts`:**
   ```ts
   export interface Modifier {
     id: string;
     name: string;
     price: number;
   }

   export interface OrderItem {
     // ... existing fields ...
     modifiers?: Modifier[];    // selected modifiers for this item
   }
   ```

2. **Add default modifiers to `lib/data.ts` and to the store:**
   ```ts
   export const defaultModifiers: Modifier[] = [
     { id: "extra-shot", name: "Extra Shot", price: 30 },
     { id: "oat-milk", name: "Oat Milk", price: 40 },
     { id: "almond-milk", name: "Almond Milk", price: 40 },
     { id: "sugar-free", name: "Sugar Free", price: 0 },
     { id: "less-ice", name: "Less Ice", price: 0 },
     { id: "extra-hot", name: "Extra Hot", price: 0 },
     { id: "whipped-cream", name: "Whipped Cream", price: 20 },
   ];
   ```

3. **Update the modifier dialog in `new-order.tsx`:**
   - Replace the current "Quick Options" text-append behavior with actual toggleable modifier chips
   - Track selected modifiers in state: `const [selectedModifiers, setSelectedModifiers] = useState<Modifier[]>([])`
   - Each modifier chip is a toggle button — selected state highlighted
   - Show running total: `base price + modifier prices`
   - On "Add to Order": include `modifiers` array on the cart item
   - **Also show the modifier dialog for ALL items** (not just variants) — add a long-press or "customize" button

4. **Update `CartItem` in `lib/store.ts`** to include `modifiers`.

5. **Update cart price calculation** — item price should include modifier prices:
   ```ts
   const itemTotal = item.price + (item.modifiers?.reduce((sum, m) => sum + m.price, 0) || 0);
   ```

6. **Update `getCartTotal()`** to account for modifier prices.

7. **Display modifiers in the cart sidebar and on receipts.**

8. **Show modifiers in billing.tsx order items and in order-history.tsx.**

**Verification:**
- Add an item → select "Extra Shot" (+₹30) and "Oat Milk" (+₹40) → verify price updates
- Cart shows modifiers under item name
- Order total includes modifier prices
- Order history shows modifiers
- Receipt (Task 6) lists modifiers

---

## Task 8: Implement Split Bill

**Goal:** Fully implement `splitTable()` — UI to select items from an order and create separate bills.

**Current state:**
- `lib/store.ts:390-393` — `splitTable` is a `console.log()` stub
- No UI for splitting

**What to do:**

1. **Create a Split Bill dialog component:** `components/pos/split-bill-dialog.tsx`
   - Takes an order as prop
   - Shows all items with checkboxes
   - User selects items for "Bill A" (remaining go to "Bill B")
   - Shows running totals for each split
   - Confirm button creates two separate orders

2. **Implement `splitOrder` action in `lib/store.ts`:**
   ```ts
   splitOrder: (orderId: string, itemIdsForNewOrder: string[]) => void;
   ```
   - Creates a new order from the selected items
   - Updates the original order to remove those items and recalculate total
   - If original order had a table, new order gets a "takeaway" or new table assignment
   - Handle the edge case where ALL items are moved (shouldn't happen — validate)

3. **Replace the `splitTable` stub** with the real `splitOrder` implementation.

4. **Add a "Split Bill" button to the billing screen** (or table management) that opens the dialog.

5. **Wire it up in `table-management.tsx`** where the split button currently exists.

**Verification:**
- Open an order with 3+ items → Split Bill → select 1 item → confirm
- Original order updated with remaining items and recalculated total
- New order created with the selected items
- Both orders appear in Order History
- Table management reflects the split correctly

---

## Task 9: Fix Reports — Use Real Data

**Goal:** Remove ALL mock/hardcoded data from reports. Every chart and metric must be computed from actual orders.

**Current state:**
- `components/pos/reports.tsx:31-57` — three hardcoded arrays: `hourlyRevenue`, `paymentBreakdown`, `topItems`
- `reports.tsx:90` — `totalRevenue + 28500` adds fake number
- `reports.tsx:111` — `totalOrders + 156` adds fake number
- `reports.tsx:128` — `avgOrderValue + 182` adds fake number
- "Avg Prep Time" is hardcoded to "4.2 min"
- No date range filtering
- "+12.5% from yesterday" and "+8 orders from yesterday" are hardcoded

**What to do:**

1. **Remove ALL hardcoded data arrays** (lines 31-57).

2. **Remove ALL fake additions** (`+ 28500`, `+ 156`, `+ 182`).

3. **Compute hourly revenue from actual orders:**
   ```ts
   const hourlyRevenue = useMemo(() => {
     const hours: Record<string, number> = {};
     orders
       .filter(o => o.status === "completed")
       .forEach(o => {
         const hour = new Date(o.createdAt).getHours();
         const label = hour > 12 ? `${hour - 12}PM` : hour === 12 ? "12PM" : `${hour}AM`;
         hours[label] = (hours[label] || 0) + o.total;
       });
     return Object.entries(hours).map(([hour, revenue]) => ({ hour, revenue }));
   }, [orders]);
   ```

4. **Compute payment breakdown from actual orders** (requires Task 3 to be done first):
   ```ts
   const paymentBreakdown = useMemo(() => {
     const methods: Record<string, number> = { Cash: 0, UPI: 0, Card: 0, Split: 0 };
     orders
       .filter(o => o.payment)
       .forEach(o => {
         const method = o.payment!.method;
         methods[method.charAt(0).toUpperCase() + method.slice(1)] += 1;
       });
     const total = Object.values(methods).reduce((a, b) => a + b, 0);
     return Object.entries(methods)
       .filter(([, count]) => count > 0)
       .map(([name, count]) => ({
         name,
         value: total > 0 ? Math.round((count / total) * 100) : 0,
         color: name === "Cash" ? "#22c55e" : name === "Upi" ? "#f59e0b" : name === "Card" ? "#3b82f6" : "#ec4899",
       }));
   }, [orders]);
   ```

5. **Compute top-selling items from actual orders:**
   ```ts
   const topItems = useMemo(() => {
     const itemMap: Record<string, { name: string; orders: number; revenue: number }> = {};
     orders.forEach(o => {
       o.items.forEach(item => {
         if (!itemMap[item.menuItemId]) {
           itemMap[item.menuItemId] = { name: item.name, orders: 0, revenue: 0 };
         }
         itemMap[item.menuItemId].orders += item.quantity;
         itemMap[item.menuItemId].revenue += item.price * item.quantity;
       });
     });
     return Object.values(itemMap).sort((a, b) => b.orders - a.orders).slice(0, 5);
   }, [orders]);
   ```

6. **Compute average prep time** from orders that went from "new" to "ready" (if timestamps exist, otherwise show "N/A").

7. **Add a date range filter:**
   - Use `react-day-picker` (already in package.json) for date selection
   - Filter orders by `createdAt` within selected range
   - Default to "Today"

8. **Remove fake comparison strings** ("+12.5% from yesterday"). Either compute real day-over-day comparison or remove them.

9. **Handle empty state** — show "No data" messages when there are no orders instead of empty charts.

**Verification:**
- Create 5+ orders → go to reports → all charts reflect actual data
- No hardcoded numbers anywhere
- Date range filter works
- Empty state displays correctly when no orders exist

---

## Task 10: Connect Staff Management in Settings to Store

**Goal:** Settings staff tab should use real data from the Zustand store, not a hardcoded array.

**Current state:**
- `components/pos/settings.tsx:308-313` — hardcoded array of 4 staff members
- "Add Staff" button (line 302-305) is non-functional
- No edit or delete functionality

**What to do:**

1. **Replace the hardcoded staff array** with `usePOSStore().staffMembers`.

2. **Implement "Add Staff" button:**
   - Opens a dialog with: Name, Role (dropdown: Admin/Cashier/Server/Kitchen), PIN, Initials
   - On submit: calls `addStaffMember()` from store
   - Auto-generate initials from name if not provided

3. **Add edit functionality:**
   - Click on a staff card → opens edit dialog pre-filled with data
   - Can change name, role, PIN
   - Save calls `updateStaffMember()`

4. **Add delete functionality:**
   - Delete button on each staff card (with confirmation dialog)
   - Cannot delete the currently logged-in user
   - Calls `deleteStaffMember()`

5. **Show active/inactive status** based on whether the staff member is currently logged in (optional).

6. **Remove the fake email field** from display (store doesn't have emails, don't fabricate them).

**Verification:**
- Staff list shows actual store data
- Add a new staff member → appears in list and on login screen
- Edit a staff member → changes persist
- Delete a staff member → removed from list and login screen
- Cannot delete yourself

---

## Task 11: Add Staff Attribution to Orders

**Goal:** Every order records which staff member created it. Enable staff performance in reports.

**Current state:**
- `lib/data.ts` `Order` interface has no `createdBy` field
- `lib/store.ts` `addOrder` doesn't record who placed the order

**What to do:**

1. **Add `createdBy` to the `Order` interface in `lib/data.ts`:**
   ```ts
   export interface Order {
     // ... existing fields ...
     createdBy?: string;       // staff member name
   }
   ```

2. **Update `addOrder` in `lib/store.ts`:**
   - Automatically set `createdBy` to `get().currentUser?.name`

3. **Display staff name in:**
   - Order History (show "by {staffName}" on each order)
   - Billing screen (show who placed the order)
   - Kitchen Display (show who created the KOT)

4. **Add staff performance section to reports (Task 9):**
   - Orders per staff member
   - Revenue per staff member
   - Show as a table or bar chart

**Verification:**
- Create an order as "Rahul S." → order shows `createdBy: "Rahul S."` in history
- Reports show staff performance breakdown
- Kitchen display shows who placed each order

---

## Task 12: Add Audit Log

**Goal:** Log significant actions — refunds, voids, discounts, login/logout, data imports/clears.

**Current state:**
- No audit log exists anywhere in the codebase

**What to do:**

1. **Create an `AuditEntry` type in `lib/data.ts`:**
   ```ts
   export interface AuditEntry {
     id: string;
     timestamp: Date;
     action: "login" | "logout" | "refund" | "void" | "discount" | "order_created" | "order_edited" | "data_clear" | "data_import" | "settings_changed" | "staff_added" | "staff_deleted";
     userId: string;           // who performed the action
     details: string;          // human-readable description
     orderId?: string;         // related order, if applicable
     metadata?: Record<string, unknown>; // extra data
   }
   ```

2. **Add to the store:**
   ```ts
   auditLog: AuditEntry[];
   addAuditEntry: (entry: Omit<AuditEntry, "id" | "timestamp">) => void;
   ```

3. **Persist `auditLog`** in the `partialize` function.

4. **Add audit entries in these locations:**
   - `login()` — log "User X logged in"
   - `logout()` — log "User X logged out"
   - `handleRefund()` in billing — log "Refund of ₹X on order Y by Z"
   - `addOrder()` — log "Order created"
   - When a discount is applied during billing
   - `clearAllData()` — log "All data cleared by X"
   - `importData()` — log "Data imported by X"
   - `addStaffMember()` / `deleteStaffMember()` — log staff changes
   - `updateSettings()` — log settings changes

5. **Create an Audit Log viewer** — accessible from Dashboard or Settings (Admin only):
   - Chronological list of all audit entries
   - Filter by action type
   - Filter by date range
   - Search by user or order ID
   - Use a simple table/list layout

6. **Handle `timestamp` serialization** in `onRehydrateStorage`.

7. **Include in `exportData()` and `importData()`.**

**Verification:**
- Log in → check audit log → "User X logged in" entry exists
- Process a refund → audit log shows refund entry with amount and order ID
- Clear data → audit log shows data clear entry
- Non-admin roles cannot see the audit log

---

## Task 13: Add Shift Tracking

**Goal:** Clock-in/clock-out, opening/closing cash, shift summary.

**Current state:**
- `components/pos/login.tsx:213-223` — "Opening Cash" input exists but value goes nowhere
- "Start Shift" button calls `onLogin` but doesn't record shift start
- No clock-out, no shift summary, no closing cash

**What to do:**

1. **Add shift types to `lib/data.ts`:**
   ```ts
   export interface Shift {
     id: string;
     staffId: string;
     staffName: string;
     startedAt: Date;
     endedAt?: Date;
     openingCash: number;
     closingCash?: number;
     totalSales?: number;      // computed from orders during shift
     totalOrders?: number;
     notes?: string;
   }
   ```

2. **Add to the store:**
   ```ts
   shifts: Shift[];
   currentShift: Shift | null;
   startShift: (staffId: string, staffName: string, openingCash: number) => void;
   endShift: (closingCash: number, notes?: string) => void;
   ```

3. **Update `login.tsx`:**
   - Capture the opening cash value from the existing input
   - Pass it to `startShift()` when "Start Shift" is clicked

4. **Add a shift end flow:**
   - When user clicks "Logout" in the sidebar, show a "End Shift" dialog first
   - Dialog shows: shift duration, orders during shift, total sales during shift
   - Input for closing cash amount
   - Optional notes
   - "End Shift & Logout" button → calls `endShift()` then `logout()`

5. **Add shift history** — viewable in the dashboard or a dedicated section (Admin only):
   - List of past shifts with duration, opening/closing cash, total sales

6. **Persist `shifts` and `currentShift` in the store.**

**Verification:**
- Login with opening cash ₹5000 → shift starts
- Create some orders
- Logout → shift end dialog shows correct sales total
- Enter closing cash → shift saved to history
- Admin can view past shifts

---

## Task 14: Add Session Timeout

**Goal:** Auto-lock the POS after a configurable idle period.

**Current state:**
- User stays logged in forever until they manually log out or clear localStorage
- No idle detection

**What to do:**

1. **Use the `sessionTimeoutMinutes` from settings** (added in Task 1).

2. **Create a custom hook: `hooks/use-session-timeout.ts`:**
   ```ts
   export function useSessionTimeout() {
     // Track last activity timestamp
     // Listen for mouse, keyboard, touch events
     // When idle time exceeds settings.sessionTimeoutMinutes:
     //   - Show a warning toast/dialog 1 minute before
     //   - On timeout: call logout()
   }
   ```

3. **Use the hook in `app/page.tsx`** (only when logged in).

4. **Add a "Session Timeout" config in settings.tsx:**
   - Dropdown or slider: 5, 10, 15, 30, 60 minutes, or "Never"
   - Stored as `sessionTimeoutMinutes` (0 = never)

5. **Show a warning dialog** 60 seconds before timeout: "Your session will expire in 60 seconds. Click anywhere to stay logged in."

**Verification:**
- Set timeout to 1 minute (for testing)
- Wait idle → warning appears → if no interaction, auto-logout occurs
- Any mouse/keyboard/touch activity resets the timer
- "Never" option disables the timeout

---

## Task 15: Add Confirmation Dialogs for Destructive Actions

**Goal:** All destructive actions require explicit confirmation before executing.

**Current state:**
- Deleting orders — no confirmation
- Clearing all data — no confirmation
- Refund processing — has a dialog but handler is empty (fixed in Task 4)
- `data-manager.tsx:144` — uses `alert()` for errors

**What to do:**

1. **Identify all destructive actions:**
   - Delete order (Order History, Data Manager)
   - Clear all data (Data Manager)
   - Delete staff member (Settings)
   - Delete table (Table Management)
   - Delete menu item (if applicable)
   - Import data (overwrites existing)
   - Cancel/void an order
   - Logout during active shift

2. **Use the AlertDialog component** (from shadcn/ui — `@radix-ui/react-alert-dialog` is already installed):
   ```tsx
   <AlertDialog>
     <AlertDialogTrigger asChild>
       <Button variant="destructive">Delete</Button>
     </AlertDialogTrigger>
     <AlertDialogContent>
       <AlertDialogHeader>
         <AlertDialogTitle>Are you sure?</AlertDialogTitle>
         <AlertDialogDescription>
           This action cannot be undone.
         </AlertDialogDescription>
       </AlertDialogHeader>
       <AlertDialogFooter>
         <AlertDialogCancel>Cancel</AlertDialogCancel>
         <AlertDialogAction onClick={handleDelete}>Confirm</AlertDialogAction>
       </AlertDialogFooter>
     </AlertDialogContent>
   </AlertDialog>
   ```

3. **Replace `alert()` calls in `data-manager.tsx`** with toast notifications (sonner is already installed).

4. **Add confirmation to EVERY destructive action** listed above.

**Verification:**
- Try to delete an order → confirmation dialog appears → must click "Confirm"
- Try to clear data → confirmation with strong warning text
- Try to import data → warning that it will overwrite existing data
- No more `alert()` calls anywhere in the codebase

---

## Implementation Order (Recommended)

Tasks have dependencies. Follow this order:

```
Task 1  (Settings persistence)        ← Foundation, everything else reads from settings
Task 2  (Tax rate connection)          ← Depends on Task 1
Task 3  (Payment data model)           ← Foundation for billing and reports
Task 11 (Staff attribution)            ← Small change, needed before audit log
Task 12 (Audit log)                    ← Depends on Task 11, enables Task 4
Task 4  (Refund logic)                 ← Depends on Task 3 and Task 12
Task 5  (UPI QR codes)                 ← Depends on Task 1 (UPI ID in settings)
Task 6  (Receipt printing)             ← Depends on Task 3 (payment data on receipt)
Task 7  (Modifiers UI)                 ← Independent but affects price calculation
Task 9  (Fix reports)                  ← Depends on Task 3 (payment breakdown), Task 11 (staff stats)
Task 10 (Staff management in settings) ← Independent
Task 8  (Split bill)                   ← Complex, do after core billing works
Task 13 (Shift tracking)              ← Depends on Task 12 (audit log for shifts)
Task 14 (Session timeout)             ← Depends on Task 1 (timeout setting)
Task 15 (Confirmation dialogs)         ← Do last — touches many files, purely additive
```

---

## Global Rules for All Tasks

1. **Never create a separate Zustand store** — everything goes in `usePOSStore`.
2. **Always bump `STORE_VERSION`** when changing the persisted state shape.
3. **Always update `partialize`** when adding new state that should persist.
4. **Always update `exportData` / `importData`** when adding new data collections.
5. **Always handle Date serialization** in `onRehydrateStorage` for any new Date fields.
6. **Use `sonner` toast** for success/error notifications — not `alert()`.
7. **Use shadcn/ui components** for all new UI — don't create custom primitives.
8. **Follow the existing Tailwind class patterns** — dark theme, `bg-card`, `border-border`, `text-foreground`, etc.
9. **Respect RBAC** — check `getPermissions(currentUser.role)` before showing admin-only features.
10. **Run `npm run build` after every task** to catch type errors early.
11. **Keep components under ~500 lines** — extract sub-components or utilities if growing too large.
12. **Don't modify `lib/roles.ts`** unless explicitly adding a new permission.
13. **Design data models for Supabase migration** — use string UUIDs (`crypto.randomUUID()`) for all new IDs, store dates as ISO 8601 strings, keep structures flat and relational (avoid deeply nested objects that won't map cleanly to Supabase PostgreSQL tables in Phase 3).

---

## Files That Will Be Modified

| File | Tasks |
|------|-------|
| `lib/data.ts` | 3, 4, 7, 11, 12, 13 |
| `lib/store.ts` | 1, 3, 4, 7, 8, 11, 12, 13 |
| `lib/utils.ts` | 6 |
| `components/pos/settings.tsx` | 1, 5, 10, 14 |
| `components/pos/billing.tsx` | 2, 3, 4, 5, 6, 8 |
| `components/pos/new-order.tsx` | 2, 7 |
| `components/pos/reports.tsx` | 9 |
| `components/pos/login.tsx` | 13 |
| `components/pos/sidebar.tsx` | 13 |
| `components/pos/order-history.tsx` | 3, 11 |
| `components/pos/kitchen-display.tsx` | 11 |
| `components/pos/data-manager.tsx` | 15 |
| `components/pos/dashboard.tsx` | 12, 13 |
| `app/page.tsx` | 14 |
| `app/globals.css` | 6 |

## New Files to Create

| File | Task |
|------|------|
| `components/pos/receipt-template.tsx` | 6 |
| `components/pos/split-bill-dialog.tsx` | 8 |
| `components/pos/audit-log.tsx` | 12 |
| `hooks/use-session-timeout.ts` | 14 |

---

*This guide covers Phase 1 completely — 15 tasks, all client-side, bringing the POS from ~45% to ~80% complete. Phase 2 adds PWA/offline support. Phase 3 migrates to Supabase (PostgreSQL, Auth, Realtime, Edge Functions) as the backend — no custom Node.js server needed.*
