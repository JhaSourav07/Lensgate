import React from 'react';
import { LensgateContextEnvelope } from '@lensgate/shared';
import { BookOpen, MessageSquare, Wrench, FileCode, CheckCircle2 } from 'lucide-react';

interface ContextInspectorProps {
  envelope: LensgateContextEnvelope;
  modifiedBody?: any;
}

export const ContextInspector: React.FC<ContextInspectorProps> = ({
  envelope,
  modifiedBody,
}) => {
  const context = envelope.context;

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-w-4xl mx-auto">
      {/* Overview Cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-lg">
          <div className="text-[11px] text-zinc-400 flex items-center space-x-1.5">
            <BookOpen className="w-3.5 h-3.5 text-blue-400" />
            <span>Instructions</span>
          </div>
          <div className="text-lg font-bold text-zinc-100 mt-1">
            {context.systemInstructions.length} block(s)
          </div>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-lg">
          <div className="text-[11px] text-zinc-400 flex items-center space-x-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span>Turns</span>
          </div>
          <div className="text-lg font-bold text-zinc-100 mt-1">
            {context.conversationTurns.length} message(s)
          </div>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-lg">
          <div className="text-[11px] text-zinc-400 flex items-center space-x-1.5">
            <Wrench className="w-3.5 h-3.5 text-amber-400" />
            <span>Tools</span>
          </div>
          <div className="text-lg font-bold text-zinc-100 mt-1">
            {context.tools.length} tool(s)
          </div>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-lg">
          <div className="text-[11px] text-zinc-400 flex items-center space-x-1.5">
            <FileCode className="w-3.5 h-3.5 text-purple-400" />
            <span>Model</span>
          </div>
          <div className="text-sm font-bold text-zinc-100 mt-1 truncate">
            {envelope.model}
          </div>
        </div>
      </div>

      {/* 1. System & Developer Instructions */}
      <section className="space-y-3">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-zinc-200">System & Developer Instructions</h3>
        </div>

        {context.systemInstructions.length === 0 ? (
          <div className="p-4 rounded-lg bg-zinc-900/40 border border-zinc-800/60 text-xs text-zinc-500 italic">
            No explicit system instructions in this request.
          </div>
        ) : (
          context.systemInstructions.map((sys) => (
            <div key={sys.id} className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">
                  {sys.source || 'system'}
                </span>
                <span className="text-[10px] text-emerald-400 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Mutable</span>
                </span>
              </div>
              <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap bg-zinc-950 p-3 rounded border border-zinc-800/80">
                {sys.content}
              </pre>
            </div>
          ))
        )}
      </section>

      {/* 2. Conversation History */}
      <section className="space-y-3">
        <div className="flex items-center space-x-2">
          <MessageSquare className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-zinc-200">Conversation Turns & Prompts</h3>
        </div>

        <div className="space-y-2.5">
          {context.conversationTurns.map((turn) => {
            const isUser = turn.role === 'user';
            const isAssistant = turn.role === 'assistant';
            const textContent = typeof turn.content === 'string'
              ? turn.content
              : JSON.stringify(turn.content, null, 2);

            return (
              <div
                key={turn.id}
                className={`p-4 rounded-lg border space-y-2 ${
                  isUser
                    ? 'bg-zinc-900/90 border-zinc-700/60'
                    : isAssistant
                    ? 'bg-zinc-900/40 border-zinc-800'
                    : 'bg-zinc-950 border-zinc-800/80'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={`font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                      isUser
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : isAssistant
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {turn.role}
                  </span>
                </div>

                <div className="text-xs font-mono text-zinc-200 whitespace-pre-wrap leading-relaxed">
                  {textContent}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Available Tools */}
      {context.tools.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center space-x-2">
            <Wrench className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-zinc-200">Exposed Tool Definitions</h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {context.tools.map((tool, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
                <span className="text-xs font-mono font-bold text-amber-400">{tool.name}</span>
                <p className="text-[11px] text-zinc-400">{tool.description || 'No description provided'}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
