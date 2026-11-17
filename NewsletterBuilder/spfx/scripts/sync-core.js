/**
 * Copies the shared editor core from ../standalone/js into src/core so both versions stay identical.
 * Runs automatically before build/start (see package.json).
 */
const fs = require('fs');
const path = require('path');
const srcDir = path.resolve(__dirname, '../../standalone/js');
const dstDir = path.resolve(__dirname, '../src/core');
fs.mkdirSync(dstDir, { recursive: true });
for (const f of ['nl-core.js', 'nl-editor.js']) {
  const src = path.join(srcDir, f);
  if (!fs.existsSync(src)) { console.warn('[sync-core] missing ' + src + ' - keeping existing copy'); continue; }
  fs.copyFileSync(src, path.join(dstDir, f));
  console.log('[sync-core] ' + f + ' -> src/core');
}
