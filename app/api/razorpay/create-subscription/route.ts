import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    let userId = '';
    // Decode the JWT to get the user ID (sub)
    // In this POS app, pin-auth issues a custom JWT where 'sub' is the staff ID
    const [, payloadBase64] = token.split('.');
    if (payloadBase64) {
      try {
        const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
        userId = payload.sub;
      } catch (e) {
        console.error("Could not decode JWT", e);
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }
    const body = await req.json();
    const { plan_id, plan_type, total_count = 12 } = body;

    if (!plan_id || !plan_type) {
      return NextResponse.json({ error: 'Plan ID and Plan Type are required' }, { status: 400 });
    }

    const razorpay = new Razorpay({
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    const subscription = await razorpay.subscriptions.create({
      plan_id,
      customer_notify: 1,
      total_count,
      notes: {
        userId: userId,
        planType: plan_type,
      },
    });

    return NextResponse.json({ subscription });
  } catch (error: any) {
    console.error('Error creating subscription:', error);
    
    // Razorpay SDK often returns the error inside an `error` property
    const errorMessage = error?.error?.description || error?.description || error?.message || 'Internal Server Error';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

