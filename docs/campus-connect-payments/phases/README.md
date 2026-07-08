# Campus Connect ⇄ Suhashi Razorpay Payments — Phase-by-Phase Execution Pack

> **How to use this pack:** Each phase is a **self-contained brief** you can drop into a *fresh* Claude
> conversation. Start a new chat and say *"Do Phase 0 from `docs/features/phases/phase-0-config-and-contract.md`"*.
> The agent must **read this README + the [blueprint](../payments-via-suhashi-razorpay.md) first**, then
> execute only that phase, run the phase's **Self-Test** section, and stop. Each phase leaves both apps working.

This README is the **shared cold-start context** every phase relies on. Phases reference it instead of
repeating it. Read it once per phase before touching code.

---

## 0. The two systems (memorize these)

| | **Campus Connect (CC)** — "grant features" | **Suhashi (SU)** — "take the money" |
|---|---|---|
| Repo on disk | `c:\Users\kaust\OneDrive\Desktop\Campus Connect\` | `c:\Users\kaust\OneDrive\Desktop\suhashi\pos-system\` |
| Stack | React 19 + Vite (SPA) | Next.js 16 App Router + `razorpay` SDK v2.9.6 |
| Supabase project id | `zvcdqdtuzatmthrawrnv` (RGU Connect) | `ycrwtvtdsbjbhdqyuptq` |
| Supabase MCP tool prefix | `mcp__claude_ai_Supabase__*` (pass `project_id`) | `mcp__supabase-suhashi__*` |
| Functions base URL | `https://zvcdqdtuzatmthrawrnv.functions.supabase.co/<fn>` | Next routes: `https://suhashico.vercel.app/api/<route>` |
| Owns Razorpay acct? | No (borrows SU's) | **Yes** — live `rzp_live_T7DDq9ZhqgVv0H`, KYC-approved |

**Razorpay is one shared merchant account.** SU's own POS billing uses **recurring** subscriptions
(`subscription.*` webhook events). CC will use **one-time Payment Links** (`payment_link.paid` /
`payment.captured` events). Disjoint → they never interfere.

## 1. What we're building (the automatic flow)

```
Student taps buy → CC payment-start (prices it server-side, makes a pending order, signs a token)
   → SU /api/campus-connect/create-payment (verifies token, makes a Razorpay Payment Link w/ notes.cc_purchase_id)
   → student pays on Razorpay's hosted page (UPI)
   → Razorpay fires payment webhook → CC razorpay-webhook verifies + GRANTS the plan (automatic, idempotent)
   → student is redirected back to CC /premium/return which shows success (plan already active)
```
Full contract + sequence diagram: [blueprint §5](../payments-via-suhashi-razorpay.md#5-the-contract-both-sides-code-to-this--do-not-change-unilaterally).

## 2. Secret placement (get this wrong = you leak money)

`VITE_` (CC) and `NEXT_PUBLIC_` (SU) values are **compiled into the browser and public**. Never put a
secret behind those prefixes.

| Secret | Value (current) | Lives in |
|---|---|---|
| `VITE_RAZORPAY_KEY_ID` | `rzp_live_T7DDq9ZhqgVv0H` | CC `.env` / Vercel (public — OK) |
| `RAZORPAY_KEY_ID` | `rzp_live_T7DDq9ZhqgVv0H` | CC **edge secrets** + SU `.env.local`/Vercel |
| `RAZORPAY_KEY_SECRET` | `n4NesK4iOOetAOTWvn4umfGW` | CC **edge secrets** + SU `.env.local`/Vercel (server only) |
| `RAZORPAY_WEBHOOK_SECRET` | `wedrip_os_secure_hook_2026_xyz` (CC may use its own) | CC **edge secrets** + Razorpay dashboard webhook |
| `SUHASHI_HANDOFF_SECRET` | **generate in Phase 0** | CC **edge secrets** + SU `.env.local`/Vercel |
| `SUHASHI_CREATE_PAYMENT_URL` | `https://suhashico.vercel.app/api/campus-connect/create-payment` | CC **edge secrets** |
| `CC_RETURN_URL` | `https://<cc-domain>/premium/return` | SU `.env.local`/Vercel |

> ⚠️ The live secret + Supabase access token were shared in chat → **rotate in Phase 2**.

## 3. Server-side price catalog (the authority — kills the "pay ₹1 for Elite" hole)

Source of truth for numbers: `Campus Connect/src/config/subscriptionPlans.ts`. Both CC (`payment-start`,
`razorpay-webhook`) and SU (`create-payment`) validate against **this exact table**; the client-sent
amount is ignored.

| `item_type` | qty | ₹ | paise | grant |
|---|---|---|---|---|
| `sub_plus_monthly` | 1 | 169 | 16900 | tier=plus, +30d |
| `sub_plus_quarterly` | 1 | 469 | 46900 | tier=plus, +90d |
| `sub_plus_semester` | 1 | 769 | 76900 | tier=plus, +180d |
| `sub_elite_monthly` | 1 | 469 | 46900 | tier=elite, +30d |
| `sub_elite_quarterly` | 1 | 769 | 76900 | tier=elite, +90d |
| `sub_elite_semester` | 1 | 969 | 96900 | tier=elite, +180d |
| `general_explorer_pass` | 1 | 99 | 9900 | +10 bought_global_swipes |
| `specific_campus_pass` | 1 | 49 | 4900 | manual_uni_hop (explorer, 3 swipes, 24h) |
| `specific_mystery_pass` | 1 | 49 | 4900 | manual_uni_hop (mystery, 24h) |
| `super_like_pack` | 3 / 10 | 69 / 169 | 6900 / 16900 | +qty super_like_balance |
| `vibe_match_pack` | 2 / 5 | 69 / 149 | 6900 / 14900 | +qty vibe_match_balance |
| `boost_pack` | 1 / 5 / 10 | 39 / 149 / 249 | 3900 / 14900 / 24900 | +30·qty min boost |

Only whitelisted `(item_type, qty)` pairs are accepted.

## 4. Live schema facts (verified 2026-07-07, project `zvcdqdtuzatmthrawrnv`)

- `orders`: `id`, `user_id`, `razorpay_order_id text NOT NULL` (**Phase 1 makes it nullable**),
  `razorpay_payment_id text` (**Phase 1 adds a unique index**), `item_type`, `quantity`, `amount_paid numeric`,
  `currency`, `status text='created'`, timestamps.
- `subscriptions`: `user_id` **UNIQUE**, `plan_name`, `status`, `expires_at` (legacy), `current_period_start`,
  `current_period_end`, `razorpay_subscription_id`, `razorpay_customer_id`. Grant = upsert on `user_id`.
- `user_usage`: `super_like_balance`, `vibe_match_balance`, `bought_global_swipes`, `boosts_active_until`.

## 5. Three defects the build fixes (verify each is closed in its phase)
- **D1 — ₹1 hole:** client currently dictates price. Fixed by §3 server catalog + webhook amount re-check.
- **D2 — closed-tab loss:** grant only happened if the browser returned. Fixed by webhook-driven grant.
- **D3 — no expiry:** `SubscriptionContext` reads `status='active'` only. Fixed by `current_period_end` check.

## 6. Phase index

| Phase | File | Goal | Touches |
|---|---|---|---|
| 0 | [phase-0-config-and-contract.md](phase-0-config-and-contract.md) | Secrets, test keys, contract lock, connectivity | Config + Razorpay dashboard only |
| 1 | [phase-1-core-flow-and-hardening.md](phase-1-core-flow-and-hardening.md) | Build the whole flow in **TEST mode** | CC edge fns + CC frontend + SU route + both DBs |
| 2 | [phase-2-go-live.md](phase-2-go-live.md) | Flip to **live**, rotate secrets, reconcile | Config + Razorpay dashboard + docs |
| 3 | [phase-3-auto-renew.md](phase-3-auto-renew.md) | (Optional, later) auto-renewing subscriptions | CC + SU + Razorpay plans |

## 7. Rules for every phase
1. **Read this README + the [blueprint](../payments-via-suhashi-razorpay.md) before editing.**
2. Do **only** the current phase. Leave both apps working.
3. Run the phase's **Self-Test** and paste the evidence. Do not mark a phase done until its test passes.
4. In CC, `npm run build` must pass. In SU, `npm run build` must pass.
5. Never commit real secrets. Only `VITE_RAZORPAY_KEY_ID` (public) belongs in a client file.
6. Update the phase's "Done checklist" + the [blueprint](../payments-via-suhashi-razorpay.md) status when finished.
