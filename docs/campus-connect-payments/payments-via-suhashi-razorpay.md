# Campus Connect Payments via the Suhashi Razorpay Account — Full Implementation Blueprint (A–Z)

- **Status:** Draft (awaiting approval to build phase-by-phase)
- **Owner:** Kaustab (Campus Connect) + friend (Suhashi Razorpay side)
- **Created:** 2026-07-07
- **Related docs:** [../03-features/monetization-and-premium.md](../03-features/monetization-and-premium.md),
  [../02-backend/functions-rls-and-edge.md](../02-backend/functions-rls-and-edge.md),
  [../06-known-issues/README.md](../06-known-issues/README.md)

> This is the single source of truth for the payment integration. It is intentionally exhaustive so that
> **both** sides (Campus Connect and the Suhashi/Razorpay side) can build to the same contract without
> guessing. Read §5 (the contract) and §10 (security) before writing any code. Nothing here is built yet —
> on approval we execute the §16 phase plan one shippable phase at a time.

---

## 0. TL;DR — is it fully automatic? **Yes.**

A student taps "Get Elite" → is redirected to a Razorpay-hosted payment page → pays with UPI → Razorpay
fires a **server-to-server webhook** to Campus Connect → Campus Connect verifies the payment with
Razorpay's own API and **unlocks the plan automatically**. No admin approval, no manual verification, and
it works **even if the student closes the app the instant they pay**, because the unlock is driven by the
webhook (server→server), not by the browser coming back. The browser redirect back into the app is only
for showing "Success 🎉".

The three things that make it "proper" and safe, all handled server-side so nobody has to think about them:
1. **Price can't be tampered** — the amount and the plan are locked on the server; a hacked page paying ₹1 is rejected.
2. **A paid student always gets their plan** — webhook-driven, idempotent, survives closed tabs / dead phones.
3. **Plans actually expire** — enforced on read + a cleanup job, instead of staying active forever.

---

## 1. The two systems & where every credential lives

| | **Campus Connect (CC)** | **Suhashi (the money side)** |
|---|---|---|
| What it is | React 19 + Vite dating/confessions super-app | Restaurant POS (Next.js) that owns the **live** Razorpay merchant account |
| Supabase project | `zvcdqdtuzatmthrawrnv` ("RGU Connect") | `ycrwtvtdsbjbhdqyuptq` |
| Repo in this workspace? | ✅ Yes (`c:\Users\kaust\...\Campus Connect`) | ❌ No — only its **Supabase** is reachable (via MCP). Its frontend repo is not open here. |
| Role in payments | **Grants features** after a confirmed payment | **Takes the money** via Razorpay |
| Razorpay account | uses Suhashi's | **owns** it (`rzp_live_T7DDq9ZhqgVv0H`, KYC-approved) |

**Because the Suhashi frontend repo is not in this workspace, the Suhashi side of this integration will be
built as Supabase Edge Functions on `ycrwtvtdsbjbhdqyuptq`** (which I *can* deploy via MCP), not as pages
in the Next.js app. If the friend prefers to host the checkout in the Next.js app instead, the contract in
§5 is identical — only the hosting location of `cc-create-payment` changes.

### Secret placement matrix (get this wrong and you leak money)
Anything prefixed `VITE_` (CC) or `NEXT_PUBLIC_` (Suhashi) is **compiled into the browser bundle and public**.

| Secret | Value | Lives ONLY in | Never in |
|---|---|---|---|
| `VITE_RAZORPAY_KEY_ID` | `rzp_live_T7DDq9ZhqgVv0H` | CC `.env` / Vercel (client) — it's public by design | — |
| `RAZORPAY_KEY_ID` | same `rzp_live_…` | CC + Suhashi **Edge Function secrets** | — |
| `RAZORPAY_KEY_SECRET` | `n4NesK4iOOetAOTWvn4umfGW` | CC + Suhashi **Edge Function secrets** | ❌ any `VITE_`/`NEXT_PUBLIC_` file |
| `RAZORPAY_WEBHOOK_SECRET` | `wedrip_os_secure_hook_2026_xyz` | CC + Suhashi **Edge Function secrets** | ❌ client |
| `SUHASHI_HANDOFF_SECRET` | **new**, we generate it | CC + Suhashi **Edge Function secrets** | ❌ client |
| `SUPABASE_SERVICE_ROLE_KEY` | per-project | that project's Edge Function secrets | ❌ client, ❌ the *other* project |

