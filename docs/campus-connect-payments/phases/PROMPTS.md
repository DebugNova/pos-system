# Copy-Paste Prompts — one per phase

Paste **one** block into a **fresh** Claude Code conversation (opened at the Campus Connect repo). Do them in
order; finish and verify a phase before starting the next. Each prompt makes the agent read the plan, execute
that phase across **both** repos, and **run the phase's Self-Test itself** before reporting done.

> Both repos are on disk: Campus Connect = `c:\Users\kaust\OneDrive\Desktop\Campus Connect\`, Suhashi =
> `c:\Users\kaust\OneDrive\Desktop\suhashi\pos-system\`. Both Supabase projects are reachable via MCP
> (`mcp__claude_ai_Supabase__*` for `zvcdqdtuzatmthrawrnv`; `mcp__supabase-suhashi__*` for `ycrwtvtdsbjbhdqyuptq`).

---

## ▶️ PHASE 0 — Config & Contract

```
You are implementing the Campus Connect ⇄ Suhashi Razorpay payment integration. Both repos are on disk
(Campus Connect: c:\Users\kaust\OneDrive\Desktop\Campus Connect\ ; Suhashi POS/Next.js:
c:\Users\kaust\OneDrive\Desktop\suhashi\pos-system\). Both Supabase projects are reachable via MCP
(mcp__claude_ai_Supabase__* with project_id zvcdqdtuzatmthrawrnv for Campus Connect; mcp__supabase-suhashi__*
for Suhashi ycrwtvtdsbjbhdqyuptq). Never touch the "Tribetoy" project.

STEP 1 — Read these fully before doing anything:
  docs/features/phases/README.md
  docs/features/payments-via-suhashi-razorpay.md
  docs/features/phases/phase-0-config-and-contract.md

STEP 2 — Execute ONLY Phase 0 exactly as written. This phase is configuration + contract only (no product
code). Use RAZORPAY TEST-MODE keys (rzp_test_...), not live. Generate the SUHASHI_HANDOFF_SECRET.

STEP 3 — For any step that needs a value only I have (test keys, secrets) or a Razorpay/Supabase dashboard
action, STOP and give me the exact command or click-path, wait for me to confirm it's done, then continue.
You may set what you can and prepare the rest.

STEP 4 — Run the phase's Self-Test (§0.7: T0.1–T0.4) yourself and paste the evidence (MCP query outputs, the
curl short_url from T0.2, the hashes from T0.3/T0.4). Do NOT declare Phase 0 done until every test passes.

STEP 5 — Tick the Done checklist in phase-0-config-and-contract.md and mark Phase 0 complete in the blueprint
§16. Then stop and summarize: what's set, what still needs me, and confirm we're ready for Phase 1.

Guardrails: test mode only; never put a secret behind VITE_/NEXT_PUBLIC_; only VITE_RAZORPAY_KEY_ID (public)
may be client-side; do not commit secrets.
```

---

## ▶️ PHASE 1 — Core Flow + Hardening (TEST mode)

```
You are implementing the Campus Connect ⇄ Suhashi Razorpay payment integration. Both repos are on disk
(Campus Connect: c:\Users\kaust\OneDrive\Desktop\Campus Connect\ ; Suhashi: c:\Users\kaust\OneDrive\Desktop\
suhashi\pos-system\). Supabase via MCP: mcp__claude_ai_Supabase__* (project_id zvcdqdtuzatmthrawrnv = Campus
Connect) and mcp__supabase-suhashi__* (ycrwtvtdsbjbhdqyuptq = Suhashi). Never touch "Tribetoy". Prerequisite:
Phase 0 is done (test keys + SUHASHI_HANDOFF_SECRET set on both sides).

STEP 1 — Read fully first:
  docs/features/phases/README.md
  docs/features/payments-via-suhashi-razorpay.md
  docs/features/phases/phase-1-core-flow-and-hardening.md

STEP 2 — Execute ONLY Phase 1, in the build order in §1.1, entirely in RAZORPAY TEST MODE. Make ALL changes:
  • Campus Connect: apply the DB migration (§1.2) via mcp__claude_ai_Supabase__apply_migration; add
    supabase/functions/_shared/{catalog,hmac,grant}.ts (§1.3); create the payment-start edge function (§1.4)
    and DEPLOY it (verify_jwt=true) via mcp__claude_ai_Supabase__deploy_edge_function; extend razorpay-webhook
    (§1.5) and harden razorpay-verify (§1.6) and redeploy them; update the frontend (§1.8): useRazorpay.tsx,
    new src/pages/Premium/PremiumReturn.tsx + route in src/App.tsx, and the SubscriptionContext expiry fix.
  • Suhashi: create app/api/campus-connect/create-payment/route.ts (§1.7) matching the existing
    app/api/razorpay/create-subscription/route.ts pattern.
  Keep the server-side price catalog identical on both sides. Preserve all existing behavior (mock-data
  branches, existing webhook subscription.* handlers).

STEP 3 — If a step needs a value/dashboard action only I can do (e.g. registering the test webhook URL in the
Razorpay dashboard, providing a test student JWT), STOP, give me exact instructions, wait, then continue.

