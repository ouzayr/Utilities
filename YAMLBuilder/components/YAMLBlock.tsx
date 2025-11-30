import { useState } from 'react';
import { YAMLBlock, ValidationError } from '@/lib/types';
import { Trash2, Plus, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';

interface YAMLBlockProps {
  block: YAMLBlock;
  onUpdate: (id: string, updates: Partial<YAMLBlock>) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string, childType: 'key-value' | 'object' | 'array') => void;
  errors: ValidationError[];
  depth: number;
}

export default function YAMLBlockComponent({
  block,
  onUpdate,
  onDelete,
  onAddChild,
  errors,
  depth,
}: YAMLBlockProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const hasErrors = errors.length > 0;
  const indentWidth = depth * 24;

  const getBlockColor = () => {
    switch (block.type) {
      case 'key-value':
        return 'border-blue-300 bg-blue-50 dark:bg-blue-900/20';
      case 'object':
        return 'border-purple-300 bg-purple-50 dark:bg-purple-900/20';
      case 'array':
        return 'border-green-300 bg-green-50 dark:bg-green-900/20';
      default:
        return 'border-gray-300 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  const getBlockLabel = () => {
    switch (block.type) {
      case 'key-value':
        return 'Key-Value';
      case 'object':
        return 'Object';
      case 'array':
        return 'Array';
      default:
        return 'Block';
    }
  };

  return (
    <div style={{ marginLeft: `${indentWidth}px` }} className="animate-in fade-in slide-in-from-left duration-200">
      <div
        className={`border-2 rounded-lg p-4 ${getBlockColor()} ${
          hasErrors ? 'border-red-500 ring-2 ring-red-200' : ''
        } transition-all hover:shadow-md`}
      >
        {/* Header */}
        <div className="flex items-start gap-2 mb-3">
          {(block.type === 'object' || block.type === 'array') && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-1 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            </button>
          )}

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                {getBlockLabel()}
              </span>
              {hasErrors && (
                <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                  <AlertCircle size={16} />
                  <span className="text-xs">{errors[0].message}</span>
                </div>
              )}
            </div>

            {/* Key Input */}
            {(block.type === 'key-value' || block.type === 'object' || block.type === 'array') && (
              <input
                type="text"
                value={block.key || ''}
                onChange={(e) => onUpdate(block.id, { key: e.target.value })}
                placeholder="Enter key name..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            )}

            {/* Value Input (for key-value pairs) */}
            {block.type === 'key-value' && (
              <input
                type="text"
                value={block.value?.toString() || ''}
                onChange={(e) => onUpdate(block.id, { value: e.target.value })}
                placeholder="Enter value..."
                className="w-full mt-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {(block.type === 'object' || block.type === 'array') && (
              <div className="relative">
                <button
                  onClick={() => setShowAddMenu(!showAddMenu)}
                  className="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                  title="Add child"
                >
                  <Plus size={18} />
                </button>

                {showAddMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-10">
                    <button
                      onClick={() => {
                        onAddChild(block.id, 'key-value');
                        setShowAddMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 text-sm"
                    >
                      + Key-Value
                    </button>
                    {block.type === 'object' && (
                      <>
                        <button
                          onClick={() => {
                            onAddChild(block.id, 'object');
                            setShowAddMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 text-sm"
                        >
                          + Nested Object
                        </button>
                        <button
                          onClick={() => {
                            onAddChild(block.id, 'array');
                            setShowAddMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 text-sm"
                        >
                          + Array
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => onDelete(block.id)}
              className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
              title="Delete block"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Children */}
        {isExpanded && block.children && block.children.length > 0 && (
          <div className="mt-4 space-y-3 pl-4 border-l-2 border-gray-300 dark:border-gray-600">
            {block.children.map((child) => (
              <YAMLBlockComponent
                key={child.id}
                block={child}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onAddChild={onAddChild}
                errors={errors}
                depth={depth + 1}
              />
            ))}
          </div>
        )}

        {/* Empty children indicator */}
        {isExpanded && block.children && block.children.length === 0 && (
          <div className="mt-3 text-sm text-gray-400 dark:text-gray-500 italic text-center py-2">
            No items yet. Click + to add.
          </div>
        )}
      </div>
    </div>
  );
}
