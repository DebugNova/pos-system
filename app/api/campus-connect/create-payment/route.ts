import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import crypto from 'crypto';

// Campus Connect → Suhashi payment handoff.
//
// Campus Connect prices every purchase server-side and sends us a signed, short-lived token.
// We (a) verify the HMAC + expiry with the shared SUHASHI_HANDOFF_SECRET, (b) RE-VALIDATE the
// amount against our own copy of the price catalog (so a tampered token can't buy Elite for ₹1),
// then (c) mint a Razorpay Payment Link on Suhashi's account carrying notes.cc_purchase_id — the
// only thing that lets Campus Connect's webhook match the payment back to the right student.
//
// Keep this catalog byte-for-byte in sync with Campus Connect's
// supabase/functions/_shared/catalog.ts (and src/config/subscriptionPlans.ts).

function priceFor(item_type: string, qty = 1): number | null {
  switch (item_type) {
    case 'sub_plus_monthly':    return 16900;
    case 'sub_plus_quarterly':  return 46900;
    case 'sub_plus_semester':   return 76900;
    case 'sub_elite_monthly':   return 46900;
    case 'sub_elite_quarterly': return 76900;
    case 'sub_elite_semester':  return 96900;
    case 'general_explorer_pass': return 9900;
    case 'specific_campus_pass':  return 4900;
    case 'specific_mystery_pass': return 4900;
    case 'super_like_pack':
      if (qty === 3)  return 6900;
      if (qty === 10) return 16900;
      return null;
    case 'vibe_match_pack':
      if (qty === 2) return 6900;
      if (qty === 5) return 14900;
      return null;
    case 'boost_pack':
      if (qty === 1)  return 3900;
      if (qty === 5)  return 14900;
      if (qty === 10) return 24900;
      return null;
    default: return null;
  }
}

// Verify token = base64url(payloadJSON) + "." + hex(HMAC_SHA256(base64url(payloadJSON), secret)).
// Byte-compatible with Campus Connect's supabase/functions/_shared/hmac.ts.
function verifyHandoff(token: string, secret: string): any | null {
  const [p, sig] = (token || '').split('.');
  if (!p || !sig) return null;
  const expect = crypto.createHmac('sha256', secret).update(p).digest('hex');
  // Constant-time compare (guard against length-mismatch throw).
  const a = Buffer.from(expect, 'hex');
  const b = Buffer.from(sig, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let data: any;
  try {
    data = JSON.parse(Buffer.from(p, 'base64url').toString());
  } catch {
    return null;
  }
  if (typeof data.exp === 'number' && data.exp * 1000 < Date.now()) return null;
  return data;
}

export async function POST(req: Request) {
  try {
    const { token } = await req.json();

    const secret = process.env.SUHASHI_HANDOFF_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'Handoff secret not configured' }, { status: 500 });
    }

    const data = verifyHandoff(token, secret);
    if (!data) {
      return NextResponse.json({ error: 'bad token' }, { status: 401 });
    }

    // Re-price against our own catalog. The token's amount must match exactly.
    // For party_booking (which has dynamic pricing), we bypass the static price catalog check
    // since the handoff token is signed securely with our shared HMAC secret.
    let expected = null;
    if (data.item_type === 'party_booking') {
      expected = data.amount_paise;
    } else {
      expected = priceFor(data.item_type, data.quantity ?? 1);
    }

    if (expected == null || expected !== data.amount_paise) {
      return NextResponse.json({ error: 'amount mismatch' }, { status: 400 });
    }

    const razorpay = new Razorpay({
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    // NOTE: no `customer` field — Razorpay's payment_links API rejects an empty customer object
    // ("faulty key: customer"). Omitting it creates a shareable link with no pre-filled customer.
    const link = await razorpay.paymentLink.create({
      amount: data.amount_paise,
      currency: 'INR',
      accept_partial: false,
      description: `Campus Connect — ${data.item_type}`,
      notify: { sms: false, email: false },
      reminder_enable: false,
      notes: {
        cc_purchase_id: data.cc_purchase_id,
        source: 'campus_connect',
        item_type: data.item_type,
      },
      callback_url: `${process.env.CC_RETURN_URL}?ref=${data.cc_purchase_id}`,
      callback_method: 'get',
    } as any);

    return NextResponse.json({ url: link.short_url });
  } catch (error: any) {
    console.error('[campus-connect/create-payment] error:', error);
    const message =
      error?.error?.description || error?.description || error?.message || 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
