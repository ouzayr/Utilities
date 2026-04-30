import * as path from 'node:path';
import { Node, SourceFile, SyntaxKind, VariableDeclaration } from 'ts-morph';
import { GraphEdge, GraphNode, edgeId, nodeId } from '../types.js';

/**
 * Extract Angular Routes arrays.
 * Recognises top-level `provideRouter([...])`, `RouterModule.forRoot([...])`,
 * and any variable declared with type `Routes`.
 */
export function extractRoutes(
  sf: SourceFile,
  root: string,
  project: string,
  classByName: Map<string, GraphNode>,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const filePath = path.relative(root, sf.getFilePath()).replace(/\\/g, '/');

  for (const v of sf.getVariableDeclarations()) {
    if (!isRoutesDecl(v)) continue;
    const init = v.getInitializer();
    if (!init || !Node.isArrayLiteralExpression(init)) continue;
    walkRoutesArray(init, '', filePath, project, nodes, edges, classByName);
  }

  return { nodes, edges };
}

function isRoutesDecl(v: VariableDeclaration): boolean {
  const typeText = v.getType().getText(v);
  if (typeText.includes('Routes')) return true;
  if (v.getName().toLowerCase().endsWith('routes')) return true;
  return false;
}

function walkRoutesArray(
  arr: Node,
  parentPath: string,
  filePath: string,
  project: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  classByName: Map<string, GraphNode>,
) {
  if (!Node.isArrayLiteralExpression(arr)) return;
  for (const el of arr.getElements()) {
    if (!Node.isObjectLiteralExpression(el)) continue;
    const props: Record<string, Node> = {};
    for (const p of el.getProperties()) {
      if (!Node.isPropertyAssignment(p)) continue;
      const init = p.getInitializer();
      if (init) props[p.getName()] = init;
    }
    const segment = props.path ? stripQuotes(props.path.getText()) : '';
    const fullPath = joinPath(parentPath, segment);
    const componentRef = props.component ? props.component.getText() : undefined;
    const id = nodeId('ui', 'ng-route', `${filePath}#${fullPath || '/'}`, project);
    const node: GraphNode = {
      id,
      kind: 'ng-route',
      side: 'ui',
      project,
      name: fullPath || '/',
      fqName: `${filePath}#${fullPath || '/'}`,
      filePath,
      line: el.getStartLineNumber(),
      meta: {
        path: fullPath,
        component: componentRef,
      },
    };
    nodes.push(node);
    if (componentRef) {
      const target = classByName.get(componentRef);
      if (target) {
        edges.push({ id: edgeId('routes-to', id, target.id), source: id, target: target.id, kind: 'routes-to', meta: {} });
      }
    }
    if (props.children) {
      walkRoutesArray(props.children, fullPath, filePath, project, nodes, edges, classByName);
    }
  }
}

function stripQuotes(s: string): string {
  return s.replace(/^['"`]/, '').replace(/['"`]$/, '');
}

function joinPath(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return `${a.replace(/\/$/, '')}/${b.replace(/^\//, '')}`;
}