> **These were pasted in chat and must be rotated after go-live** (Razorpay → regenerate secret; Supabase →
> revoke the `sbp_…` access token). Tracked as a Phase 2 task.

---

## 2. Goals
- Students can buy **Plus/Elite** (6 combos: 2 tiers × monthly/quarterly/semester) and **one-time items**
  (boosts, super-like packs, vibe-match packs, campus/mystery passes, explorer passes) with real money.
- Payment → entitlement is **automatic, server-verified, idempotent, and tamper-proof**.
- Reuse Campus Connect's **already-deployed** edge functions and grant logic where possible.

## 3. Non-goals (explicitly out of scope for launch)
- **Auto-renewing** subscriptions / UPI Autopay mandates → deferred to Phase 3. Launch = "one-time
  renewable": pay once for 30/90/180 days, re-pay to renew.
- Self-serve refunds / cancellation UI → manual via Razorpay dashboard for now.
- Migrating Campus Connect to its **own** Razorpay account → future clean-up (same code, new keys).
- Reusing Suhashi's existing `plan_…` IDs — they're priced for Suhashi's own product; **do not use them**.

---

## 4. Current reality (what already exists — verified against live DB + code, 2026-07-07)

- CC edge functions **are deployed & ACTIVE** on `zvcdqdtuzatmthrawrnv` (CLAUDE.md's "not deployed" note is
  stale): `razorpay-create-order`, `razorpay-verify`, `razorpay-webhook`.
- Every real purchase already flows through `type:'order'` (one-time). [PremiumMembership.tsx](../../src/pages/Premium/PremiumMembership.tsx)
  buys plans as `item_type:'sub_<tier>_<cycle>'`; [SubscriptionContext.tsx](../../src/contexts/SubscriptionContext.tsx)
  buys the one-time items. The `type:'subscription'` branch is **dead code**.
- [useRazorpay.tsx](../../src/hooks/useRazorpay.tsx) opens Razorpay Checkout in-app and falls back to a
  "Sandbox" mock modal (`sandbox_bypass_purchase` RPC) when no key is set.
- **Three defects this blueprint fixes:**
  - **D1 — ₹1 hole:** `razorpay-create-order` + `razorpay-verify` trust the client's `amount`/`item_type`.
  - **D2 — closed-tab loss:** entitlement is granted only if the browser calls `verify`; the webhook only
    handles recurring `subscription.*` events, which we never use.
  - **D3 — no real expiry:** [SubscriptionContext.tsx](../../src/contexts/SubscriptionContext.tsx) reads
    tier by `status='active'` only, ignoring `current_period_end`, so plans never expire.

### Verified live schema (project `zvcdqdtuzatmthrawrnv`)
- **`orders`**: `id uuid PK`, `user_id uuid NOT NULL`, `razorpay_order_id text NOT NULL`,
  `razorpay_payment_id text NULL` (**no unique constraint**), `item_type text NOT NULL`, `quantity int=1`,
  `amount_paid numeric NOT NULL`, `currency text='INR'`, `status text NOT NULL='created'`, timestamps.
- **`subscriptions`**: `user_id uuid` (**UNIQUE** → one row per user), `plan_name`, `status`,
  `expires_at` (legacy), `current_period_start`, `current_period_end`, `razorpay_subscription_id`,
  `razorpay_customer_id`, timestamps.
- **`user_usage`**: `super_like_balance`, `vibe_match_balance`, `bought_global_swipes`,
  `boosts_active_until`, … (matches the grant logic already in `razorpay-verify`).

