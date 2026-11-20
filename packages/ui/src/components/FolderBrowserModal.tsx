import React, { useState, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  ArrowUp,
  X,
  Search,
  Check,
  FolderTree,
  ChevronRight,
  HardDrive,
} from 'lucide-react';

interface FolderPreset {
  name: string;
  path: string;
  relativePath?: string;
}

interface BrowseData {
  root: string;
  current: string;
  relativePath: string;
  parent: string | null;
  subfolders: string[];
  presets: FolderPreset[];
}

interface FolderBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFolder: (folderPath: string) => void;
  initialPath?: string;
  title?: string;
  subtitle?: string;
}

export const FolderBrowserModal: React.FC<FolderBrowserModalProps> = ({
  isOpen,
  onClose,
  onSelectFolder,
  initialPath,
  title = 'Browse & Select Folder',
  subtitle = 'Navigate the workspace filesystem to select a folder',
}) => {
  const [data, setData] = useState<BrowseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [currentPath, setCurrentPath] = useState(initialPath || '');

  const loadFolder = async (dirToLoad?: string) => {
    setLoading(true);
    try {
      const url = dirToLoad
        ? `/api/context/browse-folders?dir=${encodeURIComponent(dirToLoad)}`
        : '/api/context/browse-folders';
      const res = await fetch(url);
      if (res.ok) {
        const json: BrowseData = await res.json();
        setData(json);
        setCurrentPath(json.current);
      }
    } catch (err) {
      console.error('Failed to browse folders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadFolder(initialPath);
      setFilterText('');
    }
  }, [isOpen, initialPath]);

  if (!isOpen) return null;

  const handleSelect = (pathOrRel: string) => {
    onSelectFolder(pathOrRel);
    onClose();
  };

  const filteredSubfolders = (data?.subfolders || []).filter((sf) =>
    sf.toLowerCase().includes(filterText.toLowerCase())
  );

  // Generate breadcrumbs from workspace root to current
  const breadcrumbs: { name: string; path: string }[] = [];
  if (data?.root && data?.current) {
    breadcrumbs.push({ name: 'Root', path: data.root });
    if (data.relativePath) {
      const parts = data.relativePath.split('/').filter(Boolean);
      let cumulative = data.root;
      for (const part of parts) {
        cumulative = `${cumulative}/${part}`;
        breadcrumbs.push({ name: part, path: cumulative });
      }
    }
  }

  const activeRelPath = data?.relativePath || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/70">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">{title}</h2>
              <p className="text-xs text-zinc-400">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Path Navigation & Breadcrumbs */}
        <div className="p-3 border-b border-zinc-800 bg-zinc-950/40 space-y-2 shrink-0">
          <div className="flex items-center space-x-2">
            {data?.parent && (
              <button
                onClick={() => loadFolder(data.parent!)}
                disabled={loading}
                className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold cursor-pointer border border-zinc-700 disabled:opacity-50 transition-all flex items-center space-x-1"
                title={`Up to parent directory: ${data.parent}`}
              >
                <ArrowUp className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-[11px]">Up</span>
              </button>
            )}

            {/* Breadcrumb Path */}
            <div className="flex-1 flex items-center space-x-1 overflow-x-auto bg-zinc-950 border border-zinc-800/80 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-300">
              <HardDrive className="w-3.5 h-3.5 text-zinc-500 shrink-0 mr-1" />
              {breadcrumbs.map((bc, idx) => (
                <React.Fragment key={bc.path}>
                  {idx > 0 && <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />}
                  <button
                    onClick={() => loadFolder(bc.path)}
                    className="hover:text-purple-300 hover:underline shrink-0 text-zinc-300"
                  >
                    {bc.name}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Presets */}
          {data?.presets && data.presets.length > 0 && (
            <div className="flex items-center space-x-1.5 overflow-x-auto pt-0.5">
              <span className="text-[10px] uppercase font-bold text-zinc-500 shrink-0">Presets:</span>
              {data.presets.map((p) => {
                const isActive = data.current === p.path;
                return (
                  <button
                    key={p.path}
                    onClick={() => loadFolder(p.path)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono shrink-0 transition-all cursor-pointer ${
                      isActive
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-semibold'
                        : 'bg-zinc-800/80 hover:bg-zinc-750 text-zinc-300 border border-zinc-700/60'
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Search Subfolders */}
        <div className="p-3 border-b border-zinc-800/80 bg-zinc-900/30 flex items-center space-x-2">
          <Search className="w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter subfolders in current directory..."
            className="w-full bg-transparent border-none text-xs text-zinc-200 focus:outline-none placeholder:text-zinc-600"
          />
        </div>

        {/* Subfolders List */}
        <div className="flex-1 overflow-y-auto p-3 min-h-[220px] max-h-[360px]">
          {loading ? (
            <div className="py-12 text-center text-xs text-zinc-500 font-mono">
              Loading directories...
            </div>
          ) : filteredSubfolders.length === 0 ? (
            <div className="py-12 text-center space-y-1">
              <FolderTree className="w-8 h-8 text-zinc-700 mx-auto" />
              <p className="text-xs text-zinc-400 font-medium">No subdirectories found</p>
              <p className="text-[11px] text-zinc-600">
                You can select this directory directly using the button below.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filteredSubfolders.map((sf) => (
                <div
                  key={sf}
                  className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/60 hover:bg-zinc-800/80 border border-zinc-800/70 hover:border-zinc-700 transition-all group cursor-pointer"
                  onClick={() => loadFolder(`${data?.current}/${sf}`)}
                >
                  <div className="flex items-center space-x-2 min-w-0">
                    <Folder className="w-4 h-4 text-purple-400 group-hover:text-purple-300 shrink-0" />
                    <span className="text-xs font-mono text-zinc-300 group-hover:text-zinc-100 truncate">
                      {sf}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const targetRel = activeRelPath ? `${activeRelPath}/${sf}` : sf;
                      handleSelect(targetRel);
                    }}
                    className="opacity-0 group-hover:opacity-100 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shrink-0 cursor-pointer"
                    title={`Select ${sf}`}
                  >
                    Select
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <div className="text-xs font-mono text-zinc-400 truncate max-w-sm">
            Selected: <span className="text-purple-300">{activeRelPath || '(Monorepo Root)'}</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSelect(activeRelPath)}
              className="flex items-center space-x-1.5 px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all shadow-md active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Choose Current Folder</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
