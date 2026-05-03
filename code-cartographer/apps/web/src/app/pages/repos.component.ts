import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, BrowseResponse, FsEntry } from '../api.service';

@Component({
  selector: 'cc-repos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="card">
      <h2 style="margin-top:0;">Repositories</h2>
      <p style="color:var(--muted)">List the folders or remote URLs the scanner should analyse.</p>
      <table *ngIf="repos.length">
        <thead><tr><th>Name</th><th>Side</th><th>Source</th><th>Location</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let r of repos">
            <td>{{ r.name }}</td>
            <td>{{ r.side }}</td>
            <td>{{ r.sourceKind }}</td>
            <td><code>{{ r.location }}</code></td>
            <td><button class="btn danger-text" (click)="deleteRepo(r.id)">Remove</button></td>
          </tr>
        </tbody>
      </table>
      <p *ngIf="!repos.length" style="color:var(--muted)">No repos yet.</p>
    </div>

    <div class="card" style="margin-top:1rem;">
      <h3 style="margin-top:0;">Add a repository</h3>

      <div *ngIf="message" [style.color]="messageIsError ? 'var(--danger, #e74c3c)' : 'var(--success, #27ae60)'"
           style="margin-bottom:0.75rem;font-weight:500;">
        {{ message }}
      </div>

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
            <select class="btn" [(ngModel)]="form.sourceKind" name="sourceKind" (ngModelChange)="onSourceKindChange()">
              <option value="local">local folder</option>
              <option value="github">github</option>
              <option value="azuredevops">azure devops</option>
            </select>
          </label>
          <label>
            {{ form.sourceKind === 'local' ? 'Folder path' : 'Repository URL' }}
            <div style="display:flex;gap:0.25rem;">
              <input class="btn" style="flex:1;" [(ngModel)]="form.location" name="location" required
                     [placeholder]="form.sourceKind === 'local' ? 'C:\\\\Projects\\\\my-app' : 'https://github.com/org/repo'" />
              <button *ngIf="form.sourceKind === 'local'" type="button" class="btn" style="white-space:nowrap;"
                      (click)="openBrowser()">Browse</button>
            </div>
          </label>
        </div>
        <button class="btn primary" style="margin-top:0.75rem;" type="submit" [disabled]="adding">
          {{ adding ? 'Adding...' : 'Add' }}
        </button>
      </form>
    </div>

    <!-- folder browser modal -->
    <div *ngIf="browserOpen" class="modal-backdrop" (click)="closeBrowser()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem;">
          <h3 style="margin:0;">Browse Folders</h3>
          <button class="btn" (click)="closeBrowser()">&times;</button>
        </div>

        <div *ngIf="browserPath" style="margin-bottom:0.5rem;">
          <code style="word-break:break-all;">{{ browserPath }}</code>
        </div>

        <div *ngIf="browserHints" style="margin-bottom:0.5rem;display:flex;gap:0.5rem;flex-wrap:wrap;">
          <span *ngIf="browserHints.isGitRepo" class="badge">Git repo</span>
          <span *ngIf="browserHints.hasAngularJson" class="badge badge-ui">Angular</span>
          <span *ngIf="browserHints.hasSln || browserHints.hasCsproj" class="badge badge-api">.NET</span>
          <span *ngIf="browserHints.hasPackageJson" class="badge">Node.js</span>
        </div>

        <div *ngIf="browserLoading" style="padding:1rem;color:var(--muted);">Loading...</div>
        <div *ngIf="browserError" style="padding:0.5rem;color:var(--danger, #e74c3c);">{{ browserError }}</div>

        <div *ngIf="!browserLoading" class="browser-list">
          <div *ngIf="browserPath" class="browser-item" (click)="navigateUp()">
            <span style="margin-right:0.5rem;">&#x1F4C1;</span> ..
          </div>
          <div *ngFor="let entry of browserEntries" class="browser-item" (dblclick)="navigateTo(entry.path)">
            <span style="margin-right:0.5rem;">{{ entry.type === 'drive' ? '&#x1F4BD;' : '&#x1F4C1;' }}</span>
            {{ entry.name || entry.path }}
          </div>
          <div *ngIf="!browserEntries.length && !browserLoading" style="padding:0.75rem;color:var(--muted);">
            No subdirectories found.
          </div>
        </div>

        <div style="display:flex;gap:0.5rem;margin-top:0.75rem;justify-content:flex-end;">
          <button class="btn" (click)="closeBrowser()">Cancel</button>
          <button class="btn primary" [disabled]="!browserPath" (click)="selectBrowserPath()">Select this folder</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex;
      align-items: center; justify-content: center; z-index: 1000;
    }
    .modal-content {
      background: var(--bg, #1e1e1e); border: 1px solid var(--border, #333);
      border-radius: 8px; padding: 1.25rem; width: 600px; max-width: 95vw; max-height: 80vh;
      display: flex; flex-direction: column;
    }
    .browser-list {
      flex: 1; overflow-y: auto; border: 1px solid var(--border, #333); border-radius: 4px;
      max-height: 400px; min-height: 200px;
    }
    .browser-item {
      padding: 0.4rem 0.75rem; cursor: pointer; display: flex; align-items: center;
      border-bottom: 1px solid var(--border, #222);
    }
    .browser-item:hover { background: var(--hover, rgba(255,255,255,0.05)); }
    .badge {
      font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 4px;
      background: var(--border, #333); color: var(--fg, #ccc);
    }
    .badge-ui { background: #1565c0; color: #fff; }
    .badge-api { background: #6a1b9a; color: #fff; }
    .danger-text { color: var(--danger, #e74c3c); background: none; border: none; cursor: pointer; }
    .danger-text:hover { text-decoration: underline; }
  `],
})
export class ReposComponent implements OnInit {
  private api = inject(ApiService);
  repos: Array<{ id: string; name: string; side: string; sourceKind: string; location: string }> = [];
  form = { name: '', side: 'both', sourceKind: 'local', location: '' };
  adding = false;
  message = '';
  messageIsError = false;

  // browser state
  browserOpen = false;
  browserPath: string | null = null;
  browserEntries: FsEntry[] = [];
  browserHints: BrowseResponse['hints'] = null;
  browserLoading = false;
  browserError = '';

  ngOnInit(): void {
    this.refresh();
  }

  refresh() {
    this.api.repos().subscribe({
      next: (r) => (this.repos = r),
      error: () => this.showMsg('Failed to load repositories.', true),
    });
  }

  add() {
    if (!this.form.name.trim() || !this.form.location.trim()) {
      this.showMsg('Name and location are required.', true);
      return;
    }
    this.adding = true;
    this.message = '';
    this.api.addRepo(this.form).subscribe({
      next: () => {
        this.showMsg(`Repository "${this.form.name}" added successfully.`, false);
        this.form = { name: '', side: 'both', sourceKind: 'local', location: '' };
        this.refresh();
        this.adding = false;
      },
      error: (err) => {
        const detail = err?.error?.title || err?.error?.detail || err?.message || 'Unknown error';
        this.showMsg(`Failed to add repository: ${detail}`, true);
        this.adding = false;
      },
    });
  }

  deleteRepo(id: string) {
    this.api.deleteRepo(id).subscribe({
      next: () => {
        this.showMsg('Repository removed.', false);
        this.refresh();
      },
      error: () => this.showMsg('Failed to remove repository.', true),
    });
  }

  onSourceKindChange() {
    this.form.location = '';
  }

  // --- folder browser ---
  openBrowser() {
    this.browserOpen = true;
    this.browserError = '';
    this.loadBrowser(this.form.location || undefined);
  }

  closeBrowser() {
    this.browserOpen = false;
  }

  selectBrowserPath() {
    if (this.browserPath) {
      this.form.location = this.browserPath;
      if (!this.form.name && this.browserPath) {
        const parts = this.browserPath.replace(/[\\/]+$/, '').split(/[\\/]/);
        this.form.name = parts[parts.length - 1] || '';
      }
      if (this.browserHints) {
        if (this.browserHints.hasAngularJson) this.form.side = 'ui';
        else if (this.browserHints.hasSln || this.browserHints.hasCsproj) this.form.side = 'api';
      }
    }
    this.browserOpen = false;
  }

  navigateTo(path: string) {
    this.loadBrowser(path);
  }

  navigateUp() {
    if (!this.browserPath) return;
    const sep = this.browserPath.includes('\\') ? '\\' : '/';
    const parts = this.browserPath.split(sep).filter(Boolean);
    if (parts.length <= 1) {
      this.loadBrowser(undefined);
    } else {
      parts.pop();
      let parent = parts.join(sep);
      if (this.browserPath.startsWith(sep)) parent = sep + parent;
      if (/^[A-Za-z]:$/.test(parent)) parent += sep;
      this.loadBrowser(parent);
    }
  }

  private loadBrowser(path?: string) {
    this.browserLoading = true;
    this.browserError = '';
    this.api.browse(path).subscribe({
      next: (res) => {
        this.browserPath = res.currentPath;
        this.browserEntries = res.entries;
        this.browserHints = res.hints ?? null;
        this.browserLoading = false;
      },
      error: (err) => {
        this.browserError = err?.error?.error || err?.message || 'Failed to browse directory';
        this.browserLoading = false;
      },
    });
  }

  private showMsg(msg: string, isError: boolean) {
    this.message = msg;
    this.messageIsError = isError;
  }
}
