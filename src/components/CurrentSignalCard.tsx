import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Radio,
  Layers,
} from 'lucide-react';
import type { PredictionSignal, MonitorStatus, MonitorConfig } from '../types/client.ts';

interface CurrentSignalCardProps {
  signal: PredictionSignal | null;
  status: MonitorStatus | null;
  config: MonitorConfig | null;
}

export const CurrentSignalCard: React.FC<CurrentSignalCardProps> = ({
  signal,
  status,
  config,
}) => {
  const isUp = signal?.direction === 'UP';
  const isDown = signal?.direction === 'DOWN';
  const isUnknown = !signal || signal.direction === 'UNKNOWN';

  const confidence = signal?.confidence ?? 0;
  const targetMinConf = config?.minConfidence ?? 100;
  const isConfidenceSatisfied = confidence >= targetMinConf;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between">
      {/* Card Header */}
      <div className="bg-gradient-to-r from-slate-800/80 to-slate-900/90 px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            NOW: CURRENT WINDOW
          </h2>
          <span className="text-[11px] font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded">
            Left Card Only
          </span>
        </div>
        <a
          href={config?.targetUrl || 'https://rollielevel.com/BTC/predictor/'}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-400 hover:text-sky-300 flex items-center gap-1 transition-colors"
          title="Open target prediction site"
        >
          <span>Open Site</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Main Signal Display */}
      <div className="p-6 space-y-6">
        {/* If monitor has extraction error */}
        {status?.lastError && !signal && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold text-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Target Connection Diagnostic</span>
            </div>
            <p className="leading-relaxed text-slate-300">
              {status.lastError}
            </p>
            <p className="text-[11px] text-amber-400/90">
              * Note: The monitor polls continuously in the background. If the site is temporarily offline, no false alerts will be sent. You can test live signals using the <strong>Test &amp; Simulation Studio</strong> below.
            </p>
          </div>
        )}

        {/* Direction Indicator */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl shadow-inner ${
                isUp
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : isDown
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {isUp ? (
                <TrendingUp className="w-8 h-8 text-emerald-400" />
              ) : isDown ? (
                <TrendingDown className="w-8 h-8 text-rose-400" />
              ) : (
                <Radio className="w-6 h-6 text-slate-500 animate-pulse" />
              )}
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Signal Direction
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`text-2xl font-extrabold tracking-tight ${
                    isUp
                      ? 'text-emerald-400'
                      : isDown
                      ? 'text-rose-400'
                      : 'text-slate-400'
                  }`}
                >
                  {signal?.direction || 'WAITING FOR DATA'}
                </span>
                {isUp && <span className="text-xl">🟢</span>}
                {isDown && <span className="text-xl">🔴</span>}
              </div>
            </div>
          </div>

          {/* Confidence Meter */}
          <div className="w-full sm:w-48 bg-slate-900 p-3.5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-400 font-medium">Confidence:</span>
              <span
                className={`font-mono font-bold ${
                  isConfidenceSatisfied ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {confidence}%
              </span>
            </div>
            {/* Visual Progress Bar */}
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  confidence >= 100
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                    : confidence >= 80
                    ? 'bg-amber-400'
                    : 'bg-slate-600'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, confidence))}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
              <span>0%</span>
              <span>Req: {targetMinConf}%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* Details Grid: Window & Price */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Market Window */}
          <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mt-0.5">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  5-Min Market Window
                </span>
                {status?.activeWindowAlertSent ? (
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.2 rounded border border-amber-500/20">
                    LOCKED (1 Alert Sent)
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.2 rounded border border-emerald-500/20">
                    Eligible (0 Sent)
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm font-semibold text-white font-mono truncate">
                  {signal?.windowStartEnd || signal?.window || 'Resolving Window...'}
                </span>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="text-xs text-slate-400">Timer:</span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded ${
                      signal?.isWindowTimeEligible ?? true
                        ? 'bg-slate-800 text-sky-300 border border-slate-700'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {signal?.countdown || '--:--'}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] mt-1">
                <span className="text-slate-500">
                  ID: <strong className="text-slate-300 font-mono">{signal?.windowId || status?.activeWindowId || 'Resolving...'}</strong>
                </span>
                {signal && !signal.isWindowTimeEligible ? (
                  <span className="text-rose-400 font-bold">
                    ⛔ &lt; 2:10 Cutoff (No alerts sent)
                  </span>
                ) : (
                  <span className="text-emerald-400/80">
                    ✓ &gt; 2:10 Eligible
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Reference Price */}
          <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 mt-0.5">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Reference BTC Price
              </div>
              <div className="text-sm font-semibold text-white font-mono mt-0.5">
                {signal?.referencePrice || 'Syncing Price...'}
              </div>
              <span className="text-[10px] text-slate-500">
                {signal?.rawExplain || 'Base strike reference price'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="bg-slate-950/80 px-5 py-3 border-t border-slate-800 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Excluded: "NEXT WINDOW" card strictly ignored</span>
        </div>
        <div>
          Last Checked:{' '}
          <span className="text-slate-300 font-mono">
            {status?.lastCheckTime
              ? new Date(status.lastCheckTime).toLocaleTimeString()
              : 'Pending'}
          </span>
        </div>
      </div>
    </div>
  );
};
