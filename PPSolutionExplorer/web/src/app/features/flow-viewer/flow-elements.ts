import { CONTAINER_TYPES, ChangeKind, FlowGraph, GraphNodeDto } from '../../core/models';

export interface CyElement {
  group: 'nodes' | 'edges';
  data: Record<string, string | boolean | number | undefined>;
  classes?: string;
}

export type ColorMode = 'type' | 'connector' | 'quality' | 'diff';

export interface ElementOptions {
  showDataFlow: boolean;
  /** Containers drawn as a single node; their descendants are hidden and edges re-attached to them. */
  collapsed?: ReadonlySet<string>;
  colorBy?: ColorMode;
  /** Worst finding severity per node (quality mode). */
  findings?: ReadonlyMap<string, string>;
  /** Change kind per node (diff mode). */
  changes?: ReadonlyMap<string, ChangeKind>;
  /** Connector per node (connector mode). */
  connectors?: ReadonlyMap<string, string>;
}

/** Stable, readable colour per connector name. */
export function connectorColor(name: string): string {
  let hash = 0;
  for (const c of name) {
    hash = (hash * 31 + c.charCodeAt(0)) | 0;
  }
  return `hsl(${Math.abs(hash) % 360}, 70%, 85%)`;
}

/**
 * Converts a flow graph into Cytoscape elements.
 * Containers become compound nodes; condition/switch branches get their own compound child so the
 * true/else/case lanes are visible. Collapsed containers hide their contents. Only steps of this flow are drawn.
 */
export function toElements(graph: FlowGraph, flowId: string, options: ElementOptions): CyElement[] {
  const elements: CyElement[] = [];
  const collapsed = options.collapsed ?? new Set<string>();
  const all = graph.nodes.filter((n) => n.inFlow && n.id !== flowId);
  const byId = new Map(all.map((s) => [s.id, s]));

  /** Nearest visible node for an id: itself, or its outermost collapsed ancestor. */
  const visibleOf = new Map<string, string>();
  const resolve = (id: string): string => {
    const cached = visibleOf.get(id);
    if (cached) {
      return cached;
    }
    let result = id;
    let current = byId.get(id);
    while (current?.parentId && current.parentId !== flowId) {
      if (collapsed.has(current.parentId)) {
        result = current.parentId;
      }
      current = byId.get(current.parentId);
    }
    visibleOf.set(id, result);
    return result;
  };

  const steps = all.filter((s) => resolve(s.id) === s.id);
  const visible = new Set(steps.map((s) => s.id));
  const branchNodes = new Set<string>();
  const hiddenCount = new Map<string, number>();
  for (const s of all) {
    const v = resolve(s.id);
    if (v !== s.id) {
      hiddenCount.set(v, (hiddenCount.get(v) ?? 0) + 1);
    }
  }

  for (const step of steps) {
    let parent = step.parentId && step.parentId !== flowId ? step.parentId : undefined;
    const parentNode = parent ? byId.get(parent) : undefined;
    if (parent && step.branch && parentNode && (parentNode.type === 'Condition' || parentNode.type === 'Switch')) {
      const branchId = `${parent}#${step.branch}`;
      if (!branchNodes.has(branchId)) {
        branchNodes.add(branchId);
        elements.push({ group: 'nodes', data: { id: branchId, label: step.branch, parent }, classes: 'branch' });
      }
      parent = branchId;
    }

    const isContainer = CONTAINER_TYPES.includes(step.type);
    const isCollapsed = collapsed.has(step.id);
    const hidden = hiddenCount.get(step.id) ?? 0;
    elements.push({
      group: 'nodes',
      data: {
        id: step.id,
        label: isCollapsed ? `${step.name} ▸ ${hidden}` : step.name,
        type: step.type,
        subType: step.subType,
        parent,
        color: colorFor(step, options),
      },
      classes: [
        step.type.toLowerCase(),
        isContainer && !isCollapsed ? 'container' : 'step',
        isCollapsed ? 'collapsed' : '',
        statusClass(step.id, options),
      ].filter(Boolean).join(' '),
    });
  }

  // Root steps without runAfter start after the trigger: draw that implicit edge for readability.
  const trigger = steps.find((s) => s.type === 'Trigger');
  const hasRunAfter = new Set(graph.edges.filter((e) => e.type === 'RunsAfter').map((e) => e.targetId));
  if (trigger) {
    for (const step of steps) {
      if (step.parentId === flowId && step.type !== 'Trigger' && !hasRunAfter.has(step.id)) {
        elements.push({ group: 'edges', data: { id: `start>${step.id}`, source: trigger.id, target: step.id, label: '' }, classes: 'implicit' });
      }
    }
  }

  const seen = new Set<string>();
  graph.edges.forEach((edge, index) => {
    if (!byId.has(edge.sourceId) || !byId.has(edge.targetId)) {
      return;
    }
    const source = resolve(edge.sourceId);
    const target = resolve(edge.targetId);
    if (source === target || !visible.has(source) || !visible.has(target)) {
      return;
    }
    const key = `${source}>${target}>${edge.type}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);

    if (edge.type === 'RunsAfter') {
      const failure = !/Succeeded|Skipped/.test(edge.status);
      elements.push({
        group: 'edges',
        data: { id: `e${index}`, source, target, label: edge.status === 'Succeeded' ? '' : edge.status, kind: 'RunsAfter' },
        classes: failure ? 'runafter failure' : 'runafter',
      });
    } else if (edge.type === 'DataFlow' && options.showDataFlow) {
      elements.push({ group: 'edges', data: { id: `e${index}`, source, target, label: '', kind: 'DataFlow' }, classes: 'dataflow' });
    }
  });

  return elements;
}

/** Nodes that the given node depends on (upstream) or that depend on it (downstream), via runAfter and data flow. */
export function dependencies(graph: FlowGraph, nodeId: string): { upstream: Set<string>; downstream: Set<string> } {
  const forward = new Map<string, string[]>();
  const backward = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (e.type !== 'RunsAfter' && e.type !== 'DataFlow') {
      continue;
    }
    (forward.get(e.sourceId) ?? forward.set(e.sourceId, []).get(e.sourceId)!).push(e.targetId);
    (backward.get(e.targetId) ?? backward.set(e.targetId, []).get(e.targetId)!).push(e.sourceId);
  }
  const walk = (start: string, next: Map<string, string[]>): Set<string> => {
    const seen = new Set<string>();
    const queue = [start];
    while (queue.length) {
      for (const n of next.get(queue.pop()!) ?? []) {
        if (!seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
    seen.delete(start);
    return seen;
  };
  return { upstream: walk(nodeId, backward), downstream: walk(nodeId, forward) };
}

function colorFor(step: GraphNodeDto, options: ElementOptions): string | undefined {
  if (options.colorBy === 'connector') {
    const connector = options.connectors?.get(step.id);
    return connector ? connectorColor(connector) : '#f6f8fa';
  }
  return undefined;
}

function statusClass(id: string, options: ElementOptions): string {
  if (options.colorBy === 'quality') {
    const severity = options.findings?.get(id);
    return severity ? `sev-${severity.toLowerCase()}` : '';
  }
  if (options.colorBy === 'diff') {
    const kind = options.changes?.get(id);
    return kind ? `diff-${kind.toLowerCase()}` : '';
  }
  return '';
}
