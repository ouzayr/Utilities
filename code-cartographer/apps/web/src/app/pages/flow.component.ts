import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, inject, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import cytoscape from 'cytoscape';
// @ts-ignore
import dagre from 'cytoscape-dagre';
import { ApiService, GraphEdge, GraphNode } from '../api.service';
import { ScanContextService } from '../scan-context.service';

cytoscape.use(dagre);

@Component({
  selector: 'cc-flow',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.75rem;">
      <input class="btn" style="min-width:480px;" placeholder="paste a node id (e.g. ui:ng-component:.../OrderListComponent@sample-ui)" [(ngModel)]="nodeId" />
      <select class="btn" [(ngModel)]="direction">
        <option value="downstream">downstream</option>
        <option value="upstream">upstream</option>
        <option value="both">both</option>
      </select>
      <button class="btn primary" (click)="trace()">Trace</button>
    </div>
    <div #host class="graph-host"></div>
  `,
})
export class FlowComponent implements AfterViewInit {
  private api = inject(ApiService);
  private ctx = inject(ScanContextService);
  @ViewChild('host', { static: true }) host!: ElementRef<HTMLDivElement>;
  cy?: cytoscape.Core;
  nodeId = '';
  direction: 'downstream' | 'upstream' | 'both' = 'downstream';

  ngAfterViewInit(): void {
    this.cy = cytoscape({
      container: this.host.nativeElement,
      elements: [],
      style: [
        { selector: 'node', style: { 'background-color': '#1f6feb', 'label': 'data(label)', 'color': '#c9d1d9', 'font-size': 10, 'text-outline-color': '#0d1117', 'text-outline-width': 2 } },
        { selector: 'node[side = "api"]', style: { 'background-color': '#f0883e' } },
        { selector: 'node[side = "ui"]', style: { 'background-color': '#79c0ff' } },
        { selector: 'edge', style: { 'curve-style': 'bezier', 'line-color': '#30363d', 'target-arrow-shape': 'triangle', 'target-arrow-color': '#30363d' } },
      ],
      layout: { name: 'dagre', rankDir: 'LR' } as cytoscape.LayoutOptions,
    });
  }

  trace() {
    const scanId = this.ctx.get();
    if (!scanId || !this.nodeId) return;
    this.api.flowFrom(scanId, this.nodeId, this.direction).subscribe(({ nodes, edges }) => {
      this.cy!.elements().remove();
      this.cy!.add(this.toElements(nodes, edges));
      this.cy!.layout({ name: 'dagre', rankDir: 'LR' } as cytoscape.LayoutOptions).run();
    });
  }

  private toElements(nodes: GraphNode[], edges: GraphEdge[]): cytoscape.ElementDefinition[] {
    const els: cytoscape.ElementDefinition[] = [];
    for (const n of nodes) els.push({ data: { id: n.id, label: n.name, side: n.side, kind: n.kind } });
    const ids = new Set(nodes.map((n) => n.id));
    for (const e of edges) if (ids.has(e.source) && ids.has(e.target)) els.push({ data: { id: e.id, source: e.source, target: e.target, kind: e.kind } });
    return els;
  }
}
