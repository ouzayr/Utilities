import { YAMLBlock } from '@/lib/types';
import { useState } from 'react';
import { ChevronDown, ChevronRight, File, Folder, FolderOpen, List } from 'lucide-react';

interface TreeViewProps {
  blocks: YAMLBlock[];
}

export default function TreeView({ blocks }: TreeViewProps) {
  if (blocks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">No data to visualize</p>
          <p className="text-sm">Add some blocks to see the tree structure</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
          <Folder size={20} />
          Tree Structure
        </h3>
        <div className="space-y-1">
          {blocks.map((block) => (
            <TreeNode key={block.id} block={block} depth={0} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface TreeNodeProps {
  block: YAMLBlock;
  depth: number;
}

function TreeNode({ block, depth }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = block.children && block.children.length > 0;

  const getIcon = () => {
    if (block.type === 'array') return <List size={16} />;
    if (block.type === 'object') {
      return isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />;
    }
    return <File size={16} />;
  };

  const getLabel = () => {
    if (block.type === 'key-value') {
      return (
        <span>
          <span className="font-semibold text-blue-600 dark:text-blue-400">{block.key || 'unnamed'}</span>
          <span className="text-gray-500 dark:text-gray-400">: </span>
          <span className="text-green-600 dark:text-green-400">{block.value?.toString() || '""'}</span>
        </span>
      );
    }
    return (
      <span>
        <span className="font-semibold text-purple-600 dark:text-purple-400">{block.key || 'unnamed'}</span>
        <span className="text-gray-500 dark:text-gray-400">
          {block.type === 'array' ? ' []' : ' {}'}
        </span>
      </span>
    );
  };

  return (
    <div style={{ marginLeft: `${depth * 20}px` }}>
      <div className="flex items-center gap-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-2 cursor-pointer">
        {hasChildren ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-600 dark:text-gray-300"
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        ) : (
          <span className="w-4" />
        )}

        <span className="text-gray-600 dark:text-gray-300">{getIcon()}</span>
        <span className="text-sm">{getLabel()}</span>
      </div>

      {isExpanded && hasChildren && (
        <div className="ml-2 border-l border-gray-300 dark:border-gray-600">
          {block.children!.map((child) => (
            <TreeNode key={child.id} block={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
