'use client';

import { useState, useEffect } from 'react';
import Script from 'next/script';
import { motion } from 'framer-motion';
import { Check, Sparkles, CheckCircle2, Zap, Shield, Loader2, CalendarDays, Crown, ChevronLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { usePOSStore } from '@/lib/store';
import { fetchActiveSubscriptionDetails } from '@/lib/supabase-queries';
import { format } from 'date-fns';

const plans = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: 699,
    originalPrice: 699,
    savings: 0,
    planId: process.env.NEXT_PUBLIC_RAZORPAY_MONTHLY_PLAN_ID,
    features: ['Full POS Access', 'Unlimited Transactions', 'Basic Analytics', 'Email Support'],
    color: 'from-blue-500 to-cyan-400',
    popular: false,
  },
  {
    id: 'quarterly',
    name: 'Quarterly',
    price: 1897,
    originalPrice: 2097, // 699 * 3
    savings: 200,
    planId: process.env.NEXT_PUBLIC_RAZORPAY_QUARTERLY_PLAN_ID,
    features: ['All Monthly Features', 'Advanced Analytics', 'Priority Support', 'Custom Receipts'],
    color: 'from-violet-500 to-fuchsia-400',
    popular: true,
  },
  {
    id: 'yearly',
    name: 'Yearly',
    price: 7388,
    originalPrice: 8388, // 699 * 12
    savings: 1000,
    planId: process.env.NEXT_PUBLIC_RAZORPAY_YEARLY_PLAN_ID,
    features: ['All Quarterly Features', 'Dedicated Account Manager', 'Custom Domain', '24/7 Phone Support'],
    color: 'from-emerald-500 to-teal-400',
    popular: false,
  },
];

