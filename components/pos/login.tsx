"use client";

import { useState } from "react";
import { usePOSStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { User, Lock, Clock, Wifi, ChevronRight, Fingerprint } from "lucide-react";
import { CatLogo } from "@/components/ui/cat-logo";

interface LoginProps {
  onLogin: (user: { name: string; role: string; pin: string }, origin?: {x: number, y: number}) => void;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
  pin: string;
  initials: string;
}

export function Login({ onLogin }: LoginProps) {
  const { staffMembers } = usePOSStore();
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [shiftStarted, setShiftStarted] = useState(false);

  const handlePinSubmit = () => {
    if (!selectedStaff) return;
    
    if (pin === selectedStaff.pin) {
      setError("");
      setShiftStarted(true);
    } else {
      setError("Incorrect PIN. Please try again.");
      setPin("");
    }
  };

  const handleStartShift = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (selectedStaff) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      onLogin({ name: selectedStaff.name, role: selectedStaff.role, pin: selectedStaff.pin }, { x, y });
    }
  };

  const handlePinInput = (digit: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + digit);
    }
  };

  const handlePinDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const currentDate = new Date();

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-background p-4 sm:p-6 pb-12 sm:pb-8">
      {/* Beautiful Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[100px] rounded-full mix-blend-multiply opacity-70" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[100px] rounded-full mix-blend-multiply opacity-70" />
      </div>

      <div className="w-full max-w-[400px] sm:max-w-[480px] lg:max-w-[540px] relative z-10 flex flex-col items-center flex-1 justify-center">
        {/* Logo and Header */}
        <div className="mb-4 sm:mb-6 text-center flex flex-col items-center">
          <div className="mb-2 sm:mb-3 relative group">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full scale-110 group-hover:bg-primary/30 transition-all duration-500"></div>
            <div className="relative flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 overflow-hidden shadow-lg ring-1 ring-white/10">
              <CatLogo className="p-1 sm:p-1.5 text-primary-foreground drop-shadow-md" />
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground bg-clip-text">SUHASHI Cafe</h1>
          <p className="text-xs font-medium text-muted-foreground mt-0.5">Point of Sale System</p>
          <div className="mt-2.5 flex items-center justify-center gap-2">
            <Badge variant="outline" className="gap-1 px-2 py-0.5 text-[10px] sm:text-xs text-emerald-500 border-emerald-500/30 bg-emerald-500/10 font-semibold rounded-full shadow-sm">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              System Online
            </Badge>
            <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded-full bg-secondary/80 backdrop-blur-md border-border/50">
              <Clock className="h-2.5 w-2.5" />
              {currentDate.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
            </Badge>
          </div>
        </div>

        {!selectedStaff ? (
          /* Staff Selection */
          <Card className="w-full bg-card/60 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden rounded-3xl">
            <CardHeader className="p-4 sm:p-5 text-center border-b border-border/5 bg-gradient-to-b from-card to-transparent">
              <CardTitle className="text-lg sm:text-xl font-bold">Select User</CardTitle>
              <CardDescription className="text-xs sm:text-sm font-medium mt-0.5">Choose your profile to sign in</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                {staffMembers.map((staff) => (
                  <button
                    key={staff.id}
                    onClick={() => setSelectedStaff(staff)}
                    className="group flex items-center justify-between rounded-2xl border border-border/40 bg-background/50 p-2 sm:p-2.5 transition-all duration-300 hover:border-primary/40 hover:bg-primary/5 hover:shadow-md hover:shadow-primary/5 active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-primary/5 text-primary group-hover:from-primary group-hover:to-primary/80 group-hover:text-primary-foreground transition-all duration-300 shadow-sm border border-primary/10">
                        <span className="font-bold text-xs sm:text-sm">{staff.initials}</span>
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="font-bold text-xs sm:text-sm text-foreground group-hover:text-primary transition-colors">{staff.name}</span>
                        <span className="text-[9px] sm:text-[10px] font-medium text-muted-foreground mt-0.5">{staff.role}</span>
                      </div>
                    </div>
                    <div className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-background border border-border/50 text-muted-foreground opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 group-hover:border-primary/30 group-hover:text-primary group-hover:bg-primary/10 hover:!bg-primary hover:!text-primary-foreground">
                      <ChevronRight className="h-3 w-3 sm:h-3.5 w-3.5 ml-0.5" />
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : !shiftStarted ? (
          /* PIN Entry */
          <Card className="w-full bg-card/60 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden rounded-3xl">
            <CardHeader className="p-4 sm:p-5 text-center border-b border-border/5 bg-gradient-to-b from-card to-transparent relative">
              <button 
                onClick={() => { setSelectedStaff(null); setPin(""); setError(""); }}
                className="absolute left-3 top-3 h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center rounded-full bg-secondary/50 hover:bg-secondary text-muted-foreground transition-colors"
                aria-label="Back"
              >
                 <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 rotate-180 pr-0.5" />
              </button>
              <div className="mx-auto mb-2 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/20 ring-4 ring-primary/10">
                <span className="text-base sm:text-lg font-bold">{selectedStaff.initials}</span>
              </div>
              <CardTitle className="text-base sm:text-lg font-bold">{selectedStaff.name}</CardTitle>
              <CardDescription className="text-xs font-medium mt-0.5">Enter your 4-digit security PIN</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              {/* PIN Display */}
              <div className="flex justify-center gap-3 mb-4 sm:mb-5 mt-1">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`flex h-3 w-3 items-center justify-center rounded-full border-2 transition-all duration-300 ${pin[i] ? 'border-primary bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)] scale-110' : 'border-border/60 bg-secondary/30'}`}
                  >
                  </div>
                ))}
              </div>

              {error && (
                <div className="mb-3 sm:mb-4 text-center">
                  <span className="inline-block px-3 py-1 bg-destructive/10 text-destructive text-xs font-semibold rounded-full border border-destructive/20 mt-[-8px] mb-1">
                    {error}
                  </span>
                </div>
              )}

              {/* Number Pad */}
              <div className="grid grid-cols-3 gap-2 px-8 sm:px-16">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "←"].map((digit, i) => (
                  <Button
                    key={i}
                    variant={digit === "" ? "ghost" : "outline"}
                    className={`h-11 sm:h-12 text-lg font-semibold rounded-2xl border-border/40 bg-background/50 backdrop-blur-sm transition-all duration-200
                      hover:bg-primary/5 hover:border-primary/30 hover:text-primary hover:shadow-sm active:scale-[0.95]
                      ${digit === "" ? 'opacity-0 pointer-events-none' : ''}
                      ${digit === "←" ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30' : ''}`}
                    onClick={() => {
                      if (digit === "←") {
                        handlePinDelete();
                      } else {
                        handlePinInput(digit);
                      }
                    }}
                  >
                    {digit}
                  </Button>
                ))}
              </div>

              <div className="mt-5 sm:mt-6 px-8 sm:px-16">
                <Button
                  size="lg"
                  className="w-full h-11 sm:h-12 text-sm font-bold rounded-2xl shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:shadow-primary/30 active:scale-[0.98] disabled:opacity-50 disabled:hover:shadow-none"
                  disabled={pin.length !== 4}
                  onClick={handlePinSubmit}
                >
                  {pin.length === 4 ? <Lock className="mr-2 h-4 w-4" /> : <Fingerprint className="mr-2 h-4 w-4" />}
                  {pin.length === 4 ? "Unlock System" : "Enter PIN"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Shift Start */
          <Card className="w-full bg-card/60 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden rounded-3xl">
            <CardHeader className="p-4 sm:p-5 text-center border-b border-border/5 bg-gradient-to-b from-card to-transparent relative">
               <button 
                onClick={() => { setShiftStarted(false); setPin(""); setError(""); }}
                className="absolute left-3 top-3 h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center rounded-full bg-secondary/50 hover:bg-secondary text-muted-foreground transition-colors"
                aria-label="Back"
              >
                 <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 rotate-180 pr-0.5" />
              </button>
              <div className="mx-auto mb-2 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md shadow-emerald-500/20 ring-4 ring-emerald-500/10">
                <User className="h-5 w-5" />
              </div>
              <CardTitle className="text-base sm:text-lg font-bold">Welcome, {selectedStaff.name}!</CardTitle>
              <CardDescription className="text-xs font-medium mt-0.5">Ready to start your shift?</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 space-y-4">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-secondary/30 border border-border/40 backdrop-blur-sm transition-all hover:bg-secondary/40">
                  <span className="text-muted-foreground font-medium text-[10px] sm:text-xs mb-1">Date</span>
                  <span className="text-foreground font-semibold text-xs sm:text-sm text-center leading-tight">
                    {currentDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-secondary/30 border border-border/40 backdrop-blur-sm transition-all hover:bg-secondary/40">
                  <span className="text-muted-foreground font-medium text-[10px] sm:text-xs mb-1">Time</span>
                  <span className="text-foreground font-semibold text-xs sm:text-sm text-center leading-tight">
                    {currentDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-secondary/30 border border-border/40 backdrop-blur-sm transition-all hover:bg-secondary/40">
                  <span className="text-muted-foreground font-medium text-[10px] sm:text-xs mb-1">Role</span>
                  <Badge variant="outline" className="font-bold text-[10px] sm:text-[11px] px-2 py-0 border-primary/30 text-primary bg-primary/5 rounded-full mt-0.5">
                    {selectedStaff.role}
                  </Badge>
                </div>
              </div>

              <div className="flex justify-center pt-2 pb-1">
                <Button 
                  size="lg" 
                  className="w-full max-w-[240px] h-11 sm:h-12 text-sm font-bold rounded-full shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:shadow-primary/30 active:scale-[0.98]" 
                  onClick={handleStartShift}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  Start My Shift
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

