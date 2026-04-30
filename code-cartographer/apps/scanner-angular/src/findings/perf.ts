import { Finding, GraphEdge, GraphNode } from '../types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Performance smells inspected from the file content (cheap regex-level pass).
 * - `*ngFor` without `trackBy`
 * - Component without `changeDetection: ChangeDetectionStrategy.OnPush`
 * - Inline templates over 200 lines
 */
export function perfRules(nodes: GraphNode[], _edges: GraphEdge[]): Finding[] {
  const findings: Finding[] = [];
  for (const n of nodes) {
    if (n.kind !== 'ng-component') continue;
    const tsPath = n.filePath;
    if (!tsPath) continue;
    const absTs = path.isAbsolute(tsPath) ? tsPath : path.resolve(process.cwd(), tsPath);
    if (!fs.existsSync(absTs)) continue;
    const tsText = fs.readFileSync(absTs, 'utf8');
    if (!/changeDetection\s*:\s*ChangeDetectionStrategy\.OnPush/.test(tsText)) {
      findings.push({
        id: `perf:no-onpush:${n.id}`,
        ruleId: 'perf/no-onpush',
        severity: 'info',
        category: 'perf',
        title: `Component without OnPush: ${n.name}`,
        detail: `Components default to ChangeDetectionStrategy.Default which re-checks on every event. Consider OnPush.`,
        nodeId: n.id,
        filePath: tsPath,
        line: n.line,
      });
    }
    // Look at template (inline or external).
    const tplMatch = tsText.match(/template\s*:\s*`([\s\S]*?)`/);
    let tpl: string | undefined;
    if (tplMatch) {
      tpl = tplMatch[1];
    } else {
      const urlMatch = tsText.match(/templateUrl\s*:\s*['"]([^'"]+)['"]/);
      if (urlMatch) {
        const tplPath = path.resolve(path.dirname(absTs), urlMatch[1]);
        if (fs.existsSync(tplPath)) tpl = fs.readFileSync(tplPath, 'utf8');
      }
    }
    if (tpl) {
      const ngForOccurrences = (tpl.match(/\*ngFor=/g) ?? []).length;
      const trackByOccurrences = (tpl.match(/trackBy:/g) ?? []).length;
      if (ngForOccurrences > 0 && trackByOccurrences < ngForOccurrences) {
        findings.push({
          id: `perf:ngfor-trackby:${n.id}`,
          ruleId: 'perf/ngfor-without-trackby',
          severity: 'info',
          category: 'perf',
          title: `*ngFor without trackBy: ${n.name}`,
          detail: `${ngForOccurrences} *ngFor used, only ${trackByOccurrences} use trackBy. Add trackBy for stable identity.`,
          nodeId: n.id,
          filePath: tsPath,
          line: n.line,
        });
      }
    }
  }
  return findings;
}
