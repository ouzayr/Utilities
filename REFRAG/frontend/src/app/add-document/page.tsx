'use client';

import { useState } from 'react';
import { createDocument, DocumentCreate } from '@/lib/api';

const ACCESS_LEVELS = ['public', 'internal', 'confidential', 'restricted'];
const ROLES = ['admin', 'editor', 'viewer', 'guest'];

export default function AddDocumentPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState('');
  const [source, setSource] = useState('');
  const [author, setAuthor] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [tags, setTags] = useState('');
  const [fileType, setFileType] = useState('txt');
  const [language, setLanguage] = useState('en');

  // Permission state
  const [accessLevel, setAccessLevel] = useState('internal');
  const [permissionUsers, setPermissionUsers] = useState('');
  const [permissionRoles, setPermissionRoles] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content || !title || !contentType || !source) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const doc: DocumentCreate = {
        content,
        title,
        content_type: contentType,
        source,
        author: author || undefined,
        version,
        tags: tags.split(',').map((t) => t.trim()).filter((t) => t),
        file_type: fileType,
        language,
        permissions: {
          users: permissionUsers.split(',').map((u) => u.trim()).filter((u) => u),
          roles: permissionRoles,
          access_level: accessLevel,
        },
      };

      await createDocument(doc);
      setSuccess(true);

      // Reset form
      setContent('');
      setTitle('');
      setContentType('');
      setSource('');
      setAuthor('');
      setVersion('1.0.0');
      setTags('');
      setFileType('txt');
      setLanguage('en');
      setAccessLevel('internal');
      setPermissionUsers('');
      setPermissionRoles([]);

      // Auto-hide success message
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Add New Document
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Add a new document to your knowledge base with metadata and permissions
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-green-800 dark:text-green-200">
            Document added successfully!
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Basic Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-field"
                placeholder="Document title"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Content <span className="text-red-500">*</span>
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="input-field h-64 resize-none font-mono text-sm"
                placeholder="Paste or type your document content here..."
                required
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {content.length} characters
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Content Type <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value)}
                  className="input-field"
                  placeholder="e.g., policy, faq, manual"
                  required
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Examples: policy, faq, manual, guide, etc.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Source <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="input-field"
                  placeholder="e.g., file path or URL"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Metadata
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Author
                </label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="input-field"
                  placeholder="Author name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Version
                </label>
                <input
                  type="text"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className="input-field"
                  placeholder="1.0.0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  File Type
                </label>
                <select
                  value={fileType}
                  onChange={(e) => setFileType(e.target.value)}
                  className="input-field"
                >
                  <option value="txt">Text</option>
                  <option value="pdf">PDF</option>
                  <option value="docx">Word Document</option>
                  <option value="md">Markdown</option>
                  <option value="json">JSON</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="input-field"
                  placeholder="hr, compliance, public"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Language
                </label>
                <input
                  type="text"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="input-field"
                  placeholder="en"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Permissions */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Permissions
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Access Level
              </label>
              <select
                value={accessLevel}
                onChange={(e) => setAccessLevel(e.target.value)}
                className="input-field"
              >
                {ACCESS_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Allowed Roles
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {ROLES.map((role) => (
                  <label key={role} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={permissionRoles.includes(role)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setPermissionRoles([...permissionRoles, role]);
                        } else {
                          setPermissionRoles(permissionRoles.filter((r) => r !== role));
                        }
                      }}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Allowed Users (comma-separated user IDs)
              </label>
              <input
                type="text"
                value={permissionUsers}
                onChange={(e) => setPermissionUsers(e.target.value)}
                className="input-field"
                placeholder="user1, user2, user3"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex-1"
          >
            {loading ? 'Adding Document...' : 'Add Document'}
          </button>
          <button
            type="button"
            onClick={() => {
              setContent('');
              setTitle('');
              setContentType('');
              setSource('');
              setAuthor('');
              setVersion('1.0.0');
              setTags('');
            }}
            className="btn-secondary"
          >
            Clear Form
          </button>
        </div>
      </form>
    </div>
  );
}
