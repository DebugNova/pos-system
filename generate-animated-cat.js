const fs = require('fs');
const path = require('path');

const svgFile = fs.readFileSync(path.join(__dirname, 'cat-traced.svg'), 'utf8');

const pathMatch = svgFile.match(/d="([^"]+)"/);
if (!pathMatch) process.exit(1);

const d = pathMatch[1];
const subpaths = d.split(/(?=M)/).filter(Boolean);

// Based on coordinates:
// 0: Main body
// 1: Right Ear
// 2: Left Ear
// 3: Left Eye
// 4: Right Eye
// 5: Left Pupil
// 6: Right Pupil
const bodyPath = subpaths[0] + subpaths[1] + subpaths[2];
const eyeWhitePath = subpaths[3] + subpaths[4];
const eyePupilPath = subpaths[5] + subpaths[6];

const componentCode = `
"use client";

import { cn } from "@/lib/utils";

interface CatLogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  fillColor?: string;
}

export function CatLogo({ className, fillColor = "#18181A", ...props }: CatLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 2048 2048"
      className={cn("w-full h-full", className)}
      {...props}
    >
      <style>
        {\`
          @keyframes cat-float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-2.5%); }
          }
          @keyframes cat-blink {
            0%, 5%, 100% { transform: scaleY(1); }
            2.5% { transform: scaleY(0.05); }
          }
          @keyframes cat-wag {
            0%, 100% { transform: rotate(0deg); }
            50% { transform: rotate(6deg); }
          }
          
          .cat-float-group {
            animation: cat-float 4s ease-in-out infinite;
          }
          .cat-eyes-group {
            transform-origin: 1000px 722px;
            animation: cat-blink 3.5s ease-in-out infinite;
          }
          .cat-tail-group {
            transform-origin: 1660px 1600px;
            animation: cat-wag 3s ease-in-out infinite;
          }
        \`}
      </style>

      <defs>
        {/* Body mask hides the tail specifically so they don't overlap strangely when wagging */}
        <clipPath id="body-mask" clipRule="evenodd">
          <path d="M 0 0 h 2048 v 2048 h -2048 Z M 1670 1320 h 378 v 728 h -378 Z" />
        </clipPath>
        
        {/* Tail mask isolates just the tail */}
        <clipPath id="tail-mask">
          <path d="M 1650 1300 h 398 v 748 h -398 Z" />
        </clipPath>
      </defs>

      {/* Wrapping the whole character in the float animation */}
      <g className="cat-float-group">
        
        {/* MAIN BODY (Clipped to discard the static tail) */}
        <g clipPath="url(#body-mask)">
          <path 
            d="${bodyPath}" 
            fill={fillColor} 
            fillRule="evenodd" 
          />
        </g>

        {/* WAGGING TAIL (Clipped to isolate the tail, overlapping body by 20px) */}
        <g className="cat-tail-group" clipPath="url(#tail-mask)">
          <path 
            d="${bodyPath}" 
            fill={fillColor} 
            fillRule="evenodd" 
          />
        </g>

        {/* BLINKING EYES (Drawn as perfect overlays on top of the solid body) */}
        <g className="cat-eyes-group">
          <path d="${eyeWhitePath}" fill="#FFFFFF" fillRule="evenodd" />
          <path d="${eyePupilPath}" fill="#18181A" fillRule="evenodd" />
        </g>

      </g>
    </svg>
  );
}
`;

fs.writeFileSync(path.join(__dirname, 'components/ui/cat-logo.tsx'), componentCode);
console.log("CatLogo successfully wrapped with floating, blinking, and wagging animations!");
