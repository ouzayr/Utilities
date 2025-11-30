import { useState, useEffect } from 'react';
import { getAllSaves } from '@/lib/storage';
import { SavedYAML } from '@/lib/types';
import { X, Trash2, Clock } from 'lucide-react';

interface SaveLoadModalProps {
  mode: 'save' | 'load';
  onClose: () => void;
  onSave?: (name: string) => void;
  onLoad?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export default function SaveLoadModal({ mode, onClose, onSave, onLoad, onDelete }: SaveLoadModalProps) {
  const [saveName, setSaveName] = useState('');
  const [saves, setSaves] = useState<SavedYAML[]>([]);

  useEffect(() => {
    if (mode === 'load') {
      setSaves(getAllSaves());
    }
  }, [mode]);

  const handleSave = () => {
    if (saveName.trim() && onSave) {
      onSave(saveName.trim());
      setSaveName('');
    }
  };

  const handleDelete = (id: string) => {
    if (onDelete && confirm('Are you sure you want to delete this saved YAML?')) {
      onDelete(id);
      setSaves(getAllSaves());
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {mode === 'save' ? 'Save YAML' : 'Load YAML'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {mode === 'save' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Save Name
              </label>
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSave()}
                placeholder="Enter a name for this YAML..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                autoFocus
              />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                If a save with this name already exists, it will be updated.
              </p>
            </div>
          ) : (
            <div>
              {saves.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <p className="text-lg font-semibold mb-2">No saved YAMLs</p>
                  <p className="text-sm">Save your work to load it later</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {saves.map((save) => (
                    <div
                      key={save.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                            {save.name}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                            <div className="flex items-center gap-1">
                              <Clock size={14} />
                              <span>Updated: {formatDate(save.updatedAt)}</span>
                            </div>
                            <span>{save.data.length} blocks</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onLoad && onLoad(save.id)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors text-sm"
                          >
                            Load
                          </button>
                          <button
                            onClick={() => handleDelete(save.id)}
                            className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {mode === 'save' && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!saveName.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
