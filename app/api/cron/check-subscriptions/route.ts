import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Define the 3-day window in milliseconds
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  try {
    // 1. Verify Vercel Cron Secret for security
    // Vercel sends the CRON_SECRET via the Authorization header
    const authHeader = req.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET;
    
    // Only enforce in production, allow testing locally if secret is omitted
    if (process.env.NODE_ENV === 'production') {
      if (authHeader !== `Bearer ${expectedSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // 2. Initialize Supabase with Service Role to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Find all active subscriptions
    const { data: subscriptions, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('status', 'active');

    if (fetchError) {
      throw fetchError;
    }

    const now = new Date().getTime();
    let notificationsCreated = 0;

    // 4. Iterate over subscriptions and find those expiring in ~3 days
    for (const sub of subscriptions || []) {
      if (!sub.current_period_end) continue;

      const endDate = new Date(sub.current_period_end).getTime();
      const timeRemaining = endDate - now;

      // Check if it's within the 3-day window (between 2 and 3 days remaining)
      // This ensures we only notify once, roughly 3 days before expiry
      if (timeRemaining > 0 && timeRemaining <= THREE_DAYS_MS && timeRemaining > (THREE_DAYS_MS - (24 * 60 * 60 * 1000))) {
        
        // Ensure we haven't already notified them for this specific cycle
        // (This prevents duplicate notifications if the cron job runs twice in a day)
        const { data: existingNotifs } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', sub.user_id)
          .eq('type', 'subscription_expiring')
          .gte('created_at', new Date(now - 24 * 60 * 60 * 1000).toISOString())
          .limit(1);

        if (!existingNotifs || existingNotifs.length === 0) {
          // Create the notification
          await supabase.from('notifications').insert({
            user_id: sub.user_id,
            type: 'subscription_expiring',
            title: 'Subscription Expiring Soon',
            message: `Your ${sub.plan_type || 'monthly'} subscription will renew in 3 days. Please ensure your payment method is up to date.`,
          });
          
          notificationsCreated++;
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      scanned: subscriptions?.length || 0,
      notificationsCreated
    });

  } catch (error: any) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
