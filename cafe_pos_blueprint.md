# Cafe POS Blueprint

> Developer handoff for an iPad-first restaurant POS with Swiggy and Zomato integration

| | |
|---|---|
| **Product type** | Touch-first POS for cafe billing, tables, kitchen, and aggregator orders |
| **Primary device** | iPad, with responsive support for admin and back-office use |
| **Core integrations** | Swiggy, Zomato, printers, UPI QR, receipts, cloud sync |
| **Build priority** | Speed, reliability, offline support, and clean UX |

*Version 1.0*

---

## 1. Product objective

Build a fast, reliable, visually clean cafe POS that allows staff to create orders, manage tables, send kitchen tickets, process payments, and handle Swiggy and Zomato orders from a single interface.

The experience should feel premium and simple: large touch targets, minimal clutter, quick search, offline resilience, and workflows that can be learned in minutes.

---

## 2. Design principles

- One-touch speed for common tasks such as add item, send to kitchen, and charge bill.
- Touch-first layout built for iPad, not a desktop-style admin panel.
- Offline-first behavior so billing continues even if the network is unstable.
- Cafe-specific workflows for dine-in, takeaway, delivery, and aggregator orders.
- A unique visual identity that is inspired by modern POS patterns but not copied.

---

## 3. User roles and access

| Role | Allowed actions | Restrictions |
|---|---|---|
| Admin / Owner | Menu, reports, tax, printers, integrations, refunds, staff permissions | None |
| Cashier | Create bills, take payment, apply approved discounts, print receipts | Cannot edit integrations or tax |
| Waiter / Server | Create orders, send to kitchen, manage table status | Cannot close financial settings |
| Kitchen | See KOT queue, mark items preparing/ready | Cannot edit orders |

---

## 4. Core modules

| Module | What it should do |
|---|---|
| Dashboard | Today's sales, active tables, pending orders, aggregator volume, alert cards. |
| Orders | Dine-in, takeaway, delivery, aggregator orders, order history, status filters. |
| Tables | Visual table map, open bills, move / merge / split table controls. |
| Menu | Categories, items, modifiers, combos, availability, time-based pricing. |
| Payments | Cash, UPI, card, split payment, partial payment, refunds, receipt printing. |
| Reports | Sales summaries, item performance, staff performance, payment breakdowns. |
| Settings | Printers, taxes, branch profile, roles, integrations, device settings. |

---

## 5. Recommended screen structure

- Login and shift open screen.
- Home dashboard with four large action cards: New Order, Tables, Online Orders, Billing.
- New order screen with categories on the left and cart / modifiers on the right.
- Table map with color-coded states and quick order access.
- Order detail screen with timeline, payment, and printing actions.
- Aggregator inbox for Swiggy and Zomato orders.
- Admin settings and reports screen.

---

## 6. Order flow

| Step | Action | Notes |
|---|---|---|
| 1 | Select order type | Dine-in, takeaway, delivery, or online. |
| 2 | Choose table or customer | Open or link the order to a table/customer. |
| 3 | Add items | Use categories, search, and favorites. |
| 4 | Apply modifiers | Toppings, spice level, notes, combos. |
| 5 | Send to kitchen | Produce KOT / kitchen ticket instantly. |
| 6 | Take payment | Cash, UPI, card, split payment, or partial payment. |
| 7 | Close and archive | Receipt, audit log, and reporting entry. |

---

## 7. Swiggy and Zomato integration

The POS should include a dedicated aggregator inbox where orders from Swiggy and Zomato appear with clear source badges, customer / order identifiers, and live status tracking.

- Incoming order should create an internal order record and map the external order ID to it.
- Status flow should include Received, Accepted, Preparing, Ready, Packed, Handed Over, and Cancelled.
- The kitchen should receive the same item format as in-house orders, but clearly marked as aggregator orders.
- The integration layer should be modular so another delivery platform can be added later without rewriting the POS.

| Integration expectation | Implementation note |
|---|---|
| API / webhook connector | Preferred route if the platform partner API is available. |
| Polling fallback | Use when the platform limits live webhooks. |
| Status mapping layer | Map third-party states to internal POS states. |
| Menu mapping | Match external menu items to internal menu items. |

---

## 8. Data model

- User
- Branch
- Table
- Category
- MenuItem
- Modifier
- Order
- OrderItem
- Payment
- AggregatorOrderMap
- AuditLog

---

## 9. Technical architecture

- **Frontend:** React / Next.js for a responsive iPad web app or PWA.
- **Backend:** Node.js with PostgreSQL, plus Redis if queues and sync are needed.
- **Realtime updates:** WebSockets for orders, kitchen status, and aggregator events.
- **Printing:** thermal receipt printer and kitchen printer support.
- **Offline support:** local queue + automatic sync when network returns.

---

## 10. Non-functional requirements

- App launch should feel instant on the iPad.
- The order creation flow should require as few taps as possible.
- The interface should remain readable and usable in busy, low-light environments.
- Critical actions such as refunds, voids, and discounts should be logged.
- Session controls should prevent unauthorized access and protect billing data.

---

## 11. MVP build sequence

| Phase | Deliverable |
|---|---|
| MVP 1 | Login, dashboard, menu, billing, tables, kitchen tickets, payments, receipts, basic reports, offline mode. |
| MVP 2 | Aggregator live sync, advanced reporting, split bills, customer profiles, staff shifts, analytics. |

---

## 12. Acceptance checklist

- Works smoothly on iPad and does not feel like a desktop app resized to a tablet.
- Billing is fast, clean, and reliable.
- Kitchen tickets are sent correctly.
- Swiggy and Zomato orders can be tracked in one inbox.
- Offline mode preserves the ability to create and queue orders.
- Reports, permissions, and audit logs are present.

---

*End of document*
