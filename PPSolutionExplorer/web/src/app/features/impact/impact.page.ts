import { Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../../core/api.service';
import { ImpactResult } from '../../core/models';

@Component({
  selector: 'app-impact-page',
  imports: [RouterLink, FormsModule],
  template: `
    <a [routerLink]="['/imports', importId()]">← Back to import</a>
    <h1>Impact analysis</h1>
    <p class="muted">What is affected if <code>{{ nodeId() }}</code> changes. Follows reads, writes, environment variables,
      connections, child-flow calls and data flow.</p>
    <div class="row">
      <label>Depth <input type="number" min="1" max="20" [(ngModel)]="depth" (change)="load()" style="width:4rem" /></label>
    </div>
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
    @if (result(); as r) {
      <p>{{ r.items.length }} affected component(s).</p>
      <table>
        <thead><tr><th>Depth</th><th>Via</th><th>Component</th><th>Type</th><th>Flow</th></tr></thead>
        <tbody>
          @for (i of r.items; track i.node.id) {
            <tr>
              <td>{{ i.depth }}</td>
              <td>{{ i.via }}</td>
              <td>{{ i.node.name }}</td>
              <td>{{ i.node.type }}{{ i.node.subType ? ' · ' + i.node.subType : '' }}</td>
              <td>
                @if (i.flowId) {
                  <a [routerLink]="['/imports', importId(), 'flow']" [queryParams]="{ flowId: i.flowId, nodeId: i.node.id }">{{ i.flowName ?? i.flowId }}</a>
                }
              </td>
            </tr>
          } @empty {
            <tr><td colspan="5" class="muted">Nothing depends on this component.</td></tr>
          }
        </tbody>
      </table>
    }
  `,
})
export class ImpactPage {
  private readonly api = inject(ApiService);
  readonly importId = input.required<string>();
  readonly nodeId = input.required<string>();

  protected depth = 6;
  protected readonly result = signal<ImpactResult | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.importId();
      this.nodeId();
      this.load();
    });
  }

  protected load(): void {
    this.api.impact(this.importId(), this.nodeId(), this.depth).subscribe({
      next: (r) => this.result.set(r),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }
}
