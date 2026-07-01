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
