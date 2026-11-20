import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Copy, Check, Terminal, ExternalLink } from 'lucide-react';

interface AntigravityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface IntegrationStatus {
  pluginInstalled: boolean;
  pluginPath: string;
  proxyConfigured: boolean;
  settingsPaths: string[];
  active: boolean;
}

export const AntigravityModal: React.FC<AntigravityModalProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchStatus = () => {
    fetch('/api/integrations/antigravity/status')
      .then((res) => res.json())
      .then(setStatus)
      .catch(() => {});
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleAttach = async () => {
    setLoading(true);
    const endpoint = status?.active
      ? '/api/integrations/antigravity/detach'
      : '/api/integrations/antigravity/attach';

    try {
      await fetch(endpoint, { method: 'POST' });
      fetchStatus();
    } finally {
      setLoading(false);
    }
  };

  const copyCliCommand = () => {
    navigator.clipboard.writeText('pnpm attach:antigravity');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs">
              AG
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Antigravity IDE Integration</h3>
              <p className="text-[11px] text-zinc-400">Direct visibility & control layer inside Antigravity</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Status checklist */}
          <div className="space-y-2 bg-zinc-950 p-3.5 rounded-lg border border-zinc-800/80">
            <div className="flex items-center justify-between">
              <span className="text-zinc-300 font-medium">Lifecycle Plugin</span>
              {status?.pluginInstalled ? (
                <span className="flex items-center space-x-1 text-emerald-400 font-semibold text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Installed (~/.gemini/config/plugins/lensgate)</span>
                </span>
              ) : (
                <span className="flex items-center space-x-1 text-zinc-500 text-[11px]">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Not Installed</span>
                </span>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-zinc-900 pt-2">
              <span className="text-zinc-300 font-medium">IDE HTTPS Proxy</span>
              {status?.proxyConfigured ? (
                <span className="flex items-center space-x-1 text-emerald-400 font-semibold text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Active (http://localhost:8088)</span>
                </span>
              ) : (
                <span className="flex items-center space-x-1 text-zinc-500 text-[11px]">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Not Configured</span>
                </span>
              )}
            </div>
          </div>

          {/* Action button */}
          <div>
            <button
              onClick={handleToggleAttach}
              disabled={loading}
              className={`w-full py-2 px-4 rounded-lg font-semibold text-xs transition-all shadow-sm flex items-center justify-center space-x-2 cursor-pointer ${
                status?.active
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              <span>{status?.active ? 'Detach from Antigravity IDE' : 'Connect to Antigravity IDE (1-Click)'}</span>
            </button>
          </div>

          {/* CLI Alternative */}
          <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
            <label className="text-[11px] font-semibold text-zinc-400 flex items-center space-x-1">
              <Terminal className="w-3 h-3 text-zinc-400" />
              <span>Or run in terminal:</span>
            </label>
            <div className="flex items-center justify-between bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-800 font-mono text-[11px] text-zinc-300">
              <span>pnpm attach:antigravity</span>
              <button
                onClick={copyCliCommand}
                className="text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer p-1"
                title="Copy command"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-950/60 text-[11px] text-zinc-500 flex items-center justify-between">
          <span>Antigravity model requests will automatically appear in Lensgate queue.</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

