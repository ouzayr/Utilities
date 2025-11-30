import { ValidationError } from '@/lib/types';
import { FileCode, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface YAMLPreviewProps {
  yamlText: string;
  errors: ValidationError[];
}

export default function YAMLPreview({ yamlText, errors }: YAMLPreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(yamlText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode size={20} className="text-gray-600 dark:text-gray-300" />
            <h3 className="font-semibold text-gray-900 dark:text-white">YAML Preview</h3>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
          >
            {copied ? (
              <>
                <Check size={16} className="text-green-600" />
                Copied!
              </>
            ) : (
              <>
                <Copy size={16} />
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Summary */}
      {errors.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-4 py-3">
          <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">
            Validation Issues ({errors.length})
          </h4>
          <ul className="space-y-1">
            {errors.map((error, index) => (
              <li key={index} className="text-sm text-red-700 dark:text-red-300">
                {error.type === 'error' ? '❌' : '⚠️'} {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* YAML Content */}
      <div className="flex-1 overflow-auto p-4">
        {yamlText ? (
          <pre className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-sm font-mono overflow-x-auto">
            <code className="text-gray-900 dark:text-gray-100">{yamlText}</code>
          </pre>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <p className="text-center">
              Add blocks to see YAML preview
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-2">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Lines: {yamlText.split('\n').length} | Characters: {yamlText.length}
        </div>
      </div>
    </div>
  );
}