---

## 5. THE CONTRACT (both sides code to this — do not change unilaterally)

Four hops. CC = Campus Connect, SU = Suhashi, RZP = Razorpay.

```
 STUDENT            CC (zvcdqdtuzatmthrawrnv)         SU (ycrwtvtdsbjbhdqyuptq)        RAZORPAY
   │                                                                                  
   │ tap "Get Elite (semester)"                                                        
   │─────────────▶ POST /functions/v1/payment-start  (JWT of the student)             
   │               • price = SERVER catalog[item_type]  (₹969 → 96900 paise)          
   │               • INSERT orders(status='pending', id=cc_purchase_id)               
   │               • token = sign({cc_purchase_id,user_id,item_type,qty,amount,exp})  
   │               ├──────────────────────────────▶ POST /functions/v1/cc-create-payment
   │               │                                 • verify token HMAC (shared secret)
   │               │                                 • create RZP Payment Link:        
   │               │                                     amount, notes:{cc_purchase_id},
   │               │                                     callback_url = CC /premium/return
   │               │                                 ├───────────────────────────────▶ create link
   │               │                                 ◀─────────────────────────────── short_url
   │               ◀────────────────────────────── { url: short_url }                 
   │ 302 redirect ◀ { url }                                                            
   │─────────────────────────────────────────────────────────────────────────────▶ pays (UPI) on RZP page
   │                                                                                  │
   │        (A) SERVER→SERVER, source of truth:                                       │
   │               POST /functions/v1/razorpay-webhook  ◀───────────────────────────── payment.captured /
   │               • verify x-razorpay-signature                                        payment_link.paid
   │               • read notes.cc_purchase_id                                          
   │               • confirm amount == orders.amount_paid  AND status==captured (RZP API)
   │               • idempotent on razorpay_payment_id → mark paid + GRANT entitlement 
   │                                                                                  │
   │        (B) UX only: RZP redirects student back                                    │
   │◀───────────────────────────────────────────────────────────────────────────────  to CC /premium/return
   │ /premium/return polls order/subscription → "Success 🎉", plan already active      
```

### 5.1 Handoff token (CC → SU)
`token = base64url(payloadJSON) + "." + hex(HMAC_SHA256(base64url(payloadJSON), SUHASHI_HANDOFF_SECRET))`
```jsonc
payload = {
  "v": 1,
  "cc_purchase_id": "<orders.id uuid>",   // correlation key
  "user_id": "<auth uid>",
  "item_type": "sub_elite_semester",       // or boost_pack, super_like_pack, ...
  "quantity": 1,
  "amount_paise": 96900,                    // authoritative, computed by CC server catalog
  "currency": "INR",
  "iat": 1751880000,
  "exp": 1751880900                         // 15 min
}
```
SU **must reject** if the HMAC is invalid or `exp` is past.

### 5.2 What SU must attach to the Razorpay order/link (non-negotiable)
```jsonc
notes: { "cc_purchase_id": "<uuid>", "source": "campus_connect", "item_type": "sub_elite_semester" }
callback_url: "https://<campus-connect-domain>/premium/return?ref=<cc_purchase_id>"
```
`notes.cc_purchase_id` is the **only** way CC matches a Razorpay payment back to the right student/order.

### 5.3 Grant back (RZP → CC), the automatic part
- The **Razorpay webhook** on the shared account is pointed at CC's `razorpay-webhook` (add a 2nd webhook
  endpoint if SU already uses one — Razorpay allows multiple). Events: `payment.captured`, `order.paid`,
  `payment_link.paid`. Secret = `RAZORPAY_WEBHOOK_SECRET`.
- CC verifies the signature, reads `notes.cc_purchase_id`, and — because CC also holds the Razorpay
  `KEY_SECRET` — independently calls `GET https://api.razorpay.com/v1/payments/{id}` to confirm
  `status==captured` and `amount==orders.amount_paid*100`. Only then does it grant. This means CC does **not
  have to blindly trust** SU's callback.

