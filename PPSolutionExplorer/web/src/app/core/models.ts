export type NodeType =
  | 'Solution' | 'Flow' | 'Trigger' | 'Action' | 'Scope' | 'Condition' | 'Loop' | 'Switch' | 'App'
  | 'Table' | 'Column' | 'Relationship' | 'EnvVariable' | 'ConnectionReference' | 'Connector' | 'Unknown';

export type EdgeType =
  | 'RunsAfter' | 'DataFlow' | 'Reads' | 'Writes' | 'Calls' | 'Triggers' | 'UsesEnvVar' | 'UsesConnection' | 'Contains';

export const NODE_TYPES: NodeType[] = [
  'Solution', 'Flow', 'Trigger', 'Action', 'Scope', 'Condition', 'Loop', 'Switch', 'App',
  'Table', 'Column', 'Relationship', 'EnvVariable', 'ConnectionReference', 'Connector', 'Unknown',
];

export const CONTAINER_TYPES: NodeType[] = ['Scope', 'Condition', 'Loop', 'Switch'];

export interface ImportSummary {
  id: string;
  kind: string;
  name: string;
  version?: string;
  fileName: string;
  importedAt: string;
  nodeCount: number;
  edgeCount: number;
  unresolvedCount: number;
  warnings: string[];
}

export interface NodeSummary {
  id: string;
  type: NodeType;
  name: string;
  parentId?: string;
  branch?: string;
  subType?: string;
  connector?: string;
  operation?: string;
  tags: string[];
}

export interface GraphNodeDto {
  id: string;
  type: NodeType;
  name: string;
  parentId?: string;
  branch?: string;
  subType?: string;
  isPlaceholder: boolean;
  inFlow: boolean;
}

export interface GraphEdgeDto {
  sourceId: string;
  targetId: string;
  type: EdgeType;
  status: string;
  expression?: string;
}

export interface Unresolved {
  nodeId?: string;
  rawExpression: string;
  reason: string;
}

export interface FlowGraph {
  nodes: GraphNodeDto[];
  edges: GraphEdgeDto[];
  unresolved: Unresolved[];
}

export interface Tag {
  id: number;
  nodeId: string;
  tag: string;
  source: 'user' | 'ai-accepted';
  createdAt: string;
}

export interface Note {
  id: number;
  nodeId: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

/** AI output. Always rendered with its provenance (model, prompt version, timestamp). */
export interface AiOutput {
  id: string;
  importId?: string;
  nodeId: string;
  kind: string;
  content?: string;
  model: string;
  promptName: string;
  promptVersion: string;
  aiStatus: 'succeeded' | 'failed';
  error?: string;
  createdAt: string;
}

export interface NodeDetail {
  node: {
    id: string;
    type: NodeType;
    name: string;
    parentId?: string;
    branch?: string;
    subType?: string;
    connector?: string;
    operation?: string;
    properties: Record<string, string>;
    rawJson?: string;
    flowId?: string;
  };
  outgoing: GraphEdgeDto[];
  incoming: GraphEdgeDto[];
  unresolved: Unresolved[];
  tags: Tag[];
  notes: Note[];
  ai: AiOutput[];
}

export interface PathStep {
  nodeId: string;
  branch?: string;
  viaStatus: string;
}

export interface ExecutionPath {
  steps: PathStep[];
  iterated: boolean;
  usesFailureBranch: boolean;
}

export interface PathResult {
  total_estimated: number;
  returned: number;
  truncated: boolean;
  paths: ExecutionPath[];
  warnings: string[];
  names: Record<string, string>;
}

export interface PathRequest {
  flowId: string;
  fromNodeId?: string | null;
  toNodeId?: string | null;
  includeFailureBranches: boolean;
  maxPaths: number;
}

export interface SearchQuery {
  importId?: string;
  text?: string | null;
  searchRawJson?: boolean;
  nodeTypes?: NodeType[];
  subTypes?: string[];
  connectors?: string[];
  tables?: string[];
  tags?: string[];
  flowId?: string | null;
  hasUnresolved?: boolean | null;
  limit?: number;
}

export interface SearchHit {
  node: NodeSummary;
  flowId?: string;
  flowName?: string;
}

export interface SearchResponse {
  query: SearchQuery;
  dropped: string[];
  results: SearchHit[];
  ai?: AiOutput;
}

export interface Facets {
  subTypes: string[];
  connectors: string[];
  tables: string[];
  tags: string[];
  flowIds: string[];
}

export interface ImpactItem {
  node: NodeSummary;
  depth: number;
  via: string;
  flowId?: string;
  flowName?: string;
}

export interface ImpactResult {
  nodeId: string;
  maxDepth: number;
  items: ImpactItem[];
}

export interface QualityFinding {
  ruleId: string;
  severity: 'Info' | 'Warning' | 'Error';
  nodeId: string;
  message: string;
  evidence?: string;
}

export interface AiStatus {
  enabled: boolean;
  baseUrl: string;
  reachable: boolean;
  model?: string;
  error?: string;
  contextSize: number;
  parallelSlots: number;
  slotContext: number;
  prompts: { name: string; version: string; description?: string }[];
}

export interface AiJob {
  id: string;
  kind: string;
  importId?: string;
  nodeId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  progress: number;
  total: number;
  error?: string;
  outputId?: string;
  createdAt: string;
  updatedAt: string;
}
