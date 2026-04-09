const potrace = require('potrace');
const fs = require('fs');
const path = require('path');

const imagePath = path.join(__dirname, 'logo for cat.png');

potrace.trace(imagePath, function(err, svg) {
  if (err) throw err;
  fs.writeFileSync('cat-traced.svg', svg);
  console.log('Done!');
});
