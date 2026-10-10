import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AiStatusService } from '../../core/ai-status.service';
import { ApiService, errorMessage } from '../../core/api.service';
import { Facets, NODE_TYPES, NodeType, SearchQuery, SearchResponse } from '../../core/models';
import { AiOutputComponent } from '../../shared/ai-output.component';

@Component({
  selector: 'app-search-page',
  imports: [FormsModule, RouterLink, AiOutputComponent],
  template: `
    <a [routerLink]="['/imports', importId()]">← Back to import</a>
    <h1>Search</h1>

    @if (aiStatus.enabled()) {
      <form class="card" (ngSubmit)="askAi()">
        <h3>Ask in plain English <span class="pill pill-ai">AI</span></h3>
        <div class="row">
          <input name="question" [(ngModel)]="question" placeholder="e.g. steps that write to contact" style="flex:1" />
          <button class="ai-button" type="submit" [disabled]="!question.trim() || busy()">Translate &amp; search</button>
        </div>
        <p class="muted">The model only proposes a structured query. It is validated against known values and shown below before results.</p>
      </form>
    }

    <form class="card" (ngSubmit)="run()">
      <div class="row">
        <input name="text" [(ngModel)]="query.text" placeholder="Name contains…" />
        <label><input type="checkbox" name="raw" [(ngModel)]="query.searchRawJson" /> also search raw JSON</label>
        <select name="type" [(ngModel)]="nodeType">
          <option [ngValue]="null">Any type</option>
          @for (t of nodeTypes; track t) { <option [ngValue]="t">{{ t }}</option> }
        </select>
        <select name="subType" [(ngModel)]="subType">
          <option [ngValue]="null">Any action type</option>
          @for (t of facets()?.subTypes ?? []; track t) { <option [ngValue]="t">{{ t }}</option> }
        </select>
        <select name="connector" [(ngModel)]="connector">
          <option [ngValue]="null">Any connector</option>
          @for (t of facets()?.connectors ?? []; track t) { <option [ngValue]="t">{{ t }}</option> }
        </select>
        <select name="table" [(ngModel)]="table">
          <option [ngValue]="null">Any table</option>
          @for (t of facets()?.tables ?? []; track t) { <option [ngValue]="t">{{ t }}</option> }
        </select>
        <select name="tag" [(ngModel)]="tag">
          <option [ngValue]="null">Any tag</option>
          @for (t of facets()?.tags ?? []; track t) { <option [ngValue]="t">{{ t }}</option> }
        </select>
        <label><input type="checkbox" name="unresolved" [(ngModel)]="onlyUnresolved" /> has unresolved</label>
        <button class="primary" type="submit" [disabled]="busy()">Search</button>
      </div>
    </form>

    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
    @if (response(); as r) {
      @if (r.ai) {
        <app-ai-output [output]="r.ai" />
        <p class="muted">Interpreted query: <code>{{ describe(r.query) }}</code></p>
      }
      @if (r.dropped.length) {
        <p class="warn">Ignored unknown values: {{ r.dropped.join(', ') }}</p>
      }
      <p>{{ r.results.length }} result(s)</p>
      <table>
        <thead><tr><th>Name</th><th>Type</th><th>Flow</th><th>Tags</th></tr></thead>
        <tbody>
          @for (h of r.results; track h.node.id) {
            <tr>
              <td>{{ h.node.name }}</td>
              <td>{{ h.node.type }}{{ h.node.subType ? ' · ' + h.node.subType : '' }}{{ h.node.operation ? ' · ' + h.node.operation : '' }}</td>
              <td>
                @if (h.flowId) {
                  <a [routerLink]="['/imports', importId(), 'flow']" [queryParams]="{ flowId: h.flowId, nodeId: h.node.id }">{{ h.flowName }}</a>
                } @else {
                  <a [routerLink]="['/imports', importId(), 'impact']" [queryParams]="{ nodeId: h.node.id }">impact</a>
                }
              </td>
              <td>@for (t of h.node.tags; track t) { <span class="chip">{{ t }}</span> }</td>
            </tr>
          }
        </tbody>
      </table>
    }
  `,
})
export class SearchPage implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly aiStatus = inject(AiStatusService);
  readonly importId = input.required<string>();

  protected readonly nodeTypes = NODE_TYPES;
  protected readonly facets = signal<Facets | null>(null);
  protected readonly response = signal<SearchResponse | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected query: SearchQuery = { text: '', searchRawJson: false };
  protected nodeType: NodeType | null = null;
  protected subType: string | null = null;
  protected connector: string | null = null;
  protected table: string | null = null;
  protected tag: string | null = null;
  protected onlyUnresolved = false;
  protected question = '';

  ngOnInit(): void {
    this.api.facets(this.importId()).subscribe((f) => this.facets.set(f));
  }

  protected run(): void {
    const q: SearchQuery = {
      importId: this.importId(),
      text: this.query.text || null,
      searchRawJson: this.query.searchRawJson,
      nodeTypes: this.nodeType ? [this.nodeType] : [],
      subTypes: this.subType ? [this.subType] : [],
      connectors: this.connector ? [this.connector] : [],
      tables: this.table ? [this.table] : [],
      tags: this.tag ? [this.tag] : [],
      hasUnresolved: this.onlyUnresolved ? true : null,
    };
    this.execute(this.api.search(q));
  }

  protected askAi(): void {
    this.execute(this.api.aiSearch(this.question, this.importId()));
  }

  private execute(request: ReturnType<ApiService['search']>): void {
    this.busy.set(true);
    this.error.set(null);
    request.subscribe({
      next: (r) => { this.response.set(r); this.busy.set(false); },
      error: (e) => { this.error.set(errorMessage(e)); this.busy.set(false); },
    });
  }

  protected describe(q: SearchQuery): string {
    const parts = Object.entries(q)
      .filter(([k, v]) => k !== 'importId' && k !== 'limit' && v !== null && v !== undefined && v !== false && !(Array.isArray(v) && v.length === 0) && v !== '')
      .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('|') : v}`);
    return parts.length ? parts.join('; ') : '(no filters)';
  }
}
