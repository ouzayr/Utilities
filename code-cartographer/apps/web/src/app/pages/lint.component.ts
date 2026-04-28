import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, FindingDto } from '../api.service';
import { ScanContextService } from '../scan-context.service';

@Component({
  selector: 'cc-lint',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.75rem;">
      <select class="btn" [(ngModel)]="severity" (change)="reload()">
        <option value="">all severities</option>
        <option value="error">error</option>
        <option value="warn">warn</option>
        <option value="info">info</option>
      </select>
      <select class="btn" [(ngModel)]="category" (change)="reload()">
        <option value="">all categories</option>
        <option value="dead-code">dead-code</option>
        <option value="layering">layering</option>
        <option value="scss">scss</option>
        <option value="security">security</option>
        <option value="perf">perf</option>
        <option value="architecture">architecture</option>
      </select>
      <span style="color:var(--muted)">{{ findings.length }} findings</span>
    </div>
    <div class="card">
      <table *ngIf="findings.length">
        <thead><tr><th>Severity</th><th>Category</th><th>Rule</th><th>Title</th><th>File</th></tr></thead>
        <tbody>
          <tr *ngFor="let f of findings">
            <td><span [class]="'severity-' + f.severity">{{ f.severity }}</span></td>
            <td>{{ f.category }}</td>
            <td><code>{{ f.ruleId }}</code></td>
            <td>{{ f.title }}<br /><small style="color:var(--muted)">{{ f.detail }}</small></td>
            <td><code>{{ f.filePath }}:{{ f.line }}</code></td>
          </tr>
        </tbody>
      </table>
      <p *ngIf="!findings.length" style="color:var(--muted)">No findings.</p>
    </div>
  `,
})
export class LintComponent implements OnInit {
  private api = inject(ApiService);
  private ctx = inject(ScanContextService);
  findings: FindingDto[] = [];
  severity = '';
  category = '';
  ngOnInit(): void { this.reload(); }
  reload() {
    const id = this.ctx.get();
    if (!id) return;
    this.api.findings(id, { severity: this.severity || undefined, category: this.category || undefined }).subscribe((f) => (this.findings = f));
  }
}
