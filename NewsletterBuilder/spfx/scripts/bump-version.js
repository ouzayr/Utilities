/**
 * Usage: node scripts/bump-version.js 1.1.0
 * Updates package.json, config/package-solution.json (x.y.z.0) and src/version.ts together.
 */
const fs = require('fs');
const path = require('path');
const v = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(v || '')) { console.error('Usage: node scripts/bump-version.js <major.minor.patch>'); process.exit(1); }
const root = path.resolve(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')); pkg.version = v;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
const solPath = path.join(root, 'config/package-solution.json');
const sol = JSON.parse(fs.readFileSync(solPath, 'utf8'));
sol.solution.version = v + '.0';
(sol.solution.features || []).forEach(f => { f.version = v + '.0'; });
fs.writeFileSync(solPath, JSON.stringify(sol, null, 2) + '\n');
const verPath = path.join(root, 'src/version.ts');
fs.writeFileSync(verPath, fs.readFileSync(verPath, 'utf8').replace(/APP_VERSION: string = '[^']*'/, "APP_VERSION: string = '" + v + "'"));
console.log('Version set to ' + v);
