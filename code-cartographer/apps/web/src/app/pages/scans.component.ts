import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { ApiService, ScanSummary } from '../api.service';
import { ScanContextService } from '../scan-context.service';

@Component({
  selector: 'cc-scans',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <h2 style="margin-top:0;">Scans</h2>
      <table *ngIf="scans.length">
        <thead><tr><th>Started</th><th>Label</th><th>Status</th><th>Nodes</th><th>Edges</th><th>Findings</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let s of scans" [class.active]="s.id === ctx.get()">
            <td>{{ s.startedAt | date:'short' }}</td>
            <td>{{ s.label }}</td>
            <td>{{ s.status }}</td>
            <td>{{ s.summary.nodes ?? '-' }}</td>
            <td>{{ s.summary.edges ?? '-' }}</td>
            <td>{{ s.summary.findings ?? '-' }}</td>
            <td>
              <button class="btn" (click)="select(s.id)">Use</button>
              <button class="btn" (click)="remove(s.id)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p *ngIf="!scans.length" style="color:var(--muted)">No scans yet.</p>
    </div>
  `,
})
export class ScansComponent implements OnInit {
  private api = inject(ApiService);
  ctx = inject(ScanContextService);
  scans: ScanSummary[] = [];

  ngOnInit(): void { this.refresh(); }
  refresh() { this.api.scans().subscribe((s) => (this.scans = s)); }
  select(id: string) { this.ctx.set(id); }
  remove(id: string) { this.api.deleteScan(id).subscribe(() => this.refresh()); }
}
