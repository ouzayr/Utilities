import { ViewMode } from '@/lib/types';
import { FileCode2, GitBranch, Workflow, AlertCircle, AlertTriangle } from 'lucide-react';

interface HeaderProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  errorCount: number;
  warningCount: number;
}

export default function Header({ viewMode, onViewModeChange, errorCount, warningCount }: HeaderProps) {
  return (
    <header className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileCode2 size={28} />
              Visual YAML Builder
            </h1>
            <p className="text-indigo-100 text-sm mt-1">
              Drag-and-drop GUI for creating and visualizing YAML files
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Error/Warning Indicators */}
            {(errorCount > 0 || warningCount > 0) && (
              <div className="flex items-center gap-3">
                {errorCount > 0 && (
                  <div className="flex items-center gap-1 bg-red-500 px-3 py-1 rounded-full">
                    <AlertCircle size={16} />
                    <span className="text-sm font-semibold">{errorCount}</span>
                  </div>
                )}
                {warningCount > 0 && (
                  <div className="flex items-center gap-1 bg-yellow-500 px-3 py-1 rounded-full">
                    <AlertTriangle size={16} />
                    <span className="text-sm font-semibold">{warningCount}</span>
                  </div>
                )}
              </div>
            )}

            {/* View Mode Selector */}
            <div className="flex bg-indigo-700 rounded-lg p-1">
              <button
                onClick={() => onViewModeChange('editor')}
                className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                  viewMode === 'editor'
                    ? 'bg-white text-indigo-600 shadow'
                    : 'text-white hover:bg-indigo-600'
                }`}
              >
                <FileCode2 size={18} />
                Editor
              </button>

              <button
                onClick={() => onViewModeChange('tree')}
                className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                  viewMode === 'tree'
                    ? 'bg-white text-indigo-600 shadow'
                    : 'text-white hover:bg-indigo-600'
                }`}
              >
                <GitBranch size={18} />
                Tree
              </button>

              <button
                onClick={() => onViewModeChange('workflow')}
                className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                  viewMode === 'workflow'
                    ? 'bg-white text-indigo-600 shadow'
                    : 'text-white hover:bg-indigo-600'
                }`}
              >
                <Workflow size={18} />
                Workflow
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
