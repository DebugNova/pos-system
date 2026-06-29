import { motion } from "framer-motion";
import { Lock, ShieldAlert, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SubscriptionLockModalProps {
  onViewPlans: () => void;
}

export function SubscriptionLockModal({ onViewPlans }: SubscriptionLockModalProps) {
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      {/* Dark overlay backdrop to enhance the blur effect */}
      <div className="fixed inset-0 bg-background/40 backdrop-blur-[2px]" />
      
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6 text-center">
        {/* Bento Box Modal */}
        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-border/50 bg-background/80 p-8 shadow-2xl backdrop-blur-xl text-left"
        >
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <Lock className="h-8 w-8" />
          </div>
        </div>
        
        <div className="text-center">
          <h2 className="mb-2 font-fraunces text-2xl font-bold tracking-tight text-foreground">
            WeDrip OS
          </h2>
          <div className="mx-auto mb-4 flex w-fit items-center gap-2 rounded-full border border-destructive/20 bg-destructive/5 px-3 py-1 text-xs font-medium text-destructive">
            <ShieldAlert className="h-3.5 w-3.5" />
            Maintenance Plan Required
          </div>
          
          <p className="mb-8 text-sm text-muted-foreground">
            Your POS access is currently locked because there is no active maintenance plan on file. Please subscribe to a plan to unlock the system and continue serving your customers.
          </p>
          
          <Button 
            onClick={onViewPlans} 
            className="group w-full rounded-xl py-6 text-base font-semibold shadow-md transition-all hover:shadow-lg"
          >
            View Plans & Unlock
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
        </motion.div>
      </div>
    </div>
  );
}
