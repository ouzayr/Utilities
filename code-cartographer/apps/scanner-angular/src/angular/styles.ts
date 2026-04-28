import * as fs from 'node:fs';
import * as path from 'node:path';
import postcss from 'postcss';
import postcssScss from 'postcss-scss';
import { Finding } from '../types.js';

/**
 * Lightweight SCSS/CSS hygiene checks.
 * Static-only — never executes the styles, just inspects the AST.
 */
export function analyseStyles(file: string, root: string, _project: string): Finding[] {
  const findings: Finding[] = [];
  const text = fs.readFileSync(file, 'utf8');
  const isScss = file.endsWith('.scss');
  const ast = postcss().process(text, { parser: isScss ? postcssScss : undefined, from: file }).root;
  const rel = path.relative(root, file).replace(/\\/g, '/');

  let importantCount = 0;
  let maxDepth = 0;
  let totalSelectors = 0;

  ast.walkRules((rule) => {
    totalSelectors++;
    const depth = depthOf(rule.selector);
    if (depth > maxDepth) maxDepth = depth;
    rule.walkDecls((decl) => {
      if (decl.value.includes('!important')) importantCount++;
    });
  });

  const sizeBytes = Buffer.byteLength(text, 'utf8');
  if (sizeBytes > 50_000) {
    findings.push({
      id: `scss-large:${rel}`,
      ruleId: 'scss/oversized',
      severity: 'warn',
      category: 'scss',
      title: 'Oversized stylesheet',
      detail: `${rel} is ${(sizeBytes / 1024).toFixed(1)} KB. Consider splitting it.`,
      filePath: rel,
    });
  }
  if (importantCount > 5) {
    findings.push({
      id: `scss-important:${rel}`,
      ruleId: 'scss/important-overuse',
      severity: 'warn',
      category: 'scss',
      title: '`!important` overuse',
      detail: `${rel} uses \`!important\` ${importantCount} times. Prefer specificity over !important.`,
      filePath: rel,
    });
  }
  if (maxDepth > 4) {
    findings.push({
      id: `scss-deep:${rel}`,
      ruleId: 'scss/deep-nesting',
      severity: 'warn',
      category: 'scss',
      title: 'Deep selector nesting',
      detail: `${rel} has selectors nested ${maxDepth} levels deep. Aim for ≤ 3.`,
      filePath: rel,
    });
  }
  if (totalSelectors === 0) {
    findings.push({
      id: `scss-empty:${rel}`,
      ruleId: 'scss/empty-stylesheet',
      severity: 'info',
      category: 'scss',
      title: 'Empty stylesheet',
      detail: `${rel} contains no selectors. Consider deleting it.`,
      filePath: rel,
    });
  }
  return findings;
}

function depthOf(selector: string): number {
  // Rough: count whitespace-separated parts that aren't combinators.
  return selector
    .split(',')[0]
    .trim()
    .split(/\s+/)
    .filter((p) => p && p !== '>' && p !== '+' && p !== '~').length;
}
