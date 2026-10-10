import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../../core/api.service';
import { ImportSummary } from '../../core/models';

@Component({
  selector: 'app-imports-page',
  imports: [RouterLink, DatePipe],
  template: `
    <h1>Imports</h1>
    <div class="card">
      <h3>Import a solution or flow</h3>
      <p class="muted">
        Solution export (.zip), legacy flow package (.zip) or flow definition (.json). The file is parsed in memory;
        nothing is written back to the environment.
      </p>
      <div class="row">
        <input type="file" accept=".zip,.json" (change)="onFile($event)" [disabled]="uploading()" />
        @if (uploading()) {
          <span class="muted">Parsing…</span>
        }
      </div>
      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
    </div>

    <table>
      <thead>
        <tr><th>Name</th><th>Kind</th><th>Version</th><th>File</th><th>Imported</th><th>Nodes</th><th>Unresolved</th><th></th></tr>
      </thead>
      <tbody>
        @for (i of imports(); track i.id) {
          <tr>
            <td><a [routerLink]="['/imports', i.id]">{{ i.name }}</a></td>
            <td>{{ i.kind }}</td>
            <td>{{ i.version ?? '-' }}</td>
            <td>{{ i.fileName }}</td>
            <td>{{ i.importedAt | date: 'short' }}</td>
            <td>{{ i.nodeCount }}</td>
            <td [class.unresolved]="i.unresolvedCount > 0">{{ i.unresolvedCount }}</td>
            <td><button (click)="remove(i)" title="Removes our copy only">Delete</button></td>
          </tr>
        } @empty {
          <tr><td colspan="8" class="muted">No imports yet.</td></tr>
        }
      </tbody>
    </table>
  `,
})
export class ImportsPage implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly imports = signal<ImportSummary[]>([]);
  protected readonly uploading = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.api.imports().subscribe({ next: (i) => this.imports.set(i), error: (e) => this.error.set(errorMessage(e)) });
  }

  protected onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.uploading.set(true);
    this.error.set(null);
    this.api.upload(file).subscribe({
      next: () => { this.uploading.set(false); input.value = ''; this.load(); },
      error: (e) => { this.uploading.set(false); this.error.set(errorMessage(e)); },
    });
  }

  protected remove(item: ImportSummary): void {
    if (confirm(`Delete import "${item.name}"? Tags and notes are kept.`)) {
      this.api.deleteImport(item.id).subscribe(() => this.load());
    }
  }
}
