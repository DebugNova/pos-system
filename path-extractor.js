const fs = require('fs');
const svgPathBbox = require('svg-path-bounding-box');

const svgData = fs.readFileSync('cat-traced.svg', 'utf8');
const pathMatch = svgData.match(/d="([^"]+)"/);
if (!pathMatch) process.exit(1);

const path = pathMatch[1];

// Split the path into subpaths. Each starts with 'M' (since potrace uses absolute coordinates for M mostly)
const subpaths = path.split(/(?=M)/);

subpaths.forEach((subpath, index) => {
    if (!subpath.trim()) return;
    try {
        const bbox = svgPathBbox(subpath);
        console.log(`Subpath ${index}:`);
        console.log(`  X: ${bbox.minX} - ${bbox.maxX} (W: ${bbox.width})`);
        console.log(`  Y: ${bbox.minY} - ${bbox.maxY} (H: ${bbox.height})`);
        console.log(`  Length roughly: ${subpath.length} chars`);
    } catch(e) {
        console.log(`Subpath ${index} failed to parse:`, e.message);
    }
}); 
