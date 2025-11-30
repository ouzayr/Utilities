import yaml from 'js-yaml';
import { YAMLBlock, ValidationError } from './types';

export function blocksToYAML(blocks: YAMLBlock[]): string {
  try {
    const obj = blocksToObject(blocks);
    return yaml.dump(obj, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
    });
  } catch (error) {
    console.error('Error converting blocks to YAML:', error);
    return '';
  }
}

export function blocksToObject(blocks: YAMLBlock[]): any {
  if (!blocks || blocks.length === 0) return {};

  const result: any = {};
  const arrays: { [key: string]: any[] } = {};

  blocks.forEach((block) => {
    if (block.type === 'key-value' && block.key) {
      result[block.key] = block.value || '';
    } else if (block.type === 'object' && block.key) {
      result[block.key] = block.children ? blocksToObject(block.children) : {};
    } else if (block.type === 'array' && block.key) {
      arrays[block.key] = block.children ? block.children.map(child => {
        if (child.type === 'object') {
          return blocksToObject(child.children || []);
        }
        return child.value;
      }) : [];
      result[block.key] = arrays[block.key];
    }
  });

  return result;
}

export function yamlToBlocks(yamlString: string): YAMLBlock[] {
  try {
    const obj = yaml.load(yamlString);
    return objectToBlocks(obj);
  } catch (error) {
    console.error('Error parsing YAML:', error);
    throw new Error('Invalid YAML syntax');
  }
}

export function objectToBlocks(obj: any, parentId?: string): YAMLBlock[] {
  if (!obj || typeof obj !== 'object') return [];

  const blocks: YAMLBlock[] = [];

  Object.entries(obj).forEach(([key, value]) => {
    const blockId = `${parentId || 'root'}-${key}-${Math.random().toString(36).substr(2, 9)}`;

    if (Array.isArray(value)) {
      const children: YAMLBlock[] = value.map((item, index) => {
        const childId = `${blockId}-item-${index}`;
        if (typeof item === 'object' && item !== null) {
          return {
            id: childId,
            type: 'object',
            children: objectToBlocks(item, childId),
            parent: blockId,
          };
        }
        return {
          id: childId,
          type: getValueType(item),
          value: item,
          parent: blockId,
        };
      });

      blocks.push({
        id: blockId,
        type: 'array',
        key,
        children,
        parent: parentId,
      });
    } else if (typeof value === 'object' && value !== null) {
      blocks.push({
        id: blockId,
        type: 'object',
        key,
        children: objectToBlocks(value, blockId),
        parent: parentId,
      });
    } else {
      blocks.push({
        id: blockId,
        type: 'key-value',
        key,
        value: value as string | number | boolean,
        parent: parentId,
      });
    }
  });

  return blocks;
}

function getValueType(value: any): 'string' | 'number' | 'boolean' {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'string';
}

export function validateBlocks(blocks: YAMLBlock[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const keys = new Set<string>();

  function checkDuplicateKeys(blockList: YAMLBlock[], path: string = '') {
    const localKeys = new Set<string>();

    blockList.forEach((block) => {
      if (block.key) {
        const fullPath = path ? `${path}.${block.key}` : block.key;

        if (localKeys.has(block.key)) {
          errors.push({
            blockId: block.id,
            message: `Duplicate key "${block.key}" at ${fullPath}`,
            type: 'error',
          });
        }

        localKeys.add(block.key);

        if (block.children) {
          checkDuplicateKeys(block.children, fullPath);
        }
      }

      // Check for empty keys
      if (block.type === 'key-value' || block.type === 'object' || block.type === 'array') {
        if (!block.key || block.key.trim() === '') {
          errors.push({
            blockId: block.id,
            message: 'Key cannot be empty',
            type: 'error',
          });
        }
      }

      // Check for invalid key characters
      if (block.key && /^\d/.test(block.key)) {
        errors.push({
          blockId: block.id,
          message: `Key "${block.key}" should not start with a number`,
          type: 'warning',
        });
      }
    });
  }

  checkDuplicateKeys(blocks);

  return errors;
}

export function downloadYAML(yamlString: string, filename: string = 'config.yaml') {
  const blob = new Blob([yamlString], { type: 'text/yaml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
