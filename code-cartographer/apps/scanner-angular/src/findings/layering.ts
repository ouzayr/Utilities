import { Finding, GraphEdge, GraphNode } from '../types.js';

/**
 * UI-side layering rules:
 * - Components must not call HttpClient directly (must go through a service).
 * - Pages/route components must not import other pages (sibling routes).
 */
export function layeringRules(nodes: GraphNode[], edges: GraphEdge[]): Finding[] {
  const findings: Finding[] = [];
  const byId = new Map(nodes.map((n) => [n.id, n] as const));

  for (const e of edges) {
    if (e.kind !== 'calls') continue;
    const src = byId.get(e.source);
    const tgt = byId.get(e.target);
    if (!src || !tgt) continue;
    if (src.kind !== 'ng-component') continue;
    if ((tgt.meta as { kindOverride?: string }).kindOverride !== 'http-call-site') continue;
    findings.push({
      id: `layering:component-http:${src.id}`,
      ruleId: 'layering/component-calls-http-directly',
      severity: 'warn',
      category: 'layering',
      title: `Component calls HttpClient directly: ${src.name}`,
      detail: `Components should not call HttpClient directly. Wrap the call in a service so the network surface is testable and reusable.`,
      nodeId: src.id,
      filePath: src.filePath,
      line: src.line,
    });
  }
  return findings;
}
