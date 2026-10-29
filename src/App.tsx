import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header.tsx';
import { CurrentSignalCard } from './components/CurrentSignalCard.tsx';
import { ConfirmationTimerCard } from './components/ConfirmationTimerCard.tsx';
import { SimulationStudio } from './components/SimulationStudio.tsx';
import { AlertsTable } from './components/AlertsTable.tsx';
import { LogsConsole } from './components/LogsConsole.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import { DeploymentGuide } from './components/DeploymentGuide.tsx';
import type { MonitorStatus, MonitorConfig, AlertRecord, LogEntry } from './types/client.ts';
import { ShieldAlert, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [status, setStatus] = useState<MonitorStatus | null>(null);
  const [config, setConfig] = useState<MonitorConfig | null>(null);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDeploymentOpen, setIsDeploymentOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Poll status from backend
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
        setConfig(data.config);
        setAlerts(data.alerts || []);
        setLogs(data.logs || []);
      }
    } catch (err) {
      // Backend maybe restarting or network hiccup
      console.warn('Status poll warning:', err);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 1000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Toggle Monitor Start/Stop
  const handleToggleMonitor = async () => {
    if (!status) return;
    setIsActionLoading(true);
    const nextAction = status.state === 'RUNNING' ? 'stop' : 'start';

    try {
      const res = await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: nextAction, pin: config?.dashboardPin || '1234' }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Monitor successfully ${nextAction === 'start' ? 'started' : 'stopped'}!`, 'success');
        await fetchStatus();
      } else {
        showToast(data.error || 'Failed to toggle monitor', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Network error', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Send Test Telegram Notification
  const handleSendTestNotification = async () => {
    setIsActionLoading(true);
    try {
      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initiator: 'Dashboard User',
          pin: config?.dashboardPin || '1234',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Test alert successfully sent to Telegram! (Msg #${data.messageId})`, 'success');
        await fetchStatus();
      } else {
        showToast(data.error || 'Telegram test failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to contact Telegram API', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Trigger Simulation
  const handleTriggerSimulation = async (type: 'up-100-success' | 'up-100-cancel' | 'down-100-success') => {
    setIsActionLoading(true);
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });

      if (res.ok) {
        showToast(`Simulation started: ${type}`, 'success');
        await fetchStatus();
      } else {
        const data = await res.json();
        showToast(data.error || 'Simulation failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Stop Simulation
  const handleStopSimulation = async () => {
    setIsActionLoading(true);
    try {
      await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'stop' }),
      });
      showToast('Simulation stopped. Returned to live monitoring.', 'success');
      await fetchStatus();
    } finally {
      setIsActionLoading(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async (newSettings: any, pin: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-dashboard-pin': pin,
        },
        body: JSON.stringify(newSettings),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        await fetchStatus();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-sky-500 selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 animate-bounce">
          <div
            className={`px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold border ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950 border-rose-500/40 text-rose-200'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <Header
        status={status}
        config={config}
        onToggleMonitor={handleToggleMonitor}
        onSendTestNotification={handleSendTestNotification}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenDeployment={() => setIsDeploymentOpen(true)}
        isActionLoading={isActionLoading}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Top Info Notice */}
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5">
            <span className="p-1 rounded bg-sky-500/20 text-sky-400 font-mono text-[10px] font-bold">
              24/7 CLOUD
            </span>
            <span className="text-slate-300">
              Backend is monitoring actively. When configured conditions match, it enforces the <strong>strict 5-second continuous confirmation</strong> before alerting.
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-400 text-[11px] shrink-0 font-mono">
            <span>Bot: @BTcpridicion1_bot</span>
            <span>•</span>
            <span className="text-emerald-400">Chat ID: {config?.telegramChatIdMasked || '7719••••3333'}</span>
          </div>
        </div>

        {/* Primary Row: Left Card (Now: Current Window) & 5-Second Confirmation Engine */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          <CurrentSignalCard
            signal={status?.currentSignal ?? null}
            status={status}
            config={config}
          />

          <ConfirmationTimerCard
            confirmation={status?.confirmation ?? null}
            config={config}
          />
        </div>

        {/* Middle Row: Simulation & Testing Studio */}
        <SimulationStudio
          isSimulationActive={status?.simulationActive ?? false}
          onTriggerSimulation={handleTriggerSimulation}
          onStopSimulation={handleStopSimulation}
          isActionLoading={isActionLoading}
        />

        {/* Bottom Row: Recent Confirmed Alerts & Live Console Logs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <AlertsTable alerts={alerts} />
          <LogsConsole logs={logs} />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/90 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 space-y-1">
          <p>
            BTC 5-Minute Prediction Signal Monitor • Independent Cloud Engine
          </p>
          <p className="text-[11px] text-slate-600">
            Monitors displayed model output on rollielevel.com. Not financial advice or guarantee of profit.
          </p>
        </div>
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onSave={handleSaveSettings}
        onSendTestNotification={handleSendTestNotification}
      />

      {/* 24/7 Cloud Deployment Guide Modal */}
      <DeploymentGuide
        isOpen={isDeploymentOpen}
        onClose={() => setIsDeploymentOpen(false)}
      />
    </div>
  );
}
