import React, { useState, useEffect } from 'react';
import {
  Brain,
  FileCode,
  Sparkles,
  RefreshCw,
  Layers,
  MessageSquare,
  Search,
  BookOpen,
  Folder,
  FolderOpen,
  Save,
  Check,
  Lightbulb,
  Edit3,
  Sliders,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { FolderBrowserModal } from './FolderBrowserModal';

interface StoredFile {
  path: string;
  relativePath: string;
  folder: string;
  content: string;
  tokens: number;
  lines: number;
  sizeBytes: number;
  lastReadStep: number;
  outputStepIndex: number;
}

interface AgentTurn {
  id: string;
  stepIndex: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  toolCalls?: any[];
}

interface AgentMemoryData {
  conversationId: string;
  transcriptPath: string;
  rootFolder: string;
  storedFiles: StoredFile[];
  turns: AgentTurn[];
  systemInstructions: { id: string; source: string; content: string }[];
  tokenBreakdown: {
    systemTokens: number;
    turnsTokens: number;
    codeTokens: number;
    toolsTokens: number;
    totalTokens: number;
  };
  availableFolders: string[];
}

export const AgentMemoryView: React.FC = () => {
  const [data, setData] = useState<AgentMemoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [folderInput, setFolderInput] = useState<string>('');
  const [filterText, setFilterText] = useState('');
  const [selectedFile, setSelectedFile] = useState<StoredFile | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [activeTab, setActiveTab] = useState<'files' | 'history'>('files');
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);

  // Saving state
  const [savingFile, setSavingFile] = useState(false);
  const [fileSaveSuccess, setFileSaveSuccess] = useState(false);

  // Turn editing state
  const [editingTurnIndex, setEditingTurnIndex] = useState<number | null>(null);
  const [turnContentEdit, setTurnContentEdit] = useState('');
  const [turnThinkingEdit, setTurnThinkingEdit] = useState('');
  const [savingTurn, setSavingTurn] = useState<number | null>(null);
  const [turnSaveSuccess, setTurnSaveSuccess] = useState<number | null>(null);
  const [expandedThinking, setExpandedThinking] = useState<Record<number, boolean>>({});

  const fetchAgentMemory = async (folderOverride?: string) => {
    setLoading(true);
    const folderToQuery = folderOverride !== undefined ? folderOverride : selectedFolder;
    try {
      const q = folderToQuery && folderToQuery !== 'all' ? `?folder=${encodeURIComponent(folderToQuery)}` : '';
      const res = await fetch(`/api/context/agent-memory${q}`);
      if (res.ok) {
        const mem: AgentMemoryData = await res.json();
        setData(mem);
        if (mem.storedFiles?.length > 0) {
          // Keep current selected file if in list, else pick first
          const found = mem.storedFiles.find((f) => f.path === selectedFile?.path) || mem.storedFiles[0];
          setSelectedFile(found);
          setFileContent(found.content);
        } else {
          setSelectedFile(null);
          setFileContent('');
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
    setFileContent(file.content);
    setFileSaveSuccess(false);
  };

  const handleFolderChange = (folder: string) => {
    setSelectedFolder(folder);
    setFolderInput(folder === 'all' ? '' : folder);
    fetchAgentMemory(folder);
  };

  const handleSaveMemoryFile = async () => {
    if (!selectedFile || !data) return;
    setSavingFile(true);
    try {
      const res = await fetch('/api/context/save-memory-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcriptPath: data.transcriptPath,
          filePath: selectedFile.path,
          content: fileContent,
        }),
      });
      if (res.ok) {
        const resData = await res.json();
        setFileSaveSuccess(true);
        setTimeout(() => setFileSaveSuccess(false), 3000);

        // Update local state
        setSelectedFile((prev) => (prev ? { ...prev, content: fileContent, tokens: resData.tokens } : null));
        setData((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            storedFiles: prev.storedFiles.map((f) =>
              f.path === selectedFile.path ? { ...f, content: fileContent, tokens: resData.tokens } : f
            ),
          };
        });
      }
    } catch (err) {
      console.error('Failed to save memory file:', err);
    } finally {
      setSavingFile(false);
    }
  };

  const handleStartEditTurn = (turn: AgentTurn) => {
    setEditingTurnIndex(turn.stepIndex);
    setTurnContentEdit(turn.content);
    setTurnThinkingEdit(turn.thinking || '');
  };

  const handleSaveTurn = async (turn: AgentTurn) => {
    if (!data) return;
    setSavingTurn(turn.stepIndex);
    try {
      const res = await fetch('/api/context/save-memory-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcriptPath: data.transcriptPath,
          stepIndex: turn.stepIndex,
          content: turnContentEdit,
          thinking: turnThinkingEdit || undefined,
        }),
      });
      if (res.ok) {
        setTurnSaveSuccess(turn.stepIndex);
        setTimeout(() => setTurnSaveSuccess(null), 3000);

        // Update local turn state
        setData((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            turns: prev.turns.map((t) =>
              t.stepIndex === turn.stepIndex
                ? { ...t, content: turnContentEdit, thinking: turnThinkingEdit || undefined }
                : t
            ),
          };
        });
        setEditingTurnIndex(null);
      }
    } catch (err) {
      console.error('Failed to save turn in memory:', err);
    } finally {
      setSavingTurn(null);
    }
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
      {/* 1. Top Bar: Folder Selection & Session Memory Info */}
      <div className="p-3.5 border-b border-zinc-800 bg-zinc-900/60 space-y-2.5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
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
                Inspect and edit files and conversation history stored in agent context. Edited items are sent on the next request.
              </p>
            </div>
          </div>

          {/* Folder Filter Input, Browse & Refresh */}
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={folderInput}
              onChange={(e) => setFolderInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFolderChange(folderInput)}
              placeholder="Filter by folder path (e.g. packages/core)..."
              className="w-80 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={() => handleFolderChange(folderInput)}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold cursor-pointer transition-all border border-zinc-700"
            >
              Apply Folder
            </button>
            <button
              onClick={() => setIsBrowserOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-purple-300 rounded-lg text-xs font-semibold cursor-pointer transition-all border border-purple-500/30 active:scale-95"
              title="Browse workspace folders"
            >
              <FolderOpen className="w-3.5 h-3.5 text-purple-400" />
              <span>Browse</span>
            </button>
            <button
              onClick={() => fetchAgentMemory()}
              disabled={loading}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 transition-all shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Folder Chips / Presets */}
        <div className="flex items-center space-x-2 text-xs overflow-x-auto pt-1">
          <span className="text-[11px] text-zinc-500 font-medium shrink-0 flex items-center space-x-1">
            <Folder className="w-3 h-3 text-zinc-400" />
            <span>Context Folders:</span>
          </span>

          <button
            onClick={() => handleFolderChange('all')}
            className={`px-2 py-0.5 rounded text-[11px] font-mono shrink-0 transition-all cursor-pointer ${
              selectedFolder === 'all'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800'
            }`}
          >
            All Folders ({data?.storedFiles?.length || 0})
          </button>

          {data?.availableFolders?.map((f) => {
            const isActive = selectedFolder === f;
            return (
              <button
                key={f}
                onClick={() => handleFolderChange(f)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono shrink-0 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800'
                }`}
              >
                📁 {f}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Memory Token Metrics */}
      <div className="p-3.5 border-b border-zinc-800 bg-zinc-900/20 space-y-3 shrink-0">
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-lg">
            <div className="text-[11px] text-zinc-400 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Total Context Tokens</span>
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
              {filteredFiles.length}{' '}
              <span className="text-xs text-zinc-500 font-normal">
                files ({breakdown.codeTokens.toLocaleString()} tok)
              </span>
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-lg">
            <div className="text-[11px] text-zinc-400 flex items-center space-x-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span>Conversation Turns</span>
            </div>
            <div className="text-xl font-bold text-emerald-300 mt-1">
              {data?.turns?.length || 0}{' '}
              <span className="text-xs text-zinc-500 font-normal">
                turns ({breakdown.turnsTokens.toLocaleString()} tok)
              </span>
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-lg">
            <div className="text-[11px] text-zinc-400 flex items-center space-x-1.5">
              <BookOpen className="w-3.5 h-3.5 text-blue-400" />
              <span>System Directives</span>
            </div>
            <div className="text-xl font-bold text-blue-300 mt-1">
              {data?.systemInstructions?.length || 0}{' '}
              <span className="text-xs text-zinc-500 font-normal">
                blocks ({breakdown.systemTokens.toLocaleString()} tok)
              </span>
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
            <span>Conversation History & Thinking ({turnsPct}%)</span>
            <span>System Rules ({sysPct}%)</span>
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
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
          <span>Files In Agent Context ({filteredFiles.length})</span>
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
          <span>Full Conversation History & Thinking ({data?.turns?.length || 0})</span>
        </button>
      </div>

      {/* 4. Tab Content */}
      {activeTab === 'files' ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Stored Files */}
          <div className="w-2/5 border-r border-zinc-800 flex flex-col bg-zinc-950">
            <div className="p-3 border-b border-zinc-800 flex items-center space-x-2 bg-zinc-900/50">
              <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter files stored in memory..."
                className="bg-transparent border-none text-xs text-zinc-200 focus:outline-none w-full"
              />
              <button
                onClick={() => setIsBrowserOpen(true)}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-purple-300 text-[11px] font-semibold border border-purple-500/30 shrink-0 cursor-pointer transition-all active:scale-95"
                title="Browse workspace folders"
              >
                <FolderOpen className="w-3 h-3 text-purple-400" />
                <span>Browse</span>
              </button>
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

          {/* Right: Monaco Editor showing what AI stored with Save Button */}
          <div className="flex-1 flex flex-col bg-zinc-900/30 overflow-hidden">
            {selectedFile ? (
              <>
                <div className="h-12 px-4 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between shrink-0">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <FileCode className="w-4 h-4 text-purple-400 shrink-0" />
                    <span className="text-xs font-mono font-semibold text-zinc-200 truncate">
                      {selectedFile.relativePath}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-mono">
                      ~{selectedFile.tokens.toLocaleString()} tokens in context
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    {fileSaveSuccess && (
                      <span className="text-xs text-emerald-400 flex items-center space-x-1 animate-fadeIn">
                        <Check className="w-3.5 h-3.5" />
                        <span>Saved to AI Memory!</span>
                      </span>
                    )}

                    <button
                      onClick={handleSaveMemoryFile}
                      disabled={savingFile}
                      className="flex items-center space-x-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold cursor-pointer disabled:opacity-50 transition-all shadow-sm active:scale-95"
                      title="Save modified file content into agent memory transcript on disk"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{savingFile ? 'Saving...' : 'Save to Memory'}</span>
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-hidden relative">
                  <Editor
                    height="100%"
                    language={
                      selectedFile.relativePath.endsWith('.ts') || selectedFile.relativePath.endsWith('.tsx')
                        ? 'typescript'
                        : selectedFile.relativePath.endsWith('.json')
                        ? 'json'
                        : selectedFile.relativePath.endsWith('.md')
                        ? 'markdown'
                        : 'javascript'
                    }
                    theme="vs-dark"
                    value={fileContent}
                    onChange={(val) => setFileContent(val || '')}
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
                  Click any file on the left to inspect and edit what the AI has stored in its context memory.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Conversation History & Thinking Tab (Fully Editable!) */
        <div className="flex-1 overflow-y-auto p-6 space-y-4 max-w-4xl mx-auto w-full">
          {/* History tab toolbar with Browse button */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800 text-xs">
            <div className="text-zinc-400 flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <span>
                Showing <strong className="text-zinc-200">{data?.turns?.length || 0}</strong> conversation turns in memory
              </span>
              {selectedFolder && selectedFolder !== 'all' && (
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  📁 {selectedFolder}
                </span>
              )}
            </div>
            <button
              onClick={() => setIsBrowserOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-purple-300 text-xs font-semibold border border-purple-500/30 cursor-pointer transition-all active:scale-95"
              title="Browse workspace folders"
            >
              <FolderOpen className="w-3.5 h-3.5 text-purple-400" />
              <span>Browse Folder</span>
            </button>
          </div>

          {data?.turns?.map((turn) => {
            const isUser = turn.role === 'user';
            const isEditing = editingTurnIndex === turn.stepIndex;
            const isSaving = savingTurn === turn.stepIndex;
            const isSaved = turnSaveSuccess === turn.stepIndex;
            const isThinkingOpen = Boolean(expandedThinking[turn.stepIndex]);

            return (
              <div
                key={turn.id}
                className={`p-4 rounded-xl border space-y-3 transition-all ${
                  isUser
                    ? 'bg-zinc-900/90 border-zinc-700/60'
                    : 'bg-zinc-900/40 border-zinc-800'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                        isUser
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      }`}
                    >
                      {turn.role}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">Step #{turn.stepIndex}</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    {isSaved && (
                      <span className="text-xs text-emerald-400 flex items-center space-x-1 animate-fadeIn">
                        <Check className="w-3.5 h-3.5" />
                        <span>Saved to Context!</span>
                      </span>
                    )}

                    {!isEditing ? (
                      <button
                        onClick={() => handleStartEditTurn(turn)}
                        className="flex items-center space-x-1 px-2.5 py-1 text-xs text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded border border-zinc-700 cursor-pointer transition-all"
                      >
                        <Edit3 className="w-3 h-3 text-purple-400" />
                        <span>Edit Turn</span>
                      </button>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setEditingTurnIndex(null)}
                          className="px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveTurn(turn)}
                          disabled={isSaving}
                          className="flex items-center space-x-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold cursor-pointer disabled:opacity-50 transition-all shadow-sm"
                        >
                          <Save className="w-3 h-3" />
                          <span>{isSaving ? 'Saving...' : 'Save Turn'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Turn Content / Editor */}
                {isEditing ? (
                  <div className="space-y-3">
                    {/* Model Thinking Editor if Assistant */}
                    {!isUser && (
                      <div className="space-y-1.5 p-3 rounded-lg bg-amber-950/20 border border-amber-800/40">
                        <label className="text-[11px] font-semibold text-amber-300 flex items-center space-x-1">
                          <Lightbulb className="w-3.5 h-3.5" />
                          <span>Model Thinking Process (Chain-of-Thought)</span>
                        </label>
                        <textarea
                          rows={4}
                          value={turnThinkingEdit}
                          onChange={(e) => setTurnThinkingEdit(e.target.value)}
                          placeholder="Edit or inject model thinking process..."
                          className="w-full bg-zinc-950 border border-amber-900/60 rounded p-2.5 text-xs font-mono text-amber-100/90 focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Turn Content Editor */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-zinc-400">
                        {isUser ? 'User Prompt / Request' : 'Model Response Content'}
                      </label>
                      <textarea
                        rows={5}
                        value={turnContentEdit}
                        onChange={(e) => setTurnContentEdit(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded p-2.5 text-xs font-mono text-zinc-200 focus:outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Model Thinking Preview if present */}
                    {turn.thinking && (
                      <div className="rounded-lg bg-amber-950/20 border border-amber-900/40 p-2.5 text-xs text-amber-200/90 font-mono">
                        <div
                          onClick={() =>
                            setExpandedThinking((prev) => ({
                              ...prev,
                              [turn.stepIndex]: !prev[turn.stepIndex],
                            }))
                          }
                          className="flex items-center justify-between cursor-pointer text-amber-300/80 font-semibold select-none"
                        >
                          <span className="flex items-center space-x-1.5">
                            <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                            <span>Model Thinking Process</span>
                          </span>
                          <span className="text-[10px]">
                            {isThinkingOpen ? 'Collapse ▲' : 'Expand Thinking ▼'}
                          </span>
                        </div>

                        {isThinkingOpen ? (
                          <pre className="mt-2 text-xs text-amber-100/80 whitespace-pre-wrap max-h-60 overflow-y-auto">
                            {turn.thinking}
                          </pre>
                        ) : (
                          <p className="mt-1 text-[11px] text-amber-200/60 truncate">
                            {turn.thinking.slice(0, 140)}...
                          </p>
                        )}
                      </div>
                    )}

                    {/* Main Content */}
                    <div className="text-xs font-mono text-zinc-200 whitespace-pre-wrap leading-relaxed bg-zinc-950/60 p-3 rounded border border-zinc-800/80">
                      {turn.content || <span className="italic text-zinc-500">(Tool execution turn)</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Folder Browser Modal */}
      <FolderBrowserModal
        isOpen={isBrowserOpen}
        onClose={() => setIsBrowserOpen(false)}
        onSelectFolder={(folder) => handleFolderChange(folder)}
        initialPath={selectedFolder === 'all' ? '' : selectedFolder}
        title="Browse Workspace Folders"
        subtitle="Select a directory to scope files and context history"
      />
    </div>
  );
};
