export type BlockType = 'object' | 'array' | 'key-value' | 'string' | 'number' | 'boolean';

export interface YAMLBlock {
  id: string;
  type: BlockType;
  key?: string;
  value?: string | number | boolean;
  children?: YAMLBlock[];
  parent?: string;
}

export interface ValidationError {
  blockId: string;
  message: string;
  type: 'error' | 'warning';
}

export type ViewMode = 'editor' | 'tree' | 'workflow';

export interface SavedYAML {
  id: string;
  name: string;
  data: YAMLBlock[];
  createdAt: string;
  updatedAt: string;
}
