import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { ApiService, DashboardResponse, ScanSummary } from '../api.service';
import { ScanContextService } from '../scan-context.service';

@Component({
  selector: 'cc-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="!scanId">
      <div class="card" style="margin-bottom:1rem;">
        <h2 style="margin-top:0;">Welcome</h2>
        <p>No scans found yet. Run the scanner against the bundled <code>samples/</code> or your own code (see README).</p>
        <p>Once you have at least one scan, the dashboard summarises everything.</p>
      </div>
      <div class="card">
        <h3>Recent scans</h3>
        <table *ngIf="scans.length; else nope">
          <thead><tr><th>Started</th><th>Label</th><th>Status</th><th>Nodes</th><th>Edges</th><th>Findings</th><th></th></tr></thead>
          <tbody>
            <tr *ngFor="let s of scans">
              <td>{{ s.startedAt | date:'short' }}</td>
              <td>{{ s.label }}</td>
              <td>{{ s.status }}</td>
              <td>{{ s.summary.nodes ?? '-' }}</td>
              <td>{{ s.summary.edges ?? '-' }}</td>
              <td>{{ s.summary.findings ?? '-' }}</td>
              <td><button class="btn" (click)="select(s.id)">Open</button></td>
            </tr>
          </tbody>
        </table>
        <ng-template #nope><p style="color: var(--muted)">No scans yet.</p></ng-template>
      </div>
    </div>

    <div *ngIf="scanId && data">
      <div class="kpi-grid">
        <div class="card kpi"><div class="label">Total nodes</div><div class="value">{{ data.totals.nodes }}</div></div>
        <div class="card kpi"><div class="label">Total edges</div><div class="value">{{ data.totals.edges }}</div></div>
        <div class="card kpi"><div class="label">Findings</div><div class="value">{{ data.totals.findings }}</div></div>
        <div class="card kpi"><div class="label">UI components</div><div class="value">{{ data.kpis.uiComponents }}</div></div>
        <div class="card kpi"><div class="label">UI services</div><div class="value">{{ data.kpis.uiServices }}</div></div>
        <div class="card kpi"><div class="label">API actions</div><div class="value">{{ data.kpis.apiActions }}</div></div>
        <div class="card kpi"><div class="label">Cross-links</div><div class="value">{{ data.kpis.crossLinks }}</div></div>
        <div class="card kpi"><div class="label">Orphan endpoints</div><div class="value">{{ data.kpis.orphanEndpoints }}</div></div>
      </div>
      <div class="card" style="margin-top:1rem;">
        <h3 style="margin-top:0;">By kind</h3>
        <table>
          <thead><tr><th>Kind</th><th>Count</th></tr></thead>
          <tbody>
            <tr *ngFor="let k of data.byKind"><td>{{ k.kind }}</td><td>{{ k.count }}</td></tr>
          </tbody>
        </table>
      </div>
      <div class="card" style="margin-top:1rem;">
        <h3 style="margin-top:0;">Findings by severity / category</h3>
        <p>Severity:
          <span *ngFor="let key of severityKeys()" style="margin-right:0.75rem;">{{ key }}: {{ data.bySeverity[key] }}</span>
        </p>
        <p>Category:
          <span *ngFor="let key of categoryKeys()" style="margin-right:0.75rem;">{{ key }}: {{ data.byCategory[key] }}</span>
        </p>
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private api = inject(ApiService);
  private ctx = inject(ScanContextService);

  scans: ScanSummary[] = [];
  scanId: string | null = null;
  data?: DashboardResponse;

  ngOnInit(): void {
    this.api.scans().subscribe((s) => {
      this.scans = s;
      const stored = this.ctx.get() ?? s[0]?.id ?? null;
      if (stored) this.select(stored);
    });
  }

  select(id: string) {
    this.scanId = id;
    this.ctx.set(id);
    this.api.dashboard(id).subscribe((d) => (this.data = d));
  }

  severityKeys() { return this.data ? Object.keys(this.data.bySeverity) : []; }
  categoryKeys() { return this.data ? Object.keys(this.data.byCategory) : []; }
}
