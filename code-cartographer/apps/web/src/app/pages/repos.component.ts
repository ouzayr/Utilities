import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../api.service';

@Component({
  selector: 'cc-repos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="card">
      <h2 style="margin-top:0;">Repositories</h2>
      <p style="color:var(--muted)">List the folders or remote URLs the scanner should analyse. Local paths must be reachable from the scanner container if you're running with Docker.</p>
      <table *ngIf="repos.length">
        <thead><tr><th>Name</th><th>Side</th><th>Source</th><th>Location</th></tr></thead>
        <tbody>
          <tr *ngFor="let r of repos">
            <td>{{ r.name }}</td>
            <td>{{ r.side }}</td>
            <td>{{ r.sourceKind }}</td>
            <td><code>{{ r.location }}</code></td>
          </tr>
        </tbody>
      </table>
      <p *ngIf="!repos.length" style="color:var(--muted)">No repos yet.</p>
    </div>

    <div class="card" style="margin-top:1rem;">
      <h3 style="margin-top:0;">Add a repository</h3>
      <form (ngSubmit)="add()">
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:0.5rem;max-width:720px;">
          <label>Name <input class="btn" [(ngModel)]="form.name" name="name" required /></label>
          <label>Side
            <select class="btn" [(ngModel)]="form.side" name="side">
              <option value="ui">ui</option>
              <option value="api">api</option>
              <option value="both">both</option>
            </select>
          </label>
          <label>Source kind
            <select class="btn" [(ngModel)]="form.sourceKind" name="sourceKind">
              <option value="local">local folder</option>
              <option value="github">github</option>
              <option value="azuredevops">azure devops</option>
            </select>
          </label>
          <label>Location <input class="btn" [(ngModel)]="form.location" name="location" required /></label>
        </div>
        <button class="btn primary" style="margin-top:0.75rem;" type="submit">Add</button>
      </form>
    </div>
  `,
})
export class ReposComponent implements OnInit {
  private api = inject(ApiService);
  repos: Array<{ id: string; name: string; side: string; sourceKind: string; location: string }> = [];
  form = { name: '', side: 'both', sourceKind: 'local', location: '' };

  ngOnInit(): void {
    this.refresh();
  }
  refresh() { this.api.repos().subscribe((r) => (this.repos = r)); }
  add() {
    this.api.addRepo(this.form).subscribe(() => {
      this.form = { name: '', side: 'both', sourceKind: 'local', location: '' };
      this.refresh();
    });
  }
}
