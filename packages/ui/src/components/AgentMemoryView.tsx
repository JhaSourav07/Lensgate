import React, { useState, useEffect } from 'react';
import {
  Brain,
  FileCode,
  Sparkles,
  RefreshCw,
  Layers,
  MessageSquare,
  Search,
  ExternalLink,
  BookOpen,
  ChevronRight,
  Code,
} from 'lucide-react';
import Editor from '@monaco-editor/react';

interface StoredFile {
  path: string;
  relativePath: string;
  content: string;
  tokens: number;
  lines: number;
  sizeBytes: number;
  lastReadStep: number;
}

interface AgentMemoryData {
  conversationId: string;
  transcriptPath: string;
  storedFiles: StoredFile[];
  turns: { id: string; role: string; content: string }[];
  systemInstructions: { id: string; source: string; content: string }[];
  tokenBreakdown: {
    systemTokens: number;
    turnsTokens: number;
    codeTokens: number;
    toolsTokens: number;
    totalTokens: number;
  };
}

export const AgentMemoryView: React.FC = () => {
  const [data, setData] = useState<AgentMemoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [selectedFile, setSelectedFile] = useState<StoredFile | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [activeTab, setActiveTab] = useState<'files' | 'history'>('files');

  const fetchAgentMemory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/context/agent-memory');
      if (res.ok) {
        const mem: AgentMemoryData = await res.json();
        setData(mem);
        if (mem.storedFiles?.length > 0 && !selectedFile) {
          setSelectedFile(mem.storedFiles[0]);
          setEditorContent(mem.storedFiles[0].content);
        }
      }
    } catch (err) {
      console.error('Failed to load agent memory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgentMemory();
  }, []);

  const handleSelectFile = (file: StoredFile) => {
    setSelectedFile(file);
    setEditorContent(file.content);
  };

  const filteredFiles =
    data?.storedFiles?.filter((f) =>
      f.relativePath.toLowerCase().includes(filterText.toLowerCase())
    ) || [];

  const breakdown = data?.tokenBreakdown || {
    totalTokens: 0,
    codeTokens: 0,
    turnsTokens: 0,
    systemTokens: 0,
    toolsTokens: 0,
  };

  const total = Math.max(1, breakdown.totalTokens);
  const codePct = Math.round((breakdown.codeTokens / total) * 100);
  const turnsPct = Math.round((breakdown.turnsTokens / total) * 100);
  const sysPct = Math.round((breakdown.systemTokens / total) * 100);

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* Top Banner */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/40 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-zinc-100">AI Agent Active Context Memory</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                Session: {data?.conversationId || 'active'}
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Live inspection of exactly what code files, context, and conversation the AI has loaded into memory
            </p>
          </div>
        </div>

        <button
          onClick={fetchAgentMemory}
          disabled={loading}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 transition-all shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Refreshing...' : 'Refresh Memory'}</span>
        </button>
      </div>

      {/* Memory Token Breakdown Metrics */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/20 space-y-3 shrink-0">
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-lg">
            <div className="text-[11px] text-zinc-400 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Total Memory Tokens</span>
            </div>
            <div className="text-xl font-bold text-zinc-100 mt-1">
              {breakdown.totalTokens.toLocaleString()}{' '}
              <span className="text-xs text-zinc-500 font-normal">tokens</span>
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-lg">
            <div className="text-[11px] text-zinc-400 flex items-center space-x-1.5">
              <FileCode className="w-3.5 h-3.5 text-purple-400" />
              <span>Files Stored in Context</span>
            </div>
            <div className="text-xl font-bold text-purple-300 mt-1">
              {data?.storedFiles?.length || 0}{' '}
              <span className="text-xs text-zinc-500 font-normal">files ({breakdown.codeTokens.toLocaleString()} tok)</span>
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-lg">
            <div className="text-[11px] text-zinc-400 flex items-center space-x-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span>Conversation Turns</span>
            </div>
            <div className="text-xl font-bold text-emerald-300 mt-1">
              {data?.turns?.length || 0}{' '}
              <span className="text-xs text-zinc-500 font-normal">turns ({breakdown.turnsTokens.toLocaleString()} tok)</span>
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-lg">
            <div className="text-[11px] text-zinc-400 flex items-center space-x-1.5">
              <BookOpen className="w-3.5 h-3.5 text-blue-400" />
              <span>System Directives</span>
            </div>
            <div className="text-xl font-bold text-blue-300 mt-1">
              {data?.systemInstructions?.length || 0}{' '}
              <span className="text-xs text-zinc-500 font-normal">blocks ({breakdown.systemTokens.toLocaleString()} tok)</span>
            </div>
          </div>
        </div>

        {/* Segmented Memory Bar */}
        <div className="space-y-1">
          <div className="w-full h-2.5 bg-zinc-950 rounded-full overflow-hidden flex border border-zinc-800/80">
            {codePct > 0 && (
              <div
                className="bg-purple-500 h-full transition-all"
                style={{ width: `${codePct}%` }}
                title={`Files: ${breakdown.codeTokens.toLocaleString()} tok (${codePct}%)`}
              />
            )}
            {turnsPct > 0 && (
              <div
                className="bg-emerald-500 h-full transition-all"
                style={{ width: `${turnsPct}%` }}
                title={`Turns: ${breakdown.turnsTokens.toLocaleString()} tok (${turnsPct}%)`}
              />
            )}
            {sysPct > 0 && (
              <div
                className="bg-blue-500 h-full transition-all"
                style={{ width: `${sysPct}%` }}
                title={`System: ${breakdown.systemTokens.toLocaleString()} tok (${sysPct}%)`}
              />
            )}
          </div>
          <div className="flex justify-between text-[11px] text-zinc-500 font-mono">
            <span>Files in Memory ({codePct}%)</span>
            <span>Conversation History ({turnsPct}%)</span>
            <span>System Rules ({sysPct}%)</span>
          </div>
        </div>
      </div>

      {/* Tabs Switcher: Files In Memory vs History */}
      <div className="flex items-center px-4 border-b border-zinc-800 bg-zinc-900/40 space-x-4 text-xs font-semibold shrink-0">
        <button
          onClick={() => setActiveTab('files')}
          className={`py-2.5 flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'files'
              ? 'border-purple-500 text-purple-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>Files In Agent Context ({data?.storedFiles?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`py-2.5 flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Full Conversation History ({data?.turns?.length || 0})</span>
        </button>
      </div>

      {/* Main Split: File List vs In-Place Content Editor */}
      {activeTab === 'files' ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Stored Files */}
          <div className="w-2/5 border-r border-zinc-800 flex flex-col bg-zinc-950">
            <div className="p-3 border-b border-zinc-800 flex items-center space-x-2 bg-zinc-900/50">
              <Search className="w-3.5 h-3.5 text-zinc-500" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter files stored in memory..."
                className="bg-transparent border-none text-xs text-zinc-200 focus:outline-none w-full"
              />
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-zinc-900">
              {filteredFiles.map((file) => {
                const isSelected = selectedFile?.path === file.path;
                return (
                  <div
                    key={file.path}
                    onClick={() => handleSelectFile(file)}
                    className={`p-3 cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-purple-950/40 border-l-2 border-purple-500'
                        : 'hover:bg-zinc-900/60'
                    }`}
                  >
                    <div className="space-y-1 min-w-0 pr-3 flex-1">
                      <div className="flex items-center space-x-1.5">
                        <FileCode className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span className="text-xs font-mono text-zinc-200 truncate">
                          {file.relativePath}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500 flex items-center space-x-2">
                        <span>{file.lines} lines</span>
                        <span>•</span>
                        <span>{(file.sizeBytes / 1024).toFixed(1)} KB</span>
                        <span>•</span>
                        <span>Step #{file.lastReadStep}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono font-bold text-purple-400">
                        ~{file.tokens.toLocaleString()} tok
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Monaco Editor showing what AI stored */}
          <div className="flex-1 flex flex-col bg-zinc-900/30 overflow-hidden">
            {selectedFile ? (
              <>
                <div className="h-11 px-4 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between shrink-0">
                  <div className="flex items-center space-x-2 min-w-0">
                    <FileCode className="w-4 h-4 text-purple-400 shrink-0" />
                    <span className="text-xs font-mono font-semibold text-zinc-200 truncate">
                      {selectedFile.relativePath}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-mono">
                      ~{selectedFile.tokens.toLocaleString()} tokens in context
                    </span>
                  </div>

                  <div className="text-xs text-zinc-400">
                    Loaded at step #{selectedFile.lastReadStep}
                  </div>
                </div>

                <div className="flex-1 overflow-hidden relative">
                  <Editor
                    height="100%"
                    language="typescript"
                    theme="vs-dark"
                    value={editorContent}
                    onChange={(val) => setEditorContent(val || '')}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 12,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      readOnly: false,
                      wordWrap: 'on',
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500">
                <Brain className="w-8 h-8 mb-3 text-zinc-600" />
                <p className="text-sm font-semibold text-zinc-400">No File Selected</p>
                <p className="text-xs text-zinc-600 mt-1 max-w-sm">
                  Click any file on the left to see what the AI has stored in its context memory.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Conversation History Tab */
        <div className="flex-1 overflow-y-auto p-6 space-y-3 max-w-4xl mx-auto w-full">
          {data?.turns?.map((turn, i) => {
            const isUser = turn.role === 'user';
            return (
              <div
                key={turn.id || i}
                className={`p-4 rounded-lg border space-y-2 ${
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
                  <span className="text-[10px] text-zinc-500 font-mono">Turn #{i + 1}</span>
                </div>
                <div className="text-xs font-mono text-zinc-200 whitespace-pre-wrap leading-relaxed">
                  {turn.content}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
