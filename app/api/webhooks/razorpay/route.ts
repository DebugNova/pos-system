import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const signature = req.headers.get('x-razorpay-signature');
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!signature || !secret) {
      return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(bodyText)
      .digest('hex');

    if (expectedSignature !== signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(bodyText);
    const eventType = event.event;

    // ── Campus Connect payment relay (Suhashi is CC's single Razorpay webhook endpoint) ──
    // CC purchases run through this shared Razorpay account, so Razorpay delivers their payment
    // events HERE. If an event is tagged for Campus Connect (notes.source / notes.cc_purchase_id
    // set by app/api/campus-connect/create-payment), forward the raw event — HMAC-signed with the
    // shared SUHASHI_HANDOFF_SECRET — to CC's webhook, which verifies + grants the entitlement.
    // Suhashi's own POS billing (subscription.* events) is untouched below.
    const CC_PAYMENT_EVENTS = ['payment.captured', 'payment_link.paid', 'order.paid'];
    if (CC_PAYMENT_EVENTS.includes(eventType)) {
      const pl = event.payload || {};
      const notes =
        pl.payment?.entity?.notes || pl.payment_link?.entity?.notes || pl.order?.entity?.notes || {};
      const isCampusConnect = notes?.source === 'campus_connect' || !!notes?.cc_purchase_id;

      if (isCampusConnect) {
        const handoff = process.env.SUHASHI_HANDOFF_SECRET;
        const ccUrl =
          process.env.CC_WEBHOOK_RELAY_URL ||
          'https://zvcdqdtuzatmthrawrnv.functions.supabase.co/razorpay-webhook';

        if (!handoff) {
          console.error('[cc-relay] SUHASHI_HANDOFF_SECRET not set — cannot forward CC payment');
          return NextResponse.json({ received: true, cc_relay: 'no_secret' }, { status: 200 });
        }

        const relaySig = crypto.createHmac('sha256', handoff).update(bodyText).digest('hex');
        try {
          const ccRes = await fetch(ccUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-cc-relay-signature': relaySig },
            body: bodyText,
          });
          if (ccRes.ok) {
            return NextResponse.json({ received: true, cc_relay: 'ok' }, { status: 200 });
          }
          const detail = await ccRes.text().catch(() => '');
          console.error('[cc-relay] CC webhook returned', ccRes.status, detail);
          // 4xx won't be fixed by a retry (config issue) → ack so Razorpay stops; alert via logs.
          // 5xx/transient → 502 so Razorpay retries later (CC's grant is idempotent, safe to repeat).
          if (ccRes.status >= 400 && ccRes.status < 500) {
            return NextResponse.json({ received: true, cc_relay: 'client_error' }, { status: 200 });
          }
          return NextResponse.json({ received: false, cc_relay: 'downstream_error' }, { status: 502 });
        } catch (e: any) {
          console.error('[cc-relay] forward failed:', e?.message);
          return NextResponse.json({ received: false, cc_relay: 'forward_failed' }, { status: 502 });
        }
      }

      // A payment event that isn't Campus Connect's → nothing for Suhashi to do here.
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Use Service Role to bypass RLS during webhook updates
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (eventType.startsWith('subscription.')) {
      const subscription = event.payload.subscription.entity;
      const userId = subscription.notes?.userId;
      const planType = subscription.notes?.planType;
      
      let statusToSet = 'created';
      if (eventType === 'subscription.activated' || eventType === 'subscription.charged') {
        statusToSet = 'active';
      } else if (eventType === 'subscription.halted') {
        statusToSet = 'past_due';
      } else if (eventType === 'subscription.cancelled') {
        statusToSet = 'cancelled';
      } else if (eventType === 'subscription.completed') {
        statusToSet = 'completed';
      } else if (eventType === 'subscription.paused') {
        statusToSet = 'past_due'; 
      }

      const updateData: any = { status: statusToSet };

      if (subscription.current_start) {
        updateData.current_period_start = new Date(subscription.current_start * 1000).toISOString();
      }
      
      if (subscription.current_end) {
        updateData.current_period_end = new Date(subscription.current_end * 1000).toISOString();
      }

      if (userId && planType) {
        updateData.user_id = userId;
        updateData.razorpay_subscription_id = subscription.id;
        updateData.plan_id = subscription.plan_id;
        updateData.plan_type = planType;
        if (subscription.customer_id) {
          updateData.razorpay_customer_id = subscription.customer_id;
        }
        
        const { error } = await supabase
          .from('subscriptions')
          .upsert(updateData, { onConflict: 'razorpay_subscription_id' });
          
        if (error) {
          console.error('Supabase upsert error:', error);
          // Return 200 to prevent Razorpay from retrying and disabling the webhook
          // for non-transient errors like foreign key violations (user deleted, etc.)
          return NextResponse.json({ received: true, error: 'Database update failed but acknowledged' }, { status: 200 });
        }
      } else {
        const { error } = await supabase
          .from('subscriptions')
          .update(updateData)
          .eq('razorpay_subscription_id', subscription.id);
          
        if (error) {
          console.error('Supabase update error:', error);
          // Return 200 to prevent Razorpay from retrying continuously
          return NextResponse.json({ received: true, error: 'Database update failed but acknowledged' }, { status: 200 });
        }
      }
      
      // Create notification for certain events
      if (userId && (eventType === 'subscription.activated' || eventType === 'subscription.cancelled' || eventType === 'subscription.halted')) {
        let notifType = '';
        let title = '';
        let message = '';
        
        if (eventType === 'subscription.activated') {
          notifType = 'subscription_active';
          title = 'Subscription Activated';
          message = 'Your subscription is now active. Thank you!';
        } else if (eventType === 'subscription.cancelled') {
          notifType = 'subscription_cancelled';
          title = 'Subscription Cancelled';
          message = 'Your subscription has been cancelled.';
        } else if (eventType === 'subscription.halted') {
          notifType = 'payment_failed';
          title = 'Payment Failed';
          message = 'We could not process your subscription payment. Please update your payment method.';
        }
        
        if (notifType) {
          const { error: notifError } = await supabase.from('notifications').insert({
            user_id: userId,
            type: notifType,
            title,
            message,
          });
          
          if (notifError) {
            console.error('Supabase notification insert error:', notifError);
            // Non-critical, continue
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    // Return 500 only for unhandled exceptions or severe errors before signature validation
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
