const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
envFile.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key && values.length > 0) {
    process.env[key.trim()] = values.join('=').trim().replace(/^"|"$/g, '');
  }
});
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

async function listPlans() {
  console.log("--- Fetching all active plans from Razorpay ---");
  try {
    const plans = await razorpay.plans.all();
    console.log(`Found ${plans.items.length} plans:`);
    plans.items.forEach(p => {
      console.log(`- ID: ${p.id} | Name: ${p.item.name} | Amount: ${p.item.amount / 100} ${p.item.currency} | Period: ${p.period} | Interval: ${p.interval}`);
    });
    
    console.log("\n--- Current Environment Variables ---");
    console.log("Monthly:", process.env.NEXT_PUBLIC_RAZORPAY_MONTHLY_PLAN_ID);
    console.log("Quarterly:", process.env.NEXT_PUBLIC_RAZORPAY_QUARTERLY_PLAN_ID);
    console.log("Yearly:", process.env.NEXT_PUBLIC_RAZORPAY_YEARLY_PLAN_ID);

  } catch (error) {
    console.error("RAZORPAY API ERROR:");
    console.dir(error, { depth: null });
  }
}

listPlans();
