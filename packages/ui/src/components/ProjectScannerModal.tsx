import React, { useState, useEffect } from 'react';
import { VerifiedProjectProfile, ContextCorrectionRule } from '@lensgate/shared';
import {
  X,
  Scan,
  Shield,
  Layers,
  AlertOctagon,
  Check,
  Plus,
  Trash2,
  Lock,
  RefreshCw,
  Sliders,
  FileCode,
} from 'lucide-react';

interface ProjectScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: (profile: VerifiedProjectProfile) => void;
}

export const ProjectScannerModal: React.FC<ProjectScannerModalProps> = ({
  isOpen,
  onClose,
  onProfileUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'rules'>('profile');
  const [profile, setProfile] = useState<VerifiedProjectProfile | null>(null);
  const [rules, setRules] = useState<ContextCorrectionRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanPath, setScanPath] = useState('');
  const [purposeInput, setPurposeInput] = useState('');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // New rule state
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleType, setNewRuleType] = useState<'purpose_lock' | 'regex_replace' | 'prune_turns'>('regex_replace');
  const [newRulePattern, setNewRulePattern] = useState('');
  const [newRuleReplacement, setNewRuleReplacement] = useState('');
  const [newRuleAuto, setNewRuleAuto] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchProfile();
      fetchRules();
    }
  }, [isOpen]);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/intelligence/profile');
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setPurposeInput(data.verifiedPurpose || '');
        if (!scanPath) setScanPath(data.path || '');
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  };

  const fetchRules = async () => {
    try {
      const res = await fetch('/api/intelligence/rules');
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } catch (err) {
      console.error('Failed to load rules:', err);
    }
  };

  const handleScan = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/intelligence/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootDir: scanPath.trim() || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setPurposeInput(data.verifiedPurpose || '');
        if (onProfileUpdated) onProfileUpdated(data);
        setSaveStatus('Project re-scanned successfully');
        setTimeout(() => setSaveStatus(null), 3000);
      }
    } catch (err) {
      console.error('Scan failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePurpose = async () => {
    if (!profile) return;
    const updated: VerifiedProjectProfile = {
      ...profile,
      verifiedPurpose: purposeInput.trim(),
    };
    try {
      const res = await fetch('/api/intelligence/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        setProfile(updated);
        if (onProfileUpdated) onProfileUpdated(updated);
        setSaveStatus('Purpose Lock saved!');
        setTimeout(() => setSaveStatus(null), 3000);
      }
    } catch (err) {
      console.error('Failed to save purpose:', err);
    }
  };

  const handleToggleRule = async (id: string, active: boolean) => {
    try {
      await fetch(`/api/intelligence/rules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      });
      setRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, active } : r))
      );
    } catch (err) {
      console.error('Toggle rule failed:', err);
    }
  };

  const handleToggleRuleAuto = async (id: string, autoApply: boolean) => {
    try {
      await fetch(`/api/intelligence/rules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoApply }),
      });
      setRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, autoApply } : r))
      );
    } catch (err) {
      console.error('Toggle rule auto failed:', err);
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await fetch(`/api/intelligence/rules/${id}`, { method: 'DELETE' });
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Delete rule failed:', err);
    }
  };

  const handleAddRule = async () => {
    if (!newRuleName.trim()) return;
    const rule: ContextCorrectionRule = {
      id: `rule-${Date.now()}`,
      name: newRuleName.trim(),
      type: newRuleType,
      pattern: newRulePattern,
      replacement: newRuleReplacement,
      active: true,
      autoApply: newRuleAuto,
    };
    try {
      const res = await fetch('/api/intelligence/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule),
      });
      if (res.ok) {
        setRules((prev) => [...prev, rule]);
        setNewRuleName('');
        setNewRulePattern('');
        setNewRuleReplacement('');
        setShowAddRule(false);
      }
    } catch (err) {
      console.error('Failed to add rule:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Context Intelligence & Purpose Lock</h2>
              <p className="text-xs text-zinc-400">
                Ground truth alignment & proactive context guardrails for AI coding agents
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center px-6 border-b border-zinc-800 bg-zinc-950/30 space-x-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-3 flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'profile'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Workspace Profile & Purpose Lock</span>
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`py-3 flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'rules'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Rules Engine ({rules.length})</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {saveStatus && (
            <div className="p-2.5 bg-emerald-950/40 border border-emerald-800/60 rounded-lg text-emerald-300 text-xs flex items-center space-x-2 animate-fadeIn">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{saveStatus}</span>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-5">
              {/* Scan Workspace Bar */}
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={scanPath}
                  onChange={(e) => setScanPath(e.target.value)}
                  placeholder="Root directory path..."
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-700"
                />
                <button
                  onClick={handleScan}
                  disabled={loading}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>{loading ? 'Scanning...' : 'Scan Codebase'}</span>
                </button>
              </div>

              {profile && (
                <>
                  {/* Purpose Lock Editor */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-300 flex items-center space-x-1.5">
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Ground Truth Purpose Lock</span>
                      </label>
                      <button
                        onClick={handleSavePurpose}
                        className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-md text-xs font-medium cursor-pointer transition-all"
                      >
                        Save Lock
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={purposeInput}
                      onChange={(e) => setPurposeInput(e.target.value)}
                      placeholder="Define the authorized developer purpose for this project..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-200 font-sans focus:outline-none focus:border-zinc-700"
                    />
                    <p className="text-[11px] text-zinc-500">
                      When applied, this ground truth is injected into system prompts to prevent models from refusing or misinterpreting legitimate security or architectural tools.
                    </p>
                  </div>

                  {/* Tech Stack Badges */}
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-zinc-400 flex items-center space-x-1.5">
                      <Layers className="w-3.5 h-3.5 text-blue-400" />
                      <span>Detected Tech Stack</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.techStack.map((tech) => (
                        <span
                          key={tech}
                          className="px-2.5 py-1 rounded-md bg-blue-950/40 border border-blue-800/40 text-blue-300 text-xs font-medium"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Sensitive Terms */}
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-zinc-400 flex items-center space-x-1.5">
                      <AlertOctagon className="w-3.5 h-3.5 text-amber-400" />
                      <span>Legitimate Sensitive Concepts Monitored</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.sensitiveTerms.map((term) => (
                        <span
                          key={term}
                          className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[11px] font-mono border border-zinc-700"
                        >
                          {term}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Architectural Rules */}
                  {profile.architecturalRules.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-zinc-400 flex items-center space-x-1.5">
                        <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Architectural Rules Extracted</span>
                      </span>
                      <ul className="space-y-1 bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                        {profile.architecturalRules.map((rule, idx) => (
                          <li key={idx} className="text-xs text-zinc-300 flex items-start space-x-2">
                            <span className="text-emerald-400">•</span>
                            <span>{rule}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'rules' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">
                  Rules transform or sanitize AI context payloads automatically or via 1-click fixes.
                </span>
                <button
                  onClick={() => setShowAddRule(!showAddRule)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-semibold cursor-pointer transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Rule</span>
                </button>
              </div>

              {showAddRule && (
                <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800 space-y-3">
                  <h4 className="text-xs font-bold text-zinc-200">New Context Correction Rule</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-zinc-400">Rule Name</label>
                      <input
                        type="text"
                        value={newRuleName}
                        onChange={(e) => setNewRuleName(e.target.value)}
                        placeholder="e.g. Redact Internal Tokens"
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-zinc-400">Rule Type</label>
                      <select
                        value={newRuleType}
                        onChange={(e) => setNewRuleType(e.target.value as any)}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200"
                      >
                        <option value="regex_replace">Regex Replace / Sanitize</option>
                        <option value="purpose_lock">Purpose Lock</option>
                        <option value="prune_turns">Prune Turns</option>
                      </select>
                    </div>
                  </div>

                  {newRuleType === 'regex_replace' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-zinc-400">Pattern (Regex)</label>
                        <input
                          type="text"
                          value={newRulePattern}
                          onChange={(e) => setNewRulePattern(e.target.value)}
                          placeholder="e.g. sk-proj-[a-zA-Z0-9]+"
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs font-mono text-zinc-200"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-zinc-400">Replacement</label>
                        <input
                          type="text"
                          value={newRuleReplacement}
                          onChange={(e) => setNewRuleReplacement(e.target.value)}
                          placeholder="e.g. [REDACTED]"
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs font-mono text-zinc-200"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <label className="flex items-center space-x-2 text-xs text-zinc-300">
                      <input
                        type="checkbox"
                        checked={newRuleAuto}
                        onChange={(e) => setNewRuleAuto(e.target.checked)}
                        className="rounded bg-zinc-800 border-zinc-700 text-emerald-500 focus:ring-0"
                      />
                      <span>Auto-apply to all intercepted requests</span>
                    </label>

                    <button
                      onClick={handleAddRule}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium cursor-pointer"
                    >
                      Save Rule
                    </button>
                  </div>
                </div>
              )}

              {/* Rules List */}
              <div className="space-y-2">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 flex items-center justify-between"
                  >
                    <div className="space-y-1 flex-1 pr-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-zinc-100">{rule.name}</span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                          {rule.type}
                        </span>
                        {rule.autoApply && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold">
                            Auto
                          </span>
                        )}
                      </div>
                      {rule.description && (
                        <p className="text-xs text-zinc-400">{rule.description}</p>
                      )}
                      {rule.pattern && (
                        <div className="text-[10px] font-mono text-zinc-500 truncate max-w-md">
                          Pattern: {rule.pattern}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-3">
                      <label className="flex items-center space-x-1.5 text-xs text-zinc-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rule.autoApply}
                          onChange={(e) => handleToggleRuleAuto(rule.id, e.target.checked)}
                          className="rounded bg-zinc-800 border-zinc-700 text-emerald-500"
                        />
                        <span>Auto</span>
                      </label>

                      <label className="flex items-center space-x-1.5 text-xs text-zinc-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rule.active}
                          onChange={(e) => handleToggleRule(rule.id, e.target.checked)}
                          className="rounded bg-zinc-800 border-zinc-700 text-emerald-500"
                        />
                        <span>Active</span>
                      </label>

                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-1 text-zinc-500 hover:text-rose-400 transition-all"
                        title="Delete rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
