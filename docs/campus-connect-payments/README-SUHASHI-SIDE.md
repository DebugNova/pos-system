# Campus Connect Payments — the SUHASHI side (read me, friend 👋)

This folder is a **mirror** of the plan that lives canonically in the **Campus Connect** repo
(`Campus Connect/docs/features/`). It's here so the Suhashi/POS side has the full context. The whole plan
covers both apps; **this page lists only the parts that are Suhashi's responsibility.**

## The one-line summary
Campus Connect students will pay through **this** account's Razorpay (the live one already wired into this
POS). Campus Connect hands off a signed request; Suhashi turns it into a **Razorpay Payment Link**; Razorpay's
webhook tells Campus Connect to unlock the plan. Suhashi's own POS subscription billing is untouched (it uses
`subscription.*` events; Campus Connect uses `payment_link.paid`/`payment.captured` — they never collide).

## What Suhashi has to do (total: ~1 new file + some env)

### Phase 0 — config
- Add to `.env.local` **and Vercel** (server-side, no `NEXT_PUBLIC_` on secrets):
  - `SUHASHI_HANDOFF_SECRET=<shared hex>` — **must equal** Campus Connect's value.
  - `CC_RETURN_URL=https://<campus-connect-domain>/premium/return`
  - (Razorpay `NEXT_PUBLIC_RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` already exist here.)
- Confirm the contract in `phases/phase-0-config-and-contract.md` §0.5.

### Phase 1 — build ONE Next.js route
- **New file:** `app/api/campus-connect/create-payment/route.ts` — full code is in
  `phases/phase-1-core-flow-and-hardening.md` §1.7. It:
  1. verifies the Campus Connect HMAC handoff token (`SUHASHI_HANDOFF_SECRET`),
  2. re-checks the amount against the shared price catalog (blueprint §3 / README §3),
  3. `razorpay.paymentLink.create({ amount, notes:{cc_purchase_id, source:'campus_connect'}, callback_url })`,
  4. returns `{ url: link.short_url }`.
- It reuses the exact `new Razorpay({...})` pattern already in
  `app/api/razorpay/create-subscription/route.ts`. `npm run build` must pass.

### Phase 2 — go live
- Swap the Razorpay env here from test → live keys, redeploy on Vercel.
- In the Razorpay dashboard, add a **second webhook** pointing at Campus Connect's function
  (`https://zvcdqdtuzatmthrawrnv.functions.supabase.co/razorpay-webhook`) for `payment_link.paid`,
  `payment.captured`, `order.paid`. Suhashi's existing `subscription.*` webhook stays as-is.

### Phase 3 (optional, later)
- Auto-renew: generalize `app/api/razorpay/create-subscription/route.ts` for Campus Connect plans. Details in
  `phases/phase-3-auto-renew.md`.

## What Suhashi does **not** do
- No changes to the POS, orders, KDS, or Suhashi's own subscription billing.
- Suhashi never writes to Campus Connect's database. It only mints the payment link; Razorpay's webhook (to
  Campus Connect) does the unlocking.

## Start here
Full context: `phases/README.md` → then `phases/phase-0-config-and-contract.md`. The Suhashi-specific code is
`phase-1-…` §1.7.
