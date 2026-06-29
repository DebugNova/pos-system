require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cancelSubscriptions() {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('status', 'active');

    if (error) {
      console.error('Error cancelling subscriptions:', error);
    } else {
      console.log('Successfully cancelled active subscriptions in the database.');
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

cancelSubscriptions();
