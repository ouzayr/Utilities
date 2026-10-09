import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AiJob, AiOutput, AiStatus, Facets, FlowGraph, ImpactResult, ImportSummary, NodeDetail, NodeSummary, NodeType, Note,
  PathRequest, PathResult, QualityFinding, SearchQuery, SearchResponse, Tag,
} from './models';

/** Thin typed wrapper over the backend. The backend is the only host the app talks to. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api';

  imports(): Observable<ImportSummary[]> {
    return this.http.get<ImportSummary[]>(`${this.base}/imports`);
  }

  import(id: string): Observable<ImportSummary> {
    return this.http.get<ImportSummary>(`${this.base}/imports/${id}`);
  }

  upload(file: File): Observable<ImportSummary> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<ImportSummary>(`${this.base}/imports`, form);
  }

  deleteImport(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/imports/${id}`);
  }

  nodes(importId: string, type: NodeType): Observable<NodeSummary[]> {
    return this.http.get<NodeSummary[]>(`${this.base}/imports/${importId}/nodes`, { params: { type } });
  }

  node(importId: string, nodeId: string): Observable<NodeDetail> {
    return this.http.get<NodeDetail>(`${this.base}/imports/${importId}/node`, { params: { nodeId } });
  }

  flowGraph(importId: string, flowId: string): Observable<FlowGraph> {
    return this.http.get<FlowGraph>(`${this.base}/imports/${importId}/flow-graph`, { params: { flowId } });
  }

  paths(importId: string, request: PathRequest): Observable<PathResult> {
    return this.http.post<PathResult>(`${this.base}/imports/${importId}/paths`, request);
  }

  impact(importId: string, nodeId: string, depth = 6): Observable<ImpactResult> {
    return this.http.get<ImpactResult>(`${this.base}/imports/${importId}/impact`, { params: { nodeId, depth } });
  }

  quality(importId: string, flowId: string): Observable<QualityFinding[]> {
    return this.http.get<QualityFinding[]>(`${this.base}/imports/${importId}/quality`, { params: { flowId } });
  }

  facets(importId: string): Observable<Facets> {
    return this.http.get<Facets>(`${this.base}/imports/${importId}/facets`);
  }

  search(query: SearchQuery): Observable<SearchResponse> {
    return this.http.post<SearchResponse>(`${this.base}/search`, query);
  }

  addTag(nodeId: string, tag: string): Observable<Tag> {
    return this.http.post<Tag>(`${this.base}/tags`, { nodeId, tag });
  }

  removeTag(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/tags/${id}`);
  }

  addNote(nodeId: string, text: string): Observable<Note> {
    return this.http.post<Note>(`${this.base}/notes`, { nodeId, text });
  }

  removeNote(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/notes/${id}`);
  }

  docsUrl(importId: string, format: 'md' | 'html', flowId?: string, includeEnvValues = false): string {
    let params = new HttpParams().set('format', format).set('includeEnvValues', includeEnvValues);
    if (flowId) {
      params = params.set('flowId', flowId);
    }
    return `${this.base}/imports/${importId}/docs?${params.toString()}`;
  }

  aiStatus(): Observable<AiStatus> {
    return this.http.get<AiStatus>(`${this.base}/ai/status`);
  }

  aiJob(kind: string, importId: string, nodeId: string): Observable<AiJob> {
    return this.http.post<AiJob>(`${this.base}/ai/jobs`, { kind, importId, nodeId });
  }

  aiJobStatus(id: string): Observable<AiJob> {
    return this.http.get<AiJob>(`${this.base}/ai/jobs/${id}`);
  }

  aiSearch(question: string, importId: string): Observable<SearchResponse> {
    return this.http.post<SearchResponse>(`${this.base}/ai/search`, { question, importId });
  }

  acceptTag(outputId: string, tag: string): Observable<Tag> {
    return this.http.post<Tag>(`${this.base}/ai/outputs/${outputId}/accept-tag`, { tag });
  }

  aiOutputs(nodeId: string): Observable<AiOutput[]> {
    return this.http.get<AiOutput[]>(`${this.base}/ai/outputs`, { params: { nodeId } });
  }

  describeStreamUrl(importId: string, nodeId: string): string {
    return `${this.base}/ai/describe/stream?${new HttpParams().set('importId', importId).set('nodeId', nodeId).toString()}`;
  }
}

export function errorMessage(error: unknown): string {
  const e = error as { error?: { title?: string }; message?: string };
  return e?.error?.title ?? e?.message ?? 'Request failed.';
}
