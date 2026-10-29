import React from 'react';
import { Terminal, Trash2 } from 'lucide-react';
import type { LogEntry } from '../types/client.ts';

interface LogsConsoleProps {
  logs: LogEntry[];
}

export const LogsConsole: React.FC<LogsConsoleProps> = ({ logs }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800/80 to-slate-900/90 px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1 rounded bg-slate-700 text-slate-300">
            <Terminal className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Live Monitoring Console Logs
          </h2>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          Auto-refreshing stream
        </span>
      </div>

      {/* Log Feed */}
      <div className="p-4 bg-slate-950 font-mono text-xs max-h-64 overflow-y-auto space-y-1.5 divide-y divide-slate-900">
        {logs.length === 0 ? (
          <div className="py-8 text-center text-slate-600">
            Waiting for activity stream...
          </div>
        ) : (
          logs.map((log) => {
            const timeStr = new Date(log.timestamp).toLocaleTimeString();
            let colorClass = 'text-slate-300';
            let prefix = 'ℹ️';

            if (log.level === 'SUCCESS') {
              colorClass = 'text-emerald-400 font-semibold';
              prefix = '✅';
            } else if (log.level === 'WARN') {
              colorClass = 'text-amber-400 font-medium';
              prefix = '⚠️';
            } else if (log.level === 'ERROR') {
              colorClass = 'text-rose-400 font-bold';
              prefix = '🛑';
            }

            return (
              <div key={log.id} className="pt-1.5 flex items-start gap-2.5">
                <span className="text-slate-500 shrink-0 text-[11px]">{timeStr}</span>
                <span className="shrink-0">{prefix}</span>
                <span className={`${colorClass} break-words leading-relaxed`}>
                  {log.message}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
