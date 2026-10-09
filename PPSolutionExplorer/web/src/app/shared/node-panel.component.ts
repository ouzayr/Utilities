import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AiStatusService } from '../core/ai-status.service';
import { ApiService, errorMessage } from '../core/api.service';
import { AiJob, AiOutput, CONTAINER_TYPES, NodeDetail } from '../core/models';
import { AiOutputComponent } from './ai-output.component';

/** Node detail: properties, links, unresolved references, tags, notes, raw JSON and AI outputs. */
@Component({
  selector: 'app-node-panel',
  imports: [FormsModule, RouterLink, DatePipe, AiOutputComponent],
  template: `
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
    @if (detail(); as d) {
      <div class="card">
        <h3>{{ d.node.name }}</h3>
        <div class="muted">{{ d.node.type }}{{ d.node.subType ? ' · ' + d.node.subType : '' }}{{ d.node.operation ? ' · ' + d.node.operation : '' }}</div>
        @if (d.node.branch) {
          <div class="muted">Branch: {{ d.node.branch }}</div>
        }
        <div class="muted"><code>{{ d.node.id }}</code></div>
        <div class="row" style="margin-top:.5rem">
          <a class="button" [routerLink]="['/imports', importId(), 'impact']" [queryParams]="{ nodeId: d.node.id }">Impact analysis</a>
          @if (isStep()) {
            <button (click)="traceFrom.emit(d.node.id)">Trace from here</button>
            <button (click)="traceTo.emit(d.node.id)">Trace to here</button>
          }
        </div>
      </div>

      @if (d.unresolved.length) {
        <div class="card">
          <h3 class="unresolved">Unresolved references</h3>
          @for (u of d.unresolved; track $index) {
            <div><strong>{{ u.reason }}</strong><pre>{{ u.rawExpression }}</pre></div>
          }
        </div>
      }

      <div class="card">
        <h3>Tags</h3>
        <div>
          @for (t of d.tags; track t.id) {
            <span class="chip" [class.ai]="t.source === 'ai-accepted'" [title]="t.source">{{ t.tag }}
              <button (click)="removeTag(t.id)" aria-label="Remove tag">×</button></span>
          }
        </div>
        <form class="row" (ngSubmit)="addTag()">
          <input name="tag" [(ngModel)]="newTag" placeholder="Add tag" maxlength="64" />
          <button type="submit" [disabled]="!newTag.trim()">Add</button>
        </form>
      </div>

      <div class="card">
        <h3>Notes</h3>
        @for (n of d.notes; track n.id) {
          <div class="row" style="justify-content:space-between">
            <span>{{ n.text }}</span>
            <span class="muted">{{ n.updatedAt | date: 'short' }} <button (click)="removeNote(n.id)">Delete</button></span>
          </div>
        }
        <form (ngSubmit)="addNote()">
          <textarea name="note" [(ngModel)]="newNote" placeholder="Add a note (stored locally, never in the solution)"></textarea>
          <button type="submit" [disabled]="!newNote.trim()">Save note</button>
        </form>
      </div>

      @if (aiStatus.enabled()) {
        <div class="card">
          <h3>AI</h3>
          <div class="row">
            @if (d.node.type === 'Flow') {
              <button class="ai-button" (click)="runJob('flow-summary')">Summarise flow</button>
            }
            @if (isStep()) {
              <button class="ai-button" (click)="streamDescription()">Describe step</button>
            }
            <button class="ai-button" (click)="runJob('tag-suggestions')">Suggest tags</button>
          </div>
          @if (job(); as j) {
            <p class="muted">Job {{ j.kind }}: {{ j.status }} {{ j.total > 1 ? '(' + j.progress + '/' + j.total + ')' : '' }} {{ j.error ?? '' }}</p>
          }
          @if (streaming()) {
            <div class="ai-block"><div class="ai-label">AI-generated · streaming…</div><p>{{ streamText() }}</p></div>
          }
          @for (o of d.ai; track o.id) {
            <app-ai-output [output]="o" />
            @if (o.kind === 'tag-suggestions' && o.aiStatus === 'succeeded') {
              <div class="row">
                @for (s of suggestions(o); track s) {
                  <button class="ai-button" (click)="acceptTag(o.id, s)" [disabled]="hasTag(s)">Accept "{{ s }}"</button>
                }
              </div>
            }
          }
        </div>
      }

      <div class="card">
        <h3>Links</h3>
        <table>
          <tbody>
            @for (e of d.outgoing; track $index) {
              <tr><td>→ {{ e.type }}{{ e.status !== 'None' ? ' [' + e.status + ']' : '' }}</td><td><code>{{ e.targetId }}</code></td></tr>
            }
            @for (e of d.incoming; track $index) {
              <tr><td>← {{ e.type }}{{ e.status !== 'None' ? ' [' + e.status + ']' : '' }}</td><td><code>{{ e.sourceId }}</code></td></tr>
            }
          </tbody>
        </table>
      </div>

      @if (propertyEntries().length) {
        <div class="card">
          <h3>Properties</h3>
          <table><tbody>
            @for (p of propertyEntries(); track p[0]) {
              <tr><td>{{ p[0] }}</td><td>{{ p[1] }}</td></tr>
            }
          </tbody></table>
        </div>
      }

      @if (rawJson()) {
        <div class="card">
          <h3>Raw source</h3>
          <pre>{{ rawJson() }}</pre>
        </div>
      }
    }
  `,
})
export class NodePanelComponent {
  private readonly api = inject(ApiService);
  protected readonly aiStatus = inject(AiStatusService);

