import React from 'react';
import {
  Bell,
  Play,
  Square,
  RefreshCw,
  Settings,
  Server,
  Send,
  Cloud,
} from 'lucide-react';
import type { MonitorStatus, MonitorConfig } from '../types/client.ts';

interface HeaderProps {
  status: MonitorStatus | null;
  config: MonitorConfig | null;
  onToggleMonitor: () => void;
  onSendTestNotification: () => void;
  onOpenSettings: () => void;
  onOpenDeployment: () => void;
  isActionLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  config,
  onToggleMonitor,
  onSendTestNotification,
  onOpenSettings,
  onOpenDeployment,
  isActionLoading,
}) => {
  const isRunning = status?.state === 'RUNNING';
  const isError = status?.state === 'ERROR';

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Brand & Status */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-md text-white">
              <span className="font-black text-lg tracking-tighter">₿</span>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-bold text-white tracking-tight">
                  BTC 5m Signal Monitor
                </h1>
                {/* State Badge */}
                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                    isRunning
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : isError
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isRunning
                        ? 'bg-emerald-400 animate-pulse'
                        : isError
                        ? 'bg-rose-400 animate-ping'
                        : 'bg-slate-500'
                    }`}
                  />
                  {status?.state || 'CONNECTING...'}
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                <span>Target: <strong className="text-slate-300 font-mono">rollielevel.com/BTC/predictor</strong></span>
                <span>•</span>
                <span>Strict 5s Confirmation</span>
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Start / Stop Toggle */}
            <button
              onClick={onToggleMonitor}
              disabled={isActionLoading}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm ${
                isRunning
                  ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-950/40'
              } disabled:opacity-50`}
            >
              {isRunning ? (
                <>
                  <Square className="w-4 h-4 fill-current" />
                  <span>Stop Monitor</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start Monitor</span>
                </>
              )}
            </button>

            {/* Test Telegram Alert */}
            <button
              onClick={onSendTestNotification}
              disabled={isActionLoading}
              title="Send a verified test alert to your phone"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-750 hover:text-white transition-colors"
            >
              <Send className="w-3.5 h-3.5 text-sky-400" />
              <span>Test Bot</span>
            </button>

            {/* Cloud Deployment Info */}
            <button
              onClick={onOpenDeployment}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition-colors"
            >
              <Cloud className="w-3.5 h-3.5 text-indigo-400" />
              <span>24/7 Cloud Guide</span>
            </button>

            {/* Settings */}
            <button
              onClick={onOpenSettings}
              className="inline-flex items-center gap-1.5 p-2 rounded-lg text-slate-300 hover:text-white bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
              title="Alert Configuration & PIN"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
