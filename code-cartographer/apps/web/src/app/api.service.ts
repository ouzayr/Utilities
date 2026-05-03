import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface ScanSummary {
  id: string;
  status: string;
  startedAt: string;
  finishedAt?: string | null;
  label?: string | null;
  summary: { nodes?: number; edges?: number; findings?: number; crossLinks?: number };
}

export interface GraphNode {
  id: string;
  kind: string;
  side: string;
  project: string;
  name: string;
  fqName: string;
  filePath: string;
  line?: number;
  meta: Record<string, unknown>;
  metrics?: Record<string, number>;
}
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: string;
  meta: Record<string, unknown>;
}
export interface GraphResponse {
  scanId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface DashboardResponse {
  totals: { nodes: number; edges: number; findings: number };
  kpis: { apiActions: number; orphanEndpoints: number; uiComponents: number; uiServices: number; crossLinks: number };
  byKind: Array<{ kind: string; count: number }>;
  byProject: Array<{ project: string; count: number }>;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
}

export interface FindingDto {
  id: string;
  ruleId: string;
  severity: 'info' | 'warn' | 'error';
  category: string;
  title: string;
  detail: string;
  nodeId?: string;
  filePath?: string;
  line?: number;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = '/api';

  setBase(b: string) { this.base = b; }

  scans(): Observable<ScanSummary[]> { return this.http.get<ScanSummary[]>(`${this.base}/scans`); }
  scan(id: string) { return this.http.get<{ scan: ScanSummary; nodeCount: number; edgeCount: number; findingCount: number }>(`${this.base}/scans/${id}`); }
  deleteScan(id: string) { return this.http.delete<void>(`${this.base}/scans/${id}`); }

  dashboard(scanId: string) { return this.http.get<DashboardResponse>(`${this.base}/dashboard/${scanId}`); }
  trends(limit = 20) { return this.http.get<Array<{ scanId: string; startedAt: string; nodes: number; edges: number; findings: number; label: string | null }>>(`${this.base}/dashboard/trends?limit=${limit}`); }

  graph(scanId: string, opts?: { side?: string; kind?: string; project?: string }) {
    let params = new HttpParams();
    if (opts?.side) params = params.set('side', opts.side);
    if (opts?.kind) params = params.set('kind', opts.kind);
    if (opts?.project) params = params.set('project', opts.project);
    return this.http.get<GraphResponse>(`${this.base}/graph/${scanId}`, { params });
  }
  flowFrom(scanId: string, nodeId: string, direction: 'upstream' | 'downstream' | 'both' = 'both') {
    const params = new HttpParams().set('scanId', scanId).set('nodeId', nodeId).set('direction', direction);
    return this.http.get<{ nodes: GraphNode[]; edges: GraphEdge[] }>(`${this.base}/flows/from`, { params });
  }
  impact(scanId: string, nodeId: string) {
    const params = new HttpParams().set('scanId', scanId).set('nodeId', nodeId);
    return this.http.get<{ root: string; impactedCount: number; summary: Array<{ side: string; kind: string; count: number }>; nodes: GraphNode[]; edges: GraphEdge[] }>(`${this.base}/impact`, { params });
  }
  diff(left: string, right: string) {
    return this.http.get<{
      addedNodes: Array<Record<string, unknown>>;
      removedNodes: Array<Record<string, unknown>>;
      addedEdges: Array<Record<string, unknown>>;
      removedEdges: Array<Record<string, unknown>>;
      newFindings: Array<Record<string, unknown>>;
      fixedFindings: Array<Record<string, unknown>>;
      stableFindings: Array<Record<string, unknown>>;
    }>(`${this.base}/diff/${left}/${right}`);
  }
  findings(scanId: string, opts?: { severity?: string; category?: string }) {
    let params = new HttpParams();
    if (opts?.severity) params = params.set('severity', opts.severity);
    if (opts?.category) params = params.set('category', opts.category);
    return this.http.get<FindingDto[]>(`${this.base}/scans/${scanId}/findings`, { params });
  }
  exportReport(scanId: string, format: 'json' | 'md' | 'html') {
    return this.http.get(`${this.base}/reports/${scanId}/export?format=${format}`, { responseType: 'blob' });
  }
  importScan(json: string) {
    return this.http.post<{ scanId: string }>(`${this.base}/scans/import`, json, { headers: { 'Content-Type': 'application/json' } });
  }
  repos() { return this.http.get<Array<{ id: string; name: string; side: string; sourceKind: string; location: string }>>(`${this.base}/repos`); }
  addRepo(payload: { name: string; side: string; sourceKind: string; location: string; includeGlobs?: string; excludeGlobs?: string }) {
    return this.http.post<{ id: string }>(`${this.base}/repos`, payload);
  }
  deleteRepo(id: string) { return this.http.delete<void>(`${this.base}/repos/${id}`); }

  browse(path?: string) {
    let params = new HttpParams();
    if (path) params = params.set('path', path);
    return this.http.get<BrowseResponse>(`${this.base}/fs/browse`, { params });
  }
}

export interface FsEntry {
  name: string;
  path: string;
  type: 'drive' | 'directory';
  side?: string | null;
}

export interface FolderHints {
  isGitRepo: boolean;
  hasAngularJson: boolean;
  hasSln: boolean;
  hasCsproj: boolean;
  hasPackageJson: boolean;
}

export interface BrowseResponse {
  currentPath: string | null;
  entries: FsEntry[];
  hints?: FolderHints | null;
}
