const fs = require('fs');
const path = require('path');

const svgFile = fs.readFileSync(path.join(__dirname, 'cat-traced.svg'), 'utf8');

// Extract the path data
const pathMatch = svgFile.match(/<path d="([^"]+)"/);
if (!pathMatch) {
    console.error("Could not find path data in cat-traced.svg");
    process.exit(1);
}

const pathData = pathMatch[1];

const componentCode = `
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
      {/* White backing for the eyes, ears, and paws to cover trace holes */}
      <circle cx="800" cy="710" r="150" fill="#FFFFFF" />
      <circle cx="1340" cy="710" r="150" fill="#FFFFFF" />
      <circle cx="650" cy="250" r="100" fill="#FFFFFF" />
      <circle cx="1450" cy="250" r="100" fill="#FFFFFF" />
      <rect x="700" y="1600" width="700" height="400" fill="#FFFFFF" rx="100" />
      
      {/* The traced mathematically identical path */}
      <path 
        d="${pathData}" 
        stroke="none" 
        fill={fillColor} 
        fillRule="evenodd" 
      />
    </svg>
  );
}
`;

fs.writeFileSync(path.join(__dirname, 'components/ui/cat-logo.tsx'), componentCode);
console.log("CatLogo component successfully rebuilt and fixed!");
