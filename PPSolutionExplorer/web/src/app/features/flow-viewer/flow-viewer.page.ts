import { Component, ElementRef, OnDestroy, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type { Core } from 'cytoscape';
import { ApiService, errorMessage } from '../../core/api.service';
import { ExecutionPath, FlowGraph, PathResult, QualityFinding } from '../../core/models';
import { NodePanelComponent } from '../../shared/node-panel.component';
import { toElements } from './flow-elements';

@Component({
  selector: 'app-flow-viewer-page',
  imports: [FormsModule, RouterLink, NodePanelComponent],
  styles: `
    .graph { height: calc(100vh - 210px); min-height: 480px; border: 1px solid var(--border); border-radius: 8px; background: #fff; }
    .paths { max-height: 260px; overflow: auto; }
    .path { cursor: pointer; padding: .25rem .4rem; border-radius: 4px; font-size: .82rem; }
    .path.selected, .path:hover { background: #ddf4ff; }
  `,
  template: `
    <a [routerLink]="['/imports', importId()]">← Back to import</a>
    <h1>{{ flowName() }}</h1>
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
    <div class="layout-2">
      <div>
        <div class="row" style="margin-bottom:.5rem">
          <label><input type="checkbox" [(ngModel)]="showDataFlow" (change)="render()" /> show data flow</label>
          <button (click)="fit()">Fit</button>
          <span class="muted">Click a step for details. Red dashed edges run only on failure/timeout.</span>
        </div>
        <div #graph class="graph"></div>
      </div>

      <div>
        <div class="card">
          <h3>Path tracing</h3>
          <div class="muted">From: {{ label(fromNode()) ?? 'trigger' }} · To: {{ label(toNode()) ?? 'end of flow' }}
            @if (fromNode() || toNode()) { <button (click)="fromNode.set(null); toNode.set(null)">Reset</button> }
          </div>
          <div class="row">
            <label><input type="checkbox" [(ngModel)]="includeFailure" /> include failure/timeout branches</label>
            <label>max <input type="number" [(ngModel)]="maxPaths" min="1" max="100000" style="width:6rem" /></label>
            <button class="primary" (click)="trace()">Trace</button>
          </div>
          @if (paths(); as p) {
            <p>{{ p.total_estimated }} path(s) in total, {{ p.returned }} returned{{ p.truncated ? ' (truncated)' : '' }}.</p>
            @for (w of p.warnings; track $index) { <p class="warn">{{ w }}</p> }
            <div class="paths">
              @for (path of p.paths; track $index) {
                <div class="path" [class.selected]="selectedPath() === path" (click)="highlight(path)">
                  #{{ $index + 1 }} · {{ path.steps.length }} steps{{ path.iterated ? ' · loop' : '' }}{{ path.usesFailureBranch ? ' · failure branch' : '' }}
                </div>
              }
            </div>
          }
        </div>

        <div class="card">
          <h3>Quality findings ({{ findings().length }})</h3>
          @for (f of findings(); track $index) {
            <div class="path" (click)="select(f.nodeId)">
              <strong [class.warn]="f.severity !== 'Info'">{{ f.ruleId }}</strong> {{ f.message }}
            </div>
          } @empty {
            <p class="muted">None.</p>
          }
        </div>

        @if (selected(); as nodeId) {
          <app-node-panel [importId]="importId()" [nodeId]="nodeId"
            (traceFrom)="fromNode.set($event)" (traceTo)="toNode.set($event)" />
        }
      </div>
    </div>
  `,
})
export class FlowViewerPage implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly importId = input.required<string>();
  readonly flowId = input.required<string>();
  readonly nodeId = input<string>();

  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('graph');
  private cy?: Core;

  protected readonly graph = signal<FlowGraph | null>(null);
  protected readonly selected = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly paths = signal<PathResult | null>(null);
  protected readonly selectedPath = signal<ExecutionPath | null>(null);
  protected readonly findings = signal<QualityFinding[]>([]);
  protected readonly fromNode = signal<string | null>(null);
  protected readonly toNode = signal<string | null>(null);
  protected showDataFlow = false;
  protected includeFailure = true;
  protected maxPaths = 10000;

  protected readonly flowName = computed(() => this.graph()?.nodes.find((n) => n.id === this.flowId())?.name ?? 'Flow');

  constructor() {
    effect(() => {
      const importId = this.importId();
      const flowId = this.flowId();
      this.selected.set(this.nodeId() ?? flowId);
      this.paths.set(null);
      this.api.flowGraph(importId, flowId).subscribe({
        next: (g) => { this.graph.set(g); this.render(); },
        error: (e) => this.error.set(errorMessage(e)),
      });
      this.api.quality(importId, flowId).subscribe((f) => this.findings.set(f));
    });
  }

  ngOnDestroy(): void {
    this.cy?.destroy();
  }

  protected label(id: string | null): string | null {
    return id ? (this.graph()?.nodes.find((n) => n.id === id)?.name ?? id) : null;
  }

  protected select(nodeId: string): void {
    this.selected.set(nodeId);
    this.cy?.$('node').unselect();
    this.cy?.getElementById(nodeId).select();
    void this.router.navigate([], { queryParams: { nodeId }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected fit(): void {
    this.cy?.fit(undefined, 30);
  }

  /** Cytoscape and ELK are loaded lazily: only this page pays for them. */
  protected async render(): Promise<void> {
    const graph = this.graph();
    if (!graph) {
      return;
    }

    const [{ default: cytoscape }, { default: elk }] = await Promise.all([import('cytoscape'), import('cytoscape-elk')]);
    if (!(cytoscape as unknown as { __elk?: boolean }).__elk) {
      cytoscape.use(elk);
      (cytoscape as unknown as { __elk?: boolean }).__elk = true;
    }

    this.cy?.destroy();
    this.cy = cytoscape({
      container: this.container().nativeElement,
      elements: toElements(graph, this.flowId(), { showDataFlow: this.showDataFlow }),
      wheelSensitivity: 0.3,
      style: [
        { selector: 'node', style: { label: 'data(label)', 'font-size': 11, 'text-valign': 'center', 'text-halign': 'center',
          shape: 'round-rectangle', width: 'label', height: 26, padding: '8px', 'background-color': '#ddf4ff', 'border-width': 1, 'border-color': '#54aeff', 'text-wrap': 'none' } },
        { selector: 'node.trigger', style: { 'background-color': '#dafbe1', 'border-color': '#4ac26b' } },
        { selector: 'node.unknown', style: { 'background-color': '#fff8c5', 'border-color': '#d4a72c', 'border-style': 'dashed' } },
        { selector: 'node.container', style: { 'text-valign': 'top', 'background-opacity': 0.06, 'border-style': 'solid', 'font-weight': 'bold', padding: '14px' } },
        { selector: 'node.loop', style: { 'border-color': '#bf8700' } },
        { selector: 'node.condition, node.switch', style: { 'border-color': '#8250df' } },
        { selector: 'node.branch', style: { label: 'data(label)', 'text-valign': 'top', 'background-opacity': 0.03, 'border-style': 'dotted', 'border-color': '#8c959f', 'font-size': 10, color: '#59636e' } },
        { selector: 'node:selected', style: { 'border-width': 3, 'border-color': '#0969da' } },
        { selector: 'node.onpath', style: { 'background-color': '#ffd8b5', 'border-color': '#bc4c00', 'border-width': 2 } },
        { selector: 'edge', style: { width: 1.5, 'curve-style': 'bezier', 'target-arrow-shape': 'triangle', 'line-color': '#8c959f', 'target-arrow-color': '#8c959f', label: 'data(label)', 'font-size': 9 } },
        { selector: 'edge.failure', style: { 'line-color': '#cf222e', 'target-arrow-color': '#cf222e', 'line-style': 'dashed' } },
        { selector: 'edge.implicit', style: { 'line-style': 'dotted' } },
        { selector: 'edge.dataflow', style: { 'line-color': '#a475f9', 'target-arrow-color': '#a475f9', 'line-style': 'dotted', width: 1, opacity: 0.6 } },
        { selector: 'edge.onpath', style: { 'line-color': '#bc4c00', 'target-arrow-color': '#bc4c00', width: 3 } },
      ],
      layout: {
        name: 'elk',
        nodeDimensionsIncludeLabels: true,
        // Room for the container/branch label above its children.
        nodeLayoutOptions: (node: cytoscape.NodeSingular) =>
          node.isParent() ? { 'elk.padding': '[top=34,left=14,bottom=14,right=14]' } : {},
        elk: {
          algorithm: 'layered',
          'elk.direction': 'DOWN',
          'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
          'elk.spacing.nodeNode': 25,
          'elk.layered.spacing.nodeNodeBetweenLayers': 35,
        },
      } as unknown as cytoscape.LayoutOptions,
    });

    this.cy.on('tap', 'node', (event) => {
      const id = event.target.id() as string;
      if (!id.includes('#')) {
        this.select(id);
      }
    });

    const preselected = this.selected();
    if (preselected) {
      this.cy.getElementById(preselected).select();
    }
  }

  protected trace(): void {
    this.api.paths(this.importId(), {
      flowId: this.flowId(),
      fromNodeId: this.fromNode(),
      toNodeId: this.toNode(),
      includeFailureBranches: this.includeFailure,
      maxPaths: this.maxPaths,
    }).subscribe({
      next: (p) => { this.paths.set(p); this.selectedPath.set(null); this.cy?.elements().removeClass('onpath'); },
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  protected highlight(path: ExecutionPath): void {
    this.selectedPath.set(path);
    const cy = this.cy;
    if (!cy) {
      return;
    }
    cy.elements().removeClass('onpath');
    const ids = path.steps.map((s) => s.nodeId);
    ids.forEach((id) => cy.getElementById(id).addClass('onpath'));
    for (let i = 1; i < ids.length; i++) {
      cy.edges(`[source = "${cssEscape(ids[i - 1])}"][target = "${cssEscape(ids[i])}"]`).addClass('onpath');
    }
  }
}

function cssEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
