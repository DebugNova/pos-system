# Phase 0 — Config & Contract Lock

- **Status:** Not started
- **Prerequisite:** none (this is the first phase)
- **Touches:** secrets on both Supabase projects + SU Vercel env + Razorpay dashboard. **No product code.**
- **Goal:** every credential is in place, both sides agree on the contract, and we prove the plumbing works
  end-to-end in **Razorpay TEST mode** before writing a single line of feature code.

> 🔴 **READ FIRST:** [`README.md`](README.md) (cold-start context, secret matrix, price catalog) and the
> [blueprint](../payments-via-suhashi-razorpay.md). Do only Phase 0. Run the Self-Test at the bottom and
> paste the evidence.

---

## 0.1 What "done" means (exit criteria)
1. Razorpay **TEST-mode** keys obtained and recorded (we build/test on test keys; live keys wait for Phase 2).
2. A generated `SUHASHI_HANDOFF_SECRET` is set on **both** CC edge secrets and SU env.
3. Razorpay keys + webhook secret set on **both** sides (test mode).
4. The friend confirms the **contract** (endpoint name, notes, callback URL, webhook routing) — §0.5.
5. **Self-Test passes:** using the TEST key we can (a) create a Razorpay Payment Link via the API and
   (b) POST a signed test webhook to a throwaway echo and see the signature verify. No product code yet.

## 0.2 Decisions to lock (write the answers into the blueprint §17)
- **CC production domain / return URL** → `CC_RETURN_URL = https://<domain>/premium/return`. If CC has no
  custom domain yet, use the Vercel URL. **Record it.**
- **Where `create-payment` lives** → default: a **Next.js API route in SU** (`app/api/campus-connect/create-payment/route.ts`),
  reusing SU's existing `razorpay` SDK setup. (Confirmed by the friend, or he builds it — same contract.)
