import { CONTAINER_TYPES, FlowGraph } from '../../core/models';

export interface CyElement {
  group: 'nodes' | 'edges';
  data: Record<string, string | boolean | undefined>;
  classes?: string;
}

export interface ElementOptions {
  showDataFlow: boolean;
}

/**
 * Converts a flow graph into Cytoscape elements.
 * Containers become compound nodes; condition/switch branches get their own compound child so the
 * true/else/case lanes are visible. Only steps of this flow are drawn (external nodes are listed in the panel).
 */
export function toElements(graph: FlowGraph, flowId: string, options: ElementOptions): CyElement[] {
  const elements: CyElement[] = [];
  const steps = graph.nodes.filter((n) => n.inFlow && n.id !== flowId);
  const ids = new Set(steps.map((s) => s.id));
  const byId = new Map(steps.map((s) => [s.id, s]));
  const branchNodes = new Set<string>();

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
    elements.push({
      group: 'nodes',
      data: {
        id: step.id,
        label: step.name,
        type: step.type,
        subType: step.subType,
        parent,
      },
      classes: [step.type.toLowerCase(), isContainer ? 'container' : 'step'].join(' '),
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

  graph.edges.forEach((edge, index) => {
    if (!ids.has(edge.sourceId) || !ids.has(edge.targetId)) {
      return;
    }
    if (edge.type === 'RunsAfter') {
      const failure = !/Succeeded|Skipped/.test(edge.status);
      elements.push({
        group: 'edges',
        data: { id: `e${index}`, source: edge.sourceId, target: edge.targetId, label: edge.status === 'Succeeded' ? '' : edge.status },
        classes: failure ? 'runafter failure' : 'runafter',
      });
    } else if (edge.type === 'DataFlow' && options.showDataFlow) {
      elements.push({ group: 'edges', data: { id: `e${index}`, source: edge.sourceId, target: edge.targetId, label: '' }, classes: 'dataflow' });
    }
  });

  return elements;
}
