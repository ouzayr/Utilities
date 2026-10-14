import { Component, ElementRef, OnDestroy, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type { Core } from 'cytoscape';
import { ApiService, errorMessage } from '../../core/api.service';
import { CONTAINER_TYPES, ChangeKind, DiffResult, ExecutionPath, FlowComplexity, FlowGraph, PathResult, QualityFinding } from '../../core/models';
import { NodePanelComponent } from '../../shared/node-panel.component';
import { ColorMode, dependencies, toElements } from './flow-elements';

const SEVERITY_RANK: Record<string, number> = { Info: 1, Warning: 2, Error: 3 };

@Component({
  selector: 'app-flow-viewer-page',
  imports: [FormsModule, RouterLink, NodePanelComponent],
  styles: `
    .graph-wrap { position: relative; }
    .graph { height: calc(100vh - 230px); min-height: 480px; border: 1px solid var(--border); border-radius: 8px; background: #fff; }
    .minimap { position: absolute; right: 10px; bottom: 10px; width: 200px; height: 140px; border: 1px solid var(--border);
      background: #fff; border-radius: 6px; overflow: hidden; cursor: pointer; opacity: .95; }
    .minimap img { width: 100%; height: 100%; object-fit: contain; display: block; }
    .minimap .view { position: absolute; border: 2px solid var(--accent); background: rgba(9,105,218,.08); pointer-events: none; }
    .list { max-height: 240px; overflow: auto; }
    .item { cursor: pointer; padding: .25rem .4rem; border-radius: 4px; font-size: .82rem; }
    .item.selected, .item:hover { background: #ddf4ff; }
    .legend span { display: inline-block; width: .8rem; height: .8rem; border-radius: 3px; margin: 0 .2rem 0 .6rem; vertical-align: middle; }
  `,
  template: `
    <a [routerLink]="['/imports', importId()]">← Back to import</a>
    <h1>{{ flowName() }}
      @if (complexity(); as c) {
        <span class="pill" [title]="c.actions + ' steps, depth ' + c.maxDepth + ', ' + c.paths + ' paths, ' + c.expressions + ' expressions'">complexity {{ c.score }} · {{ c.rating }}</span>
      }
    </h1>
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
    <div class="layout-2">
      <div>
        <div class="row" style="margin-bottom:.5rem">
          <label>Colour by
            <select [(ngModel)]="colorBy" (ngModelChange)="render()">
              <option value="type">step type</option>
              <option value="connector">connector</option>
              <option value="quality">quality findings</option>
              @if (diff()) { <option value="diff">changes vs baseline</option> }
            </select>
          </label>
          <label><input type="checkbox" [(ngModel)]="showDataFlow" (change)="render()" /> data flow</label>
          <label><input type="checkbox" [(ngModel)]="highlightDeps" (change)="applyHighlight()" /> highlight dependencies</label>
          <button (click)="collapseAll()">Collapse all</button>
          <button (click)="expandAll()">Expand all</button>
          <button (click)="fit()">Fit</button>
        </div>
        <div class="muted legend">
          Double-click a container to collapse/expand. Red dashed edges run only on failure/timeout.
          @if (colorBy === 'quality') { <span style="background:#ffcecb"></span>error <span style="background:#fff1c2"></span>warning <span style="background:#ddf4ff"></span>info }
          @if (colorBy === 'diff') { <span style="background:#ccf7d8"></span>added <span style="background:#fff1c2"></span>changed <span style="background:#e0d4ff"></span>moved }
          @if (highlightDeps) { <span style="background:#ffd8b5"></span>depends on <span style="background:#b6e3ff"></span>used by }
        </div>
        <div class="graph-wrap">
          <div #graph class="graph"></div>
          @if (minimap(); as m) {
            <div class="minimap" (click)="minimapClick($event)" title="Click to navigate">
              <img [src]="m" alt="Minimap" />
              <div class="view" [style.left.%]="viewport().x" [style.top.%]="viewport().y" [style.width.%]="viewport().w" [style.height.%]="viewport().h"></div>
            </div>
          }
        </div>
      </div>

      <div>
        @if (diff(); as d) {
          <div class="card">
            <h3>Changes vs baseline</h3>
            <p class="muted">Baseline: {{ d.left.name }} {{ d.left.version }} ({{ d.left.fileName }})</p>
            <p>{{ flowChanges().length }} step change(s) in this flow.</p>
            <div class="list">
              @for (ch of flowChanges(); track ch.nodeId) {
                <div class="item" (click)="ch.kind !== 'Removed' && select(ch.nodeId)" [title]="describeChange(ch.changes)">
                  <strong>{{ ch.kind }}</strong> {{ ch.name }}{{ ch.kind === 'Removed' ? ' (not in this version)' : '' }}
                </div>
              }
            </div>
          </div>
        }

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
            <div class="list">
              @for (path of p.paths; track $index) {
                <div class="item" [class.selected]="selectedPath() === path" (click)="highlight(path)">
                  #{{ $index + 1 }} · {{ path.steps.length }} steps{{ path.iterated ? ' · loop' : '' }}{{ path.usesFailureBranch ? ' · failure branch' : '' }}
                </div>
              }
            </div>
          }
        </div>

        <div class="card">
          <h3>Quality findings ({{ findings().length }})</h3>
          <div class="list">
            @for (f of findings(); track $index) {
              <div class="item" (click)="select(f.nodeId)">
                <strong [class.warn]="f.severity === 'Warning'" [class.error]="f.severity === 'Error'">{{ f.ruleId }}</strong> {{ f.message }}
              </div>
            } @empty {
              <p class="muted">None.</p>
            }
          </div>
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
  /** Baseline import to compare against (version comparison / drift overlay). */
  readonly compareTo = input<string>();

  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('graph');
  private cy?: Core;
  private renderToken = 0;

  protected readonly graph = signal<FlowGraph | null>(null);
  protected readonly selected = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly paths = signal<PathResult | null>(null);
  protected readonly selectedPath = signal<ExecutionPath | null>(null);
  protected readonly findings = signal<QualityFinding[]>([]);
  protected readonly complexity = signal<FlowComplexity | null>(null);
  protected readonly diff = signal<DiffResult | null>(null);
  protected readonly collapsed = signal<ReadonlySet<string>>(new Set());
  protected readonly fromNode = signal<string | null>(null);
  protected readonly toNode = signal<string | null>(null);
  protected readonly minimap = signal<string | null>(null);
  protected readonly viewport = signal({ x: 0, y: 0, w: 100, h: 100 });
  protected showDataFlow = false;
  protected highlightDeps = true;
  protected includeFailure = true;
  protected maxPaths = 10000;
  protected colorBy: ColorMode = 'type';

  protected readonly flowName = computed(() => this.graph()?.nodes.find((n) => n.id === this.flowId())?.name ?? 'Flow');
  protected readonly flowChanges = computed(() => (this.diff()?.nodes ?? []).filter((n) => n.flowId === this.flowId() && n.nodeId !== this.flowId()));

  constructor() {
    effect(() => {
      const importId = this.importId();
      const flowId = this.flowId();
      const baseline = this.compareTo();
      this.selected.set(this.nodeId() ?? flowId);
      this.paths.set(null);
      this.diff.set(null);
      this.collapsed.set(new Set());
      this.api.flowGraph(importId, flowId).subscribe({
        next: (g) => { this.graph.set(g); void this.render(); },
        error: (e) => this.error.set(errorMessage(e)),
      });
      this.api.quality(importId, flowId).subscribe((f) => { this.findings.set(f); if (this.colorBy === 'quality') { void this.render(); } });
      this.api.complexity(importId, flowId).subscribe((c) => this.complexity.set(c[0] ?? null));
      if (baseline) {
        this.api.diff(baseline, importId, flowId).subscribe({
          next: (d) => { this.diff.set(d); this.colorBy = 'diff'; void this.render(); },
          error: (e) => this.error.set(errorMessage(e)),
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.cy?.destroy();
  }

  protected label(id: string | null): string | null {
    return id ? (this.graph()?.nodes.find((n) => n.id === id)?.name ?? id) : null;
  }

  protected describeChange(changes: { path: string; before?: string; after?: string }[]): string {
    return changes.map((c) => `${c.path}: ${c.before ?? '∅'} → ${c.after ?? '∅'}`).join('\n');
  }

  /** Selects a node, expanding collapsed ancestors and centring it (jump from search/impact/findings). */
  protected select(nodeId: string): void {
    this.selected.set(nodeId);
    const graph = this.graph();
    const ancestors = new Set<string>();
    let current = graph?.nodes.find((n) => n.id === nodeId);
    while (current?.parentId) {
      ancestors.add(current.parentId);
      current = graph?.nodes.find((n) => n.id === current!.parentId);
    }
    if ([...ancestors].some((a) => this.collapsed().has(a))) {
      this.collapsed.set(new Set([...this.collapsed()].filter((c) => !ancestors.has(c))));
      void this.render();
    } else {
      this.focus(nodeId);
    }
    void this.router.navigate([], { queryParams: { nodeId }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  private focus(nodeId: string): void {
    const cy = this.cy;
    const node = cy?.getElementById(nodeId);
    if (!cy || !node || node.empty()) {
      return;
    }
    cy.$('node').unselect();
    node.select();
    cy.animate({ center: { eles: node }, zoom: Math.max(cy.zoom(), 0.9) }, { duration: 250 });
    this.applyHighlight();
  }

  protected fit(): void {
    this.cy?.fit(undefined, 30);
  }

  protected collapseAll(): void {
    const containers = (this.graph()?.nodes ?? []).filter((n) => n.inFlow && CONTAINER_TYPES.includes(n.type)).map((n) => n.id);
    this.collapsed.set(new Set(containers));
    void this.render();
  }

  protected expandAll(): void {
    this.collapsed.set(new Set());
    void this.render();
  }

  private toggle(id: string): void {
    const next = new Set(this.collapsed());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.collapsed.set(next);
    void this.render();
  }

  /** Cytoscape and ELK are loaded lazily: only this page pays for them. */
  protected async render(): Promise<void> {
    const graph = this.graph();
    if (!graph) {
      return;
    }
    const token = ++this.renderToken;

    const [{ default: cytoscape }, { default: elk }] = await Promise.all([import('cytoscape'), import('cytoscape-elk')]);
    if (token !== this.renderToken) {
      return;
    }
    if (!(cytoscape as unknown as { __elk?: boolean }).__elk) {
      cytoscape.use(elk);
      (cytoscape as unknown as { __elk?: boolean }).__elk = true;
    }

    const findings = new Map<string, string>();
    for (const f of this.findings()) {
      if ((SEVERITY_RANK[f.severity] ?? 0) > (SEVERITY_RANK[findings.get(f.nodeId) ?? ''] ?? 0)) {
        findings.set(f.nodeId, f.severity);
      }
    }
    const changes = new Map<string, ChangeKind>((this.diff()?.nodes ?? []).map((n) => [n.nodeId, n.kind]));
    const connectors = new Map<string, string>(graph.nodes.filter((n) => n.connector).map((n) => [n.id, n.connector!]));

    this.cy?.destroy();
    const cy = cytoscape({
      container: this.container().nativeElement,
      elements: toElements(graph, this.flowId(), {
        showDataFlow: this.showDataFlow, collapsed: this.collapsed(), colorBy: this.colorBy, findings, changes, connectors,
      }),
      wheelSensitivity: 0.3,
      style: [
        { selector: 'node', style: { label: 'data(label)', 'font-size': 11, 'text-valign': 'center', 'text-halign': 'center',
          shape: 'round-rectangle', width: 'label', height: 26, padding: '8px', 'background-color': '#ddf4ff', 'border-width': 1, 'border-color': '#54aeff', 'text-wrap': 'none' } },
        { selector: 'node[color]', style: { 'background-color': 'data(color)' } },
        { selector: 'node.trigger', style: { 'background-color': '#dafbe1', 'border-color': '#4ac26b' } },
        { selector: 'node.unknown', style: { 'background-color': '#fff8c5', 'border-color': '#d4a72c', 'border-style': 'dashed' } },
        { selector: 'node.container', style: { 'text-valign': 'top', 'background-opacity': 0.06, 'border-style': 'solid', 'font-weight': 'bold', padding: '14px' } },
        { selector: 'node.collapsed', style: { 'border-style': 'double', 'border-width': 3, 'font-weight': 'bold' } },
        { selector: 'node.loop', style: { 'border-color': '#bf8700' } },
        { selector: 'node.condition, node.switch', style: { 'border-color': '#8250df' } },
        { selector: 'node.branch', style: { label: 'data(label)', 'text-valign': 'top', 'background-opacity': 0.03, 'border-style': 'dotted', 'border-color': '#8c959f', 'font-size': 10, color: '#59636e' } },
        { selector: 'node.sev-error', style: { 'background-color': '#ffcecb', 'border-color': '#cf222e', 'border-width': 2, 'background-opacity': 1 } },
        { selector: 'node.sev-warning', style: { 'background-color': '#fff1c2', 'border-color': '#9a6700', 'border-width': 2, 'background-opacity': 1 } },
        { selector: 'node.sev-info', style: { 'border-color': '#0969da', 'border-width': 2 } },
        { selector: 'node.diff-added', style: { 'background-color': '#ccf7d8', 'border-color': '#1a7f37', 'border-width': 2, 'background-opacity': 1 } },
        { selector: 'node.diff-changed', style: { 'background-color': '#fff1c2', 'border-color': '#9a6700', 'border-width': 2, 'background-opacity': 1 } },
        { selector: 'node.diff-moved', style: { 'background-color': '#e0d4ff', 'border-color': '#8250df', 'border-width': 2, 'background-opacity': 1 } },
        { selector: 'node.upstream', style: { 'background-color': '#ffd8b5', 'background-opacity': 1 } },
        { selector: 'node.downstream', style: { 'background-color': '#b6e3ff', 'background-opacity': 1 } },
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
    this.cy = cy;

    cy.on('tap', 'node', (event) => {
      const id = event.target.id() as string;
      if (!id.includes('#')) {
        this.selected.set(id);
        this.applyHighlight();
        void this.router.navigate([], { queryParams: { nodeId: id }, queryParamsHandling: 'merge', replaceUrl: true });
      }
    });
    cy.on('dbltap', 'node', (event) => {
      const id = event.target.id() as string;
      const node = graph.nodes.find((n) => n.id === id);
      if (node && CONTAINER_TYPES.includes(node.type)) {
        this.toggle(id);
      }
    });
    cy.on('viewport', () => this.updateViewport());
    cy.one('layoutstop', () => {
      this.minimap.set(cy.png({ full: true, maxWidth: 400, maxHeight: 280, bg: '#ffffff' }));
      this.updateViewport();
      const preselected = this.selected();
      if (preselected && preselected !== this.flowId()) {
        this.focus(preselected);
      }
    });
  }

  /** Visible window as a percentage of the whole graph, for the minimap rectangle. */
  private updateViewport(): void {
    const cy = this.cy;
    if (!cy) {
      return;
    }
    const bb = cy.elements().boundingBox();
    const ext = cy.extent();
    if (bb.w === 0 || bb.h === 0) {
      return;
    }
    // The image is "contain"-fitted into 200x140: compute the letterbox offsets.
    const scale = Math.min(200 / bb.w, 140 / bb.h);
    const offX = (200 - bb.w * scale) / 2;
    const offY = (140 - bb.h * scale) / 2;
    const clamp = (v: number) => Math.max(0, Math.min(100, v));
    const x = clamp(((ext.x1 - bb.x1) * scale + offX) / 2);
    const y = clamp(((ext.y1 - bb.y1) * scale + offY) / 1.4);
    this.viewport.set({ x, y, w: clamp((ext.w * scale) / 2), h: clamp((ext.h * scale) / 1.4) });
  }

  protected minimapClick(event: MouseEvent): void {
    const cy = this.cy;
    if (!cy) {
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const bb = cy.elements().boundingBox();
    const scale = Math.min(rect.width / bb.w, rect.height / bb.h);
    const offX = (rect.width - bb.w * scale) / 2;
    const offY = (rect.height - bb.h * scale) / 2;
    const x = bb.x1 + (event.clientX - rect.left - offX) / scale;
    const y = bb.y1 + (event.clientY - rect.top - offY) / scale;
    const zoom = cy.zoom();
    cy.pan({ x: cy.width() / 2 - x * zoom, y: cy.height() / 2 - y * zoom });
  }

  /** Marks everything the selected step depends on (upstream) and everything that depends on it (downstream). */
  protected applyHighlight(): void {
    const cy = this.cy;
    const graph = this.graph();
    cy?.nodes().removeClass('upstream downstream');
    const id = this.selected();
    if (!cy || !graph || !id || !this.highlightDeps || id === this.flowId()) {
      return;
    }
    const { upstream, downstream } = dependencies(graph, id);
    upstream.forEach((n) => cy.getElementById(n).addClass('upstream'));
    downstream.forEach((n) => cy.getElementById(n).addClass('downstream'));
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

  protected async highlight(path: ExecutionPath): Promise<void> {
    this.selectedPath.set(path);
    if (this.collapsed().size) {
      this.collapsed.set(new Set());
      await this.render();
    }
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
