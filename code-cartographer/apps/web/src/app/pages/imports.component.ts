import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ApiService } from '../api.service';

@Component({
  selector: 'cc-imports',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <h2 style="margin-top:0;">Import a previous scan</h2>
      <p style="color:var(--muted)">Drop a previously exported <code>scan.json</code> here. It becomes a new scan in the database (status <code>imported</code>) and is available everywhere — Dashboard, Diffs, Trends — to compare against your current code.</p>
      <input type="file" accept="application/json,.json" (change)="onFile($event)" />
      <p *ngIf="message" style="margin-top:0.75rem;">{{ message }}</p>
    </div>
  `,
})
export class ImportsComponent {
  private api = inject(ApiService);
  message = '';

  async onFile(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (!f) return;
    const text = await f.text();
    this.api.importScan(text).subscribe({
      next: (r) => { this.message = `Imported as scan ${r.scanId}.`; },
      error: (e: unknown) => { this.message = `Import failed: ${(e as { message?: string }).message ?? String(e)}`; },
    });
  }
}
