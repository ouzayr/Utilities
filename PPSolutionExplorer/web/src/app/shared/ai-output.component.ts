import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { AiOutput } from '../core/models';

/** Renders an AI output with its provenance. Never shown without model, prompt version and timestamp. */
@Component({
  selector: 'app-ai-output',
  imports: [DatePipe],
  template: `
    @let o = output();
    <div class="ai-block" [class.failed]="o.aiStatus === 'failed'">
      <div class="ai-label">
        AI-generated · {{ o.kind }} · {{ o.model }} · {{ o.promptName }} v{{ o.promptVersion }} · {{ o.createdAt | date: 'short' }}
      </div>
      @if (o.aiStatus === 'failed') {
        <p class="error">Failed: {{ o.error }}</p>
      } @else {
        @for (line of lines(); track $index) {
          <p>{{ line }}</p>
        }
      }
      <div class="muted">Model output. Verify before relying on it.</div>
    </div>
  `,
})
export class AiOutputComponent {
  readonly output = input.required<AiOutput>();

  protected readonly lines = computed(() => {
    const content = this.output().content;
    if (!content) {
      return [];
    }
    try {
      return flatten(JSON.parse(content));
    } catch {
      return [content];
    }
  });
}

function flatten(value: unknown, label = ''): string[] {
  if (value === null || value === undefined) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => flatten(v, label ? `${label} ${i + 1}` : ''));
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('tag' in obj) {
      return [`${obj['tag']}${obj['inVocabulary'] ? '' : ' (new)'} — ${obj['reason'] ?? ''}`];
    }
    return Object.entries(obj).flatMap(([k, v]) => flatten(v, k));
  }
  return [label ? `${label}: ${value}` : String(value)];
}
