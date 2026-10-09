import { FlowGraph } from '../../core/models';
import { toElements } from './flow-elements';

describe('toElements', () => {
  const flowId = 'flow:1';
  const graph: FlowGraph = {
    nodes: [
      { id: flowId, type: 'Flow', name: 'F', isPlaceholder: false, inFlow: true },
      { id: `${flowId}/trigger:t`, type: 'Trigger', name: 't', parentId: flowId, isPlaceholder: false, inFlow: true },
      { id: `${flowId}/action:c`, type: 'Condition', name: 'c', parentId: flowId, isPlaceholder: false, inFlow: true },
      { id: `${flowId}/action:a`, type: 'Action', name: 'a', parentId: `${flowId}/action:c`, branch: 'true', isPlaceholder: false, inFlow: true },
      { id: `${flowId}/action:b`, type: 'Action', name: 'b', parentId: `${flowId}/action:c`, branch: 'else', isPlaceholder: false, inFlow: true },
      { id: `${flowId}/action:d`, type: 'Action', name: 'd', parentId: flowId, isPlaceholder: false, inFlow: true },
      { id: 'table:x', type: 'Table', name: 'x', isPlaceholder: true, inFlow: false },
    ],
    edges: [
      { sourceId: `${flowId}/action:c`, targetId: `${flowId}/action:d`, type: 'RunsAfter', status: 'Failed' },
      { sourceId: `${flowId}/action:a`, targetId: 'table:x', type: 'Reads', status: 'None' },
      { sourceId: `${flowId}/trigger:t`, targetId: `${flowId}/action:a`, type: 'DataFlow', status: 'None' },
    ],
    unresolved: [],
  };

  it('creates branch lanes inside conditions', () => {
    const elements = toElements(graph, flowId, { showDataFlow: false });
    const branch = elements.find((e) => e.data['id'] === `${flowId}/action:c#true`);
    expect(branch?.data['parent']).toBe(`${flowId}/action:c`);
    expect(elements.find((e) => e.data['id'] === `${flowId}/action:a`)?.data['parent']).toBe(`${flowId}/action:c#true`);
  });

  it('marks failure-only runAfter edges and skips external nodes', () => {
    const elements = toElements(graph, flowId, { showDataFlow: false });
    expect(elements.some((e) => e.classes === 'runafter failure')).toBeTrue();
    expect(elements.some((e) => e.data['id'] === 'table:x')).toBeFalse();
  });

  it('adds implicit start edges and optional data flow', () => {
    const without = toElements(graph, flowId, { showDataFlow: false });
    const withData = toElements(graph, flowId, { showDataFlow: true });
    expect(without.some((e) => e.classes === 'implicit' && e.data['target'] === `${flowId}/action:c`)).toBeTrue();
    expect(without.some((e) => e.classes === 'dataflow')).toBeFalse();
    expect(withData.some((e) => e.classes === 'dataflow')).toBeTrue();
  });
});
