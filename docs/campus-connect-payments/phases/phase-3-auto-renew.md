# Phase 3 — Auto-Renewing Subscriptions (OPTIONAL, later)

- **Status:** Not started · **do only if data shows demand.** Launch (Phases 0–2) is "one-time renewable".
- **Prerequisite:** Phases 0–2 live and stable.
- **Touches:** Razorpay plans + **SU** route + **CC** webhook/DB + **CC** frontend.
- **Goal:** let students opt into an auto-renewing plan (UPI Autopay / e-mandate) instead of re-paying each cycle.

> 🔴 **READ FIRST:** [`README.md`](README.md) + [blueprint](../payments-via-suhashi-razorpay.md) §3 (non-goals)
> and the recurring code that already exists on both sides. This is a bigger build than Phases 1–2; scope it
> as its own mini-spec before starting.

---

## 3.1 Why this is separate (and optional)
- Indian students are UPI-first and frequently distrust auto-debit mandates → auto-renew can *lower*
  conversion. One-time renewable already covers launch.
- Recurring adds real complexity: e-mandates, failed-charge dunning, cancellation/upgrade/proration, and the
  webhook (not the browser) as the entitlement source of truth.
- A shared cafe merchant account running recurring dating-app mandates draws more Razorpay scrutiny.

## 3.2 What already exists to reuse
- **SU** `app/api/razorpay/create-subscription/route.ts` already creates Razorpay **Subscriptions** with
  `notes:{userId, planType}` and `total_count`. Generalize it to accept a CC handoff + Razorpay **plan_id**.
- **SU** `app/api/webhooks/razorpay/route.ts` already handles `subscription.activated/charged/halted/cancelled`
  and upserts on `razorpay_subscription_id`. CC's `razorpay-webhook` already has stub `subscription.charged/
  cancelled/halted` handlers — extend them to grant/downgrade CC tiers.
- **Do NOT reuse** Suhashi's existing `plan_…` IDs (monthly/quarterly/yearly in its env) — those are priced
  for the POS product. Create **new** Razorpay Plans for CC's tiers.

## 3.3 Build outline
1. **Create 6 Razorpay Plans** (live) matching CC pricing: plus/elite × monthly/quarterly/semester. Record
   their `plan_id`s in a CC-side map (`item_type → plan_id`). (Scripts pattern: `[SU]scripts/create-test-plan.js`.)
2. **SU** new/extended route `create-subscription` (CC variant): verify CC handoff, look up `plan_id` from the
   item, `razorpay.subscriptions.create({ plan_id, notes:{cc_purchase_id, user_id, source:'campus_connect'} })`,
   return the subscription short URL / checkout.
3. **CC** `razorpay-webhook`: on `subscription.activated`/`subscription.charged` with
   `notes.source==='campus_connect'` → upsert `subscriptions` (tier from plan map, `current_period_end` from
   `subscription.current_end`); on `cancelled`/`halted` → set `status` accordingly so the tier lapses.
4. **CC** frontend: add an "Auto-renew & save" toggle on the plan screen; a "Manage/Cancel subscription" action
   (calls a cancel endpoint → `razorpay.subscriptions.cancel`).
5. **DB:** use `subscriptions.razorpay_subscription_id` (already exists) as the correlation key for recurring.

## 3.4 Self-Test (test mode)
- Create a CC subscription via the SU route → Razorpay test mandate → `subscription.activated` webhook →
  CC tier active with correct `current_period_end`.
- Simulate `subscription.charged` (renewal) → `current_period_end` advances.
- Simulate `subscription.halted` (failed charge) → tier lapses to free after grace; dunning notification.
- Cancel → `subscription.cancelled` → tier ends at period end.
- Idempotency: duplicate `subscription.charged` → single advance.

## 3.5 Risks
- Mandate UX friction; dunning correctness; proration on upgrade/downgrade; heightened compliance on a shared
  account. Treat as a deliberate, separately-approved effort.

## 3.6 Done checklist
- [ ] 6 CC Razorpay Plans created (live) + mapped.
- [ ] SU CC-subscription route deployed.
- [ ] CC webhook grants/lapses on `subscription.*` for `source==='campus_connect'`.
- [ ] Frontend auto-renew toggle + cancel/manage.
- [ ] Self-Tests pass; docs updated.
