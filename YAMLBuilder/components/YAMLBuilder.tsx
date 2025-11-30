"use client";

import { useState, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { YAMLBlock, ViewMode, ValidationError } from '@/lib/types';
import { blocksToYAML, yamlToBlocks, validateBlocks, downloadYAML } from '@/lib/yamlUtils';
import { saveToLocalStorage, getAllSaves, loadFromLocalStorage, deleteFromLocalStorage } from '@/lib/storage';
import Header from './Header';
import BlockEditor from './BlockEditor';
import YAMLPreview from './YAMLPreview';
import TreeView from './TreeView';
import WorkflowView from './WorkflowView';
import SaveLoadModal from './SaveLoadModal';
import { FileDown, FileUp, Save, FolderOpen, Plus } from 'lucide-react';

export default function YAMLBuilder() {
  const [blocks, setBlocks] = useState<YAMLBlock[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('editor');
  const [yamlText, setYamlText] = useState('');
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);

  // Update YAML text when blocks change
  useEffect(() => {
    const yaml = blocksToYAML(blocks);
    setYamlText(yaml);

    // Validate blocks
    const validationErrors = validateBlocks(blocks);
    setErrors(validationErrors);
  }, [blocks]);

  const handleAddBlock = (type: 'key-value' | 'object' | 'array') => {
    const newBlock: YAMLBlock = {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      key: '',
      value: type === 'key-value' ? '' : undefined,
      children: type === 'object' || type === 'array' ? [] : undefined,
    };

    setBlocks([...blocks, newBlock]);
  };

  const handleUpdateBlock = (id: string, updates: Partial<YAMLBlock>) => {
    const updateBlockRecursive = (blockList: YAMLBlock[]): YAMLBlock[] => {
      return blockList.map(block => {
        if (block.id === id) {
          return { ...block, ...updates };
        }
        if (block.children) {
          return { ...block, children: updateBlockRecursive(block.children) };
        }
        return block;
      });
    };

    setBlocks(updateBlockRecursive(blocks));
  };

  const handleDeleteBlock = (id: string) => {
    const deleteBlockRecursive = (blockList: YAMLBlock[]): YAMLBlock[] => {
      return blockList.filter(block => {
        if (block.id === id) return false;
        if (block.children) {
          block.children = deleteBlockRecursive(block.children);
        }
        return true;
      });
    };

    setBlocks(deleteBlockRecursive(blocks));
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importedBlocks = yamlToBlocks(content);
        setBlocks(importedBlocks);
      } catch (error) {
        alert('Error importing YAML file. Please check the file format.');
        console.error('Import error:', error);
      }
    };
    reader.readAsText(file);
  };

  const handleExport = () => {
    downloadYAML(yamlText, 'config.yaml');
  };

  const handleSave = (name: string) => {
    saveToLocalStorage(name, blocks);
    setShowSaveModal(false);
  };

  const handleLoad = (id: string) => {
    const saved = loadFromLocalStorage(id);
    if (saved) {
      setBlocks(saved.data);
      setShowLoadModal(false);
    }
  };

  const handleNew = () => {
    if (blocks.length > 0) {
      if (confirm('Are you sure you want to create a new YAML? Unsaved changes will be lost.')) {
        setBlocks([]);
      }
    } else {
      setBlocks([]);
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex flex-col h-screen">
        <Header
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          errorCount={errors.filter(e => e.type === 'error').length}
          warningCount={errors.filter(e => e.type === 'warning').length}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                onClick={handleNew}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                <Plus size={18} />
                New
              </button>

              <button
                onClick={() => setShowSaveModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                <Save size={18} />
                Save
              </button>

              <button
                onClick={() => setShowLoadModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
              >
                <FolderOpen size={18} />
                Load
              </button>

              <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-2" />

              <label className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors cursor-pointer">
                <FileUp size={18} />
                Import
                <input
                  type="file"
                  accept=".yaml,.yml"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>

              <button
                onClick={handleExport}
                disabled={blocks.length === 0}
                className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileDown size={18} />
                Export
              </button>

              {viewMode === 'editor' && (
                <>
                  <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-2" />

                  <button
                    onClick={() => handleAddBlock('key-value')}
                    className="px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors text-sm"
                  >
                    + Key-Value
                  </button>

                  <button
                    onClick={() => handleAddBlock('object')}
                    className="px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors text-sm"
                  >
                    + Object
                  </button>

                  <button
                    onClick={() => handleAddBlock('array')}
                    className="px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors text-sm"
                  >
                    + Array
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Panel - Editor/Visualization */}
            <div className="flex-1 overflow-auto bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
              {viewMode === 'editor' && (
                <BlockEditor
                  blocks={blocks}
                  onUpdateBlock={handleUpdateBlock}
                  onDeleteBlock={handleDeleteBlock}
                  onAddChild={(parentId, childType) => {
                    const newChild: YAMLBlock = {
                      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                      type: childType,
                      key: childType === 'key-value' ? '' : undefined,
                      value: childType === 'key-value' ? '' : undefined,
                      children: childType === 'object' || childType === 'array' ? [] : undefined,
                      parent: parentId,
                    };

                    const addChildRecursive = (blockList: YAMLBlock[]): YAMLBlock[] => {
                      return blockList.map(block => {
                        if (block.id === parentId) {
                          return {
                            ...block,
                            children: [...(block.children || []), newChild],
                          };
                        }
                        if (block.children) {
                          return { ...block, children: addChildRecursive(block.children) };
                        }
                        return block;
                      });
                    };

                    setBlocks(addChildRecursive(blocks));
                  }}
                  errors={errors}
                />
              )}

              {viewMode === 'tree' && (
                <TreeView blocks={blocks} />
              )}

              {viewMode === 'workflow' && (
                <WorkflowView blocks={blocks} />
              )}
            </div>

            {/* Right Panel - YAML Preview */}
            <div className="w-1/2 overflow-auto">
              <YAMLPreview yamlText={yamlText} errors={errors} />
            </div>
          </div>
        </div>

        {/* Modals */}
        {showSaveModal && (
          <SaveLoadModal
            mode="save"
            onClose={() => setShowSaveModal(false)}
            onSave={handleSave}
          />
        )}

        {showLoadModal && (
          <SaveLoadModal
            mode="load"
            onClose={() => setShowLoadModal(false)}
            onLoad={handleLoad}
            onDelete={deleteFromLocalStorage}
          />
        )}
      </div>
    </DndProvider>
  );
}
