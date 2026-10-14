import { Component, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../../core/api.service';
import { DiffResult, ImportSummary, NodeChange } from '../../core/models';

/** Version comparison and environment drift: compare any two imports (e.g. v1.0.3 vs v1.0.4, or DEV vs PROD export). */
@Component({
  selector: 'app-compare-page',
  imports: [FormsModule, RouterLink],
  template: `
    <h1>Compare versions / environments</h1>
    <p class="muted">Pick a baseline and a target import. Components are matched by ID, so an export of the same solution from
      two environments shows drift; two exports over time show the change log.</p>
    <div class="card row">
      <label>Baseline
        <select [(ngModel)]="leftId">
          @for (i of imports(); track i.id) { <option [ngValue]="i.id">{{ i.name }} {{ i.version }} · {{ i.fileName }}</option> }
        </select>
      </label>
      <label>Target
        <select [(ngModel)]="rightId">
          @for (i of imports(); track i.id) { <option [ngValue]="i.id">{{ i.name }} {{ i.version }} · {{ i.fileName }}</option> }
        </select>
      </label>
      <button class="primary" (click)="go()" [disabled]="!leftId || !rightId || leftId === rightId">Compare</button>
    </div>
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
    @if (diff(); as d) {
      <div class="row">
        <a class="button" [href]="api.diffUrl(d.left.id, d.right.id, 'html')" target="_blank">Change log (HTML)</a>
        <a class="button" [href]="api.diffUrl(d.left.id, d.right.id, 'md')">Change log (Markdown)</a>
      </div>
      <p>Added {{ d.summary.added }} · Removed {{ d.summary.removed }} · Changed {{ d.summary.changed }} · Moved {{ d.summary.moved }} · Link changes {{ d.summary.edgesChanged }}</p>
      @if (d.summary.isEmpty) {
        <p>No differences.</p>
      }
      @if (solutionChanges().length) {
        <h2>Solution components</h2>
        <table>
          <thead><tr><th>Change</th><th>Type</th><th>Name</th><th>Details</th></tr></thead>
          <tbody>
            @for (n of solutionChanges(); track n.nodeId) {
              <tr><td>{{ n.kind }}</td><td>{{ n.type }}</td><td>{{ n.name }}</td><td><code>{{ details(n) }}</code></td></tr>
            }
          </tbody>
        </table>
      }
      @for (f of flows(); track f.flowId) {
        <h2>{{ f.name }}
          @if (!f.removed) {
            <a class="button" [routerLink]="['/imports', d.right.id, 'flow']" [queryParams]="{ flowId: f.flowId, compareTo: d.left.id }">View with overlay</a>
          }
        </h2>
        <table>
          <thead><tr><th>Change</th><th>Step</th><th>Type</th><th>Details</th></tr></thead>
          <tbody>
            @for (n of f.changes; track n.nodeId) {
              <tr><td>{{ n.kind }}</td><td>{{ n.name }}</td><td>{{ n.type }}</td><td><code>{{ details(n) }}</code></td></tr>
            }
          </tbody>
        </table>
      }
    }
  `,
})
export class ComparePage implements OnInit {
  protected readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly left = input<string>();
  readonly right = input<string>();

  protected readonly imports = signal<ImportSummary[]>([]);
  protected readonly diff = signal<DiffResult | null>(null);
  protected readonly error = signal<string | null>(null);
  protected leftId: string | null = null;
  protected rightId: string | null = null;

  protected readonly solutionChanges = computed(() => (this.diff()?.nodes ?? []).filter((n) => !n.flowId));
  protected readonly flows = computed(() => {
    const d = this.diff();
    if (!d) {
      return [];
    }
    const groups = new Map<string, NodeChange[]>();
    for (const n of d.nodes.filter((x) => x.flowId)) {
      groups.set(n.flowId!, [...(groups.get(n.flowId!) ?? []), n]);
    }
    return [...groups.entries()].map(([flowId, changes]) => ({
      flowId,
      name: d.flowNames[flowId] ?? flowId,
      removed: changes.some((c) => c.nodeId === flowId && c.kind === 'Removed'),
      changes,
    }));
  });

  constructor() {
    effect(() => {
      const left = this.left();
      const right = this.right();
      if (left && right) {
        this.leftId = left;
        this.rightId = right;
        this.api.diff(left, right).subscribe({ next: (d) => this.diff.set(d), error: (e) => this.error.set(errorMessage(e)) });
      }
    });
  }

  ngOnInit(): void {
    this.api.imports().subscribe((i) => {
      this.imports.set(i);
      this.leftId ??= i[1]?.id ?? null;
      this.rightId ??= i[0]?.id ?? null;
    });
  }

  protected go(): void {
    void this.router.navigate([], { queryParams: { left: this.leftId, right: this.rightId } });
  }

  protected details(n: NodeChange): string {
    return n.changes.slice(0, 6).map((c) => `${c.path}: ${c.before ?? '∅'} → ${c.after ?? '∅'}`).join('\n');
  }
}
