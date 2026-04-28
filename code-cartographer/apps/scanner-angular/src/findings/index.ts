import { Finding, GraphEdge, GraphNode } from '../types.js';
import { deadCodeRules } from './dead-code.js';
import { layeringRules } from './layering.js';
import { perfRules } from './perf.js';
import { securityRules } from './security.js';

export function runLintRules(nodes: GraphNode[], edges: GraphEdge[]): Finding[] {
  return [
    ...deadCodeRules(nodes, edges),
    ...layeringRules(nodes, edges),
    ...perfRules(nodes, edges),
    ...securityRules(nodes, edges),
  ];
}
