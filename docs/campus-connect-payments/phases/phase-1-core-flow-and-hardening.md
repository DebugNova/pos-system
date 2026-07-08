# Phase 1 — Core Flow + Hardening (TEST mode)

- **Status:** Not started
- **Prerequisite:** Phase 0 complete (secrets set with **test** keys; contract confirmed).
- **Touches:** **CC** edge functions + frontend + DB · **SU** one Next.js route + env · both Supabase DBs.
- **Goal:** the entire automatic payment→grant flow works end-to-end in **Razorpay TEST mode**, with all
  three defects (D1 ₹1-hole, D2 closed-tab, D3 expiry) closed. **No real money. No live keys.**

> 🔴 **READ FIRST:** [`README.md`](README.md) + [blueprint](../payments-via-suhashi-razorpay.md). Do only
> Phase 1. `npm run build` must pass in both repos. Run every Self-Test (§1.9) and paste evidence.

Path shorthand: **[CC]** = `c:\Users\kaust\OneDrive\Desktop\Campus Connect\` · **[SU]** =
`c:\Users\kaust\OneDrive\Desktop\suhashi\pos-system\`.

---

## 1.1 Build order (do in this sequence)
1. CC DB migration (§1.2)
2. CC shared modules: price catalog + grant logic + HMAC (§1.3)
3. CC edge function `payment-start` (§1.4)
4. CC edge function `razorpay-webhook` — extend (§1.5)
5. CC edge function `razorpay-verify` — harden (§1.6)
6. SU route `create-payment` (§1.7)
7. CC frontend: redirect + `/premium/return` + expiry fix (§1.8)
8. Deploy + Self-Test (§1.9)

---

## 1.2 [CC] Database migration (Supabase `zvcdqdtuzatmthrawrnv`)
Apply via `mcp__claude_ai_Supabase__apply_migration` (name: `payments_handoff_phase1`):
```sql
-- Allow a pending order to exist before the Razorpay order/link is created
ALTER TABLE public.orders ALTER COLUMN razorpay_order_id DROP NOT NULL;

