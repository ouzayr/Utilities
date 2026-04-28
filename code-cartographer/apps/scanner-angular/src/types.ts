export type Side = 'ui' | 'api';

export type NgKind =
  | 'ng-component'
  | 'ng-service'
  | 'ng-module'
  | 'ng-route'
  | 'ng-pipe'
  | 'ng-directive'
  | 'ng-guard'
  | 'ng-interceptor'
  | 'ng-resolver'
  | 'ng-model'
  | 'ng-style';

export type DotnetKind =
  | 'dotnet-controller'
  | 'dotnet-action'
  | 'dotnet-endpoint'
  | 'dotnet-service'
  | 'dotnet-interface'
  | 'dotnet-repository'
  | 'dotnet-dto'
  | 'dotnet-entity'
  | 'dotnet-method'
  | 'dotnet-handler'
  | 'dotnet-validator'
  | 'dotnet-middleware';

export type NodeKind = NgKind | DotnetKind;

export type EdgeKind =
  | 'imports'
  | 'injects'
  | 'calls'
  | 'http-call'
  | 'route-handler'
  | 'extends'
  | 'implements'
  | 'declares'
  | 'registers'
  | 'uses-dto'
  | 'returns'
  | 'routes-to'
  | 'renders'
  | 'binds';

export interface GraphNode {
  id: string;
  kind: NodeKind;
  side: Side;
  project: string;
  name: string;
  fqName: string;
  filePath: string;
  line?: number;
  meta: Record<string, unknown>;
  metrics?: Record<string, number>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  meta: Record<string, unknown>;
}

export interface Finding {
  id: string;
  ruleId: string;
  severity: 'info' | 'warn' | 'error';
  category: 'dead-code' | 'layering' | 'scss' | 'security' | 'perf' | 'architecture';
  title: string;
  detail: string;
  nodeId?: string;
  filePath?: string;
  line?: number;
}

export interface ScanResult {
  schemaVersion: 1;
  side: Side;
  project: string;
  scannedAt: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  findings: Finding[];
  metrics: Record<string, number>;
}

export function nodeId(side: Side, kind: NodeKind, fqName: string, project: string): string {
  return `${side}:${kind}:${fqName}@${project}`;
}

export function edgeId(kind: EdgeKind, source: string, target: string, suffix = ''): string {
  return `${kind}|${source}->${target}${suffix ? `|${suffix}` : ''}`;
}
