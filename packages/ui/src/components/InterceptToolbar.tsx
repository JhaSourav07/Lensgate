import React from 'react';
import { Check, X, Wand2, RotateCcw, ArrowRight } from 'lucide-react';

interface InterceptToolbarProps {
  status: string;
  onForward: () => void;
  onDrop: () => void;
  onQuickOverride: () => void;
  onReset: () => void;
  activeTab: 'inspector' | 'editor' | 'diff' | 'response';
  onTabChange: (tab: 'inspector' | 'editor' | 'diff' | 'response') => void;
  hasModifications: boolean;
}

export const InterceptToolbar: React.FC<InterceptToolbarProps> = ({
  status,
  onForward,
  onDrop,
  onQuickOverride,
  onReset,
  activeTab,
  onTabChange,
  hasModifications,
}) => {
  const isPending = status === 'pending';

  return (
    <div className="h-12 border-b border-zinc-800 bg-zinc-900/50 px-4 flex items-center justify-between shrink-0">
      {/* Action Buttons */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onForward}
          disabled={!isPending}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold shadow-sm transition-all ${
            isPending
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-95'
              : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
          }`}
          title="Forward request to upstream model (Ctrl+Enter)"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Forward {hasModifications ? 'Modified' : 'Original'}</span>
          <kbd className="ml-1 text-[10px] opacity-75 font-mono">↵</kbd>
        </button>

        <button
          onClick={onDrop}
          disabled={!isPending}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            isPending
              ? 'bg-rose-950/70 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 cursor-pointer active:scale-95'
              : 'bg-zinc-800/50 text-zinc-600 border border-zinc-800 cursor-not-allowed'
          }`}
          title="Drop request, return HTTP 403 to Agent (Esc)"
        >
          <X className="w-3.5 h-3.5" />
          <span>Drop</span>
        </button>

        {isPending && (
          <button
            onClick={onQuickOverride}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all cursor-pointer"
            title="Inject developer-verified project purpose into request context"
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Apply Purpose Override</span>
          </button>
        )}

        {hasModifications && isPending && (
          <button
            onClick={onReset}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all"
            title="Reset modifications back to original payload"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* View Tabs */}
      <div className="flex items-center bg-zinc-950 p-0.5 rounded-lg border border-zinc-800 text-xs">
        <button
          onClick={() => onTabChange('inspector')}
          className={`px-3 py-1 rounded-md font-medium transition-all ${
            activeTab === 'inspector'
              ? 'bg-zinc-800 text-zinc-100 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Context Inspector
        </button>

        <button
          onClick={() => onTabChange('editor')}
          className={`px-3 py-1 rounded-md font-medium transition-all ${
            activeTab === 'editor'
              ? 'bg-zinc-800 text-zinc-100 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          JSON Editor {hasModifications && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block ml-1" />}
        </button>

        <button
          onClick={() => onTabChange('diff')}
          className={`px-3 py-1 rounded-md font-medium transition-all ${
            activeTab === 'diff'
              ? 'bg-zinc-800 text-zinc-100 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Diff View
        </button>

        <button
          onClick={() => onTabChange('response')}
          className={`px-3 py-1 rounded-md font-medium transition-all ${
            activeTab === 'response'
              ? 'bg-zinc-800 text-zinc-100 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Response
        </button>
      </div>
    </div>
  );
};

