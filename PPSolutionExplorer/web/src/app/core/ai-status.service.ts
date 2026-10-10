import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { AiStatus } from './models';

/** Shared AI availability. All AI UI is hidden or disabled when AI is off; core features never depend on it. */
@Injectable({ providedIn: 'root' })
export class AiStatusService {
  private readonly api = inject(ApiService);
  readonly status = signal<AiStatus | null>(null);

  refresh(): void {
    this.api.aiStatus().subscribe({
      next: (s) => this.status.set(s),
      error: () => this.status.set(null),
    });
  }

  enabled(): boolean {
    return this.status()?.enabled === true;
  }
}
