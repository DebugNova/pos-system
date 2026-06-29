"use client";

import { motion } from "framer-motion";
import { AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SubscriptionExpiryWarningModalProps {
  daysRemaining: number;
  onViewPlans: () => void;
  onDismiss: () => void;
}

export function SubscriptionExpiryWarningModal({ daysRemaining, onViewPlans, onDismiss }: SubscriptionExpiryWarningModalProps) {
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      {/* Dark overlay backdrop */}
      <div className="fixed inset-0 bg-background/60 backdrop-blur-[2px]" onClick={onDismiss} />
      
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6 text-center">
        {/* Bento Box Modal */}
        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-warning/50 bg-background p-8 shadow-2xl backdrop-blur-xl text-left"
        >
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
            <AlertCircle className="h-8 w-8" />
          </div>
        </div>
        
        <div className="text-center">
          <h2 className="mb-2 font-fraunces text-2xl font-bold tracking-tight text-foreground">
            WeDrip OS
          </h2>
          <div className="mx-auto mb-4 flex w-fit items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/5 px-3 py-1 text-xs font-medium text-amber-500">
            Plan Expiring Soon
          </div>
          
          <p className="mb-8 text-sm text-muted-foreground">
            Your maintenance plan will expire in <strong className="text-foreground">{daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}</strong>. Please renew your subscription to avoid interruption of POS services.
          </p>
          
          <div className="flex flex-col gap-3">
            <Button 
              onClick={onViewPlans} 
              className="group w-full rounded-xl py-6 text-base font-semibold shadow-md transition-all hover:shadow-lg bg-amber-500 hover:bg-amber-600 text-white"
            >
              Renew Plan Now
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            
            <Button 
              variant="ghost"
              onClick={onDismiss} 
              className="w-full rounded-xl py-6 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Remind Me Later
            </Button>
          </div>
        </div>
        </motion.div>
      </div>
    </div>
  );
}
