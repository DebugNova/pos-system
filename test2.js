const Razorpay = require('razorpay');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
envFile.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key && values.length > 0) {
    process.env[key.trim()] = values.join('=').trim().replace(/^"|"$/g, '');
  }
});

const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

async function testSubscription() {
  try {
    const subscription = await razorpay.subscriptions.create({
      plan_id: process.env.NEXT_PUBLIC_RAZORPAY_QUARTERLY_PLAN_ID,
      customer_notify: 1,
      total_count: 4,
      notes: {
        userId: 'test-user',
        planType: 'quarterly',
      },
    });
    console.log("SUCCESS:");
    console.log(subscription);
  } catch (error) {
    console.log("ERROR:");
    console.dir(error, { depth: null });
  }
}

testSubscription();
