import React, { useState } from 'react';
import { InterceptedItem } from '../hooks/useLensgateWs';
import { Clock, Search, Filter } from 'lucide-react';

interface RequestQueueProps {
  items: InterceptedItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export const RequestQueue: React.FC<RequestQueueProps> = ({
  items,
  selectedId,
  onSelect,
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'forwarded' | 'dropped'>('all');
  const [search, setSearch] = useState('');

  const filteredItems = items.filter((item) => {
    if (filter !== 'all' && item.envelope.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const prompt = item.envelope.context.conversationTurns[0]?.content;
      const promptStr = typeof prompt === 'string' ? prompt.toLowerCase() : JSON.stringify(prompt || '');
      const model = item.envelope.model.toLowerCase();
      return promptStr.includes(q) || model.includes(q) || item.envelope.id.includes(q);
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">PAUSED</span>;
      case 'modified':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">MODIFIED</span>;
      case 'forwarded':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">FORWARDED</span>;
      case 'dropped':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">DROPPED</span>;
      default:
        return null;
    }
  };

  return (
    <aside className="w-80 border-r border-zinc-800 bg-zinc-950 flex flex-col shrink-0">
      {/* Search & Filter Header */}
      <div className="p-3 border-b border-zinc-800 space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search prompts or models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex space-x-1 text-[11px]">
          {(['all', 'pending', 'forwarded', 'dropped'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-0.5 rounded capitalize font-medium transition-all ${
                filter === f
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-900">
        {filteredItems.length === 0 ? (
          <div className="p-6 text-center text-xs text-zinc-500">
            No requests captured yet.
          </div>
        ) : (
          filteredItems.map((item) => {
            const isSelected = item.envelope.id === selectedId;
            const prompt = item.envelope.context.conversationTurns[0]?.content;
            const promptPreview = typeof prompt === 'string'
              ? prompt
              : (Array.isArray(prompt) ? JSON.stringify(prompt[0]) : 'Empty prompt');

            const timeStr = new Date(item.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            return (
              <div
                key={item.envelope.id}
                onClick={() => onSelect(item.envelope.id)}
                className={`p-3 cursor-pointer transition-all border-l-2 ${
                  isSelected
                    ? 'bg-zinc-900/90 border-emerald-500'
                    : 'hover:bg-zinc-900/40 border-transparent'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-1.5">
                    {getStatusBadge(item.envelope.status)}
                    <span className="text-[11px] font-mono text-zinc-400 uppercase">{item.envelope.provider}</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 flex items-center space-x-1 font-mono">
                    <Clock className="w-2.5 h-2.5" />
                    <span>{timeStr}</span>
                  </span>
                </div>

                <p className="text-xs font-medium text-zinc-200 line-clamp-2 leading-relaxed">
                  {promptPreview}
                </p>

                <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                  <span>{item.envelope.model}</span>
                  {item.durationMs !== undefined && (
                    <span className="text-zinc-400">{item.durationMs}ms</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
