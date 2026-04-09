"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CatLogo } from "@/components/ui/cat-logo";

interface TransitionOverlayProps {
  isAnimating: boolean;
  origin: { x: number; y: number } | null;
  onComplete: () => void;
}

export function TransitionOverlay({ isAnimating, origin, onComplete }: TransitionOverlayProps) {
  const [phase, setPhase] = useState<number>(0);
  const [windowSize, setWindowSize] = useState({ width: 1000, height: 1000 });

  useEffect(() => {
    setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    
    if (isAnimating) {
      setPhase(1); // Ripple
      
      const t1 = setTimeout(() => setPhase(2), 600); // Cat & Text Reveal
      const t2 = setTimeout(() => setPhase(3), 2000); // Micro Animation
      const t3 = setTimeout(() => setPhase(4), 3800); // Transition out
      const t4 = setTimeout(() => {
         setPhase(0);
         onComplete();
      }, 4800); // Full unmount

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
      };
    }
  }, [isAnimating, onComplete]);

  if (!isAnimating || !origin) return null;

  const maxDimension = Math.max(windowSize.width, windowSize.height) * 1.5;
  const isDesktop = windowSize.width >= 1024;
  
  // Precise calculation for the center of the sidebar logo
  const targetX = -(windowSize.width / 2) + (isDesktop ? 40 : 36);
  const targetY = -(windowSize.height / 2) + (isDesktop ? 40 : 32);

  // Split text for SUHASHI perfect animation
  const textChars = "SUHASHI".split("");

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center overflow-hidden">
      <AnimatePresence>
        {phase < 4 && (
          <motion.div
            key="overlay"
            className="absolute inset-0 z-40"
            initial={{ opacity: 1, backdropFilter: "blur(0px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(12px)", transition: { duration: 0.8, ease: [0.32, 0.72, 0, 1] } }}
          >
            {/* Activation Ripple - Slower, smoother expansion */}
            <motion.div
              className="absolute bg-[#F59E0B] rounded-full"
              style={{
                left: origin.x,
                top: origin.y,
                width: maxDimension * 2,
                height: maxDimension * 2,
                originX: 0.5,
                originY: 0.5,
                translateX: "-50%",
                translateY: "-50%",
              }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase >= 2 && phase < 4 && (
          <motion.div
            key="content-container"
            className="absolute z-50 flex flex-col items-center justify-center gap-6 sm:gap-8"
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{
              scale: 0.4,
              opacity: 0,
              x: targetX,
              y: targetY,
            }}
            transition={{
              scale: { type: "spring", damping: 18, stiffness: 100 },
              opacity: { duration: 0.5 },
              y: { type: "spring", damping: 20, stiffness: 100 },
              exit: { duration: 0.8, ease: [0.32, 0.72, 0, 1] } // Buttersmooth trajectory to sidebar
            }}
          >
            <div className="relative flex h-32 w-32 sm:h-40 sm:w-40 items-center justify-center rounded-[2rem] bg-white shadow-2xl overflow-hidden">
              {/* The Cat Logo with a buttery smooth playful wiggle */}
              <motion.div
                className="relative h-full w-full p-4"
                animate={
                  phase === 3
                    ? {
                        rotate: [0, -8, 6, -4, 2, 0],
                        y: [0, -6, 0, -3, 0],
                      }
                    : { rotate: 0 }
                }
                transition={{ duration: 1.2, ease: "easeInOut" }}
              >
                <CatLogo className="h-full w-full" />
                
                {/* Simulated Cat Paw for scratching ear */}
                <AnimatePresence>
                  {phase === 3 && (
                    <motion.div
                      className="absolute top-4 right-6 h-6 w-6 rounded-full bg-[#18181A] shadow-lg border-[3px] border-white"
                      initial={{ opacity: 0, x: 24, y: 36, scale: 0 }}
                      animate={{
                        opacity: [0, 1, 1, 1, 0],
                        x: [24, 0, -6, 0, 24],
                        y: [36, -6, 0, -6, 36],
                        scale: [0.5, 1, 1, 1, 0.5],
                      }}
                      transition={{ duration: 1.2, times: [0, 0.2, 0.5, 0.8, 1], ease: "easeInOut" }}
                    />
                  )}
                </AnimatePresence>
                
                <AnimatePresence>
                  {phase === 3 && (
                    <motion.div
                      className="absolute top-[42%] left-[32%] w-[38%] h-[12%] bg-[#18181A] rounded-full"
                      initial={{ opacity: 0, scaleY: 0 }}
                      animate={{
                        opacity: [0, 1, 1, 0],
                        scaleY: [0, 1, 1, 0],
                      }}
                      transition={{ delay: 0.5, duration: 0.3, times: [0, 0.2, 0.8, 1] }}
                    />
                  )}
                </AnimatePresence>
              </motion.div>
            </div>

            {/* SUHASHI Text Reveal */}
            <motion.div 
              className="flex items-center overflow-hidden px-2 pt-2"
              exit={{ opacity: 0, filter: "blur(8px)", transition: { duration: 0.4 } }}
            >
              {textChars.map((char, index) => (
                <motion.span
                  key={index}
                  className="relative text-5xl sm:text-7xl lg:text-[5rem] font-black text-[#18181A] leading-none tracking-tighter"
                  style={{ 
                    fontFamily: "'Inter', 'Montserrat', 'Arial Black', sans-serif",
                    marginRight: char === "I" ? "0" : "0.02em", 
                  }}
                  initial={{ y: "100%", opacity: 0, filter: "blur(10px)", rotateX: -90 }}
                  animate={{ y: 0, opacity: 1, filter: "blur(0px)", rotateX: 0 }}
                  transition={{
                    type: "spring",
                    damping: 16,
                    stiffness: 120,
                    delay: 0.5 + index * 0.05, // Stagger effect
                  }}
                >
                  {char}
                  {/* The unique dot above the 'I' matching the image */}
                  {char === "I" && (
                    <motion.div 
                      className="absolute -top-3 left-1/2 h-3.5 w-3.5 sm:h-5 sm:w-5 -translate-x-1/2 rounded-full bg-[#18181A]"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.5 + index * 0.05 + 0.2, type: "spring", stiffness: 200 }}
                    />
                  )}
                </motion.span>
              ))}
            </motion.div>
            
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
