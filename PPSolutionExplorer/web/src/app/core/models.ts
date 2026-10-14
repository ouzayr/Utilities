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
  connector?: string;
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
  importId: string;
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

export interface FlowComplexity {
  flowId: string;
  actions: number;
  containers: number;
  branches: number;
  maxDepth: number;
  expressions: number;
  paths: number;
  score: number;
  rating: 'Low' | 'Medium' | 'High' | 'VeryHigh';
}

export interface RuleInfo {
  id: string;
  title: string;
  category: string;
  description: string;
  defaultSeverity: string;
  enabled: boolean;
  severity: string;
}

export interface RuleCatalog {
  profile: string;
  profiles: string[];
  maxNestingDepth: number;
  maxActions: number;
  rules: RuleInfo[];
}

export type ChangeKind = 'Added' | 'Removed' | 'Changed' | 'Moved';

export interface PropertyChange {
  path: string;
  before?: string;
  after?: string;
}

export interface NodeChange {
  nodeId: string;
  type: NodeType;
  name: string;
  kind: ChangeKind;
  flowId?: string;
  changes: PropertyChange[];
}

export interface EdgeChange {
  sourceId: string;
  targetId: string;
  type: EdgeType;
  kind: ChangeKind;
  before?: string;
  after?: string;
}

export interface DiffResult {
  left: ImportSummary;
  right: ImportSummary;
  summary: { added: number; removed: number; changed: number; moved: number; edgesChanged: number; isEmpty: boolean };
  nodes: NodeChange[];
  edges: EdgeChange[];
  flowNames: Record<string, string>;
}

export interface ConnectorUsage {
  connector: string;
  premium: boolean;
  connectionReferences: string[];
  flows: string[];
  steps: number;
}

export interface FlowInventory {
  flowId: string;
  name: string;
  state?: string;
  trigger?: string;
  steps: number;
  usesPremium: boolean;
  connectors: string[];
  complexity: FlowComplexity;
}

export interface InventoryReport {
  connectors: ConnectorUsage[];
  flows: FlowInventory[];
  deprecated: { flowId: string; flowName: string; stepId: string; stepName: string; match: string }[];
  note: string;
}

export interface AuditEntry {
  id: number;
  at: string;
  action: string;
  target: string;
  details?: string;
  actor: string;
}

export interface ExpressionInfo {
  index: number;
  path: string;
  expression: string;
  references: { kind: string; function: string; name?: string }[];
}
