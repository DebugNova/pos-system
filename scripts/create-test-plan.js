require('dotenv').config({ path: '.env.local' });
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

async function createTestPlan() {
  try {
    const plan = await razorpay.plans.create({
      period: 'weekly',
      interval: 1,
      item: {
        name: 'Test 1 Rs Plan',
        amount: 100, // Amount is in paise (100 paise = 1 INR)
        currency: 'INR',
        description: 'Temporary 1 Rs plan for testing the subscription lock'
      },
      notes: {
        type: 'testing'
      }
    });

    console.log('SUCCESS! Test Plan Created.');
    console.log('PLAN ID:', plan.id);
  } catch (error) {
    console.error('ERROR creating plan:', error);
  }
}

createTestPlan();