-- Idempotency: a given Razorpay payment can be granted exactly once
CREATE UNIQUE INDEX IF NOT EXISTS orders_razorpay_payment_id_uidx
  ON public.orders (razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;

-- Status vocabulary
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_chk;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_chk CHECK (status IN ('created','pending','paid','failed','expired'));

-- Abandoned pending-order cleanup marker
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Store the SU Payment Link id for correlation/debugging (optional but useful)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS razorpay_payment_link_id text;
```
Also verify/lock RLS (introspect first; add only if missing): students may `SELECT` their own `orders` &
`subscriptions`; **no client INSERT/UPDATE** on either (edge functions use the service role). Do not weaken
existing policies.

## 1.3 [CC] Shared modules (new files under `[CC]supabase/functions/_shared/`)

### `catalog.ts` — the price authority (mirrors `src/config/subscriptionPlans.ts`)
```ts
// Returns amount in paise + the grant descriptor, or null if the (item_type, qty) pair is not allowed.
export type Grant =
  | { kind: 'sub'; tier: 'plus' | 'elite'; days: 30 | 90 | 180 }
  | { kind: 'boost'; minutes: number }
  | { kind: 'super_like'; qty: number }
  | { kind: 'vibe_match'; qty: number }
  | { kind: 'global_swipes'; count: number }
  | { kind: 'uni_hop'; hop: 'explorer' | 'mystery' };

export function priceFor(item_type: string, qty = 1): { paise: number; grant: Grant } | null {
  switch (item_type) {
    case 'sub_plus_monthly':    return { paise: 16900, grant: { kind:'sub', tier:'plus',  days:30  } };
    case 'sub_plus_quarterly':  return { paise: 46900, grant: { kind:'sub', tier:'plus',  days:90  } };
    case 'sub_plus_semester':   return { paise: 76900, grant: { kind:'sub', tier:'plus',  days:180 } };
    case 'sub_elite_monthly':   return { paise: 46900, grant: { kind:'sub', tier:'elite', days:30  } };
    case 'sub_elite_quarterly': return { paise: 76900, grant: { kind:'sub', tier:'elite', days:90  } };
    case 'sub_elite_semester':  return { paise: 96900, grant: { kind:'sub', tier:'elite', days:180 } };
    case 'general_explorer_pass': return { paise: 9900, grant: { kind:'global_swipes', count:10 } };
    case 'specific_campus_pass':  return { paise: 4900, grant: { kind:'uni_hop', hop:'explorer' } };
    case 'specific_mystery_pass': return { paise: 4900, grant: { kind:'uni_hop', hop:'mystery' } };
    case 'super_like_pack':
      if (qty === 3)  return { paise: 6900,  grant:{ kind:'super_like', qty:3 } };
      if (qty === 10) return { paise: 16900, grant:{ kind:'super_like', qty:10 } };
      return null;
    case 'vibe_match_pack':
      if (qty === 2) return { paise: 6900,  grant:{ kind:'vibe_match', qty:2 } };
      if (qty === 5) return { paise: 14900, grant:{ kind:'vibe_match', qty:5 } };
      return null;
    case 'boost_pack':
      if (qty === 1)  return { paise: 3900,  grant:{ kind:'boost', minutes:30  } };
      if (qty === 5)  return { paise: 14900, grant:{ kind:'boost', minutes:150 } };
      if (qty === 10) return { paise: 24900, grant:{ kind:'boost', minutes:300 } };
      return null;
    default: return null;
  }
}
```

### `hmac.ts` — handoff token sign/verify (Deno WebCrypto)
```ts
const enc = new TextEncoder();
async function hmacHex(msg: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2,'0')).join('');
}
export function b64url(s: string){ return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
export function b64urlDecode(s: string){ return atob(s.replace(/-/g,'+').replace(/_/g,'/')); }

export async function signHandoff(payload: object, secret: string): Promise<string> {
  const p = b64url(JSON.stringify(payload));
  return p + '.' + await hmacHex(p, secret);
}
export async function verifyHandoff(token: string, secret: string): Promise<any | null> {
  const [p, sig] = token.split('.');
  if (!p || !sig) return null;
  if (await hmacHex(p, secret) !== sig) return null;
  const data = JSON.parse(b64urlDecode(p));
  if (typeof data.exp === 'number' && data.exp * 1000 < Date.now()) return null;
  return data;
}
```

### `grant.ts` — idempotent entitlement (lifts the branches from `razorpay-verify`)
Signature: `grantForOrder(admin, order, razorpay_payment_id): Promise<void>`.
- Guard: `if (order.status === 'paid' && order.razorpay_payment_id) return;` (idempotent).
- Compute `const spec = priceFor(order.item_type, order.quantity)` — if null, throw (should never happen; order was priced on creation).
- Set `orders.status='paid'`, `razorpay_payment_id=…` (unique index enforces once-only; catch unique-violation → treat as already-granted no-op).
- Then branch on `spec.grant.kind`:
  - `sub` → upsert `subscriptions` on `user_id`: `plan_name=tier, status='active', current_period_start=now(), current_period_end=now()+days, expires_at=same`.
  - `boost` → extend `user_usage.boosts_active_until` by `minutes` (from max(now, existing)) + insert `boost_purchases`.
  - `super_like` → `user_usage.super_like_balance += qty` + insert `super_like_purchases`.
  - `vibe_match` → `user_usage.vibe_match_balance += qty`.
  - `global_swipes` → `user_usage.bought_global_swipes += count`.
  - `uni_hop` → insert `manual_uni_hops` (explorer: swipes_remaining=3; mystery:0; expires_at=now()+24h; needs `order.target_university_id` — store it on the order in Phase 1 via an added `target_university_id` column, OR pass through notes).
  (Mirror the exact writes already in `[CC]supabase/functions/razorpay-verify/index.ts` lines ~114–237.)

> **Add `orders.target_university_id uuid`** in the §1.2 migration if you want uni-hop passes to work through
> this path (the current verify reads it from the request body; here it must live on the pending order).

## 1.4 [CC] NEW edge function `payment-start`  (`[CC]supabase/functions/payment-start/index.ts`, `verify_jwt: true`)
```
INPUT  (POST, student JWT):  { item_type: string, quantity?: number, target_university_id?: string }
STEPS:
  1. userId = sub from JWT (same decode as existing functions).
  2. spec = priceFor(item_type, quantity ?? 1); if null → 400 "invalid item".
  3. INSERT orders { user_id, item_type, quantity, amount_paid: spec.paise/100, currency:'INR',
        status:'pending', expires_at: now()+15m, target_university_id }  → returns id = cc_purchase_id.
  4. token = signHandoff({ v:1, cc_purchase_id, user_id:userId, item_type, quantity, amount_paise: spec.paise,
        currency:'INR', iat, exp: now+900s }, SUHASHI_HANDOFF_SECRET).
  5. res = fetch(SUHASHI_CREATE_PAYMENT_URL, { method:'POST', body: JSON.stringify({ token }) }).
  6. return { url: res.short_url, cc_purchase_id }.
OUTPUT: { url } — the browser redirects here.
```
Deploy with `mcp__claude_ai_Supabase__deploy_edge_function` (project `zvcdqdtuzatmthrawrnv`), `verify_jwt=true`.

## 1.5 [CC] EXTEND `razorpay-webhook`  (`[CC]supabase/functions/razorpay-webhook/index.ts`)
Keep the existing signature check + `subscription.*` handlers. **Add** handling for one-time payments:
```
on 'payment_link.paid' | 'payment.captured' | 'order.paid':
  entity   = event.payload.payment?.entity ?? event.payload.payment_link?.entity
  ccId     = entity.notes?.cc_purchase_id  (payment_link.paid carries notes on the link;
             payment.captured carries notes on the payment — read whichever is present)
  paymentId= event.payload.payment?.entity?.id ?? entity.id
  amount   = event.payload.payment?.entity?.amount ?? entity.amount
  if !ccId → 200 ignore (not a CC payment)
  order = select * from orders where id = ccId
  if !order → 200 ignore
  if order.status === 'paid' → 200 (idempotent)
  // independent verification (optional but recommended): GET /v1/payments/{paymentId} with CC key,
  //   assert status==='captured'
  if amount !== round(order.amount_paid*100) → 200 + log "amount mismatch, refusing"  // D1 safety net
  await grantForOrder(admin, order, paymentId)
  return 200
```
Redeploy (`verify_jwt=false` — Razorpay can't send a Supabase JWT).

> **Idempotency + retries:** always return HTTP 200 on handled/ignored events so Razorpay doesn't disable the
> webhook. The unique index on `razorpay_payment_id` makes double-delivery a no-op.

## 1.6 [CC] HARDEN `razorpay-verify`  (`[CC]supabase/functions/razorpay-verify/index.ts`)
This is now only the **fast-path** for the return redirect (nice UX, not the source of truth).
- After signature check, **look up the order by `cc_purchase_id`** (pass it from the client return page) and
  call the **same `grantForOrder`** — do **not** trust client `amount`/`item_type` anymore (kills D1 here too).
- If the webhook already granted, `grantForOrder`'s idempotency makes this a no-op. Safe to race.

## 1.7 [SU] NEW route `create-payment`  (`[SU]app/api/campus-connect/create-payment/route.ts`)
Mirror the existing pattern in `[SU]app/api/razorpay/create-subscription/route.ts`.
```ts
import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import crypto from 'crypto';
// --- inline the same price catalog as README §3 (keep in sync with CC catalog.ts) ---
function priceFor(item_type: string, qty = 1): number | null { /* returns paise or null */ }

function verifyHandoff(token: string, secret: string): any | null {
  const [p, sig] = token.split('.');
  if (!p || !sig) return null;
  const expect = crypto.createHmac('sha256', secret).update(p).digest('hex');
  if (expect !== sig) return null;
  const data = JSON.parse(Buffer.from(p, 'base64url').toString());
  if (typeof data.exp === 'number' && data.exp * 1000 < Date.now()) return null;
  return data;
}

export async function POST(req: Request) {
  const { token } = await req.json();
  const data = verifyHandoff(token, process.env.SUHASHI_HANDOFF_SECRET!);
  if (!data) return NextResponse.json({ error: 'bad token' }, { status: 401 });

  const expected = priceFor(data.item_type, data.quantity ?? 1);
  if (expected == null || expected !== data.amount_paise)
    return NextResponse.json({ error: 'amount mismatch' }, { status: 400 });

  const razorpay = new Razorpay({
    key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
  const link = await razorpay.paymentLink.create({
    amount: data.amount_paise,
    currency: 'INR',
    accept_partial: false,
    description: `Campus Connect — ${data.item_type}`,
    notes: { cc_purchase_id: data.cc_purchase_id, source: 'campus_connect', item_type: data.item_type },
    callback_url: `${process.env.CC_RETURN_URL}?ref=${data.cc_purchase_id}`,
    callback_method: 'get',
  });
  return NextResponse.json({ url: link.short_url });
}
```
- Add `SUHASHI_HANDOFF_SECRET` + `CC_RETURN_URL` to `[SU].env.local` + Vercel (Phase 0 did this).
- `npm run build` in `[SU]` must pass.

## 1.8 [CC] Frontend
### `useRazorpay.tsx` (`[CC]src/hooks/useRazorpay.tsx`)
Replace the "open in-app Razorpay Checkout" block with:
```ts
const { data, error } = await supabase.functions.invoke('payment-start', {
  body: { item_type, quantity, target_university_id }
});
if (error || !data?.url) { onError?.(new Error('Could not start payment')); return; }
window.location.assign(data.url);   // hosted Razorpay Payment Link
```
Keep the sandbox mock modal **only** behind `import.meta.env.DEV && !rzpKey`. Existing callers keep their
`item_type`/`quantity` args; the `amount` arg becomes advisory (server decides).

### New page `PremiumReturn` (`[CC]src/pages/Premium/PremiumReturn.tsx`) + route in `[CC]src/App.tsx`
- Lazy route `/premium/return` inside `ProtectedRoute`.
- Read `?ref=<cc_purchase_id>`. Poll (React Query, 2s, cap 60s): `select status from orders where id=ref`
  and the user's `subscriptions`. States: **confirming** → **success** (order `paid` / tier active) →
  **still-pending** ("We'll unlock it the moment your payment confirms — safe to leave") → **failed** (retry).
- On success, call the subscription refresh so the app reflects the new tier immediately.

### Expiry fix `SubscriptionContext.tsx` (`[CC]src/contexts/SubscriptionContext.tsx`) — closes D3
Change the tier query from `.eq('status','active')` to also require a live period:
```ts
.eq('status','active')
.gt('current_period_end', new Date().toISOString())
```
(Fallback: if `current_period_end` is null on legacy rows, treat as active to avoid regressions — decide and
document.) Optionally add an hourly `pg_cron` job to flip expired rows to `status='expired'` (can defer to Phase 2).

---

## 1.9 Self-Test (agent runs ALL of these in TEST mode, pastes evidence)

> These prove the flow **without paying real money** by (a) driving the real functions and (b) POSTing
> **validly-signed** webhooks that mimic Razorpay.

**Setup:** pick a real test user id `U` (from `auth.users` on CC). Get a student JWT for `U` (or call
functions with a service test harness). Have the CC test webhook secret `W` handy.

**T1.1 — Migration applied**
`execute_sql`(CC): check `razorpay_order_id` is nullable, the unique index exists, and the status check exists:
```sql
select is_nullable from information_schema.columns where table_name='orders' and column_name='razorpay_order_id';
select indexname from pg_indexes where tablename='orders' and indexname='orders_razorpay_payment_id_uidx';
```
✅ `YES` + index present.

**T1.2 — `payment-start` prices server-side & creates a pending order + link**
`curl` the deployed function with a valid student JWT and `{ "item_type":"sub_elite_semester" }`.
✅ Returns `{ url: "https://rzp.io/..." }`; `execute_sql`(CC) shows a new `orders` row `status='pending'`,
`amount_paid=969.00`. **Tamper check (D1):** call with `{ "item_type":"sub_elite_semester","amount":1 }` →
the order is still `amount_paid=969.00` (client amount ignored).

**T1.3 — Automatic grant via signed webhook (D2: no browser needed)**
Take the `cc_purchase_id` from T1.2. Build a fake `payment.captured` body and sign it with `W`:
```bash
BODY='{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_TEST123","amount":96900,"status":"captured","notes":{"cc_purchase_id":"<ID>","source":"campus_connect"}}}}}'
SIG=$(node -e "const c=require('crypto');console.log(c.createHmac('sha256',process.argv[1]).update(process.argv[2]).digest('hex'))" "$W" "$BODY")
curl -s -X POST https://zvcdqdtuzatmthrawrnv.functions.supabase.co/razorpay-webhook \
  -H "x-razorpay-signature: $SIG" -H "content-type: application/json" -d "$BODY"
```
✅ 200; `execute_sql`(CC): the `orders` row is now `status='paid'`, `razorpay_payment_id='pay_TEST123'`, and
`subscriptions` for `U` is `plan_name='elite'`, `status='active'`, `current_period_end ≈ now()+180d`.

**T1.4 — Idempotency**
Re-POST the exact T1.3 request. ✅ 200, and **no** duplicate grant (still one paid order; period_end unchanged).

**T1.5 — Under-pay refused (D1 safety net at the webhook)**
New pending order for `sub_elite_semester` (₹969). POST a webhook with `amount:100`.
✅ 200 but **no grant** (order stays `pending`; logs show "amount mismatch"). Check `mcp__claude_ai_Supabase__get_logs`.

**T1.6 — Bad signature rejected**
Re-POST T1.3 body with a wrong `x-razorpay-signature`. ✅ 400, no grant.

**T1.7 — Expiry (D3)**
`execute_sql`(CC): set the test sub's `current_period_end` to `now() - interval '1 day'`. Reload the app (or
re-run the tier query). ✅ Tier resolves to `free`.

**T1.8 — Suhashi route (real Razorpay TEST link)**
Sign a handoff token for `sub_plus_monthly` (₹169) with the shared secret; `curl` the deployed SU route:
```bash
curl -s -X POST https://suhashico.vercel.app/api/campus-connect/create-payment -H "content-type: application/json" -d "{\"token\":\"<token>\"}"
```
✅ Returns `{ url }`; opening it shows a Razorpay-hosted page for **₹169** with `notes.cc_purchase_id`.
**Negative:** a token with `amount_paise:100` for `sub_plus_monthly` → 400 "amount mismatch".

**T1.9 — Full happy path in test mode (optional manual, uses Razorpay test UPI)**
From the CC app: tap buy → redirected to the SU-made link → pay with Razorpay **test** success → webhook
grants → land on `/premium/return` → tier active. ✅ End-to-end.

**T1.10 — Builds pass**
`npm run build` in **[CC]** and in **[SU]** → both succeed.

---

## 1.10 Rollback
- Frontend: revert `useRazorpay.tsx` to the previous in-app Checkout branch (one block) — the redirect is the
  only behavioral switch. `/premium/return` + `SubscriptionContext` change are additive/harmless.
- Edge functions are additive (`payment-start` new; `razorpay-webhook`/`verify` extensions are idempotent and
  guarded). Migration is additive (nullable + new index/columns) — no data loss.
- SU route is new and isolated; deleting the file fully reverts SU.

## 1.11 Done checklist
- [ ] Migration `payments_handoff_phase1` applied; T1.1 passes.
- [ ] `_shared/catalog.ts`, `_shared/hmac.ts`, `_shared/grant.ts` added.
- [ ] `payment-start` deployed (`verify_jwt=true`); T1.2 passes (incl. tamper check).
- [ ] `razorpay-webhook` extended + redeployed; T1.3–T1.6 pass.
- [ ] `razorpay-verify` hardened (server-priced, idempotent).
- [ ] SU `create-payment` route added + deployed; T1.8 passes.
- [ ] Frontend redirect + `/premium/return` + expiry fix; T1.7, T1.9 pass.
- [ ] `npm run build` passes in both repos (T1.10).
- [ ] Blueprint §16 Phase 1 marked complete; D1/D2/D3 noted as closed (test mode).
