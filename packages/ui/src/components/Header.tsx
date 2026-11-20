import React from 'react';
import { InterceptMode } from '@lensgate/shared';
import { Shield, ShieldAlert, Eye, Cpu, Radio, Sparkles, Scan } from 'lucide-react';

interface HeaderProps {
  connected: boolean;
  mode: InterceptMode;
  onModeChange: (mode: InterceptMode) => void;
  pendingCount: number;
  onOpenAntigravity: () => void;
  onOpenScanner?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  connected,
  mode,
  onModeChange,
  pendingCount,
  onOpenAntigravity,
  onOpenScanner,
}) => {
  return (
    <header className="h-14 border-b border-zinc-800 bg-zinc-900/90 px-4 flex items-center justify-between select-none shrink-0">
      {/* Brand & Identity */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-base tracking-tight text-zinc-100">LENSGATE</span>
            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50">
              v0.1
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 -mt-0.5">Control Layer for AI Coding Agents</p>
        </div>
      </div>

      {/* Mode Controls */}
      <div className="flex items-center space-x-4">
        {/* Interception Toggle */}
        <div className="flex items-center bg-zinc-950 p-1 rounded-lg border border-zinc-800">
          <button
            onClick={() => onModeChange('observe')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
              mode === 'observe'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-blue-400" />
            <span>Observe</span>
          </button>

          <button
            onClick={() => onModeChange('control')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
              mode === 'control'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>Control (Intercept)</span>
          </button>
        </div>

        {/* Pending Badge */}
        {mode === 'control' && (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-amber-950/60 border border-amber-800/60 text-amber-300 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>{pendingCount} Paused</span>
          </div>
        )}

        {/* Context Intelligence Pill */}
        {onOpenScanner && (
          <button
            onClick={onOpenScanner}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/60 text-zinc-300 text-xs font-medium transition-all cursor-pointer"
            title="Context Intelligence & Purpose Lock"
          >
            <Scan className="w-3.5 h-3.5 text-blue-400" />
            <span>Intelligence</span>
          </button>
        )}

        {/* Antigravity Integration Pill */}
        <button
          onClick={onOpenAntigravity}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/60 text-zinc-300 text-xs font-medium transition-all cursor-pointer"
          title="Manage Antigravity IDE connection"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>Antigravity</span>
        </button>

        {/* Connection status */}
        <div className="flex items-center space-x-1.5 text-xs text-zinc-400 pl-2 border-l border-zinc-800">
          <Radio className={`w-3.5 h-3.5 ${connected ? 'text-emerald-400' : 'text-red-400 animate-pulse'}`} />
          <span className="text-[11px]">{connected ? 'Live' : 'Disconnected'}</span>
        </div>
      </div>
    </header>
  );
};

