"use client";

interface ToolbarProps {
  onAddText: () => void;
  onAddRect: () => void;
  onAddCircle: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onDeleteSelected: () => void;
  onUndo: () => void;
}

export default function Toolbar({
  onAddText,
  onAddRect,
  onAddCircle,
  onBringForward,
  onSendBackward,
  onDeleteSelected,
  onUndo,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap gap-2 p-3 bg-card border rounded-lg">
      <ToolGroup label="Add">
        <ToolBtn onClick={onAddText} title="Add Text">T</ToolBtn>
        <ToolBtn onClick={onAddRect} title="Add Rectangle">▭</ToolBtn>
        <ToolBtn onClick={onAddCircle} title="Add Circle">○</ToolBtn>
      </ToolGroup>
      <ToolGroup label="Layer">
        <ToolBtn onClick={onBringForward} title="Bring Forward">↑</ToolBtn>
        <ToolBtn onClick={onSendBackward} title="Send Backward">↓</ToolBtn>
      </ToolGroup>
      <ToolGroup label="Edit">
        <ToolBtn onClick={onUndo} title="Undo">↩</ToolBtn>
        <ToolBtn onClick={onDeleteSelected} title="Delete Selected" danger>✕</ToolBtn>
      </ToolGroup>
    </div>
  );
}

function ToolGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground mr-1">{label}</span>
      {children}
    </div>
  );
}

function ToolBtn({
  onClick,
  title,
  children,
  danger,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-8 h-8 rounded border text-sm font-mono flex items-center justify-center hover:opacity-80 transition-opacity ${
        danger ? "border-destructive text-destructive" : "border-input bg-background"
      }`}
    >
      {children}
    </button>
  );
}
