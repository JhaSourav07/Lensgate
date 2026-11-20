import React, { useState } from 'react';
import { LensgateContextEnvelope, CodeAttachment } from '@lensgate/shared';
import {
  BookOpen,
  MessageSquare,
  Wrench,
  FileCode,
  CheckCircle2,
  Sparkles,
  Edit2,
  Check,
  ChevronDown,
  ChevronRight,
  Code,
} from 'lucide-react';

interface ContextInspectorProps {
  envelope: LensgateContextEnvelope;
  modifiedBody?: any;
  onUpdateContent?: (newBody: any) => void;
}

export const ContextInspector: React.FC<ContextInspectorProps> = ({
  envelope,
  modifiedBody,
  onUpdateContent,
}) => {
  const context = envelope.context;
  const breakdown = envelope.tokenBreakdown || {
    totalTokens: Math.max(1, Math.round(JSON.stringify(envelope.rawBody || {}).length / 3.8)),
    codeTokens: 0,
    turnsTokens: Math.round(
      (context.conversationTurns.reduce((acc, t) => acc + (typeof t.content === 'string' ? t.content.length : 100), 0)) / 3.8
    ),
    systemTokens: Math.round(
      (context.systemInstructions.reduce((acc, s) => acc + s.content.length, 0)) / 3.8
    ),
    toolsTokens: Math.round(JSON.stringify(context.tools || []).length / 3.8),
  };

  const [editingTurnId, setEditingTurnId] = useState<string | null>(null);
  const [turnEditText, setTurnEditText] = useState('');
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});

  const total = Math.max(1, breakdown.totalTokens);
  const codePct = Math.round((breakdown.codeTokens / total) * 100);
  const turnsPct = Math.round((breakdown.turnsTokens / total) * 100);
  const sysPct = Math.round((breakdown.systemTokens / total) * 100);
  const toolsPct = Math.round((breakdown.toolsTokens / total) * 100);

  const handleStartEditTurn = (turnId: string, currentText: string) => {
    setEditingTurnId(turnId);
    setTurnEditText(currentText);
  };

  const handleSaveTurn = (turnId: string) => {
    if (!onUpdateContent) return;
    const body = JSON.parse(JSON.stringify(modifiedBody || envelope.rawBody || {}));

    if (Array.isArray(body.messages)) {
      const idx = context.conversationTurns.findIndex((t) => t.id === turnId);
      if (idx !== -1 && body.messages[idx]) {
        body.messages[idx].content = turnEditText;
      }
    }

    onUpdateContent(body);
    setEditingTurnId(null);
  };

  const toggleFile = (path: string) => {
    setExpandedFiles((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-w-4xl mx-auto font-sans">
      {/* 1. Context Token Breakdown Banner */}
      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
              Context Token Consumption
            </span>
          </div>
          <div className="text-xs font-mono font-bold text-purple-300">
            {breakdown.totalTokens.toLocaleString()}{' '}
            <span className="text-zinc-500 font-normal">total tokens</span>
          </div>
        </div>

        {/* Visual Segmented Bar */}
        <div className="w-full h-3 bg-zinc-950 rounded-full overflow-hidden flex border border-zinc-800/80">
          {codePct > 0 && (
            <div
              className="bg-purple-500 h-full transition-all"
              style={{ width: `${codePct}%` }}
              title={`Attached Code Files: ${breakdown.codeTokens.toLocaleString()} tok (${codePct}%)`}
            />
          )}
          {turnsPct > 0 && (
            <div
              className="bg-emerald-500 h-full transition-all"
              style={{ width: `${turnsPct}%` }}
              title={`Conversation Turns: ${breakdown.turnsTokens.toLocaleString()} tok (${turnsPct}%)`}
            />
          )}
          {sysPct > 0 && (
            <div
              className="bg-blue-500 h-full transition-all"
              style={{ width: `${sysPct}%` }}
              title={`System Instructions: ${breakdown.systemTokens.toLocaleString()} tok (${sysPct}%)`}
            />
          )}
          {toolsPct > 0 && (
            <div
              className="bg-amber-500 h-full transition-all"
              style={{ width: `${toolsPct}%` }}
              title={`Tool Definitions: ${breakdown.toolsTokens.toLocaleString()} tok (${toolsPct}%)`}
            />
          )}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-4 gap-2 text-[11px] pt-1">
          <div className="flex items-center space-x-1.5 text-purple-300">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <span>Files: {breakdown.codeTokens.toLocaleString()} tok</span>
          </div>
          <div className="flex items-center space-x-1.5 text-emerald-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Prompts: {breakdown.turnsTokens.toLocaleString()} tok</span>
          </div>
          <div className="flex items-center space-x-1.5 text-blue-300">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span>System: {breakdown.systemTokens.toLocaleString()} tok</span>
          </div>
          <div className="flex items-center space-x-1.5 text-amber-300">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Tools: {breakdown.toolsTokens.toLocaleString()} tok</span>
          </div>
        </div>
      </div>

      {/* 2. Overview Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-lg">
          <div className="text-[11px] text-zinc-400 flex items-center space-x-1.5">
            <FileCode className="w-3.5 h-3.5 text-purple-400" />
            <span>Files Attached</span>
          </div>
          <div className="text-lg font-bold text-zinc-100 mt-1">
            {context.codeAttachments.length} file(s)
          </div>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-lg">
          <div className="text-[11px] text-zinc-400 flex items-center space-x-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span>Prompt Turns</span>
          </div>
          <div className="text-lg font-bold text-zinc-100 mt-1">
            {context.conversationTurns.length} message(s)
          </div>
        </div>

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
            <Wrench className="w-3.5 h-3.5 text-amber-400" />
            <span>Model Target</span>
          </div>
          <div className="text-sm font-bold text-zinc-100 mt-1 truncate">
            {envelope.model}
          </div>
        </div>
      </div>

      {/* 3. Attached Code Files & Token Breakdown */}
      {context.codeAttachments.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center space-x-2">
            <FileCode className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-zinc-200">
              Attached Code Files ({context.codeAttachments.length})
            </h3>
          </div>

          <div className="space-y-2">
            {context.codeAttachments.map((file, idx) => {
              const isExpanded = Boolean(expandedFiles[file.path || idx]);
              const tokens = file.tokenCount || Math.ceil(file.content.length / 3.8);

              return (
                <div key={idx} className="bg-zinc-900/70 border border-zinc-800 rounded-lg overflow-hidden">
                  <div
                    onClick={() => toggleFile(file.path || String(idx))}
                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-zinc-800/40 transition-all select-none"
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-zinc-400" />
                      )}
                      <Code className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="text-xs font-mono font-medium text-zinc-200 truncate">
                        {file.path || `attachment-${idx + 1}`}
                      </span>
                    </div>

                    <div className="flex items-center space-x-3 text-xs">
                      <span className="text-purple-400 font-mono font-semibold">
                        ~{tokens.toLocaleString()} tokens
                      </span>
                      <span className="text-zinc-500 font-mono text-[11px]">
                        {(file.content.length / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-3 border-t border-zinc-800 bg-zinc-950">
                      <pre className="text-xs font-mono text-zinc-300 max-h-60 overflow-y-auto whitespace-pre-wrap">
                        {file.content}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. Conversation Turns & In-Place Editing */}
      <section className="space-y-3">
        <div className="flex items-center space-x-2">
          <MessageSquare className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-zinc-200">Conversation Turns & Prompts</h3>
        </div>

        <div className="space-y-2.5">
          {context.conversationTurns.map((turn) => {
            const isUser = turn.role === 'user';
            const isEditing = editingTurnId === turn.id;
            const textContent =
              typeof turn.content === 'string'
                ? turn.content
                : JSON.stringify(turn.content, null, 2);

            return (
              <div
                key={turn.id}
                className={`p-4 rounded-lg border space-y-2.5 ${
                  isUser
                    ? 'bg-zinc-900/90 border-zinc-700/60'
                    : 'bg-zinc-900/40 border-zinc-800'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={`font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                      isUser
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    }`}
                  >
                    {turn.role}
                  </span>

                  {envelope.status === 'pending' && !isEditing && (
                    <button
                      onClick={() => handleStartEditTurn(turn.id, textContent)}
                      className="flex items-center space-x-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit In Place</span>
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      rows={5}
                      value={turnEditText}
                      onChange={(e) => setTurnEditText(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-xs font-mono text-zinc-200 focus:outline-none"
                    />
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => setEditingTurnId(null)}
                        className="px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveTurn(turn.id)}
                        className="flex items-center space-x-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Apply Change</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs font-mono text-zinc-200 whitespace-pre-wrap leading-relaxed">
                    {textContent}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. System Instructions */}
      <section className="space-y-3">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-zinc-200">System & Developer Instructions</h3>
        </div>

        {context.systemInstructions.map((sys) => (
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
        ))}
      </section>
    </div>
  );
};
