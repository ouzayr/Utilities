import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, errorMessage } from '../../core/api.service';
import { RuleCatalog } from '../../core/models';

@Component({
  selector: 'app-rules-page',
  imports: [FormsModule],
  template: `
    <h1>Quality rules</h1>
    <p class="muted">Profiles are configured in <code>Quality:Profiles</code> (appsettings) so a team or project can share one rule set.
      This page shows the effective settings.</p>
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
    @if (catalog(); as c) {
      <div class="row">
        <label>Profile
          <select [(ngModel)]="profile" (ngModelChange)="load()">
            @for (p of c.profiles; track p) { <option [ngValue]="p">{{ p }}</option> }
          </select>
        </label>
        <span class="muted">Max nesting depth {{ c.maxNestingDepth }} · max steps per flow {{ c.maxActions }}</span>
      </div>
      <table>
        <thead><tr><th>Rule</th><th>Title</th><th>Category</th><th>Severity</th><th>Enabled</th><th>Description</th></tr></thead>
        <tbody>
          @for (r of c.rules; track r.id) {
            <tr [class.muted]="!r.enabled">
              <td>{{ r.id }}</td><td>{{ r.title }}</td><td>{{ r.category }}</td>
              <td>{{ r.severity }}{{ r.severity !== r.defaultSeverity ? ' (default ' + r.defaultSeverity + ')' : '' }}</td>
              <td>{{ r.enabled ? 'yes' : 'no' }}</td><td>{{ r.description }}</td>
            </tr>
          }
        </tbody>
      </table>
    }
  `,
})
export class RulesPage implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly catalog = signal<RuleCatalog | null>(null);
  protected readonly error = signal<string | null>(null);
  protected profile = 'default';

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.api.rules(this.profile).subscribe({ next: (c) => this.catalog.set(c), error: (e) => this.error.set(errorMessage(e)) });
  }
}
