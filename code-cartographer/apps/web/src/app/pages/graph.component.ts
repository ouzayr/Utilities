import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, inject, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import cytoscape from 'cytoscape';
// @ts-ignore — cytoscape-dagre has no types
import dagre from 'cytoscape-dagre';
import { ApiService, GraphEdge, GraphNode } from '../api.service';
import { ScanContextService } from '../scan-context.service';

cytoscape.use(dagre);

@Component({
  selector: 'cc-graph',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div style="display:flex;gap:0.75rem;align-items:center;margin-bottom:0.75rem;">
      <select class="btn" [(ngModel)]="filterSide" (change)="reload()">
        <option value="">all sides</option>
        <option value="ui">ui</option>
        <option value="api">api</option>
      </select>
      <input class="btn" placeholder="kind filter (e.g. ng-component)" [(ngModel)]="filterKind" (change)="reload()" />
      <input class="btn" placeholder="project filter" [(ngModel)]="filterProject" (change)="reload()" />
      <button class="btn" (click)="layout()">Re-layout</button>
      <span style="color:var(--muted)">{{ nodeCount }} nodes / {{ edgeCount }} edges</span>
    </div>
    <div #host class="graph-host"></div>

    <div *ngIf="selected" class="card" style="position:fixed;right:1rem;bottom:1rem;width:340px;">
      <strong>{{ selected.name }}</strong>
      <div style="color:var(--muted)">{{ selected.kind }} · {{ selected.side }} · {{ selected.project }}</div>
      <div><code>{{ selected.filePath }}:{{ selected.line }}</code></div>
      <details style="margin-top:0.5rem;">
        <summary>Meta</summary>
        <pre style="white-space:pre-wrap;word-break:break-all;">{{ selectedMeta }}</pre>
      </details>
    </div>
  `,
})
export class GraphComponent implements OnInit, AfterViewInit {
  private api = inject(ApiService);
  private ctx = inject(ScanContextService);
  @ViewChild('host', { static: true }) host!: ElementRef<HTMLDivElement>;
  cy?: cytoscape.Core;
  filterSide = '';
  filterKind = '';
  filterProject = '';
  nodeCount = 0;
  edgeCount = 0;
  selected?: GraphNode;
  selectedMeta = '';

  ngOnInit(): void {
    if (!this.ctx.get()) {
      this.api.scans().subscribe((s) => {
        if (s[0]) {
          this.ctx.set(s[0].id);
          this.reload();
        }
      });
    }
  }
  ngAfterViewInit(): void {
    this.cy = cytoscape({
      container: this.host.nativeElement,
      elements: [],
      style: this.style(),
      layout: { name: 'dagre' } as cytoscape.LayoutOptions,
    });
    this.cy.on('tap', 'node', (e) => {
      const data = e.target.data();
      this.selected = data['raw'];
      this.selectedMeta = JSON.stringify(this.selected?.meta ?? {}, null, 2);
    });
    if (this.ctx.get()) this.reload();
  }

  reload() {
    const id = this.ctx.get();
    if (!id || !this.cy) return;
    this.api.graph(id, { side: this.filterSide || undefined, kind: this.filterKind || undefined, project: this.filterProject || undefined }).subscribe((g) => {
      this.nodeCount = g.nodes.length;
      this.edgeCount = g.edges.length;
      this.cy!.elements().remove();
      this.cy!.add(this.toElements(g.nodes, g.edges));
      this.layout();
    });
  }

  layout() {
    this.cy?.layout({ name: 'dagre', rankDir: 'LR' } as cytoscape.LayoutOptions).run();
  }

  private toElements(nodes: GraphNode[], edges: GraphEdge[]): cytoscape.ElementDefinition[] {
    const els: cytoscape.ElementDefinition[] = [];
    for (const n of nodes) {
      els.push({ data: { id: n.id, label: n.name, side: n.side, kind: n.kind, raw: n } });
    }
    const ids = new Set(nodes.map((n) => n.id));
    for (const e of edges) {
      if (!ids.has(e.source) || !ids.has(e.target)) continue;
      els.push({ data: { id: e.id, source: e.source, target: e.target, kind: e.kind } });
    }
    return els;
  }

  private style(): cytoscape.StylesheetJson {
    return [
      { selector: 'node', style: {
        'background-color': '#1f6feb',
        'label': 'data(label)',
        'color': '#c9d1d9',
        'font-size': 10,
        'text-outline-color': '#0d1117',
        'text-outline-width': 2,
        'width': 24, 'height': 24,
      }},
      { selector: 'node[side = "api"]', style: { 'background-color': '#f0883e' }},
      { selector: 'node[side = "ui"]', style: { 'background-color': '#79c0ff' }},
      { selector: 'edge', style: {
        'curve-style': 'bezier',
        'line-color': '#30363d',
        'target-arrow-shape': 'triangle',
        'target-arrow-color': '#30363d',
        'width': 1,
      }},
      { selector: 'edge[kind = "http-call"]', style: { 'line-color': '#3fb950', 'target-arrow-color': '#3fb950', 'width': 2 }},
      { selector: ':selected', style: { 'border-width': 3, 'border-color': '#f85149' }},
    ];
  }
}
