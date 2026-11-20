import React, { useState, useEffect } from 'react';
import {
  FolderTree,
  FileCode,
  Sparkles,
  RefreshCw,
  HardDrive,
  Layers,
  Edit3,
  Check,
  Search,
  ExternalLink,
  ArrowUp,
  Folder,
  Save,
  AlertCircle,
  Clock,
} from 'lucide-react';
import Editor from '@monaco-editor/react';

interface FileTokenInfo {
  path: string;
  relativePath: string;
  tokens: number;
  sizeBytes: number;
  lines: number;
  extension: string;
}

interface FolderTokenSummary {
  folder: string;
  tokens: number;
  fileCount: number;
}

interface WorkspaceTokenReport {
  rootPath: string;
  totalTokens: number;
  totalFiles: number;
  topFiles: FileTokenInfo[];
  folderBreakdown: FolderTokenSummary[];
}

interface BrowseData {
  current: string;
  parent: string | null;
  subfolders: string[];
  presets: { name: string; path: string }[];
}

export const WorkspaceTokenExplorer: React.FC = () => {
  const [report, setReport] = useState<WorkspaceTokenReport | null>(null);
  const [browse, setBrowse] = useState<BrowseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [dirPath, setDirPath] = useState('');
  const [filterText, setFilterText] = useState('');
  const [selectedFile, setSelectedFile] = useState<FileTokenInfo | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loadingContent, setLoadingContent] = useState(false);
  const [savingFile, setSavingFile] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [contextLimit, setContextLimit] = useState<number>(128000); // Default 128k context (GPT-4o / Claude 3.5 Sonnet)

  const fetchWorkspaceTokens = async (targetPath?: string) => {
    const pathToAnalyze = (targetPath !== undefined ? targetPath : dirPath).trim();
    setLoading(true);
    try {
      // 1. Analyze workspace tokens
      const res = await fetch('/api/context/workspace-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dirPath: pathToAnalyze || undefined }),
      });
      if (res.ok) {
        const data: WorkspaceTokenReport = await res.json();
        setReport(data);
        setDirPath(data.rootPath);
        if (data.topFiles.length > 0) {
          loadFileContent(data.topFiles[0]);
        } else {
          setSelectedFile(null);
          setFileContent('');
        }
      }

      // 2. Fetch browse info (subfolders & presets)
      const bRes = await fetch(`/api/context/browse-folders?dir=${encodeURIComponent(pathToAnalyze || '')}`);
      if (bRes.ok) {
        const bData: BrowseData = await bRes.json();
        setBrowse(bData);
      }
    } catch (err) {
      console.error('Failed to load workspace tokens:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadFileContent = async (file: FileTokenInfo) => {
    setSelectedFile(file);
    setLoadingContent(true);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/context/file-content?path=${encodeURIComponent(file.path)}`);
      if (res.ok) {
        const data = await res.json();
        setFileContent(data.content || '');
      } else {
        setFileContent(`// Error loading file contents from ${file.path}`);
      }
    } catch {
      setFileContent(`// Network error reading file`);
    } finally {
      setLoadingContent(false);
    }
  };

  const handleSaveFile = async () => {
    if (!selectedFile) return;
    setSavingFile(true);
    try {
      const res = await fetch('/api/context/save-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedFile.path, content: fileContent }),
      });
      if (res.ok) {
        const data = await res.json();
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);

        // Update local file token count
        setSelectedFile((prev) => (prev ? { ...prev, tokens: data.tokens, lines: data.lines } : null));

        // Re-analyze workspace tokens to update totals
        const reRes = await fetch('/api/context/workspace-tokens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dirPath }),
        });
        if (reRes.ok) {
          setReport(await reRes.json());
        }
      }
    } catch (err) {
      console.error('Failed to save file:', err);
    } finally {
      setSavingFile(false);
    }
  };

  useEffect(() => {
    fetchWorkspaceTokens();
  }, []);

  const handleKeyDownPath = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      fetchWorkspaceTokens(dirPath);
    }
  };

  const filteredFiles =
    report?.topFiles.filter((f) =>
      f.relativePath.toLowerCase().includes(filterText.toLowerCase())
    ) || [];

  const totalTokens = report?.totalTokens || 0;
  const budgetPercent = Math.min(100, Math.round((totalTokens / contextLimit) * 100));

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* 1. Folder Navigation & Analysis Bar */}
      <div className="p-3.5 border-b border-zinc-800 bg-zinc-900/60 space-y-2.5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <FolderTree className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Workspace Token & File Consumption</h2>
              <p className="text-xs text-zinc-400">
                Analyze and edit file token costs across any directory before sending context to AI agents
              </p>
            </div>
          </div>

          {/* Directory Input, Up Button & Scan Button */}
          <div className="flex items-center space-x-2">
            {browse?.parent && (
              <button
                onClick={() => fetchWorkspaceTokens(browse.parent!)}
                disabled={loading}
                className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium cursor-pointer transition-all border border-zinc-700/60"
                title={`Navigate up to ${browse.parent}`}
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            )}

            <div className="relative">
              <input
                type="text"
                value={dirPath}
                onChange={(e) => setDirPath(e.target.value)}
                onKeyDown={handleKeyDownPath}
                placeholder="Enter folder path to analyze..."
                className="w-96 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-purple-500 transition-all"
              />
            </div>

            <button
              onClick={() => fetchWorkspaceTokens(dirPath)}
              disabled={loading}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 transition-all shadow-sm active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Analyzing...' : 'Analyze Folder'}</span>
            </button>
          </div>
        </div>

        {/* Quick Folder Presets & Subfolders */}
        <div className="flex items-center space-x-2 text-xs overflow-x-auto pt-1">
          <span className="text-[11px] text-zinc-500 font-medium shrink-0 flex items-center space-x-1">
            <Folder className="w-3 h-3 text-zinc-400" />
            <span>Quick Presets:</span>
          </span>

          {browse?.presets?.map((p) => {
            const isActive = report?.rootPath === p.path;
            return (
              <button
                key={p.path}
                onClick={() => fetchWorkspaceTokens(p.path)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono shrink-0 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-semibold'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800'
                }`}
              >
                {p.name}
              </button>
            );
          })}

          {/* Subfolder jumps */}
          {browse?.subfolders && browse.subfolders.length > 0 && (
            <>
              <span className="text-[11px] text-zinc-600 shrink-0">|</span>
              <span className="text-[11px] text-zinc-500 font-medium shrink-0">Subfolders:</span>
              {browse.subfolders.slice(0, 6).map((sf) => (
                <button
                  key={sf}
                  onClick={() => fetchWorkspaceTokens(`${report?.rootPath}/${sf}`)}
                  className="px-2 py-0.5 rounded text-[11px] font-mono text-zinc-400 bg-zinc-900/60 hover:bg-zinc-800 hover:text-zinc-200 border border-zinc-800/80 shrink-0 transition-all"
                >
                  📁 {sf}/
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* 2. Metric Cards & Context Window Budget Bar */}
      {report && (
        <div className="p-3.5 border-b border-zinc-800 bg-zinc-900/20 space-y-3 shrink-0">
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-lg">
              <div className="text-[11px] text-zinc-400 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Total Folder Tokens</span>
              </div>
              <div className="text-xl font-bold text-zinc-100 mt-1">
                {report.totalTokens.toLocaleString()}{' '}
                <span className="text-xs text-zinc-500 font-normal">tokens</span>
              </div>
            </div>

            <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-lg">
              <div className="text-[11px] text-zinc-400 flex items-center space-x-1.5">
                <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                <span>Analyzed Code Files</span>
              </div>
              <div className="text-xl font-bold text-zinc-100 mt-1">
                {report.totalFiles}{' '}
                <span className="text-xs text-zinc-500 font-normal">files</span>
              </div>
            </div>

            <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-lg">
              <div className="text-[11px] text-zinc-400 flex items-center justify-between">
                <span className="flex items-center space-x-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Context Window Fit</span>
                </span>
                <select
                  value={contextLimit}
                  onChange={(e) => setContextLimit(Number(e.target.value))}
                  className="bg-zinc-950 border border-zinc-800 text-[10px] text-zinc-300 rounded px-1.5 py-0.5"
                >
                  <option value={128000}>128k (GPT-4o)</option>
                  <option value={200000}>200k (Claude 3.5)</option>
                  <option value={1000000}>1M (Gemini 1.5/2.0)</option>
                </select>
              </div>
              <div className="text-xl font-bold text-zinc-100 mt-1">
                {budgetPercent}%{' '}
                <span className="text-xs text-zinc-500 font-normal">
                  of {(contextLimit / 1000)}k window
                </span>
              </div>
            </div>

            <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-lg">
              <div className="text-[11px] text-zinc-400">Heaviest Subdirectory</div>
              <div className="text-base font-bold text-amber-300 mt-1 truncate">
                {report.folderBreakdown[0]?.folder || 'None'}
              </div>
              <div className="text-[11px] text-zinc-500">
                {report.folderBreakdown[0]?.tokens.toLocaleString()} tokens ({report.folderBreakdown[0]?.fileCount} files)
              </div>
            </div>
          </div>

          {/* Context Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-zinc-400">
              <span className="font-mono text-zinc-300 truncate max-w-lg">
                Directory: {report.rootPath}
              </span>
              <span className="font-mono text-purple-300">
                {report.totalTokens.toLocaleString()} / {contextLimit.toLocaleString()} tok ({budgetPercent}%)
              </span>
            </div>
            <div className="w-full h-2.5 bg-zinc-950 rounded-full overflow-hidden flex border border-zinc-800">
              <div
                className={`h-full transition-all ${
                  budgetPercent > 90
                    ? 'bg-rose-500'
                    : budgetPercent > 60
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${budgetPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Split: File List & Subfolder Pills vs Live Monaco In-Place Editor */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Files sorted by token cost */}
        <div className="w-2/5 border-r border-zinc-800 flex flex-col bg-zinc-950">
          {/* Search bar */}
          <div className="p-3 border-b border-zinc-800 flex items-center space-x-2 bg-zinc-900/50">
            <Search className="w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Search files by path or extension..."
              className="bg-transparent border-none text-xs text-zinc-200 focus:outline-none w-full"
            />
          </div>

          {/* Folder Breakdown Quick Filters */}
          {report?.folderBreakdown && report.folderBreakdown.length > 0 && (
            <div className="p-2 border-b border-zinc-800 flex items-center space-x-1.5 overflow-x-auto bg-zinc-900/20 text-xs">
              {report.folderBreakdown.slice(0, 6).map((f) => (
                <button
                  key={f.folder}
                  onClick={() => setFilterText(f.folder === '(root)' ? '' : f.folder)}
                  className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-[11px] shrink-0 font-mono transition-all"
                >
                  {f.folder}: <span className="text-purple-400 font-semibold">{f.tokens.toLocaleString()} tok</span>
                </button>
              ))}
            </div>
          )}

          {/* Files List */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-900">
            {filteredFiles.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-xs">
                No files found matching filter in this folder.
              </div>
            ) : (
              filteredFiles.map((file) => {
                const isSelected = selectedFile?.path === file.path;
                const filePercent = totalTokens > 0 ? Math.round((file.tokens / totalTokens) * 100) : 0;

                return (
                  <div
                    key={file.path}
                    onClick={() => loadFileContent(file)}
                    className={`p-3 cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-purple-950/40 border-l-2 border-purple-500'
                        : 'hover:bg-zinc-900/60'
                    }`}
                  >
                    <div className="space-y-1 min-w-0 pr-3 flex-1">
                      <div className="flex items-center space-x-1.5">
                        <FileCode className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="text-xs font-mono text-zinc-200 truncate">
                          {file.relativePath}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500 flex items-center space-x-2">
                        <span>{file.lines} lines</span>
                        <span>•</span>
                        <span>{(file.sizeBytes / 1024).toFixed(1)} KB</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono font-bold text-purple-400">
                        ~{file.tokens.toLocaleString()} tok
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono">
                        {filePercent}% of folder
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Live File Content & In-Place Monaco Editor */}
        <div className="flex-1 flex flex-col bg-zinc-900/30 overflow-hidden">
          {selectedFile ? (
            <>
              {/* File Action Header */}
              <div className="h-12 px-4 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <FileCode className="w-4 h-4 text-purple-400 shrink-0" />
                  <span className="text-xs font-mono font-semibold text-zinc-200 truncate">
                    {selectedFile.relativePath}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-mono">
                    ~{selectedFile.tokens.toLocaleString()} tokens
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  <span className="text-xs text-zinc-400">
                    {selectedFile.lines} lines • {(selectedFile.sizeBytes / 1024).toFixed(1)} KB
                  </span>

                  {saveSuccess && (
                    <span className="text-xs text-emerald-400 flex items-center space-x-1 animate-fadeIn">
                      <Check className="w-3.5 h-3.5" />
                      <span>Saved!</span>
                    </span>
                  )}

                  <button
                    onClick={handleSaveFile}
                    disabled={savingFile}
                    className="flex items-center space-x-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold cursor-pointer disabled:opacity-50 transition-all shadow-sm"
                    title="Save changes to disk and update token consumption"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingFile ? 'Saving...' : 'Save File'}</span>
                  </button>
                </div>
              </div>

              {/* In-Place Monaco Editor */}
              <div className="flex-1 overflow-hidden relative">
                {loadingContent ? (
                  <div className="flex items-center justify-center h-full text-zinc-500 text-xs">
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    <span>Loading file content...</span>
                  </div>
                ) : (
                  <Editor
                    height="100%"
                    language={
                      selectedFile.extension === '.ts' || selectedFile.extension === '.tsx'
                        ? 'typescript'
                        : selectedFile.extension === '.json'
                        ? 'json'
                        : selectedFile.extension === '.md'
                        ? 'markdown'
                        : selectedFile.extension === '.css'
                        ? 'css'
                        : selectedFile.extension === '.html'
                        ? 'html'
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
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500">
              <FolderTree className="w-8 h-8 mb-3 text-zinc-600" />
              <p className="text-sm font-semibold text-zinc-400">Select a File to Inspect</p>
              <p className="text-xs text-zinc-600 mt-1 max-w-sm">
                Click any file on the left to inspect its contents and review token cost.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