### 5.4 Return URL contract (SU/RZP → CC, UX only)
`GET https://<cc>/premium/return?ref=<cc_purchase_id>&razorpay_payment_link_status=paid` (params passed
through by Razorpay). CC's return page treats this as a *hint* and confirms via its own DB (which the
webhook updates), never granting from query params alone.

---

## 6. Data model changes

### 6.1 Campus Connect (`zvcdqdtuzatmthrawrnv`) — migration
```sql
-- Allow a pending order to exist before the Razorpay order/link is created
ALTER TABLE public.orders ALTER COLUMN razorpay_order_id DROP NOT NULL;

-- Idempotency: never grant the same payment twice (partial unique ignores NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS orders_razorpay_payment_id_uidx
  ON public.orders (razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;

-- Status vocabulary: 'pending' -> 'paid' | 'failed' | 'expired'
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_chk
  CHECK (status IN ('created','pending','paid','failed','expired'));

-- Optional: auto-expire abandoned pending orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS expires_at timestamptz;
```
- **Subscriptions:** standardize on `current_period_end` as the effective expiry. Keep `expires_at` in
  sync (write both) for any legacy reader, or migrate readers off it. Grant = upsert on `user_id`
  (UNIQUE already exists) with `plan_name`, `status='active'`, `current_period_start=now()`,
  `current_period_end=now()+interval`.
- **RLS:** students `SELECT` their own `orders`/`subscriptions`; **all writes are service-role only** (edge
  functions). No client insert/update on these tables. Verify current policies during Phase 1 and lock down.

### 6.2 Suhashi (`ycrwtvtdsbjbhdqyuptq`)
- Ideally **no schema change**. `cc-create-payment` is stateless (verify token → mint link). Optionally log
  to a `cc_payment_intents` table for the friend's own reconciliation (not required by CC).

---

## 7. Server-side price catalog (the authority that kills the ₹1 hole)

A single trusted map, mirrored on **both** edge sides (CC computes it; SU re-validates the token amount
against the same table). Source of the numbers = [subscriptionPlans.ts](../../src/config/subscriptionPlans.ts).

| `item_type` | ₹ | paise | grant |
|---|---|---|---|
| `sub_plus_monthly` | 169 | 16900 | plus, +30d |
| `sub_plus_quarterly` | 469 | 46900 | plus, +90d |
| `sub_plus_semester` | 769 | 76900 | plus, +180d |
| `sub_elite_monthly` | 469 | 46900 | elite, +30d |
| `sub_elite_quarterly` | 769 | 76900 | elite, +90d |
| `sub_elite_semester` | 969 | 96900 | elite, +180d |
| `campus_explorer_pass` / `general_explorer_pass` | 99 | 9900 | +10 global swipes |
| `specific_campus_pass` | 49 | 4900 | 1 explorer hop (3 swipes, 24h) |
| `specific_mystery_pass` | 49 | 4900 | 1 mystery hop (24h) |
| `super_like_pack` (q=3 / q=10) | 69 / 169 | 6900 / 16900 | +N super_like_balance |
| `vibe_match_pack` (q=2 / q=5) | 69 / 149 | 6900 / 14900 | +N vibe_match_balance |
| `boost_pack` (q=1/5/10) | 39 / 149 / 249 | … | +30·N min boost |

The edge function computes amount from `(item_type, quantity)` and **ignores any client-sent amount**. For
packs, only the whitelisted `(item_type, quantity)` pairs above are accepted.

---

## 8. Edge functions in detail

### 8.1 NEW — CC `payment-start`  (`verify_jwt: true`)
**In:** `{ item_type, quantity?, target_university_id? }` (+ student JWT).
**Does:**
1. Extract `user_id` from JWT.
2. `amount_paise = catalog(item_type, quantity)` → 400 if unknown/invalid pair.
3. `INSERT orders (id=gen, user_id, item_type, quantity, amount_paid=amount/100, status='pending', expires_at=now()+15m)`.
4. `token = signHandoff({...})`.
5. `POST {SUHASHI_FUNCTIONS_URL}/cc-create-payment { token }` → `{ url }`.
6. Return `{ url, cc_purchase_id }`.
**Out:** `{ url }` for the browser to redirect to.

