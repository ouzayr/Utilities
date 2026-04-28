import * as path from 'node:path';
import { CallExpression, Node, SourceFile, SyntaxKind } from 'ts-morph';
import { GraphEdge, GraphNode, edgeId, nodeId } from '../types.js';

const HTTP_VERBS = new Set(['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'request']);

export function extractHttpCalls(
  sf: SourceFile,
  root: string,
  project: string,
  classByName: Map<string, GraphNode>,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const filePath = path.relative(root, sf.getFilePath()).replace(/\\/g, '/');

  sf.forEachDescendant((d) => {
    if (d.getKind() !== SyntaxKind.CallExpression) return;
    const ce = d.asKindOrThrow(SyntaxKind.CallExpression);
    const expr = ce.getExpression();
    if (!Node.isPropertyAccessExpression(expr)) return;
    const verb = expr.getName();
    if (!HTTP_VERBS.has(verb.toLowerCase())) return;

    // Heuristic A (precise, when types resolve): receiver type symbol name contains HttpClient.
    // Heuristic B (fallback, no type info): the receiver text mentions an http-ish identifier.
    let isHttpReceiver = false;
    try {
      const receiverTypeName = expr.getExpression().getType().getSymbol()?.getName() ?? '';
      if (/HttpClient/i.test(receiverTypeName)) isHttpReceiver = true;
    } catch {
      // ignore - fall through to text heuristic
    }
    if (!isHttpReceiver) {
      const receiverText = expr.getExpression().getText();
      if (/(\b|\.)http(?:Client)?\b/i.test(receiverText)) isHttpReceiver = true;
    }
    if (!isHttpReceiver) return;

    const args = ce.getArguments();
    if (args.length === 0) return;
    const urlInfo = resolveUrl(args[0]);

    // Determine owning class.
    const owner = findEnclosingClass(ce);
    if (!owner) return;
    const ownerNode = classByName.get(owner);
    if (!ownerNode) return;

    const callId = `${ownerNode.id}#http:${verb.toUpperCase()}:${urlInfo.pattern}`;
    const httpNode: GraphNode = {
      id: callId,
      kind: 'ng-service', // attached to the same kind as owner (acts as a synthetic call site)
      side: 'ui',
      project,
      name: `${verb.toUpperCase()} ${urlInfo.pattern}`,
      fqName: `${ownerNode.fqName}::${verb.toUpperCase()} ${urlInfo.pattern}`,
      filePath,
      line: ce.getStartLineNumber(),
      meta: {
        kindOverride: 'http-call-site',
        verb: verb.toUpperCase(),
        url: urlInfo.pattern,
        rawUrl: urlInfo.raw,
        confidence: urlInfo.confidence,
        responseType: tryReadGeneric(ce),
      },
    };
    // Edge from owner → call site.
    edges.push({
      id: edgeId('calls', ownerNode.id, callId),
      source: ownerNode.id,
      target: callId,
      kind: 'calls',
      meta: {},
    });
    nodes.push(httpNode);
  });

  return { nodes, edges };
}

function findEnclosingClass(node: Node): string | undefined {
  let n: Node | undefined = node.getParent();
  while (n) {
    if (Node.isClassDeclaration(n)) return n.getName();
    n = n.getParent();
  }
  return undefined;
}

function tryReadGeneric(ce: CallExpression): string | undefined {
  const tps = ce.getTypeArguments();
  if (tps.length === 0) return undefined;
  return tps[0].getText();
}

interface UrlResolution {
  pattern: string;
  raw: string;
  confidence: number;
}

function resolveUrl(arg: Node): UrlResolution {
  if (Node.isStringLiteral(arg) || Node.isNoSubstitutionTemplateLiteral(arg)) {
    return { pattern: normalisePattern(arg.getLiteralValue()), raw: arg.getLiteralValue(), confidence: 1.0 };
  }
  if (Node.isTemplateExpression(arg)) {
    const head = arg.getHead().getLiteralText();
    const spans = arg.getTemplateSpans();
    let pattern = head;
    let dynamicCount = 0;
    for (const span of spans) {
      const expression = span.getExpression();
      const exprText = expression.getText();
      const literal = span.getLiteral().getLiteralText();
      const isApiBase = /(api|service|server)?base$|^environment\./i.test(exprText);
      let inlined: string | undefined;
      // If the span is `this.<prop>`, inline its initialiser pattern.
      if (Node.isPropertyAccessExpression(expression) && expression.getExpression().getKind() === SyntaxKind.ThisKeyword) {
        const propName = expression.getName();
        let cls: Node | undefined = expression.getParent();
        while (cls && !Node.isClassDeclaration(cls)) cls = cls.getParent();
        if (cls && Node.isClassDeclaration(cls)) {
          const init = cls.getProperty(propName)?.getInitializer();
          if (init) inlined = resolveUrl(init).pattern;
        }
      }
      if (inlined && pattern === '') {
        pattern = inlined + literal;
      } else if (isApiBase && pattern === '') {
        pattern = literal;
      } else {
        pattern += ':param' + literal;
        dynamicCount++;
      }
    }
    return { pattern: normalisePattern(pattern), raw: arg.getText(), confidence: dynamicCount === 0 ? 0.9 : dynamicCount === 1 ? 0.6 : 0.5 };
  }
  if (Node.isBinaryExpression(arg) && arg.getOperatorToken().getText() === '+') {
    const left = arg.getLeft();
    const right = arg.getRight();
    if (Node.isStringLiteral(left)) {
      return { pattern: normalisePattern(left.getLiteralValue() + ':param'), raw: arg.getText(), confidence: 0.4 };
    }
    if (Node.isStringLiteral(right)) {
      return { pattern: normalisePattern(':param' + right.getLiteralValue()), raw: arg.getText(), confidence: 0.4 };
    }
  }
  // Resolve `this.X` where X is initialised to a string/template within the same class.
  if (Node.isPropertyAccessExpression(arg) && arg.getExpression().getKind() === SyntaxKind.ThisKeyword) {
    const propName = arg.getName();
    let cls: Node | undefined = arg.getParent();
    while (cls && !Node.isClassDeclaration(cls)) cls = cls.getParent();
    if (cls && Node.isClassDeclaration(cls)) {
      const prop = cls.getProperty(propName);
      const init = prop?.getInitializer();
      if (init) {
        const child = resolveUrl(init);
        if (child.pattern !== '__dynamic__') {
          return { pattern: child.pattern, raw: arg.getText(), confidence: Math.max(0.3, child.confidence - 0.2) };
        }
      }
    }
  }
  // Fallback: try the textual form. Helpful for `${environment.apiBase}/api/orders/${id}/status`.
  const text = arg.getText();
  const m = text.match(/[`'"]([^`'"]*)[`'"]/);
  if (m) {
    return { pattern: normalisePattern(m[1].replace(/\$\{[^}]+\}/g, ':param')), raw: text, confidence: 0.3 };
  }
  return { pattern: '__dynamic__', raw: text, confidence: 0.2 };
}

function normalisePattern(p: string): string {
  // Strip env prefix: ${environment.apiBase}/x → /x
  let out = p.replace(/^\$\{[^}]+\}/, '');
  out = out.replace(/^https?:\/\/[^/]+/, '');
  if (!out.startsWith('/')) out = '/' + out;
  out = out.toLowerCase();
  return out;
}
