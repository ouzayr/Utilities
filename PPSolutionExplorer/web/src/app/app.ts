import { Component, OnInit, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AiStatusService } from './core/ai-status.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  template: `
    <header class="topbar">
      <a routerLink="/" class="brand">PP Solution Explorer</a>
      <span class="spacer"></span>
      @let ai = aiStatus.status();
      <span class="pill" [class.pill-ai]="ai?.enabled && ai?.reachable" [title]="ai?.error ?? ''">
        AI: {{ !ai ? 'unknown' : !ai.enabled ? 'off' : ai.reachable ? (ai.model ?? 'on') : 'unreachable' }}
      </span>
    </header>
    <main><router-outlet /></main>
  `,
})
export class App implements OnInit {
  protected readonly aiStatus = inject(AiStatusService);

  ngOnInit(): void {
    this.aiStatus.refresh();
  }
}
