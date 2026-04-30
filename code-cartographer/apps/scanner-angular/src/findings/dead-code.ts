import { Finding, GraphEdge, GraphNode } from '../types.js';

export function deadCodeRules(nodes: GraphNode[], edges: GraphEdge[]): Finding[] {
  const findings: Finding[] = [];
  const referenced = new Set<string>();
  for (const e of edges) referenced.add(e.target);

  for (const n of nodes) {
    if (n.side !== 'ui') continue;
    if (referenced.has(n.id)) continue;
    if (n.kind === 'ng-route') continue; // routes are entrypoints
    if (n.kind === 'ng-module') continue; // modules are entrypoints
    if ((n.meta as { kindOverride?: string }).kindOverride === 'http-call-site') continue;
    if (n.kind === 'ng-component' && /AppComponent$/.test(n.name)) continue;
    findings.push({
      id: `dead:${n.id}`,
      ruleId: 'dead-code/unreferenced',
      severity: 'info',
      category: 'dead-code',
      title: `Unreferenced ${n.kind.replace('ng-', '')}: ${n.name}`,
      detail: `${n.name} (${n.filePath}:${n.line ?? '?'}) has no incoming references in this scan. It might be unused.`,
      nodeId: n.id,
      filePath: n.filePath,
      line: n.line,
    });
  }
  return findings;
}
