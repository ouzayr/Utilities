#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { scanAngularProject } from './scanner.js';

interface ScanConfig {
  root?: string;
  out?: string;
  project?: string;
  include?: string;
  exclude?: string;
  apiBase?: string;
  scanId?: string;
  finalize?: boolean;
}

function loadConfigFile(): ScanConfig {
  const candidates = [
    'cc-scan-config.json',
    '../cc-scan-config.json',
    '../../cc-scan-config.json',
  ];
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (fs.existsSync(resolved)) {
      try {
        const raw = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
        const angular = raw.angular ?? raw;
        console.log(`[cc-scan-angular] loaded config from ${resolved}`);
        return angular as ScanConfig;
      } catch {
        // ignore malformed config
      }
    }
  }
  return {};
}

const fileConfig = loadConfigFile();

const program = new Command()
  .name('cc-scan-angular')
  .description('Angular static analyser — emits a normalised graph.json')
  .option('--root <path>', 'Path to the Angular project root (must contain package.json + tsconfig.json or angular.json)')
  .option('--out <path>', 'Output path for graph.json')
  .option('--project <name>', 'Logical project key (defaults to folder name)')
  .option('--include <globs>', 'Comma-separated include globs')
  .option('--exclude <globs>', 'Comma-separated exclude globs')
  .option('--api-base <url>', 'If set, POST graph.json to this API after writing it')
  .option('--scan-id <uuid>', 'Existing scan id to merge into (otherwise the API creates a fresh scan)')
  .option('--finalize', 'Mark the scan as completed after this ingest', false)
  .parse(process.argv);

const cliOpts = program.opts<{ root?: string; out?: string; project?: string; include?: string; exclude?: string; apiBase?: string; scanId?: string; finalize?: boolean }>();

const merged = {
  root: cliOpts.root ?? fileConfig.root,
  out: cliOpts.out ?? fileConfig.out ?? 'graph.json',
  project: cliOpts.project ?? fileConfig.project,
  include: cliOpts.include ?? fileConfig.include ?? '**/*.ts,**/*.html,**/*.scss,**/*.css',
  exclude: cliOpts.exclude ?? fileConfig.exclude ?? '**/node_modules/**,**/dist/**,**/.angular/**,**/*.spec.ts',
  apiBase: cliOpts.apiBase ?? fileConfig.apiBase,
  scanId: cliOpts.scanId ?? fileConfig.scanId,
  finalize: cliOpts.finalize || fileConfig.finalize || false,
};

if (!merged.root) {
  console.error('[cc-scan-angular] --root is required (or set "root" in cc-scan-config.json)');
  process.exit(2);
}

const root = path.resolve(merged.root);
if (!fs.existsSync(root)) {
  console.error(`[cc-scan-angular] root does not exist: ${root}`);
  process.exit(2);
}
const project = merged.project ?? path.basename(root);

const t0 = Date.now();
const result = await scanAngularProject({
  root,
  project,
  includeGlobs: merged.include.split(',').map((s) => s.trim()).filter(Boolean),
  excludeGlobs: merged.exclude.split(',').map((s) => s.trim()).filter(Boolean),
});
result.metrics.msTaken = Date.now() - t0;

fs.mkdirSync(path.dirname(path.resolve(merged.out)), { recursive: true });
fs.writeFileSync(merged.out, JSON.stringify(result, null, 2));
console.log(`[cc-scan-angular] wrote ${result.nodes.length} nodes, ${result.edges.length} edges, ${result.findings.length} findings → ${merged.out}`);

if (merged.apiBase) {
  const qs = new URLSearchParams();
  if (merged.scanId) qs.set('scanId', merged.scanId);
  if (merged.finalize) qs.set('finalize', 'true');
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const url = `${merged.apiBase.replace(/\/$/, '')}/api/graph/ingest${query}`;
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
