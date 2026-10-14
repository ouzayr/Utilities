import { Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../../core/api.service';
import { InventoryReport } from '../../core/models';

@Component({
  selector: 'app-inventory-page',
  imports: [RouterLink],
  template: `
    <a [routerLink]="['/imports', importId()]">← Back to import</a>
    <h1>Inventory</h1>
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
    @if (report(); as r) {
      <p class="muted">{{ r.note }}</p>
      <h2>Flows by complexity</h2>
      <table>
        <thead><tr><th>Flow</th><th>State</th><th>Trigger</th><th>Steps</th><th>Depth</th><th>Paths</th><th>Score</th><th>Premium</th><th>Connectors</th></tr></thead>
        <tbody>
          @for (f of r.flows; track f.flowId) {
            <tr>
              <td><a [routerLink]="['/imports', importId(), 'flow']" [queryParams]="{ flowId: f.flowId }">{{ f.name }}</a></td>
              <td>{{ f.state ?? '-' }}</td><td>{{ f.trigger ?? '-' }}</td><td>{{ f.steps }}</td>
              <td>{{ f.complexity.maxDepth }}</td><td>{{ f.complexity.paths }}</td>
              <td [class.warn]="f.complexity.rating === 'High'" [class.error]="f.complexity.rating === 'VeryHigh'">{{ f.complexity.score }} ({{ f.complexity.rating }})</td>
              <td>{{ f.usesPremium ? 'yes' : 'no' }}</td><td>{{ f.connectors.join(', ') }}</td>
            </tr>
          }
        </tbody>
      </table>
      <h2>Connectors</h2>
      <table>
        <thead><tr><th>Connector</th><th>Premium</th><th>Connection references</th><th>Flows</th><th>Steps</th></tr></thead>
        <tbody>
          @for (c of r.connectors; track c.connector) {
            <tr><td>{{ c.connector }}</td><td>{{ c.premium ? 'yes' : 'no' }}</td><td>{{ c.connectionReferences.join(', ') }}</td><td>{{ c.flows.join(', ') }}</td><td>{{ c.steps }}</td></tr>
          }
        </tbody>
      </table>
      <h2>Deprecated connectors / operations in use</h2>
      <table>
        <thead><tr><th>Flow</th><th>Step</th><th>Matches</th></tr></thead>
        <tbody>
          @for (d of r.deprecated; track d.stepId) {
            <tr>
              <td>{{ d.flowName }}</td>
              <td><a [routerLink]="['/imports', importId(), 'flow']" [queryParams]="{ flowId: d.flowId, nodeId: d.stepId }">{{ d.stepName }}</a></td>
              <td>{{ d.match }}</td>
            </tr>
          } @empty {
            <tr><td colspan="3" class="muted">None found (against the configured list).</td></tr>
          }
        </tbody>
      </table>
    }
  `,
})
export class InventoryPage {
  private readonly api = inject(ApiService);
  readonly importId = input.required<string>();
  protected readonly report = signal<InventoryReport | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => this.api.inventory(this.importId()).subscribe({ next: (r) => this.report.set(r), error: (e) => this.error.set(errorMessage(e)) }));
  }
}
