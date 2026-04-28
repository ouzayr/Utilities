import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { ApiService, GraphEdge, GraphNode } from '../api.service';
import { ScanContextService } from '../scan-context.service';

interface EndpointRow {
  node: GraphNode;
  callers: GraphNode[];
  orphan: boolean;
}

@Component({
  selector: 'cc-endpoints',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <h2 style="margin-top:0;">API endpoints</h2>
      <p style="color:var(--muted)">Every controller action / minimal-API endpoint and the UI components/services that call it. Orphan endpoints (no UI caller) are flagged.</p>
      <table *ngIf="rows.length">
        <thead><tr><th>Verb</th><th>Route</th><th>Controller</th><th>Auth</th><th>Callers</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let r of rows" [class.warn]="r.orphan">
            <td>{{ r.node.meta['verb'] }}</td>
            <td><code>{{ r.node.meta['route'] }}</code></td>
            <td>{{ r.node.meta['controller'] || '—' }}</td>
            <td>{{ r.node.meta['authorize'] ? '✓' : (r.node.meta['allowAnonymous'] ? 'anon' : '—') }}</td>
            <td>
              <span *ngIf="r.orphan" style="color:var(--warn);">orphan</span>
              <span *ngIf="!r.orphan">{{ r.callers.length }}</span>
            </td>
            <td>
              <details *ngIf="r.callers.length">
                <summary>show</summary>
                <ul>
                  <li *ngFor="let c of r.callers">{{ c.name }} <small style="color:var(--muted)">({{ c.filePath }})</small></li>
                </ul>
              </details>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
  styles: [`tr.warn td { background: rgba(210, 153, 34, 0.08); }`],
})
export class EndpointsComponent implements OnInit {
  private api = inject(ApiService);
  private ctx = inject(ScanContextService);
  rows: EndpointRow[] = [];

  ngOnInit(): void {
    const id = this.ctx.get();
    if (!id) return;
    this.api.graph(id).subscribe((g) => {
      const byId = new Map(g.nodes.map((n) => [n.id, n] as const));
      const apiNodes = g.nodes.filter((n) => n.kind === 'dotnet-action' || n.kind === 'dotnet-endpoint');
      const httpEdges = g.edges.filter((e: GraphEdge) => e.kind === 'http-call');
      this.rows = apiNodes.map((node) => {
        const callers = httpEdges
          .filter((e) => e.target === node.id)
          .map((e) => byId.get(e.source))
          .filter((n): n is GraphNode => Boolean(n));
        return { node, callers, orphan: callers.length === 0 };
      });
    });
  }
}
