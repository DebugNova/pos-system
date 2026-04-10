const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'components', 'pos');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Phase 2.3 transformations
    content = content.replace(/text-\[10px\]/g, 'text-[11px] sm:text-xs');
    content = content.replace(/h-2\.5 w-2\.5/g, 'h-3 w-3');
    content = content.replace(/min-w-\[20px\]/g, 'min-w-[24px]');

    // Phase 2.2 transformations: touch feedback
    // hover:bg-secondary/50 → hover:bg-secondary/50 active:bg-secondary/70
    content = content.replace(/hover:bg-secondary\/50(?!\s+active:)/g, 'hover:bg-secondary/50 active:bg-secondary/70');
    
    // hover:scale-\[1\.02\] → hover:scale-[1.02] active:scale-[0.98]
    content = content.replace(/hover:scale-\[1\.02\](?!\s+active:)/g, 'hover:scale-[1.02] active:scale-[0.98]');

    // hover:bg-primary\/10 → hover:bg-primary/10 active:bg-primary/20
    content = content.replace(/hover:bg-primary\/10(?!\s+active:)/g, 'hover:bg-primary/10 active:bg-primary/20');
    
    // hover:shadow-md → hover:shadow-md active:shadow-sm
    content = content.replace(/hover:shadow-md(?!\s+active:)/g, 'hover:shadow-md active:shadow-sm');

    if (original !== content) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${filePath}`);
    }
}

function traverseDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            traverseDirectory(fullPath);
        } else if (fullPath.endsWith('.tsx')) {
            processFile(fullPath);
        }
    }
}

traverseDirectory(directoryPath);
