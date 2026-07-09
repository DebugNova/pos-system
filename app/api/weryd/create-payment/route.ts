import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import crypto from 'crypto';

// Keep this catalog byte-for-byte in sync with WeRyd's lib/payments/catalog.ts.
function priceFor(item_type: string, qty = 1): number | null {
  if (qty !== 1) return null;
  switch (item_type) {
    case 'plus_monthly':     return 29900;
    case 'plus_quarterly':   return 79900;
    case 'plus_yearly':      return 249900;
    case 'pro_monthly':      return 79900;
    case 'pro_yearly':       return 799900;
    case 'commuter_4_sedan': return 949900;
    case 'commuter_8_sedan': return 1799900;
    case 'commuter_4_suv':   return 1349900;
    case 'wallet_2500':      return 250000;
    case 'wallet_5000':      return 475000;
    default: return null;
  }
}

function verifyHandoff(token: string, secret: string): any | null {
  const [p, sig] = (token || '').split('.');
  if (!p || !sig) return null;
  const expect = crypto.createHmac('sha256', secret).update(p).digest('hex');
  const a = Buffer.from(expect, 'hex');
  const b = Buffer.from(sig, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let data: any;
  try { data = JSON.parse(Buffer.from(p, 'base64url').toString()); } catch { return null; }
  if (typeof data.exp === 'number' && data.exp * 1000 < Date.now()) return null;
  return data;
}

export async function POST(req: Request) {
  try {
    const { token } = await req.json();

    const secret = process.env.WERYD_HANDOFF_SECRET;
    if (!secret) return NextResponse.json({ error: 'Handoff secret not configured' }, { status: 500 });

    const data = verifyHandoff(token, secret);
    if (!data) return NextResponse.json({ error: 'bad token' }, { status: 401 });

    // RE-VALIDATE the amount against our own catalog (except for dynamic ride bookings).
    if (data.item_type !== 'ride_booking') {
      const expected = priceFor(data.item_type, data.quantity ?? 1);
      if (expected == null || expected !== data.amount_paise) {
        return NextResponse.json({ error: 'amount mismatch' }, { status: 400 });
      }
    }

    const razorpay = new Razorpay({
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    // NOTE: do NOT pass an empty `customer` object — Razorpay rejects it ("faulty key: customer").
    const link = await razorpay.paymentLink.create({
      amount: data.amount_paise,
      currency: 'INR',
      accept_partial: false,
      description: `WeRyd — ${data.item_type}`,
      notify: { sms: false, email: false },
      reminder_enable: false,
      notes: {
        weryd_purchase_id: data.weryd_purchase_id,
        source: 'weryd',
        item_type: data.item_type,
      },
      callback_url: `${process.env.WERYD_RETURN_URL}?ref=${data.weryd_purchase_id}`,
      callback_method: 'get',
    } as any);

    return NextResponse.json({ url: link.short_url });
  } catch (error: any) {
    console.error('[weryd/create-payment]', error);
    const message = error?.error?.description || error?.description || error?.message || 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
