import { FlowGraph } from '../../core/models';
import { connectorColor, dependencies, toElements } from './flow-elements';

describe('toElements', () => {
  const flowId = 'flow:1';
  const c = `${flowId}/action:c`;
  const a = `${flowId}/action:a`;
  const b = `${flowId}/action:b`;
  const d = `${flowId}/action:d`;
  const t = `${flowId}/trigger:t`;
  const graph: FlowGraph = {
    nodes: [
      { id: flowId, type: 'Flow', name: 'F', isPlaceholder: false, inFlow: true },
      { id: t, type: 'Trigger', name: 't', parentId: flowId, isPlaceholder: false, inFlow: true },
      { id: c, type: 'Condition', name: 'c', parentId: flowId, isPlaceholder: false, inFlow: true },
      { id: a, type: 'Action', name: 'a', parentId: c, branch: 'true', isPlaceholder: false, inFlow: true },
      { id: b, type: 'Action', name: 'b', parentId: c, branch: 'else', isPlaceholder: false, inFlow: true },
      { id: d, type: 'Action', name: 'd', parentId: flowId, isPlaceholder: false, inFlow: true },
      { id: 'table:x', type: 'Table', name: 'x', isPlaceholder: true, inFlow: false },
    ],
    edges: [
      { sourceId: c, targetId: d, type: 'RunsAfter', status: 'Failed' },
      { sourceId: a, targetId: 'table:x', type: 'Reads', status: 'None' },
      { sourceId: t, targetId: a, type: 'DataFlow', status: 'None' },
      { sourceId: a, targetId: d, type: 'DataFlow', status: 'None' },
    ],
    unresolved: [],
  };

  it('creates branch lanes inside conditions', () => {
    const elements = toElements(graph, flowId, { showDataFlow: false });
    const branch = elements.find((e) => e.data['id'] === `${c}#true`);
    expect(branch?.data['parent']).toBe(c);
    expect(elements.find((e) => e.data['id'] === a)?.data['parent']).toBe(`${c}#true`);
  });

  it('marks failure-only runAfter edges and skips external nodes', () => {
    const elements = toElements(graph, flowId, { showDataFlow: false });
    expect(elements.some((e) => e.classes === 'runafter failure')).toBeTrue();
    expect(elements.some((e) => e.data['id'] === 'table:x')).toBeFalse();
  });

  it('adds implicit start edges and optional data flow', () => {
    const without = toElements(graph, flowId, { showDataFlow: false });
    const withData = toElements(graph, flowId, { showDataFlow: true });
    expect(without.some((e) => e.classes === 'implicit' && e.data['target'] === c)).toBeTrue();
    expect(without.some((e) => e.classes === 'dataflow')).toBeFalse();
    expect(withData.some((e) => e.classes === 'dataflow')).toBeTrue();
  });

  it('collapses containers and re-attaches edges to the collapsed node', () => {
    const elements = toElements(graph, flowId, { showDataFlow: true, collapsed: new Set([c]) });
    expect(elements.some((e) => e.data['id'] === a || e.data['id'] === b)).toBeFalse();
    expect(elements.some((e) => String(e.data['id']).startsWith(`${c}#`))).toBeFalse();
    const node = elements.find((e) => e.data['id'] === c)!;
    expect(node.classes).toContain('collapsed');
    expect(node.data['label']).toBe('c ▸ 2');
    // t -> a becomes t -> c; a -> d becomes c -> d (deduplicated with nothing else)
    expect(elements.some((e) => e.data['source'] === t && e.data['target'] === c && e.classes === 'dataflow')).toBeTrue();
    expect(elements.some((e) => e.data['source'] === c && e.data['target'] === d && e.classes === 'dataflow')).toBeTrue();
  });

  it('applies colour modes', () => {
    const quality = toElements(graph, flowId, { showDataFlow: false, colorBy: 'quality', findings: new Map([[a, 'Error']]) });
    expect(quality.find((e) => e.data['id'] === a)?.classes).toContain('sev-error');
    const diff = toElements(graph, flowId, { showDataFlow: false, colorBy: 'diff', changes: new Map([[d, 'Added']]) });
    expect(diff.find((e) => e.data['id'] === d)?.classes).toContain('diff-added');
    const conn = toElements(graph, flowId, { showDataFlow: false, colorBy: 'connector', connectors: new Map([[a, 'shared_sql']]) });
    expect(conn.find((e) => e.data['id'] === a)?.data['color']).toBe(connectorColor('shared_sql'));
  });

  it('finds upstream and downstream dependencies', () => {
    const deps = dependencies(graph, a);
    expect([...deps.upstream]).toEqual([t]);
    expect([...deps.downstream]).toEqual([d]);
  });
});
