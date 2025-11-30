"use client";

import { useMemo } from 'react';
import { ReactFlow, Node, Edge, Background, Controls, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { YAMLBlock } from '@/lib/types';

interface WorkflowViewProps {
  blocks: YAMLBlock[];
}

export default function WorkflowView({ blocks }: WorkflowViewProps) {
  const { nodes, edges } = useMemo(() => {
    if (blocks.length === 0) {
      return { nodes: [], edges: [] };
    }

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    let yOffset = 0;

    const processBlock = (block: YAMLBlock, x: number, y: number, parentId?: string): number => {
      const nodeId = block.id;
      let height = 80;

      // Create node based on block type
      const nodeData: any = {
        label: block.key || 'root',
        type: block.type,
      };

      if (block.type === 'key-value') {
        nodeData.value = block.value;
      }

      nodes.push({
        id: nodeId,
        type: getNodeType(block.type),
        position: { x, y },
        data: nodeData,
        style: getNodeStyle(block.type),
      });

      // Create edge from parent
      if (parentId) {
        edges.push({
          id: `${parentId}-${nodeId}`,
          source: parentId,
          target: nodeId,
          type: 'smoothstep',
          animated: false,
        });
      }

      let childY = y;

      // Process children
      if (block.children && block.children.length > 0) {
        block.children.forEach((child, index) => {
          const childX = x + 250;
          childY = processBlock(child, childX, childY, nodeId);
          childY += 120; // Space between children
        });
      }

      return Math.max(y, childY);
    };

    let currentY = 50;
    blocks.forEach((block, index) => {
      currentY = processBlock(block, 50, currentY);
      currentY += 150; // Space between root-level blocks
    });

    return { nodes, edges };
  }, [blocks]);

  if (blocks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">No data to visualize</p>
          <p className="text-sm">Add some blocks to see the workflow diagram</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        attributionPosition="bottom-left"
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}

function getNodeType(blockType: string): string {
  switch (blockType) {
    case 'key-value':
      return 'default';
    case 'object':
      return 'default';
    case 'array':
      return 'default';
    default:
      return 'default';
  }
}

function getNodeStyle(blockType: string): React.CSSProperties {
  const baseStyle: React.CSSProperties = {
    padding: '10px 20px',
    borderRadius: '8px',
    fontSize: '14px',
    border: '2px solid',
    minWidth: '180px',
  };

  switch (blockType) {
    case 'key-value':
      return {
        ...baseStyle,
        background: '#dbeafe',
        borderColor: '#3b82f6',
        color: '#1e40af',
      };
    case 'object':
      return {
        ...baseStyle,
        background: '#e9d5ff',
        borderColor: '#9333ea',
        color: '#6b21a8',
      };
    case 'array':
      return {
        ...baseStyle,
        background: '#d1fae5',
        borderColor: '#10b981',
        color: '#065f46',
      };
    default:
      return baseStyle;
  }
}