- **Webhook routing** → add a **second** Razorpay webhook endpoint pointing at CC's `razorpay-webhook`
  (SU's existing webhook stays for `subscription.*`). Confirm this is acceptable.
- **Handoff secret value** → generate one now (see 0.3).

## 0.3 Generate the shared handoff secret
Run locally (either repo):
```bash
node -e "console.log('SUHASHI_HANDOFF_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```
Record the output; it goes into CC edge secrets **and** SU env (identical value).

## 0.4 Set the secrets

### Campus Connect (Supabase project `zvcdqdtuzatmthrawrnv`) — Edge Function secrets
Dashboard → Project Settings → Edge Functions → Secrets, **or** CLI:
```bash
supabase secrets set \
  RAZORPAY_KEY_ID=rzp_test_xxxxxxxx \
  RAZORPAY_KEY_SECRET=<test_secret> \
  RAZORPAY_WEBHOOK_SECRET=<cc_webhook_secret> \
  SUHASHI_HANDOFF_SECRET=<generated_hex> \
  SUHASHI_CREATE_PAYMENT_URL=https://suhashico.vercel.app/api/campus-connect/create-payment \
  --project-ref zvcdqdtuzatmthrawrnv
```
> Use **TEST** keys for now (`rzp_test_…`). Live keys are a Phase 2 swap.
> `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected into Supabase edge functions — do **not** set them manually.

### Campus Connect frontend — `c:\Users\kaust\OneDrive\Desktop\Campus Connect\.env`
Already contains `VITE_RAZORPAY_KEY_ID` (currently the **live** id). For test-mode QA, temporarily set it to
the **test** id, or leave live (the id only affects the in-app SDK, which Phase 1 stops using for the primary
flow). Record intent; no change strictly required for Phase 0.

### Suhashi (`c:\Users\kaust\OneDrive\Desktop\suhashi\pos-system\.env.local` + Vercel)
Confirm these exist (the POS already uses Razorpay so most are present):
```
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxx        # test for now
RAZORPAY_KEY_SECRET=<test_secret>
RAZORPAY_WEBHOOK_SECRET=<same as CC's if you share one webhook secret>
SUHASHI_HANDOFF_SECRET=<generated_hex>               # NEW — must equal CC's
CC_RETURN_URL=https://<cc-domain>/premium/return     # NEW
```
> These are **server-side** (no `NEXT_PUBLIC_` on the secret/handoff). Add to Vercel Project → Settings →
> Environment Variables too, or the deployed route won't see them.

## 0.5 Contract confirmation checklist (send to the friend)
Ask him to confirm he will implement / accept, in **Phase 1**:
- [ ] `POST /api/campus-connect/create-payment` accepting `{ token }` (HMAC handoff, §5.1 of blueprint).
- [ ] It creates a Razorpay **Payment Link** with `notes: { cc_purchase_id, source:"campus_connect", item_type }`
      and `callback_url = CC_RETURN_URL?ref=<cc_purchase_id>`.
- [ ] It re-validates the amount against the shared price catalog (README §3).
- [ ] OK to add a **second Razorpay webhook** → CC's `razorpay-webhook` for `payment_link.paid`,
      `payment.captured`, `order.paid`.
- [ ] `SUHASHI_HANDOFF_SECRET` shared value agreed.

## 0.6 Razorpay dashboard (test mode)
- Settings → API Keys → generate/download **Test** `key_id` + `key_secret`.
- Settings → Webhooks → **Add New Webhook** (we'll set the real URL in Phase 1 once the function is
  deployed; for now just confirm you can add a second endpoint and set a secret). Note the events list:
  `payment_link.paid`, `payment.captured`, `order.paid`.

---

## 0.7 Self-Test (the agent runs these and pastes output)

**T0.1 — Both Supabase projects reachable via MCP**
- `mcp__claude_ai_Supabase__execute_sql`(project `zvcdqdtuzatmthrawrnv`): `select now();` → returns a timestamp.
- `mcp__supabase-suhashi__execute_sql`: `select now();` → returns a timestamp.
- ✅ Pass = both return.

**T0.2 — Razorpay TEST key can create a Payment Link** (proves keys valid + Payment Links enabled)
Run locally with the **test** key/secret:
```bash
curl -s -u "rzp_test_xxx:<test_secret>" -X POST https://api.razorpay.com/v1/payment_links \
  -H "content-type: application/json" \
  -d '{"amount":16900,"currency":"INR","description":"CC test","notes":{"cc_purchase_id":"phase0-probe","source":"campus_connect"}}'
```
- ✅ Pass = JSON with a `short_url` and `"status":"created"`. (Open the `short_url` to eyeball the hosted page; do not pay.)
- ❌ If `Payment Links` is not enabled on the account, enable it in the Razorpay dashboard.

**T0.3 — HMAC handoff signing is reproducible on both stacks** (Deno for CC edge, Node for SU)
Node (SU side):
```bash
node -e "const c=require('crypto');const p=Buffer.from(JSON.stringify({v:1,cc_purchase_id:'x',exp:9999999999})).toString('base64url');console.log(p+'.'+c.createHmac('sha256','SECRET').update(p).digest('hex'))"
```
- ✅ Pass = a `payload.signature` string is produced. (Phase 1 verifies CC's Deno HMAC produces the identical signature for the same input+secret.)

**T0.4 — Webhook signature scheme sanity** (Razorpay signs the **raw body** with HMAC-SHA256 hex)
```bash
node -e "const c=require('crypto');console.log(c.createHmac('sha256','WEBHOOK_SECRET').update('{\"event\":\"payment.captured\"}').digest('hex'))"
```
- ✅ Pass = a 64-char hex. This is the exact scheme CC's `razorpay-webhook` already uses (matches
  `Suhashi/pos-system/app/api/webhooks/razorpay/route.ts`).

**Record in the phase's Done checklist:** the test `key_id` (not the secret), the `short_url` from T0.2,
and confirmation that T0.1/T0.3/T0.4 passed.

---

## 0.8 Rollback
Nothing to roll back — Phase 0 is configuration only. If a secret is wrong, re-set it. No code, no schema,
no user-facing change.

## 0.9 Done checklist
- [ ] `SUHASHI_HANDOFF_SECRET` generated and set on **both** sides (identical).
- [ ] CC edge secrets set (test keys): `RAZORPAY_KEY_ID/SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `SUHASHI_HANDOFF_SECRET`, `SUHASHI_CREATE_PAYMENT_URL`.
- [ ] SU env set: Razorpay test keys, `SUHASHI_HANDOFF_SECRET`, `CC_RETURN_URL` (local `.env.local` **and** Vercel).
- [ ] Friend confirmed the §0.5 contract.
- [ ] `CC_RETURN_URL` + CC production domain recorded in [blueprint §17](../payments-via-suhashi-razorpay.md#17-info-still-needed-from-you--your-friend).
- [ ] Self-Test T0.1–T0.4 all pass (evidence pasted).
- [ ] Blueprint §16 Phase 0 marked complete.
