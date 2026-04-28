import { Finding, GraphEdge, GraphNode } from '../types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SUSPICIOUS_PATTERNS: { id: string; pattern: RegExp; title: string; detail: string; severity: Finding['severity'] }[] = [
  {
    id: 'bypass-trust',
    pattern: /bypassSecurityTrust(Html|Style|Script|Url|ResourceUrl)\s*\(/,
    title: 'DOMSanitizer bypass',
    detail: 'bypassSecurityTrust* should be a last resort; verify input is trusted.',
    severity: 'warn',
  },
  {
    id: 'inner-html',
    pattern: /\[innerHTML\]=/,
    title: '[innerHTML] binding',
    detail: '[innerHTML] should be used with sanitised input only.',
    severity: 'info',
  },
  {
    id: 'eval',
    pattern: /\beval\s*\(/,
    title: 'eval() call',
    detail: 'Avoid eval — XSS surface and bundle bloat.',
    severity: 'error',
  },
  {
    id: 'embedded-secret',
    pattern: /(api[_-]?key|secret|password)\s*[:=]\s*['"`][A-Za-z0-9_\-]{16,}['"`]/i,
    title: 'Possible embedded secret',
    detail: 'Looks like a hard-coded credential. Move to env / runtime config.',
    severity: 'warn',
  },
];

export function securityRules(nodes: GraphNode[], _edges: GraphEdge[]): Finding[] {
  const findings: Finding[] = [];
  const seenFiles = new Set<string>();
  for (const n of nodes) {
    const f = n.filePath;
    if (!f || seenFiles.has(f)) continue;
    seenFiles.add(f);
    const abs = path.isAbsolute(f) ? f : path.resolve(process.cwd(), f);
    if (!fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, 'utf8');
    const lines = text.split(/\r?\n/);
    for (const rule of SUSPICIOUS_PATTERNS) {
      lines.forEach((ln, i) => {
        if (rule.pattern.test(ln)) {
          findings.push({
            id: `sec:${rule.id}:${f}:${i}`,
            ruleId: `security/${rule.id}`,
            severity: rule.severity,
            category: 'security',
            title: rule.title,
            detail: rule.detail,
            filePath: f,
            line: i + 1,
          });
        }
      });
    }
  }
  return findings;
}
