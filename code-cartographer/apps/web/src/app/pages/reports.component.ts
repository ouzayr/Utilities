import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, ScanSummary } from '../api.service';
import { ScanContextService } from '../scan-context.service';

@Component({
  selector: 'cc-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="card">
      <h2 style="margin-top:0;">Reports & export</h2>
      <p style="color:var(--muted)">Export the current scan as a Markdown architecture report, an HTML page, or raw JSON. JSON exports can be re-imported on the Imports tab.</p>
      <div style="display:flex;gap:0.5rem;align-items:center;">
        <select class="btn" [(ngModel)]="scanId">
          <option *ngFor="let s of scans" [value]="s.id">{{ s.startedAt | date:'short' }} · {{ s.label }}</option>
        </select>
        <button class="btn" (click)="download('json')">Export JSON</button>
        <button class="btn" (click)="download('md')">Export Markdown</button>
        <button class="btn" (click)="download('html')">Export HTML</button>
      </div>
      <p style="margin-top:0.75rem;color:var(--muted)">A trends chart of node/edge/finding counts across recent scans is available on the Dashboard's "Trends" tab.</p>
    </div>
  `,
})
export class ReportsComponent implements OnInit {
  private api = inject(ApiService);
  private ctx = inject(ScanContextService);
  scans: ScanSummary[] = [];
  scanId = '';

  ngOnInit(): void {
    this.api.scans().subscribe((s) => {
      this.scans = s;
      this.scanId = this.ctx.get() ?? s[0]?.id ?? '';
    });
  }

  download(fmt: 'json' | 'md' | 'html') {
    if (!this.scanId) return;
    this.api.exportReport(this.scanId, fmt).subscribe((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `scan-${this.scanId}.${fmt === 'md' ? 'md' : fmt}`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }
}
