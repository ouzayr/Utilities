#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { scanAngularProject } from './scanner.js';

const program = new Command()
  .name('cc-scan-angular')
  .description('Angular static analyser — emits a normalised graph.json')
  .requiredOption('--root <path>', 'Path to the Angular project root (must contain package.json + tsconfig.json or angular.json)')
  .option('--out <path>', 'Output path for graph.json', 'graph.json')
  .option('--project <name>', 'Logical project key (defaults to folder name)')
  .option('--include <globs>', 'Comma-separated include globs', '**/*.ts,**/*.html,**/*.scss,**/*.css')
  .option('--exclude <globs>', 'Comma-separated exclude globs', '**/node_modules/**,**/dist/**,**/.angular/**,**/*.spec.ts')
  .option('--api-base <url>', 'If set, POST graph.json to this API after writing it')
  .option('--scan-id <uuid>', 'Existing scan id to merge into (otherwise the API creates a fresh scan)')
  .option('--finalize', 'Mark the scan as completed after this ingest', false)
  .parse(process.argv);

const opts = program.opts<{ root: string; out: string; project?: string; include: string; exclude: string; apiBase?: string; scanId?: string; finalize?: boolean }>();

const root = path.resolve(opts.root);
if (!fs.existsSync(root)) {
  console.error(`[cc-scan-angular] root does not exist: ${root}`);
  process.exit(2);
}
const project = opts.project ?? path.basename(root);

const t0 = Date.now();
const result = await scanAngularProject({
  root,
  project,
  includeGlobs: opts.include.split(',').map((s) => s.trim()).filter(Boolean),
  excludeGlobs: opts.exclude.split(',').map((s) => s.trim()).filter(Boolean),
});
result.metrics.msTaken = Date.now() - t0;

fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true });
fs.writeFileSync(opts.out, JSON.stringify(result, null, 2));
console.log(`[cc-scan-angular] wrote ${result.nodes.length} nodes, ${result.edges.length} edges, ${result.findings.length} findings → ${opts.out}`);

if (opts.apiBase) {
  const qs = new URLSearchParams();
  if (opts.scanId) qs.set('scanId', opts.scanId);
  if (opts.finalize) qs.set('finalize', 'true');
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const url = `${opts.apiBase.replace(/\/$/, '')}/api/graph/ingest${query}`;
  console.log(`[cc-scan-angular] POST ${url}`);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    });
    if (!res.ok) {
      console.error(`[cc-scan-angular] ingest failed: ${res.status} ${await res.text()}`);
      process.exit(3);
    }
    console.log(`[cc-scan-angular] ingest ok`);
  } catch (e) {
    console.error(`[cc-scan-angular] ingest error: ${(e as Error).message}`);
    process.exit(3);
  }
}
