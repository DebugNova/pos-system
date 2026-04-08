"use client";

import { useState } from "react";
import { usePOSStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Coffee, User, Lock, Clock, Wifi } from "lucide-react";

interface LoginProps {
  onLogin: (user: { name: string; role: string; pin: string }) => void;
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

  const handleStartShift = () => {
    if (selectedStaff) {
      onLogin({ name: selectedStaff.name, role: selectedStaff.role, pin: selectedStaff.pin });
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
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        {/* Logo and Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary">
            <Coffee className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">SUHASHI Cafe</h1>
          <p className="mt-1 text-muted-foreground">Point of Sale System</p>
          <div className="mt-4 flex items-center justify-center gap-4">
            <Badge variant="outline" className="gap-1.5 py-1.5 text-success border-success/30 bg-success/10">
              <Wifi className="h-3 w-3" />
              Online
            </Badge>
            <Badge variant="secondary" className="gap-1.5 py-1.5">
              <Clock className="h-3 w-3" />
              {currentDate.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
            </Badge>
          </div>
        </div>

        {!selectedStaff ? (
          /* Staff Selection */
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Select User</CardTitle>
              <CardDescription>Choose your profile to sign in</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {staffMembers.map((staff) => (
                <button
                  key={staff.id}
                  onClick={() => setSelectedStaff(staff)}
                  className="flex flex-col items-center gap-2 rounded-xl border border-border bg-secondary/30 p-4 transition-all hover:border-primary/50 hover:bg-secondary/50 active:scale-[0.98]"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/20">
                    <span className="text-lg font-semibold text-primary">{staff.initials}</span>
                  </div>
                  <span className="font-medium text-foreground">{staff.name}</span>
                  <Badge variant="secondary" className="text-xs">{staff.role}</Badge>
                </button>
              ))}
            </CardContent>
          </Card>
        ) : !shiftStarted ? (
          /* PIN Entry */
          <Card className="bg-card border-border">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
                <span className="text-xl font-semibold text-primary">{selectedStaff.initials}</span>
              </div>
              <CardTitle className="text-lg">{selectedStaff.name}</CardTitle>
              <CardDescription>Enter your 4-digit PIN</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* PIN Display */}
              <div className="flex justify-center gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-border bg-secondary"
                  >
                    {pin[i] ? (
                      <div className="h-4 w-4 rounded-full bg-primary" />
                    ) : null}
                  </div>
                ))}
              </div>

              {error && (
                <p className="text-center text-sm text-destructive">{error}</p>
              )}

              {/* Number Pad */}
              <div className="grid grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "←"].map((digit, i) => (
                  <Button
                    key={i}
                    variant={digit === "" ? "ghost" : "secondary"}
                    size="lg"
                    className="h-14 text-xl font-medium"
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

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setSelectedStaff(null);
                    setPin("");
                    setError("");
                  }}
                >
                  Back
                </Button>
                <Button
                  className="flex-1"
                  disabled={pin.length !== 4}
                  onClick={handlePinSubmit}
                >
                  <Lock className="mr-2 h-4 w-4" />
                  Unlock
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Shift Start */
          <Card className="bg-card border-border">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-success/20">
                <User className="h-8 w-8 text-success" />
              </div>
              <CardTitle className="text-lg">Welcome, {selectedStaff.name}!</CardTitle>
              <CardDescription>Ready to start your shift?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-secondary/50 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Date</span>
                  <span className="text-foreground">{currentDate.toLocaleDateString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Time</span>
                  <span className="text-foreground">{currentDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Role</span>
                  <Badge variant="secondary">{selectedStaff.role}</Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="openingCash">Opening Cash (Optional)</Label>
                <Input
                  id="openingCash"
                  type="number"
                  placeholder="Enter opening cash amount"
                  className="bg-secondary border-none"
                />
              </div>

              <Button className="w-full h-14 text-lg" onClick={handleStartShift}>
                <Clock className="mr-2 h-5 w-5" />
                Start Shift
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
