import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, ScanSummary } from '../api.service';

@Component({
  selector: 'cc-diff',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="card">
      <h2 style="margin-top:0;">Snapshot diff</h2>
      <p style="color:var(--muted)">Compare any two scans. Same scan IDs you exported as JSON can also be re-imported on the Imports page and diffed against the current scan.</p>
      <div style="display:flex;gap:0.5rem;">
        <select class="btn" [(ngModel)]="left">
          <option value="">left scan…</option>
          <option *ngFor="let s of scans" [value]="s.id">{{ s.startedAt | date:'short' }} · {{ s.label }}</option>
        </select>
        <select class="btn" [(ngModel)]="right">
          <option value="">right scan…</option>
          <option *ngFor="let s of scans" [value]="s.id">{{ s.startedAt | date:'short' }} · {{ s.label }}</option>
        </select>
        <button class="btn primary" [disabled]="!left || !right" (click)="run()">Diff</button>
      </div>
    </div>

    <div *ngIf="result" class="kpi-grid" style="margin-top:1rem;">
      <div class="card kpi"><div class="label">Added nodes</div><div class="value">{{ result.addedNodes.length }}</div></div>
      <div class="card kpi"><div class="label">Removed nodes</div><div class="value">{{ result.removedNodes.length }}</div></div>
      <div class="card kpi"><div class="label">Added edges</div><div class="value">{{ result.addedEdges.length }}</div></div>
      <div class="card kpi"><div class="label">Removed edges</div><div class="value">{{ result.removedEdges.length }}</div></div>
      <div class="card kpi"><div class="label">New findings</div><div class="value" style="color:var(--warn);">{{ result.newFindings.length }}</div></div>
      <div class="card kpi"><div class="label">Fixed findings</div><div class="value" style="color:var(--ok);">{{ result.fixedFindings.length }}</div></div>
      <div class="card kpi"><div class="label">Stable (still present)</div><div class="value">{{ result.stableFindings.length }}</div></div>
    </div>

    <div *ngIf="result" class="card" style="margin-top:1rem;">
      <h3>New findings</h3>
      <table>
        <thead><tr><th>Severity</th><th>Rule</th><th>Title</th></tr></thead>
        <tbody>
          <tr *ngFor="let f of result.newFindings"><td>{{ asAny(f).severity }}</td><td><code>{{ asAny(f).ruleId }}</code></td><td>{{ asAny(f).title }}</td></tr>
        </tbody>
      </table>
    </div>
  `,
})
export class DiffComponent implements OnInit {
  private api = inject(ApiService);
  scans: ScanSummary[] = [];
  left = '';
  right = '';
  result?: Awaited<ReturnType<ApiService['diff']>> extends import('rxjs').Observable<infer R> ? R : never;
  ngOnInit(): void { this.api.scans().subscribe((s) => (this.scans = s)); }
  run() { this.api.diff(this.left, this.right).subscribe((r) => (this.result = r as never)); }
  asAny(x: unknown): { severity: string; ruleId: string; title: string } { return x as { severity: string; ruleId: string; title: string }; }
}
