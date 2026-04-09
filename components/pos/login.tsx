"use client";

import { useState } from "react";
import { usePOSStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Coffee, User, Lock, Clock, Wifi } from "lucide-react";
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
    <div className="flex min-h-[100dvh] items-center justify-center bg-background p-2 sm:p-4">
      <div className="w-full max-w-sm sm:max-w-md">
        {/* Logo and Header */}
        <div className="mb-4 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-primary overflow-hidden shadow-sm">
            <CatLogo className="p-1.5" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">SUHASHI Cafe</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Point of Sale System</p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <Badge variant="outline" className="gap-1 px-2 py-0.5 text-[10px] sm:text-xs text-success border-success/30 bg-success/10 font-medium">
              <Wifi className="h-2.5 w-2.5" />
              Online
            </Badge>
            <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-[10px] sm:text-xs font-medium">
              <Clock className="h-2.5 w-2.5" />
              {currentDate.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
            </Badge>
          </div>
        </div>

        {!selectedStaff ? (
          /* Staff Selection */
          <Card className="bg-card border-border shadow-md">
            <CardHeader className="p-4 pb-2 text-center">
              <CardTitle className="text-base sm:text-lg">Select User</CardTitle>
              <CardDescription className="text-xs">Choose your profile to sign in</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 grid grid-cols-2 gap-2">
              {staffMembers.map((staff) => (
                <button
                  key={staff.id}
                  onClick={() => setSelectedStaff(staff)}
                  className="group flex flex-col items-center gap-1 sm:gap-2 rounded-xl border border-border bg-secondary/30 p-2 sm:p-3 transition-all hover:border-primary/50 hover:bg-secondary/50 hover:shadow-sm active:scale-[0.98]"
                >
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-primary/10 transition-colors group-hover:bg-primary/20">
                    <span className="text-sm sm:text-base font-semibold text-primary">{staff.initials}</span>
                  </div>
                  <span className="font-medium text-xs sm:text-sm text-foreground">{staff.name}</span>
                  <Badge variant="secondary" className="text-[9px] sm:text-[10px] px-1.5 py-0 font-medium">{staff.role}</Badge>
                </button>
              ))}
            </CardContent>
          </Card>
        ) : !shiftStarted ? (
          /* PIN Entry */
          <Card className="bg-card border-border shadow-md">
            <CardHeader className="p-4 pb-2 text-center">
              <div className="mx-auto mb-1 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-primary/10">
                <span className="text-sm sm:text-base font-semibold text-primary">{selectedStaff.initials}</span>
              </div>
              <CardTitle className="text-base sm:text-lg">{selectedStaff.name}</CardTitle>
              <CardDescription className="text-[10px] sm:text-xs">Enter your 4-digit PIN</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3 sm:space-y-4">
              {/* PIN Display */}
              <div className="flex justify-center gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl border-2 border-border bg-secondary shadow-inner"
                  >
                    {pin[i] ? (
                      <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-primary" />
                    ) : null}
                  </div>
                ))}
              </div>

              {error && (
                <p className="text-center text-[10px] sm:text-xs text-destructive font-medium m-0">{error}</p>
              )}

              {/* Number Pad */}
              <div className="grid grid-cols-3 gap-2 px-1 sm:px-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "←"].map((digit, i) => (
                  <Button
                    key={i}
                    variant={digit === "" ? "ghost" : "secondary"}
                    size="sm"
                    className="h-10 sm:h-11 text-base sm:text-lg font-medium rounded-xl hover:bg-secondary/80 active:scale-[0.98]"
                    disabled={digit === ""}
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

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-9 sm:h-10 text-xs sm:text-sm font-medium rounded-xl"
                  onClick={() => {
                    setSelectedStaff(null);
                    setPin("");
                    setError("");
                  }}
                >
                  Back
                </Button>
                <Button
                  size="sm"
                  className="flex-[2] h-9 sm:h-10 text-xs sm:text-sm font-medium rounded-xl"
                  disabled={pin.length !== 4}
                  onClick={handlePinSubmit}
                >
                  <Lock className="mr-1.5 h-3.5 w-3.5" />
                  Unlock
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Shift Start */
          <Card className="bg-card border-border shadow-md">
            <CardHeader className="p-4 pb-2 text-center">
              <div className="mx-auto mb-1 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-success/10">
                <User className="h-5 w-5 sm:h-6 sm:w-6 text-success" />
              </div>
              <CardTitle className="text-base sm:text-lg">Welcome, {selectedStaff.name}!</CardTitle>
              <CardDescription className="text-[10px] sm:text-xs">Ready to start your shift?</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3 sm:space-y-4">
              <div className="rounded-xl bg-secondary/50 p-2.5 sm:p-3 space-y-1.5 sm:space-y-2 border border-border/50">
                <div className="flex justify-between items-center text-[10px] sm:text-xs">
                  <span className="text-muted-foreground font-medium">Date</span>
                  <span className="text-foreground font-semibold">{currentDate.toLocaleDateString("en-IN")}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] sm:text-xs">
                  <span className="text-muted-foreground font-medium">Time</span>
                  <span className="text-foreground font-semibold">{currentDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] sm:text-xs pt-1 border-t border-border/50">
                  <span className="text-muted-foreground font-medium">Role</span>
                  <Badge variant="secondary" className="font-medium text-[9px] sm:text-[10px] px-1.5 py-0">{selectedStaff.role}</Badge>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="openingCash" className="text-[10px] sm:text-xs font-medium">Opening Cash <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-xs sm:text-sm">₹</span>
                  <Input
                    id="openingCash"
                    type="number"
                    placeholder="0.00"
                    className="bg-secondary/50 border-border/50 pl-6 h-9 sm:h-10 text-xs sm:text-sm font-medium rounded-xl focus-visible:ring-1"
                  />
                </div>
              </div>

              <Button size="sm" className="w-full h-9 sm:h-10 text-sm font-medium rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98]" onClick={handleStartShift}>
                <Clock className="mr-1.5 h-3.5 w-3.5" />
                Start Shift
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
