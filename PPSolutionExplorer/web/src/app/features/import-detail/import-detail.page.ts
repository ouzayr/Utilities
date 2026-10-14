import { Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService, errorMessage } from '../../core/api.service';
import { ImportSummary, NodeSummary } from '../../core/models';

@Component({
  selector: 'app-import-detail-page',
  imports: [RouterLink, FormsModule],
  template: `
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
    @if (summary(); as s) {
      <h1>{{ s.name }} <span class="muted">{{ s.kind }} {{ s.version ?? '' }}</span></h1>
      <div class="row">
        <a class="button" [routerLink]="['/imports', s.id, 'search']">Search</a>
        <a class="button" [href]="api.docsUrl(s.id, 'html', undefined, includeEnvValues)" target="_blank">Docs (HTML)</a>
        <a class="button" [href]="api.docsUrl(s.id, 'md', undefined, includeEnvValues)">Docs (Markdown)</a>
        <label><input type="checkbox" [(ngModel)]="includeEnvValues" /> include environment variable values</label>
      </div>
      @if (s.warnings.length) {
        <div class="card">
          <h3 class="warn">Import warnings</h3>
          <ul>
            @for (w of s.warnings; track $index) {
              <li>{{ w }}</li>
            }
          </ul>
        </div>
      }

      <h2>Cloud flows</h2>
      <table>
        <thead><tr><th>Flow</th><th>Tags</th><th>Docs</th></tr></thead>
        <tbody>
          @for (f of flows(); track f.id) {
            <tr>
              <td><a [routerLink]="['/imports', s.id, 'flow']" [queryParams]="{ flowId: f.id }">{{ f.name }}</a></td>
              <td>@for (t of f.tags; track t) { <span class="chip">{{ t }}</span> }</td>
              <td><a [href]="api.docsUrl(s.id, 'html', f.id)" target="_blank">HTML</a> · <a [href]="api.docsUrl(s.id, 'md', f.id)">MD</a></td>
            </tr>
          } @empty {
            <tr><td colspan="3" class="muted">No cloud flows.</td></tr>
          }
        </tbody>
      </table>

      @for (group of groups(); track group.title) {
        <h2>{{ group.title }}</h2>
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>Tags</th><th></th></tr></thead>
          <tbody>
            @for (n of group.items; track n.id) {
              <tr>
                <td>{{ n.name }}</td>
                <td>{{ n.subType ?? '' }}</td>
                <td>@for (t of n.tags; track t) { <span class="chip">{{ t }}</span> }</td>
                <td><a [routerLink]="['/imports', s.id, 'impact']" [queryParams]="{ nodeId: n.id }">Impact</a></td>
              </tr>
            } @empty {
              <tr><td colspan="4" class="muted">None.</td></tr>
            }
          </tbody>
        </table>
      }
    }
  `,
})
export class ImportDetailPage {
  protected readonly api = inject(ApiService);
  readonly importId = input.required<string>();

  protected readonly summary = signal<ImportSummary | null>(null);
  protected readonly flows = signal<NodeSummary[]>([]);
  protected readonly groups = signal<{ title: string; items: NodeSummary[] }[]>([]);
  protected readonly error = signal<string | null>(null);
  protected includeEnvValues = false;

  constructor() {
    effect(() => {
      const id = this.importId();
      forkJoin({
        summary: this.api.import(id),
        flows: this.api.nodes(id, 'Flow'),
        env: this.api.nodes(id, 'EnvVariable'),
        refs: this.api.nodes(id, 'ConnectionReference'),
        tables: this.api.nodes(id, 'Table'),
        apps: this.api.nodes(id, 'App'),
      }).subscribe({
        next: (r) => {
          this.summary.set(r.summary);
          this.flows.set(r.flows);
          this.groups.set([
            { title: 'Environment variables', items: r.env },
            { title: 'Connection references', items: r.refs },
            { title: 'Tables', items: r.tables },
            { title: 'Apps', items: r.apps },
          ]);
        },
        error: (e) => this.error.set(errorMessage(e)),
      });
    });
  }
}
