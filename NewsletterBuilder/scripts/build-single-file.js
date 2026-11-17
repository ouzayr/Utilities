/**
 * Builds standalone/NewsletterBuilder.html - one self-contained file you can copy anywhere
 * (email it, put it on OneDrive, double-click to run). Run: node scripts/build-single-file.js
 */
const fs = require('fs');
const path = require('path');
const dir = path.resolve(__dirname, '../standalone');
let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, src) => {
  const code = fs.readFileSync(path.join(dir, src), 'utf8').replace(/<\/script/gi, '<\\/script');
  return '<script>\n/* ' + src + ' */\n' + code + '\n</script>';
});
const out = path.join(dir, 'NewsletterBuilder.html');
fs.writeFileSync(out, html);
console.log('Wrote ' + out + ' (' + Math.round(html.length / 1024) + ' KB)');
