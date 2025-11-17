'use client';

import { useState, useEffect } from 'react';
import { query, getContentTypes, getTags, QueryRequest, QueryResponse } from '@/lib/api';

export default function Home() {
  const [queryText, setQueryText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [contentTypes, setContentTypes] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedContentTypes, setSelectedContentTypes] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [topK, setTopK] = useState(5);
  const [enableRefrag, setEnableRefrag] = useState(true);

  // Load available content types and tags
  useEffect(() => {
    loadFilters();
  }, []);

  const loadFilters = async () => {
    try {
      const [ctData, tagsData] = await Promise.all([
        getContentTypes(),
        getTags(),
      ]);
      setContentTypes(ctData.content_types);
      setTags(tagsData.tags);
    } catch (err) {
      console.error('Error loading filters:', err);
    }
  };

  const handleQuery = async () => {
    if (!queryText.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const request: QueryRequest = {
        query: queryText,
        content_types: selectedContentTypes.length > 0 ? selectedContentTypes : undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        top_k: topK,
        enable_refrag: enableRefrag,
      };

      const response = await query(request);
      setResult(response);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Query Documents
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Ask questions and get answers from your document collection using REFRAG
        </p>
      </div>

      {/* Query Input */}
      <div className="card">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Your Question
            </label>
            <textarea
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              className="input-field h-32 resize-none"
              placeholder="Enter your question here..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  handleQuery();
                }
              }}
            />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Content Types
              </label>
              <select
                multiple
                value={selectedContentTypes}
                onChange={(e) => setSelectedContentTypes(Array.from(e.target.selectedOptions, option => option.value))}
                className="input-field h-24"
              >
                {contentTypes.map((ct) => (
                  <option key={ct} value={ct}>
                    {ct}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tags
              </label>
              <select
                multiple
                value={selectedTags}
                onChange={(e) => setSelectedTags(Array.from(e.target.selectedOptions, option => option.value))}
                className="input-field h-24"
              >
                {tags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Top K Results
              </label>
              <input
                type="number"
                value={topK}
                onChange={(e) => setTopK(parseInt(e.target.value))}
                min={1}
                max={20}
                className="input-field"
              />
              <div className="mt-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={enableRefrag}
                    onChange={(e) => setEnableRefrag(e.target.checked)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Enable REFRAG
                  </span>
                </label>
              </div>
            </div>
          </div>

          <button
            onClick={handleQuery}
            disabled={loading || !queryText.trim()}
            className="btn-primary w-full"
          >
            {loading ? 'Querying...' : 'Query (Ctrl+Enter)'}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Answer */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Answer
            </h2>
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {result.answer}
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                <span>Method: {result.metadata.method}</span>
                <span>Iterations: {result.retrieval_iterations}</span>
                <span>Documents: {result.retrieved_documents.length}</span>
              </div>
            </div>
          </div>

          {/* Retrieved Documents */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Retrieved Documents ({result.retrieved_documents.length})
            </h2>
            <div className="space-y-4">
              {result.retrieved_documents.map((doc, idx) => (
                <div
                  key={doc.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {doc.metadata.title}
                      </h3>
                      <div className="flex gap-2 mt-1">
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200">
                          {doc.metadata.content_type}
                        </span>
                        {doc.score && (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                            Score: {(doc.score * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
                    {doc.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
