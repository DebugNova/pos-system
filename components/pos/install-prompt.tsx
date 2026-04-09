"use client";

import { useEffect, useState } from "react";
import { usePOSStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { X, Share, PlusSquare, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function InstallPrompt() {
  const { settings, updateSettings } = usePOSStore();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
    
    if (isStandalone || settings.installPromptDismissed) {
      return;
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSBrowser = /iphone|ipad|ipod/.test(userAgent);

    if (isIOSBrowser) {
      setShowIOSModal(true);
      return;
    }

    // Standard PWA install prompt for Chrome/Edge/Android
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, [settings.installPromptDismissed]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    updateSettings({ installPromptDismissed: true });
    setShowPrompt(false);
    setShowIOSModal(false);
  };

  if (!showPrompt && !showIOSModal) return null;

  return (
    <>
      {showPrompt && (
        <div className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-lg border-primary/20 bg-primary/5">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Download className="h-4 w-4 text-primary" />
                Install SUHASHI POS
              </h3>
              <p className="text-xs text-muted-foreground mr-6">
                Install the app on your device for the best full-screen and offline experience.
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 -mr-2 -mt-2" onClick={handleDismiss}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={handleInstallClick} size="sm" className="w-full mt-2">
            Install App
          </Button>
        </div>
      )}

      {/* iOS Modal */}
      <Dialog open={showIOSModal} onOpenChange={(open) => !open && handleDismiss()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Install SUHASHI POS</DialogTitle>
            <DialogDescription>
              Install this app on your iPad or iPhone for full-screen access and offline support.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                <Share className="h-5 w-5 text-foreground" />
              </div>
              <div className="text-sm">
                <p className="font-semibold text-foreground">1. Tap the Share button</p>
                <p className="text-muted-foreground">You can find it at the top or bottom of your screen in Safari.</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                <PlusSquare className="h-5 w-5 text-foreground" />
              </div>
              <div className="text-sm">
                <p className="font-semibold text-foreground">2. Select Add to Home Screen</p>
                <p className="text-muted-foreground">Scroll down the share menu to find this option.</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-foreground">
                <span className="font-bold text-foreground text-xs uppercase">Add</span>
              </div>
              <div className="text-sm">
                <p className="font-semibold text-foreground">3. Tap Add</p>
                <p className="text-muted-foreground">The app will appear on your home screen.</p>
              </div>
            </div>
          </div>
          <Button className="w-full" onClick={handleDismiss}>I understand</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
