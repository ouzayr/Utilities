'use client';

import { useState, useEffect } from 'react';
import { listDocuments, deleteDocument, DocumentResponse, getStats } from '@/lib/api';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);

  // Filters
  const [contentTypeFilter, setContentTypeFilter] = useState('');
  const [tagsFilter, setTagsFilter] = useState('');

  useEffect(() => {
    loadDocuments();
    loadStats();
  }, [contentTypeFilter, tagsFilter]);

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);

    try {
      const docs = await listDocuments({
        content_type: contentTypeFilter || undefined,
        tags: tagsFilter || undefined,
        limit: 100,
      });
      setDocuments(docs);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await getStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      await deleteDocument(docId);
      await loadDocuments();
      await loadStats();
    } catch (err: any) {
      alert(err.response?.data?.detail || err.message || 'Failed to delete document');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Documents
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          View and manage all documents in your knowledge base
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Total Documents
            </h3>
            <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
              {stats.documents.document_count}
            </p>
          </div>
          <div className="card">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Content Types
            </h3>
            <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
              {Object.keys(stats.documents.content_type_distribution || {}).length}
            </p>
          </div>
          <div className="card">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Current Model
            </h3>
            <p className="mt-2 text-lg font-bold text-gray-900 dark:text-white">
              {stats.ollama.current_model}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Filter by Content Type
            </label>
            <input
              type="text"
              value={contentTypeFilter}
              onChange={(e) => setContentTypeFilter(e.target.value)}
              className="input-field"
              placeholder="e.g., policy, faq"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Filter by Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tagsFilter}
              onChange={(e) => setTagsFilter(e.target.value)}
              className="input-field"
              placeholder="e.g., hr, compliance"
            />
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Documents List */}
      {loading ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Loading documents...</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">
            No documents found. Add your first document to get started!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {documents.map((doc) => (
            <div key={doc.id} className="card hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {doc.metadata.title}
                  </h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200">
                      {doc.metadata.content_type}
                    </span>
                    {doc.metadata.tags && doc.metadata.tags.split(',').filter(Boolean).map((tag: string) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                      >
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    <p>Source: {doc.metadata.source}</p>
                    {doc.metadata.author && <p>Author: {doc.metadata.author}</p>}
                    <p>Version: {doc.metadata.version}</p>
                    <p>Access: {doc.metadata.permission_access_level}</p>
                    <p>Updated: {new Date(doc.metadata.updated_at).toLocaleDateString()}</p>
                  </div>
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                    {doc.content}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="ml-4 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                  title="Delete document"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Content Type Distribution */}
      {stats && stats.documents.content_type_distribution && (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Content Type Distribution
          </h2>
          <div className="space-y-2">
            {Object.entries(stats.documents.content_type_distribution).map(([type, count]: [string, any]) => (
              <div key={type} className="flex justify-between items-center">
                <span className="text-gray-700 dark:text-gray-300">{type}</span>
                <span className="font-semibold text-gray-900 dark:text-white">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
