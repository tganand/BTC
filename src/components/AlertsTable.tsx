import React from 'react';
import {
  Bell,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import type { AlertRecord } from '../types/client.ts';

interface AlertsTableProps {
  alerts: AlertRecord[];
}

export const AlertsTable: React.FC<AlertsTableProps> = ({ alerts }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800/80 to-slate-900/90 px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1 rounded bg-emerald-500/20 text-emerald-400">
            <Bell className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Confirmed Telegram Alerts
          </h2>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          Total Sent: <strong className="text-emerald-400">{alerts.filter(a => a.status === 'SENT').length}</strong>
        </span>
      </div>

      <div className="overflow-x-auto">
        {alerts.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No confirmed alerts sent yet. Waiting for &gt;5s continuous matching signal or run a simulation above.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">Signal</th>
                <th className="py-3 px-4">Confidence</th>
                <th className="py-3 px-4">Hold Duration</th>
                <th className="py-3 px-4">Market Window</th>
                <th className="py-3 px-4">Delivery Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {alerts.map((alert) => {
                const isUp = alert.signal.direction === 'UP';
                return (
                  <tr key={alert.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 text-slate-300">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 font-bold ${
                          isUp ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isUp ? (
                          <TrendingUp className="w-3.5 h-3.5" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5" />
                        )}
                        {alert.signal.direction}
                        {isUp ? '🟢' : '🔴'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-white font-bold">
                      {alert.signal.confidence}%
                    </td>
                    <td className="py-3 px-4 text-amber-300 font-bold">
                      &gt;{alert.confirmedDurationSeconds}s
                    </td>
                    <td className="py-3 px-4 text-slate-300 truncate max-w-[160px]">
                      {alert.signal.window}
                    </td>
                    <td className="py-3 px-4">
                      {alert.status === 'SENT' ? (
                        <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Delivered</span>
                          {alert.telegramMessageId && (
                            <span className="text-[10px] text-slate-500">
                              (#{alert.telegramMessageId})
                            </span>
                          )}
                          {alert.isSimulation && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-amber-500/20 text-amber-400 rounded">
                              Sim
                            </span>
                          )}
                        </div>
                      ) : alert.status === 'SKIPPED_DUPLICATE_WINDOW' || (alert.status as any) === 'SKIPPED_DUPLICATE' ? (
                        <div className="flex items-center gap-1.5 text-amber-400 font-medium">
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                          <span>Blocked (1 Alert/Window Max)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-rose-400 font-medium">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Failed: {alert.errorMessage || 'Error'}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