  readonly importId = input.required<string>();
  readonly nodeId = input.required<string>();
  readonly traceFrom = output<string>();
  readonly traceTo = output<string>();

  protected readonly detail = signal<NodeDetail | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly job = signal<AiJob | null>(null);
  protected readonly streaming = signal(false);
  protected readonly streamText = signal('');
  protected newTag = '';
  protected newNote = '';

  protected readonly isStep = computed(() => {
    const type = this.detail()?.node.type;
    return type === 'Trigger' || type === 'Action' || type === 'Unknown' || (!!type && CONTAINER_TYPES.includes(type));
  });

  protected readonly propertyEntries = computed(() =>
    Object.entries(this.detail()?.node.properties ?? {}).filter(([k]) => k !== 'solutionMetadata'),
  );

  protected readonly rawJson = computed(() => {
    const raw = this.detail()?.node.rawJson;
    if (!raw) {
      return null;
    }
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  });

  constructor() {
    effect(() => this.load(this.importId(), this.nodeId()));
  }

  private load(importId: string, nodeId: string): void {
    this.error.set(null);
    this.api.node(importId, nodeId).subscribe({
      next: (d) => this.detail.set(d),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  private reload(): void {
    this.load(this.importId(), this.nodeId());
  }

  protected addTag(): void {
    this.api.addTag(this.nodeId(), this.newTag).subscribe({
      next: () => { this.newTag = ''; this.reload(); },
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  protected removeTag(id: number): void {
    this.api.removeTag(id).subscribe(() => this.reload());
  }

  protected addNote(): void {
    this.api.addNote(this.nodeId(), this.newNote).subscribe({
      next: () => { this.newNote = ''; this.reload(); },
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  protected removeNote(id: number): void {
    this.api.removeNote(id).subscribe(() => this.reload());
  }

  protected hasTag(tag: string): boolean {
    return this.detail()?.tags.some((t) => t.tag === tag) ?? false;
  }

  protected suggestions(output: AiOutput): string[] {
    try {
      return (JSON.parse(output.content ?? '{}').tags ?? []).map((t: { tag: string }) => t.tag);
    } catch {
      return [];
    }
  }

  /** Suggestions are only applied when the user accepts them one by one. */
  protected acceptTag(outputId: string, tag: string): void {
    this.api.acceptTag(outputId, tag).subscribe({ next: () => this.reload(), error: (e) => this.error.set(errorMessage(e)) });
  }

  protected runJob(kind: string): void {
    this.api.aiJob(kind, this.importId(), this.nodeId()).subscribe({
      next: (job) => { this.job.set(job); this.poll(job.id); },
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  private poll(id: string): void {
    const timer = setInterval(() => {
      this.api.aiJobStatus(id).subscribe((job) => {
        this.job.set(job);
        if (job.status === 'succeeded' || job.status === 'failed') {
          clearInterval(timer);
          this.reload();
        }
      });
    }, 2000);
  }

  protected streamDescription(): void {
    this.streaming.set(true);
    this.streamText.set('');
    const source = new EventSource(this.api.describeStreamUrl(this.importId(), this.nodeId()));
    source.onmessage = (event) => this.streamText.update((t) => t + JSON.parse(event.data));
    source.addEventListener('done', () => { source.close(); this.streaming.set(false); this.reload(); });
    source.onerror = () => { source.close(); this.streaming.set(false); this.reload(); };
  }
}
