import * as fs from 'node:fs';
import * as path from 'node:path';
import fg from 'fast-glob';
import { Project, SourceFile } from 'ts-morph';
import { GraphEdge, GraphNode, Finding, ScanResult, edgeId } from './types.js';
import { extractDecorated } from './angular/decorators.js';
import { extractHttpCalls } from './angular/http-calls.js';
import { extractRoutes } from './angular/routes.js';
import { analyseStyles } from './angular/styles.js';
import { runLintRules } from './findings/index.js';

export interface ScanOptions {
  root: string;
  project: string;
  includeGlobs: string[];
  excludeGlobs: string[];
}

export async function scanAngularProject(opts: ScanOptions): Promise<ScanResult> {
  const { root, project } = opts;

  // Find a tsconfig: prefer tsconfig.app.json then tsconfig.json then any.
  const tsconfigCandidates = [
    'tsconfig.app.json',
    'tsconfig.json',
    'apps/' + project + '/tsconfig.app.json',
    'apps/' + project + '/tsconfig.json',
  ].map((p) => path.join(root, p));
  const tsconfig = tsconfigCandidates.find((p) => fs.existsSync(p));

  const proj = tsconfig
    ? new Project({ tsConfigFilePath: tsconfig, skipAddingFilesFromTsConfig: false, skipFileDependencyResolution: true })
    : new Project({ compilerOptions: { allowJs: false, target: 99 }, skipAddingFilesFromTsConfig: true });

  if (!tsconfig) {
    // Fall back to glob-adding TS files.
    const tsFiles = await fg(['**/*.ts'], { cwd: root, absolute: true, ignore: opts.excludeGlobs });
    for (const f of tsFiles) {
      try { proj.addSourceFileAtPath(f); } catch { /* ignore */ }
    }
  }

  const sourceFiles: SourceFile[] = proj.getSourceFiles().filter((sf) => {
    const p = sf.getFilePath();
    if (!p.startsWith(root)) return false;
    return !opts.excludeGlobs.some((g) => simpleGlobMatch(g, path.relative(root, p)));
  });

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const findings: Finding[] = [];

  // --- Pass 1: discover decorated classes (components, services, modules, ...) ---
  const decorated = extractDecorated(sourceFiles, root, project);
  nodes.push(...decorated.nodes);
  edges.push(...decorated.edges);

  // Build a name → service node id index used by HTTP-call extraction so we can
  // attribute calls to the enclosing class.
  const classToNode = new Map<string, GraphNode>();
  for (const n of decorated.nodes) {
    if (n.meta.className && typeof n.meta.className === 'string') {
      classToNode.set(n.meta.className, n);
    }
  }

  // --- Pass 2: extract HTTP calls anchored to their owning class ---
  for (const sf of sourceFiles) {
    const calls = extractHttpCalls(sf, root, project, classToNode);
    nodes.push(...calls.nodes);
    edges.push(...calls.edges);
  }

  // --- Pass 3: route trees ---
  for (const sf of sourceFiles) {
    const r = extractRoutes(sf, root, project, classToNode);
    nodes.push(...r.nodes);
    edges.push(...r.edges);
  }

  // --- Pass 4: SCSS / CSS hygiene ---
  const styleFiles = await fg(['**/*.scss', '**/*.css'], { cwd: root, absolute: true, ignore: opts.excludeGlobs });
  for (const file of styleFiles) {
    const f = analyseStyles(file, root, project);
    findings.push(...f);
  }

  // --- Pass 5: deduplicate and synth fan-in/out metrics ---
  const dedupedNodes = dedupeBy(nodes, (n) => n.id);
  const dedupedEdges = dedupeBy(edges, (e) => e.id);
  computeFanMetrics(dedupedNodes, dedupedEdges);

  // --- Pass 6: run lint rules ---
  findings.push(...runLintRules(dedupedNodes, dedupedEdges));

  return {
    schemaVersion: 1,
    side: 'ui',
    project,
    scannedAt: new Date().toISOString(),
    nodes: dedupedNodes,
    edges: dedupedEdges,
    findings,
    metrics: {
      filesScanned: sourceFiles.length,
      msTaken: 0,
    },
  };
}

function dedupeBy<T>(arr: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of arr) {
    const k = key(x);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

function computeFanMetrics(nodes: GraphNode[], edges: GraphEdge[]) {
  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();
  for (const e of edges) {
    fanOut.set(e.source, (fanOut.get(e.source) ?? 0) + 1);
    fanIn.set(e.target, (fanIn.get(e.target) ?? 0) + 1);
  }
  for (const n of nodes) {
    n.metrics = n.metrics ?? {};
    n.metrics.fanIn = fanIn.get(n.id) ?? 0;
    n.metrics.fanOut = fanOut.get(n.id) ?? 0;
  }
}

function simpleGlobMatch(pattern: string, candidate: string): boolean {
  // Cheap glob: treat ** as `.*`, * as `[^/]*`, escape dots.
  const re = new RegExp(
    '^' +
      pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '§§')
        .replace(/\*/g, '[^/]*')
        .replace(/§§/g, '.*') +
      '$',
  );
  return re.test(candidate.replace(/\\/g, '/'));
}

// re-export for tests / unused-import linters
export { edgeId };