STEP 4 — Run the FULL Self-Test §1.9 yourself and paste evidence for each:
  T1.1 migration checks (SQL) · T1.2 payment-start prices server-side + D1 tamper check · T1.3 automatic grant
  via a validly-signed fake payment.captured webhook (build the HMAC and POST it — no real money) · T1.4
  idempotency (re-POST → no double grant) · T1.5 under-pay refused · T1.6 bad signature rejected · T1.7 expiry
  (D3) · T1.8 Suhashi route creates a real test Payment Link + amount-mismatch negative · T1.10 `npm run build`
  passes in BOTH repos. Use mcp__claude_ai_Supabase__execute_sql to prove DB state before/after and
  mcp__claude_ai_Supabase__get_logs to read webhook logs. Do NOT declare done until all pass.

STEP 5 — Tick the Done checklist in phase-1-…md, mark Phase 1 done in blueprint §16, note D1/D2/D3 closed (test
mode). Stop and summarize results with the pasted test evidence.

Guardrails: TEST mode only (no live keys this phase); run `npm run build` in both repos and fix type errors;
never commit/expose secrets; only VITE_RAZORPAY_KEY_ID may be client-side; grants must be idempotent on
razorpay_payment_id; webhook must return HTTP 200 on handled/ignored events.
```

---

## ▶️ PHASE 2 — Go Live (real money — go carefully)

```
You are implementing the Campus Connect ⇄ Suhashi Razorpay payment integration. Both repos on disk (Campus
Connect: c:\Users\kaust\OneDrive\Desktop\Campus Connect\ ; Suhashi: c:\Users\kaust\OneDrive\Desktop\suhashi\
pos-system\). Supabase via MCP (mcp__claude_ai_Supabase__* project zvcdqdtuzatmthrawrnv; mcp__supabase-suhashi__*
project ycrwtvtdsbjbhdqyuptq). Never touch "Tribetoy". Prerequisite: Phase 1 fully passed in test mode.

STEP 1 — Read fully first:
  docs/features/phases/README.md
  docs/features/payments-via-suhashi-razorpay.md
  docs/features/phases/phase-2-go-live.md

STEP 2 — Execute ONLY Phase 2. This moves REAL MONEY — do each step deliberately and confirm before the next:
  swap CC edge secrets + SU env from test → LIVE Razorpay keys; ensure VITE_RAZORPAY_KEY_ID is the live id and
  CC is redeployed; register the LIVE second webhook to CC's razorpay-webhook for payment_link.paid /
  payment.captured / order.paid; add the "billed via SUHASHI" microcopy (§2.4).

STEP 3 — Secret/dashboard steps are mine to click. For each (setting live secrets, adding the live webhook,
Vercel redeploys), STOP and give me the exact command/click-path, wait for confirmation, then continue.

STEP 4 — Verify (paste evidence): send a Razorpay dashboard test event → confirm CC logs 200
(mcp__claude_ai_Supabase__get_logs). Then guide me through ONE real cheapest purchase (₹39 boost) and verify
via mcp__claude_ai_Supabase__execute_sql that the order is 'paid' with a real razorpay_payment_id and the
entitlement was granted; cross-check the Razorpay dashboard.

STEP 5 — 🔐 Walk me through ROTATING the leaked secrets (§2.6: Razorpay key secret, webhook secret, Supabase
access token), update them on both sides, and re-run the signed-webhook grant test (T1.3) to confirm the new
webhook secret works.

STEP 6 — Update docs (§2.10: 06-known-issues, 03-features/monetization, 02-backend, 08-roadmap) and mark Phase
2 complete in the blueprint §16 + §20 close-out. Stop and summarize.

Guardrails: verify each live step before moving on; if anything misbehaves, follow the §2.9 rollback (revert to
test keys, disable live webhook); never commit/expose secrets.
```

---

## ▶️ PHASE 3 — Auto-Renew (OPTIONAL, only if you ask for it)

```
You are extending the Campus Connect ⇄ Suhashi Razorpay integration with OPTIONAL auto-renewing subscriptions.
Both repos on disk; Supabase via MCP (zvcdqdtuzatmthrawrnv = Campus Connect, ycrwtvtdsbjbhdqyuptq = Suhashi).
Prerequisite: Phases 0–2 are live and stable. Only proceed because I explicitly asked for Phase 3.

STEP 1 — Read fully first:
  docs/features/phases/README.md
  docs/features/payments-via-suhashi-razorpay.md
  docs/features/phases/phase-3-auto-renew.md

STEP 2 — Before building, write a short mini-spec (new Razorpay plans, SU subscription route changes, CC
webhook subscription.* grant/lapse, frontend auto-renew toggle + cancel) and confirm it with me.

STEP 3 — On approval, implement per §3.3 in TEST mode first (new CC Razorpay plans, SU create-subscription CC
variant, CC razorpay-webhook subscription.* handling for source=campus_connect, frontend toggle/cancel).

STEP 4 — Run the §3.4 Self-Tests yourself (activation, renewal charge, halted/dunning, cancel, idempotency) and
paste evidence. Then guide the live cutover. Do not declare done until tests pass.

STEP 5 — Tick §3.6 checklist, update docs, mark Phase 3 in the blueprint. Stop and summarize.

Guardrails: do NOT reuse Suhashi's existing plan_ IDs; new plans for Campus Connect only; test mode before
live; idempotent grants; never commit/expose secrets.
```

---

### Tips
- If a phase gets interrupted, in the next message say *"continue Phase X where you left off; re-run the
  Self-Test from the start before declaring done."*
- After each phase, skim the pasted test evidence yourself — that's your sign-off before moving on.
- The same pack (and these prompts) is mirrored in the Suhashi repo at
  `suhashi/pos-system/docs/campus-connect-payments/`.
