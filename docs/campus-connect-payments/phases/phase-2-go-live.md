# Phase 2 — Go Live

- **Status:** Not started
- **Prerequisite:** Phase 1 complete — the entire flow passes in **TEST mode** (D1/D2/D3 closed).
- **Touches:** secrets on both sides + Razorpay dashboard + one real transaction + docs. **Minimal/no new code.**
- **Goal:** flip from test keys to **live** keys, register the **live** webhook, prove one real ₹ transaction
  grants a real plan, add the branding notice, and **rotate the leaked secrets**.

> 🔴 **READ FIRST:** [`README.md`](README.md) + [blueprint](../payments-via-suhashi-razorpay.md). Do only
> Phase 2. This phase moves **real money** — go slow, verify each step.

---

## 2.1 Exit criteria
1. Live Razorpay keys in place on both sides; live webhook registered to CC's `razorpay-webhook`.
2. One **real** low-value transaction (e.g. a ₹39 boost) completes end-to-end and grants automatically.
3. Settlement visible in the Razorpay dashboard.
4. Branding microcopy ("billed via SUHASHI") live at checkout.
5. Leaked secrets rotated.
6. Docs updated (known-issues: payments real; roadmap).

## 2.2 Swap to live keys
### [CC] edge secrets (`zvcdqdtuzatmthrawrnv`)
```bash
supabase secrets set \
  RAZORPAY_KEY_ID=rzp_live_T7DDq9ZhqgVv0H \
  RAZORPAY_KEY_SECRET=<LIVE secret> \
  RAZORPAY_WEBHOOK_SECRET=<CC live webhook secret> \
  --project-ref zvcdqdtuzatmthrawrnv
```
### [CC] frontend `.env` + Vercel
`VITE_RAZORPAY_KEY_ID=rzp_live_T7DDq9ZhqgVv0H` (already set). Redeploy CC on Vercel so the value ships.
### [SU] `.env.local` + Vercel
`NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_…`, `RAZORPAY_KEY_SECRET=<LIVE>`, keep `SUHASHI_HANDOFF_SECRET`,
`CC_RETURN_URL`. Redeploy SU on Vercel.

## 2.3 Register the LIVE webhook (Razorpay dashboard → Live mode → Webhooks)
- **Add a second webhook** (SU's existing one stays for `subscription.*`):
  - URL: `https://zvcdqdtuzatmthrawrnv.functions.supabase.co/razorpay-webhook`
  - Secret: the value set as CC's `RAZORPAY_WEBHOOK_SECRET`.
  - Active events: `payment_link.paid`, `payment.captured`, `order.paid`.
- Save. Send a **test webhook** from the dashboard if available and confirm CC logs a 200
  (`mcp__claude_ai_Supabase__get_logs`).

## 2.4 Branding microcopy (compliance/trust)
In `[CC]src/pages/Premium/PremiumMembership.tsx` (and any one-time purchase modals), near the pay button:
> *"Payments are processed securely by our partner SUHASHI via Razorpay. Your statement may show SUHASHI."*
This prevents "why is a cafe charging me?" confusion and support tickets.

## 2.5 The real transaction test
1. From CC production, buy the **cheapest** item (₹39 boost) with a real UPI.
2. ✅ Redirect → pay → land on `/premium/return` → boost active within seconds.
3. `execute_sql`(CC): `orders` row `status='paid'` with a real `razorpay_payment_id`; `user_usage.boosts_active_until` extended.
4. Razorpay dashboard → Payments shows the ₹39 captured; Settlements will show it in the cycle.
5. (Optional) refund yourself from the Razorpay dashboard to validate the refund path manually.

## 2.6 🔐 Rotate the leaked secrets (do NOT skip)
These were pasted in chat and must be considered compromised:
- **Razorpay `KEY_SECRET`** → Razorpay Dashboard → Settings → API Keys → **Regenerate**. Update the new
  secret in: CC edge secrets, SU `.env.local` + Vercel. (Key **id** can stay.)
- **`RAZORPAY_WEBHOOK_SECRET`** → set a fresh value on the webhook + both sides.
- **Supabase access token** `sbp_…` → Supabase → Account → Access Tokens → **Revoke**. (Only needed for CLI;
  MCP uses its own auth.)
- **`SUHASHI_HANDOFF_SECRET`** → optional rotation; if you do, set the new value on both sides together.
- Re-run T1.3 (signed-webhook grant) after rotation to confirm the new webhook secret works.

## 2.7 Reconciliation & monitoring
- Spot-check: every Razorpay captured payment has a matching CC `orders` row `status='paid'` with the same
  `razorpay_payment_id`; correlate via `notes.cc_purchase_id`.
- Add a saved query / admin view later: pending orders older than 1h that never paid (abandoned), and any
  captured payment with no matching paid order (investigate).
- Watch `mcp__claude_ai_Supabase__get_logs` on `razorpay-webhook` for the first days.

## 2.8 Self-Test summary (paste evidence)
- [ ] Live webhook test event → CC logs 200.
- [ ] Real ₹39 purchase → auto-granted; DB + Razorpay dashboard agree.
- [ ] Post-rotation signed-webhook grant (T1.3 repeat) still works.
- [ ] `VITE_RAZORPAY_KEY_ID` live and CC redeployed; SU redeployed.

## 2.9 Rollback
- If live misbehaves: revert edge secrets to test keys and disable the live webhook (Razorpay dashboard) —
  the flow returns to test mode; no schema/code change needed. Frontend can fall back to the pre-redirect
  branch if truly necessary (Phase 1 §1.10).

## 2.10 Docs to update on completion
- `docs/06-known-issues/README.md` — payments are **no longer mocked**; D1/D2/D3 closed; two-paywall note resolved.
- `docs/03-features/monetization-and-premium.md` — document the handoff flow as shipped.
- `docs/02-backend/functions-rls-and-edge.md` — `payment-start`, extended `razorpay-webhook`, hardened `verify`, SU `create-payment`.
- `docs/08-roadmap/*` — mark payments done.
- Blueprint §16 Phase 2 complete; §20 close-out checkboxes.
