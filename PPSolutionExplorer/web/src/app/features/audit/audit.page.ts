import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ApiService, errorMessage } from '../../core/api.service';
import { AuditEntry } from '../../core/models';

@Component({
  selector: 'app-audit-page',
  imports: [DatePipe],
  template: `
    <h1>Audit log</h1>
    <p class="muted">Changes made through this tool (imports, tags, notes, AI requests and accepted suggestions). Append-only.</p>
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
    <table>
      <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
      <tbody>
        @for (a of entries(); track a.id) {
          <tr><td>{{ a.at | date: 'medium' }}</td><td>{{ a.actor }}</td><td>{{ a.action }}</td><td><code>{{ a.target }}</code></td><td>{{ a.details }}</td></tr>
        } @empty {
          <tr><td colspan="5" class="muted">No entries.</td></tr>
        }
      </tbody>
    </table>
  `,
})
export class AuditPage implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly entries = signal<AuditEntry[]>([]);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.api.audit().subscribe({ next: (a) => this.entries.set(a), error: (e) => this.error.set(errorMessage(e)) });
  }
}
