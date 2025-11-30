import { YAMLBlock, ValidationError } from '@/lib/types';
import YAMLBlockComponent from './YAMLBlock';

interface BlockEditorProps {
  blocks: YAMLBlock[];
  onUpdateBlock: (id: string, updates: Partial<YAMLBlock>) => void;
  onDeleteBlock: (id: string) => void;
  onAddChild: (parentId: string, childType: 'key-value' | 'object' | 'array') => void;
  errors: ValidationError[];
}

export default function BlockEditor({
  blocks,
  onUpdateBlock,
  onDeleteBlock,
  onAddChild,
  errors,
}: BlockEditorProps) {
  if (blocks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">No YAML blocks yet</p>
          <p className="text-sm">Click the buttons above to add your first block</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-3">
      {blocks.map((block) => (
        <YAMLBlockComponent
          key={block.id}
          block={block}
          onUpdate={onUpdateBlock}
          onDelete={onDeleteBlock}
          onAddChild={onAddChild}
          errors={errors.filter(e => e.blockId === block.id)}
          depth={0}
        />
      ))}
    </div>
  );
}
