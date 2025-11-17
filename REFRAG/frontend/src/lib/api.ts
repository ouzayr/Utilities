/**
 * API client for REFRAG backend
 */
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Document interfaces
export interface Permission {
  users: string[];
  roles: string[];
  access_level: string;
}

export interface DocumentCreate {
  content: string;
  content_type: string;
  title: string;
  source: string;
  author?: string;
  version?: string;
  tags?: string[];
  permissions?: Permission;
  language?: string;
  file_type?: string;
  custom_metadata?: Record<string, any>;
}

export interface QueryRequest {
  query: string;
  user_id?: string;
  user_roles?: string[];
  content_types?: string[];
  tags?: string[];
  top_k?: number;
  enable_refrag?: boolean;
}

export interface QueryResponse {
  query: string;
  answer: string;
  retrieved_documents: any[];
  retrieval_iterations: number;
  metadata: Record<string, any>;
}

export interface DocumentResponse {
  id: string;
  content: string;
  metadata: any;
  score?: number;
}

// API functions

export const createDocument = async (doc: DocumentCreate) => {
  const response = await api.post('/documents', doc);
  return response.data;
};

export const createDocumentsbatch = async (docs: DocumentCreate[]) => {
  const response = await api.post('/documents/batch', docs);
  return response.data;
};

export const getDocument = async (docId: string) => {
  const response = await api.get<DocumentResponse>(`/documents/${docId}`);
  return response.data;
};

export const listDocuments = async (params?: {
  content_type?: string;
  tags?: string;
  limit?: number;
}) => {
  const response = await api.get<DocumentResponse[]>('/documents', { params });
  return response.data;
};

export const deleteDocument = async (docId: string) => {
  const response = await api.delete(`/documents/${docId}`);
  return response.data;
};

export const query = async (request: QueryRequest) => {
  const response = await api.post<QueryResponse>('/query', request);
  return response.data;
};

export const getHealth = async () => {
  const response = await api.get('/health');
  return response.data;
};

export const getStats = async () => {
  const response = await api.get('/stats');
  return response.data;
};

export const getContentTypes = async () => {
  const response = await api.get<{ content_types: string[] }>('/content-types');
  return response.data;
};

export const getTags = async () => {
  const response = await api.get<{ tags: string[] }>('/tags');
  return response.data;
};

export default api;
