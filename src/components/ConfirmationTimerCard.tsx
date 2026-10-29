import React from 'react';
import {
  Timer,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Flame,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import type { ConfirmationState, MonitorConfig } from '../types/client.ts';

interface ConfirmationTimerCardProps {
  confirmation: ConfirmationState | null;
  config: MonitorConfig | null;
}

export const ConfirmationTimerCard: React.FC<ConfirmationTimerCardProps> = ({
  confirmation,
  config,
}) => {
  const status = confirmation?.status || 'IDLE';
  const targetSeconds = confirmation?.targetSeconds ?? config?.confirmationSeconds ?? 5.0;
  const elapsed = confirmation?.elapsedSeconds ?? 0;
  const remaining = confirmation?.remainingSeconds ?? targetSeconds;

  // Percentage complete (0 to 100)
  const percentComplete = Math.min(100, Math.max(0, (elapsed / targetSeconds) * 100));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800/80 to-slate-900/90 px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1 rounded bg-amber-500/20 text-amber-400">
            <Timer className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Strict 5-Second Confirmation Rule
          </h2>
        </div>
        <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
          Target: &gt;{targetSeconds}s Unchanged
        </span>
      </div>

      {/* Main Body */}
      <div className="p-6 space-y-5">
        {/* State Banner */}
        <div
          className={`p-4 rounded-xl border flex items-center justify-between transition-colors ${
            status === 'CONFIRMING'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : status === 'ALERTED'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : status === 'CANCELLED'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : 'bg-slate-950/60 border-slate-800 text-slate-400'
          }`}
        >
          <div className="flex items-center gap-3">
            {status === 'CONFIRMING' ? (
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 animate-spin">
                <Timer className="w-5 h-5" />
              </div>
            ) : status === 'ALERTED' ? (
              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            ) : status === 'CANCELLED' ? (
              <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
                <XCircle className="w-5 h-5" />
              </div>
            ) : (
              <div className="p-2 rounded-lg bg-slate-800 text-slate-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
            )}

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider">
                Confirmation Engine State
              </div>
              <div className="text-base font-extrabold tracking-tight text-white mt-0.5">
                {status === 'CONFIRMING' && (
                  <span className="text-amber-400">
                    HOLDING CONTINUOUS SIGNAL ({elapsed.toFixed(1)}s / {targetSeconds.toFixed(1)}s)
                  </span>
                )}
                {status === 'ALERTED' && (
                  <span className="text-emerald-400">
                    CONFIRMED &amp; ALERT DISPATCHED
                  </span>
                )}
                {status === 'CANCELLED' && (
                  <span className="text-rose-400">
                    CONFIRMATION CANCELLED (RESET)
                  </span>
                )}
                {status === 'IDLE' && (
                  <span className="text-slate-300">
                    STANDBY — AWAITING 100% SIGNAL
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stopwatch Display */}
          <div className="text-right">
            <div className="text-2xl font-black font-mono tracking-tight text-white">
              {elapsed.toFixed(1)}s
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Req: &gt;{targetSeconds.toFixed(1)}s
            </div>
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-mono text-slate-400">
            <span>0.0s (Start)</span>
            <span className="font-semibold text-slate-300">
              {status === 'CONFIRMING'
                ? `${remaining.toFixed(1)}s remaining to trigger Telegram`
                : status === 'ALERTED'
                ? 'Threshold passed (>5s continuous)'
                : 'Timer starts on 100% detection'}
            </span>
            <span>{targetSeconds.toFixed(1)}s Trigger</span>
          </div>

          <div className="w-full h-4 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-200 ${
                status === 'CONFIRMING'
                  ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 animate-pulse'
                  : status === 'ALERTED'
                  ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.7)]'
                  : status === 'CANCELLED'
                  ? 'bg-rose-500/50'
                  : 'bg-slate-800'
              }`}
              style={{ width: `${percentComplete}%` }}
            />
          </div>
        </div>

        {/* Cancellation Alert Callout */}
        {confirmation?.lastCancelReason && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-rose-200">Last Cancellation Reason:</span>
              <p className="text-slate-300 leading-relaxed font-mono text-[11px]">
                {confirmation.lastCancelReason}
              </p>
              <p className="text-[10px] text-rose-400">
                Rule verified: Instant cancellation prevents false Telegram alerts if the website signal fluctuates.
              </p>
            </div>
          </div>
        )}

        {/* Protocol Rule Recap */}
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-2">
          <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
            Verification Protocol:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Target: ONLY "NOW: CURRENT WINDOW"</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              <span>Cutoff: Disqualified if timer &lt; 2:10</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>Cancel if direction/conf drops before 5s</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Deduplication: Max 1 alert per 5m window</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-slate-950/80 px-5 py-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Backend Authoritative Clock</span>
        <span className="text-emerald-400 font-mono font-medium">
          Deduplication Protected
        </span>
      </div>
    </div>
  );
};