### 8.2 NEW — SU `cc-create-payment`  (`verify_jwt: false`, HMAC-guarded)
**In:** `{ token }`.
**Does:** verify HMAC + `exp`; re-check `amount_paise == catalog(item_type, quantity)`; create Razorpay
**Payment Link** (`POST /v1/payment_links`) with `amount`, `currency`, `notes` (§5.2), `callback_url`,
`callback_method:'get'`; return `{ url: response.short_url }`. Uses Suhashi's `RAZORPAY_KEY_ID/SECRET`.

### 8.3 EXTEND — CC `razorpay-webhook`  (`verify_jwt: false`) — the automatic grant
Add handlers for `payment.captured` / `order.paid` / `payment_link.paid`:
1. Verify `x-razorpay-signature` with `RAZORPAY_WEBHOOK_SECRET` (already implemented).
2. Pull `cc_purchase_id` from `payload...notes`.
3. Load the pending `orders` row; if already `status='paid'` with a `razorpay_payment_id` → **return 200
   (idempotent no-op)**.
4. Independently `GET /v1/payments/{payment_id}` (CC's key) → assert `captured` and `amount == order.amount_paid*100`.
5. In a transaction: set `orders.status='paid'`, `razorpay_payment_id=…` (unique index enforces once-only),
   then **grant** via shared logic (§8.5).
6. Return 200 quickly (Razorpay retries on non-2xx — idempotency covers retries).

### 8.4 HARDEN — CC `razorpay-verify`  (`verify_jwt: true`) — fast-path only
Keep for the return-redirect fast unlock, but: **re-derive amount + entitlement from the server catalog**
(ignore client amount/item_type except as a lookup key tied to the order row), and make the grant the
**same idempotent function** as the webhook so the two can race safely. If the webhook already granted, this
is a no-op.

### 8.5 Shared grant logic (one implementation, called by both webhook & verify)
Keyed on `razorpay_payment_id` for idempotency. Branch on `item_type`:
- `sub_*` → upsert `subscriptions` (plan_name, status='active', current_period_end = now()+30/90/180d, mirror `expires_at`).
- `boost_pack` → extend `user_usage.boosts_active_until` + insert `boost_purchases`.
- `super_like_pack` → `user_usage.super_like_balance += qty` + insert `super_like_purchases`.
- `vibe_match_pack` → `user_usage.vibe_match_balance += qty`.
- `general_explorer_pass` → `user_usage.bought_global_swipes += 10`.
- `specific_campus_pass`/`specific_mystery_pass` → insert `manual_uni_hops`.
(This mirrors the branches already in [razorpay-verify](../../supabase/functions/razorpay-verify/index.ts),
lifted into one reusable module so webhook + verify share it.)

---

## 9. Frontend changes (Campus Connect)

- **[src/App.tsx](../../src/App.tsx):** add lazy route `/premium/return` → new `PremiumReturn` page (inside `ProtectedRoute`).
- **[src/hooks/useRazorpay.tsx](../../src/hooks/useRazorpay.tsx):** replace "open in-app Checkout" with:
  call `payment-start` → `window.location.assign(url)`. Keep the sandbox mock **only** when
  `import.meta.env.DEV` and no key (local dev). All the existing callers (`initiatePayment`) keep their
  signatures — they just need `item_type` (already passed) and no longer need `amount` (server decides).
- **New `PremiumReturn` page:** reads `?ref=cc_purchase_id`, polls `orders`/`subscriptions` (React Query,
  ~2s interval, 60s cap) until `status='paid'` / tier active → success animation → route into the app.
  States: confirming / success / still-pending ("we'll unlock it the moment payment confirms") / failed-retry.
- **[src/contexts/SubscriptionContext.tsx](../../src/contexts/SubscriptionContext.tsx):** fix **D3** — read
  tier only when `status='active' AND current_period_end > now()`; treat expired as `free`. Refresh on
  return-page success.
- **[src/pages/Premium/PremiumMembership.tsx](../../src/pages/Premium/PremiumMembership.tsx):** add the
  "Billed securely via SUHASHI" microcopy near the pay button (see §11).

---

## 10. Security model

| Threat | Mitigation |
|---|---|
| **Price tampering (₹1 for Elite)** | Amount from server catalog on both CC & SU; webhook re-verifies captured amount via Razorpay API. Client amount ignored. |
| **Forged "I paid" callback** | Grant only from signed Razorpay **webhook** + independent Razorpay API check. Return-page query params never grant. |
| **Replaying a webhook / double-grant** | Unique index on `orders.razorpay_payment_id` + idempotent grant. |
| **Forged handoff to SU** | HMAC(`SUHASHI_HANDOFF_SECRET`) + short `exp`. |
| **Secret leakage** | Secrets only in Edge Function secrets; only `VITE_RAZORPAY_KEY_ID` (public) client-side. Rotate the pasted ones (Phase 2). |
| **Cross-project blast radius** | SU never gets CC's service role and vice-versa; each project's functions use their own. |
| **RLS** | `orders`/`subscriptions` writes are service-role only; students read only their own rows. |

---

## 11. Compliance & UX reality (must communicate)
- Razorpay sheet + the student's **bank statement show "SUHASHI"**, not Campus Connect. Add checkout
  microcopy: *"Payments are processed securely by our partner SUHASHI via Razorpay."*
- Running a (dating-category) revenue stream through a cafe's KYC/settlement account **risks fund holds /
  freeze**. Interim arrangement; the clean fix is CC's own account later (same code, new keys). Keep
  transaction volume/labels sane; monitor the Razorpay dashboard.

## 12. Idempotency & reconciliation
- Every grant is keyed on `razorpay_payment_id`. Webhook and verify can both fire; first writer wins,
  second is a no-op.
- `orders` is the ledger (pending → paid/failed/expired). A nightly job flips stale `pending` (past
  `expires_at`) → `expired`. Admin can reconcile CC `orders` vs Razorpay payments by `cc_purchase_id`
  (stored in Razorpay `notes`).

## 13. Expiry enforcement
- Read-time: tier resolves to `free` once `current_period_end < now()`.
- Cleanup: `pg_cron` (or the existing purge pattern) sets expired `subscriptions.status='expired'` hourly so
  stale rows don't linger. One-time items already carry their own expiry (`boosts_active_until`, hop `expires_at`).

---

## 14. Test plan (all in Razorpay **TEST mode** first, `rzp_test_…`)
1. **Happy path** — buy each of the 6 plans + each one-time item → correct entitlement, correct expiry date.
2. **Closed-tab (D2)** — pay, then kill the browser before redirect → webhook still grants within seconds.
3. **Under-pay (D1)** — tamper the client to request a cheaper amount → `payment-start`/SU reject; even if
   forced, webhook amount-check refuses the grant.
4. **Double webhook** — replay the same `payment.captured` → exactly one grant.
5. **Expiry (D3)** — set `current_period_end` in the past → tier reads `free`; buying again re-activates.
6. **Failure/cancel** — abandon on the Razorpay page → order stays `pending`→`expired`, no entitlement,
   friendly retry.
7. **Signature failures** — bad webhook signature / bad handoff HMAC → 400, no grant.

## 15. Go-live checklist (Phase 2)
- [ ] Set CC edge secrets (`RAZORPAY_KEY_ID/SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `SUHASHI_HANDOFF_SECRET`, `SUHASHI_FUNCTIONS_URL`).
- [ ] Set SU edge secrets (same Razorpay keys, `RAZORPAY_WEBHOOK_SECRET`, `SUHASHI_HANDOFF_SECRET`, CC return URL).
- [ ] Register the **live** Razorpay webhook → CC `razorpay-webhook`, events subscribed, secret set.
- [ ] Swap CC `.env` / Vercel to the **live** `VITE_RAZORPAY_KEY_ID` (already set) and redeploy.
- [ ] One real ₹ transaction end-to-end; confirm settlement shows in the Razorpay dashboard.
- [ ] **Rotate** the Razorpay secret + Supabase access token that were shared in chat.
- [ ] Update [../06-known-issues/README.md](../06-known-issues/README.md) (payments no longer mocked; D1/D2/D3 closed).

---

## 16. Phase plan (each phase leaves `main` working; ship one at a time)

### Phase 0 — Config & contract lock  *(no product code)*
- Generate `SUHASHI_HANDOFF_SECRET`; set **test-mode** Razorpay keys as edge secrets on both projects.
- Friend confirms/implements `cc-create-payment` shape (§5, §8.2) and webhook routing (§5.3).
- **Exit:** a hand-crafted test-mode call round-trips a Payment Link and CC can read `notes.cc_purchase_id`.

### Phase 1 — Core flow + hardening, TEST mode
- CC migration (§6.1). Server price catalog (§7). `payment-start` (§8.1). Extend `razorpay-webhook` (§8.3).
  Harden `razorpay-verify` + shared grant module (§8.4–8.5). Frontend redirect + `/premium/return` + expiry
  fix (§9). SU `cc-create-payment` (§8.2).
- **Exit:** the entire §14 test plan passes in test mode.

### Phase 2 — Go live
- Run §15. Live keys, live webhook, branding microcopy, secret rotation, reconciliation spot-check.
- **Exit:** one real transaction unlocks a real plan; docs updated.

### Phase 3 — (later, optional) Auto-renew
- Real Razorpay recurring plans for CC's tiers, mandate flow, `subscription.charged` webhook (already
  scaffolded), dunning. Only if data shows demand.

---

## 17. Info still needed (from you / your friend)
1. **Campus Connect production domain** (for `callback_url` + webhook allowed origins). Vercel URL / custom domain?
2. **Friend's decision:** host `cc-create-payment` as a **Suhashi Supabase Edge Function** (I can build/deploy it) or in the Suhashi Next.js app (he builds; same contract)?
3. Confirm we may **add a second webhook** on the Razorpay account pointing at CC (or is one free to repurpose?).
4. Agree the **`SUHASHI_HANDOFF_SECRET`** value (I can generate one).
5. Any existing Suhashi reconciliation needs (should `cc-create-payment` log intents in Suhashi's DB?).

## 18. Rollback plan
- Feature is additive; the old in-app Checkout + sandbox path stays until Phase 2 flips the redirect on.
- If a phase misbehaves: revert the CC frontend to open Checkout in-app (one-line branch in `useRazorpay`),
  leave webhook/verify in place (idempotent, harmless). No data migration is destructive (all additive).

## 19. Appendix — quick reference
- CC functions base: `https://zvcdqdtuzatmthrawrnv.functions.supabase.co/<fn>`
- SU functions base: `https://ycrwtvtdsbjbhdqyuptq.functions.supabase.co/<fn>`
- Razorpay API: `https://api.razorpay.com/v1/{payment_links,payments,orders}` (Basic auth `key_id:key_secret`).
- Item types & prices: §7. Contract: §5. Secrets: §1.

## 20. Close-out (fill on completion)
- [ ] Folded into `docs/03-features/monetization-and-premium.md`
- [ ] `docs/02-backend/*` updated (new/changed edge functions + orders/subscriptions)
- [ ] `docs/03-features/README.md` status table updated
- [ ] `docs/06-known-issues/README.md` updated (D1/D2/D3 closed; payments real)
- [ ] `docs/08-roadmap/*` updated
- [ ] QA + backend checklists run and passing