export function Subscription() {
  const { isSubscriptionActive, setSubscriptionStatus, setActiveView } = usePOSStore();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [subDetails, setSubDetails] = useState<{ planType: string, currentPeriodEnd: string } | null>(null);

  useEffect(() => {
    if (isSubscriptionActive) {
      fetchActiveSubscriptionDetails().then(details => {
        if (details) setSubDetails(details);
      });
    }
  }, [isSubscriptionActive]);

  const handleSubscribe = async (plan: typeof plans[0]) => {
    if (!plan.planId) {
      toast.error('Plan ID is missing. Check your environment variables.');
      return;
    }

    try {
      setLoadingPlan(plan.id);

      // Get user session
      const { data: { session }, error: authError } = await supabase!.auth.getSession();
      
      if (authError || !session) {
        toast.error('Please sign in to subscribe.');
        return;
      }

      // Create subscription on backend
      const res = await fetch('/api/razorpay/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          plan_id: plan.planId,
          plan_type: plan.id,
          total_count: plan.id === 'yearly' ? 1 : plan.id === 'quarterly' ? 4 : 12
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create subscription');
      }

      // Open Razorpay Checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        subscription_id: data.subscription.id,
        name: 'WeDrip OS',
        description: `${plan.name} Subscription`,
        image: '/apple-icon-cat.png',
        handler: function (response: any) {
          setPaymentSuccess(true);
          setSubscriptionStatus(true);
          // Refetch active subscription details silently in the background
          import('@/lib/supabase-queries').then(m => m.fetchActiveSubscriptionDetails().then(details => {
            if (details) {
              setSubDetails({ currentPeriodEnd: details.currentPeriodEnd, planType: details.planType });
            }
          }));
        },
        prefill: {
          contact: '',
          email: '',
        },
        theme: {
          color: plan.id === 'quarterly' ? '#8b5cf6' : plan.id === 'yearly' ? '#10b981' : '#09090b', // Sleek dark aesthetic for WeDrip OS
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        toast.error(`Payment failed: ${response.error.description}`);
      });
      rzp.open();

    } catch (error: any) {
      console.error('Subscription error:', error);
      toast.error(error.message || 'An error occurred during checkout');
    } finally {
      setLoadingPlan(null);
    }
  };

  if (paymentSuccess) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-background p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", bounce: 0.4 }}
          className="max-w-md w-full bg-card rounded-[2rem] border border-border/50 p-8 shadow-2xl overflow-hidden relative"
        >
          {/* Animated Background Gradients */}
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-green-500/20 rounded-full blur-3xl opacity-50" />
          <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl opacity-50" />
          
          <div className="relative z-10 flex flex-col items-center text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", bounce: 0.5 }}
              className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6 border border-green-500/20"
            >
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </motion.div>
            
            <h1 className="text-3xl font-bold tracking-tight mb-2">Payment Completed!</h1>
            <p className="text-muted-foreground mb-8">
              Your subscription is now active. All WeDrip OS features have been unlocked successfully.
            </p>
            
            <div className="w-full bg-background rounded-2xl p-4 border border-border/50 mb-8 flex items-center justify-between">
              <span className="font-medium">Status</span>
              <span className="px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-sm font-medium">Active</span>
            </div>
            
            <div className="text-sm font-medium text-muted-foreground italic mb-8">
              "Thank You"<br/>
              <span className="text-foreground not-italic">— Team WeDrip OS</span>
            </div>
            
            <Button 
              onClick={() => setActiveView("dashboard")}
              className="w-full h-12 rounded-xl text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Go to Dashboard
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full bg-background text-foreground flex flex-col relative overflow-x-hidden overflow-y-auto">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      
      {/* Background Effects matching theme */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-secondary/50 blur-[100px] rounded-full pointer-events-none" />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-16 lg:py-24 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative"
          >
            {isSubscriptionActive === false && (
              <Button 
                variant="ghost" 
                className="absolute -top-12 left-0 text-muted-foreground hover:text-foreground"
                onClick={() => usePOSStore.getState().setActiveView("dashboard")}
              >
                ← Back
              </Button>
            )}
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 font-fraunces">
              WeDrip OS <span className="text-primary">Maintenance Plans</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Choose the perfect maintenance plan to unlock your POS. No hidden fees, upgrade or cancel anytime.
            </p>
          </motion.div>
        </div>

        {isSubscriptionActive ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="bg-card rounded-[2rem] border border-border/50 p-10 text-center max-w-2xl mx-auto shadow-2xl relative overflow-hidden"
          >
            {/* Background Accents */}
            <div className="absolute -top-32 -left-32 w-64 h-64 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-24 h-24 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mb-6 shadow-inner">
                <Shield className="w-12 h-12 text-green-500" />
              </div>
              
              <h2 className="text-3xl font-bold mb-3 tracking-tight">Maintenance Plan Active</h2>
              <p className="text-muted-foreground mb-8 text-lg max-w-md">
                Your POS is securely unlocked and fully operational.
              </p>

              <div className="w-full bg-background/50 rounded-2xl p-6 border border-border flex flex-col gap-4 text-left shadow-sm">
                
                <div className="flex justify-between items-center pb-4 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Crown className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">Current Plan</p>
                      <p className="font-semibold text-lg capitalize">{subDetails?.planType || 'Test Plan'}</p>
                    </div>
                  </div>
                  <div className="px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-sm font-bold tracking-wide">
                    ACTIVE
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <CalendarDays className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">Valid Until</p>
                      <p className="font-semibold text-lg">
                        {subDetails?.currentPeriodEnd ? format(new Date(subDetails.currentPeriodEnd), 'MMM dd, yyyy') : format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'MMM dd, yyyy')}
                      </p>
                    </div>
                  </div>
                </div>

              </div>

              <Button 
                onClick={() => usePOSStore.getState().setActiveView("dashboard")}
                className="mt-8 w-full max-w-xs h-12 rounded-xl text-base font-semibold"
              >
                Return to Dashboard
              </Button>
            </div>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 items-stretch max-w-5xl mx-auto">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`relative rounded-3xl border ${plan.popular ? 'bg-card border-primary shadow-xl' : 'bg-card/50 border-border'} p-8 flex flex-col h-full overflow-hidden`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center z-20">
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 uppercase tracking-wider shadow-sm">
                      <Sparkles className="w-3 h-3" /> Most Popular
                    </span>
                  </div>
                )}
                {plan.popular && (
                  <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
                )}

                <div className="mb-6 relative z-10">
                  <h3 className="text-xl font-medium text-foreground mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl font-bold">₹{plan.price.toLocaleString()}</span>
                    <span className="text-muted-foreground">/{plan.id === 'monthly' ? 'mo' : plan.id === 'quarterly' ? 'quarter' : 'year'}</span>
                  </div>
                  {plan.savings > 0 && (
                    <p className="text-emerald-500 dark:text-emerald-400 text-sm font-medium">
                      Save ₹{plan.savings.toLocaleString()} compared to monthly
                    </p>
                  )}
                  {plan.savings === 0 && (
                    <p className="text-muted-foreground text-sm">Standard flat rate</p>
                  )}
                </div>

                <ul className="space-y-4 mb-8 flex-1 relative z-10">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-muted-foreground">
                      <Check className={`w-5 h-5 shrink-0 ${plan.popular ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="relative z-10 mt-auto">
                  <Button
                    onClick={() => handleSubscribe(plan)}
                    disabled={loadingPlan === plan.id}
                    className={`w-full py-6 rounded-xl text-md font-medium transition-all ${
                      plan.popular 
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md' 
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {loadingPlan === plan.id ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing
                      </>
                    ) : (
                      'Subscribe Now'
                    )}
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-20 pt-10 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-8 text-center"
        >
          <div className="flex flex-col items-center gap-2">
            <Shield className="w-6 h-6 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Secure Payments</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Zap className="w-6 h-6 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Instant Setup</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 rounded-full border-2 border-muted-foreground flex items-center justify-center text-xs text-muted-foreground font-bold">24/7</div>
            <span className="text-sm text-muted-foreground">Premium Support</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-sm text-muted-foreground">Cancel Anytime</span>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
