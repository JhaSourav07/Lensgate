import React from 'react';
import { IntelligenceAlert } from '@lensgate/shared';
import { ShieldAlert, AlertTriangle, Flame, ShieldCheck, Wand2, Info } from 'lucide-react';

interface IntelligenceAlertBannerProps {
  alerts: IntelligenceAlert[];
  onApplyFix: (action: string) => void;
  isPending: boolean;
}

export const IntelligenceAlertBanner: React.FC<IntelligenceAlertBannerProps> = ({
  alerts,
  onApplyFix,
  isPending,
}) => {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="bg-zinc-950/90 border-b border-zinc-800 p-3 space-y-2 shrink-0">
      <div className="flex items-center space-x-2 text-xs font-semibold text-zinc-400">
        <ShieldAlert className="w-4 h-4 text-amber-400" />
        <span>Context Intelligence Alerts ({alerts.length})</span>
      </div>

      <div className="space-y-2">
        {alerts.map((alert) => {
          const isCritical = alert.severity === 'critical';
          const isHigh = alert.severity === 'high';

          const borderBg = isCritical
            ? 'border-rose-500/40 bg-rose-950/20 text-rose-200'
            : isHigh
            ? 'border-amber-500/40 bg-amber-950/20 text-amber-200'
            : 'border-blue-500/40 bg-blue-950/20 text-blue-200';

          const badgeBg = isCritical
            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
            : isHigh
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            : 'bg-blue-500/20 text-blue-300 border-blue-500/40';

          return (
            <div
              key={alert.id}
              className={`flex items-start justify-between p-2.5 rounded-lg border ${borderBg} transition-all`}
            >
              <div className="flex items-start space-x-2.5 flex-1 pr-3">
                {isCritical ? (
                  <Flame className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                ) : isHigh ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                )}

                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-zinc-100">{alert.title}</span>
                    <span
                      className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${badgeBg}`}
                    >
                      {alert.severity}
                    </span>
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wide">
                      {alert.type}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed">{alert.message}</p>

                  {alert.evidence && (
                    <div className="text-[11px] font-mono text-zinc-400 bg-zinc-900/80 px-2 py-0.5 rounded border border-zinc-800/80 inline-block">
                      {alert.evidence}
                    </div>
                  )}
                </div>
              </div>

              {alert.suggestedFix && isPending && (
                <button
                  onClick={() => onApplyFix(alert.suggestedFix!.action)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shrink-0 cursor-pointer active:scale-95 transition-all"
                  title={alert.suggestedFix.description}
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Apply Fix</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
