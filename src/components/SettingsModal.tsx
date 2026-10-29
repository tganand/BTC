import React, { useState } from 'react';
import {
  X,
  Settings,
  Save,
  Lock,
  Shield,
  Bell,
  Radio,
  Sliders,
  Send,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import type { MonitorConfig } from '../types/client.ts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: MonitorConfig | null;
  onSave: (newSettings: any, pin: string) => Promise<boolean>;
  onSendTestNotification: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave,
  onSendTestNotification,
}) => {
  if (!isOpen) return null;

  const [targetUrl, setTargetUrl] = useState(config?.targetUrl || 'https://rollielevel.com/BTC/predictor/');
  const [signalDirection, setSignalDirection] = useState<'UP' | 'DOWN' | 'BOTH'>(config?.signalDirection || 'UP');
  const [minConfidence, setMinConfidence] = useState<number>(config?.minConfidence ?? 100);
  const [confirmationSeconds, setConfirmationSeconds] = useState<number>(config?.confirmationSeconds ?? 5);
  const [pollIntervalMs, setPollIntervalMs] = useState<number>(config?.pollIntervalMs ?? 1000);
  const [minTimeRemainingSeconds, setMinTimeRemainingSeconds] = useState<number>(config?.minTimeRemainingSeconds ?? 130);
  const [telegramEnabled, setTelegramEnabled] = useState<boolean>(config?.telegramEnabled ?? true);
  const [telegramBotToken, setTelegramBotToken] = useState<string>('');
  const [telegramChatId, setTelegramChatId] = useState<string>('');
  const [pin, setPin] = useState<string>('1234');
  const [newPin, setNewPin] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSaving(true);
    setSuccessMsg(false);

    try {
      const payload: any = {
        targetUrl,
        signalDirection,
        minConfidence: Number(minConfidence),
        confirmationSeconds: Number(confirmationSeconds),
        pollIntervalMs: Number(pollIntervalMs),
        minTimeRemainingSeconds: Number(minTimeRemainingSeconds),
        telegramEnabled,
        pin,
      };

      if (telegramBotToken.trim()) payload.telegramBotToken = telegramBotToken.trim();
      if (telegramChatId.trim()) payload.telegramChatId = telegramChatId.trim();
      if (newPin.trim()) payload.newPin = newPin.trim();

      const ok = await onSave(payload, pin);
      if (ok) {
        setSuccessMsg(true);
        setTimeout(() => {
          setSuccessMsg(false);
          onClose();
        }, 1200);
      } else {
        setErrorMsg('Failed to save settings. Please verify your PIN (default is 1234).');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 border-b border-slate-800 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Monitoring &amp; Alert Settings
              </h2>
              <p className="text-xs text-slate-400">
                Configure 5-second confirmation rule, signal thresholds, and Telegram bot
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Settings saved successfully and updated in persistent storage!</span>
            </div>
          )}

          {/* Section 1: Signal Rules */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-sky-400" />
              Signal Detection Rules
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Direction */}
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Signal Direction
                </label>
                <select
                  value={signalDirection}
                  onChange={(e) => setSignalDirection(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="UP">UP Only 🟢</option>
                  <option value="DOWN">DOWN Only 🔴</option>
                  <option value="BOTH">BOTH (UP and DOWN)</option>
                </select>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Alert condition: Must match selected direction
                </span>
              </div>

              {/* Min Confidence */}
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Minimum Confidence (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={minConfidence}
                    onChange={(e) => setMinConfidence(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-500">%</span>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Default: 100%. Alerts are rejected below this percentage.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Strict Confirmation Hold Seconds */}
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Strict Confirmation Duration (Seconds)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="60"
                  value={confirmationSeconds}
                  onChange={(e) => setConfirmationSeconds(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Default: 5 seconds. Signal must remain continuously unchanged for &gt;5s.
                </span>
              </div>

              {/* Polling Interval */}
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Monitoring Frequency (ms)
                </label>
                <input
                  type="number"
                  step="500"
                  min="500"
                  max="30000"
                  value={pollIntervalMs}
                  onChange={(e) => setPollIntervalMs(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Default: 1000ms (1 second). Fast enough to verify 5s continuity.
                </span>
              </div>
            </div>

            {/* Timer Cutoff Threshold */}
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1 flex items-center justify-between">
                <span>Countdown Timer Cutoff (Seconds)</span>
                <span className="text-[11px] font-mono text-amber-400 font-semibold">
                  {Math.floor(minTimeRemainingSeconds / 60)}:{(minTimeRemainingSeconds % 60).toString().padStart(2, '0')} min cutoff
                </span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="300"
                  step="5"
                  value={minTimeRemainingSeconds}
                  onChange={(e) => setMinTimeRemainingSeconds(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-500">sec</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Default: 130 seconds (2:10 minutes). If card timer countdown is less than this cutoff, alerts are strictly suppressed even at 100% confidence.
              </span>
            </div>
          </div>

          {/* Section 2: Deduplication Rule */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              Window Deduplication (Strict Enforcement)
            </h3>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-emerald-500/30 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Maximum 1 Alert Per 5-Minute Market Window</span>
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                Each 5-minute market window is identified by its unique start/end time. Once an alert is confirmed and dispatched for a window, no second alert will ever be sent for that window (even if the signal changes to DOWN, returns to UP, or reaches 100% confidence again).
              </p>
              <p className="text-slate-400 text-[10px]">
                Alerted window IDs are stored in persistent JSON storage so backend restarts will never cause duplicate notifications.
              </p>
            </div>
          </div>

          {/* Section 3: Telegram Settings */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Bell className="w-4 h-4 text-sky-400" />
                Telegram Bot Integration
              </h3>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={telegramEnabled}
                  onChange={(e) => setTelegramEnabled(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-0"
                />
                <span>Enable Notifications</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Bot Token (Configured securely)
                </label>
                <input
                  type="password"
                  placeholder={config?.telegramBotTokenMasked || 'Enter token if changing'}
                  value={telegramBotToken}
                  onChange={(e) => setTelegramBotToken(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Current: {config?.telegramBotTokenMasked || 'Configured via .env'}
                </span>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Telegram Chat ID
                </label>
                <input
                  type="text"
                  placeholder={config?.telegramChatIdMasked || 'Enter chat ID'}
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Current: {config?.telegramChatIdMasked || '7719••••3333'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-400">
                Test bot connectivity with current credentials:
              </span>
              <button
                type="button"
                onClick={onSendTestNotification}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:text-white border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Send className="w-3.5 h-3.5 text-sky-400" />
                <span>Send Test Alert to Phone</span>
              </button>
            </div>
          </div>

          {/* Section 4: Target URL */}
          <div className="space-y-2 pt-4 border-t border-slate-800">
            <label className="text-xs font-medium text-slate-300 block">
              Target Prediction URL
            </label>
            <input
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            <span className="text-[11px] text-slate-500 block">
              Default: https://rollielevel.com/BTC/predictor/ (Left card "NOW: CURRENT WINDOW")
            </span>
          </div>

          {/* Section 5: Authorization PIN */}
          <div className="space-y-3 pt-4 border-t border-slate-800 bg-slate-950/40 p-4 rounded-xl border">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Dashboard PIN Protection
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Settings &amp; Telegram dispatch endpoints are protected against unauthorized web visitors. Default PIN is <code className="text-amber-300 font-mono">1234</code>.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Current PIN (Required to save)
                </label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Change PIN (Optional)
                </label>
                <input
                  type="password"
                  placeholder="Leave empty to keep current"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save & Apply Settings'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
