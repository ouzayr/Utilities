import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ScanContextService {
  readonly currentScanId = signal<string | null>(null);

  set(scanId: string | null) { this.currentScanId.set(scanId); }
  get(): string | null { return this.currentScanId(); }
}
