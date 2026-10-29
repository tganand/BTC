import fs from 'node:fs';
import path from 'node:path';
import type { MonitorConfig, AlertRecord, LogEntry } from './types.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'monitor_state.json');

export interface PersistentState {
  config: {
    enabled: boolean;
    targetUrl: string;
    pollIntervalMs: number;
    signalDirection: 'UP' | 'DOWN' | 'BOTH';
    minConfidence: number;
    confirmationSeconds: number;
    minTimeRemainingSeconds: number; // Cutoff: default 130s (2m 10s)
    telegramEnabled: boolean;
    telegramBotToken: string;
    telegramChatId: string;
    dashboardPin: string;
  };
  // Window ID -> details of sent alert for that 5m window
  alertedWindows: Record<
    string,
    {
      timestamp: number;
      direction: string;
      confidence: number;
      windowRange: string;
      alertId: string;
    }
  >;
  alerts: AlertRecord[];
  logs: LogEntry[];
}

export function maskString(str: string, keepStart = 4, keepEnd = 4): string {
  if (!str) return '';
  if (str.length <= keepStart + keepEnd) return '••••••••';
  const start = str.slice(0, keepStart);
  const end = str.slice(-keepEnd);
  return `${start}••••••••${end}`;
}

const DEFAULT_CONFIG: PersistentState['config'] = {
  enabled: true,
  targetUrl: process.env.TARGET_URL || 'https://rolflelieveld.com/BTC/predictor/',
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '1000', 10),
  signalDirection: (process.env.SIGNAL_DIRECTION as 'UP' | 'DOWN' | 'BOTH') || 'UP',
  minConfidence: parseInt(process.env.MIN_CONFIDENCE || '100', 10),
  confirmationSeconds: parseFloat(process.env.CONFIRMATION_SECONDS || '5'),
  minTimeRemainingSeconds: parseInt(process.env.MIN_TIME_REMAINING_SECONDS || '130', 10),
  telegramEnabled: true,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '9198281670:AAH9PPB0bXWr1zmCGT_E9VFAV8jn6vlrGmI',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '7719238333',
  dashboardPin: process.env.DASHBOARD_PIN || '1234',
};

class Store {
  private state: PersistentState;

  constructor() {
    this.ensureDir();
    this.state = this.loadState();
  }

  private ensureDir() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch (err) {
      console.error('[Store] Failed to create data dir:', err);
    }
  }

  private loadState(): PersistentState {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const raw = fs.readFileSync(STATE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);

        // Migrate legacy dedupKeys if present
        const alertedWindows: Record<string, any> = parsed.alertedWindows || {};
        if (parsed.dedupKeys) {
          for (const [key, val] of Object.entries(parsed.dedupKeys as Record<string, any>)) {
            const windowId = val.window || key.split('_')[0];
            if (windowId && !alertedWindows[windowId]) {
              alertedWindows[windowId] = {
                timestamp: val.timestamp,
                direction: val.direction,
                confidence: 100,
                windowRange: val.window,
                alertId: 'legacy',
              };
            }
          }
        }

        return {
          config: {
            ...DEFAULT_CONFIG,
            ...parsed.config,
            targetUrl: parsed.config?.targetUrl || DEFAULT_CONFIG.targetUrl,
            telegramBotToken: parsed.config?.telegramBotToken || DEFAULT_CONFIG.telegramBotToken,
            telegramChatId: parsed.config?.telegramChatId || DEFAULT_CONFIG.telegramChatId,
          },
          alertedWindows,
          alerts: Array.isArray(parsed.alerts) ? parsed.alerts.slice(-100) : [],
          logs: Array.isArray(parsed.logs) ? parsed.logs.slice(-150) : [],
        };
      }
    } catch (err) {
      console.warn('[Store] Failed to read state file, using defaults:', err);
    }

    return {
      config: { ...DEFAULT_CONFIG },
      alertedWindows: {},
      alerts: [],
      logs: [],
    };
  }

  public save() {
    try {
      this.ensureDir();
      const serialized = JSON.stringify(this.state, null, 2);
      fs.writeFileSync(STATE_FILE, serialized, 'utf-8');
    } catch (err) {
      console.error('[Store] Failed to persist state:', err);
    }
  }

  public getConfig(): MonitorConfig {
    return {
      enabled: this.state.config.enabled,
      targetUrl: this.state.config.targetUrl,
      pollIntervalMs: this.state.config.pollIntervalMs,
      signalDirection: this.state.config.signalDirection,
      minConfidence: this.state.config.minConfidence,
      confirmationSeconds: this.state.config.confirmationSeconds,
      minTimeRemainingSeconds: this.state.config.minTimeRemainingSeconds ?? 130,
      telegramEnabled: this.state.config.telegramEnabled,
      telegramBotTokenMasked: maskString(this.state.config.telegramBotToken, 4, 4),
      telegramChatIdMasked: maskString(this.state.config.telegramChatId, 3, 3),
      isCustomTokenSet: Boolean(this.state.config.telegramBotToken),
      dashboardPin: this.state.config.dashboardPin,
    };
  }

  public getRawCredentials() {
    return {
      token: this.state.config.telegramBotToken,
      chatId: this.state.config.telegramChatId,
      pin: this.state.config.dashboardPin,
      targetUrl: this.state.config.targetUrl,
      confirmationSeconds: this.state.config.confirmationSeconds,
      minTimeRemainingSeconds: this.state.config.minTimeRemainingSeconds ?? 130,
      pollIntervalMs: this.state.config.pollIntervalMs,
      signalDirection: this.state.config.signalDirection,
      minConfidence: this.state.config.minConfidence,
      enabled: this.state.config.enabled,
      telegramEnabled: this.state.config.telegramEnabled,
    };
  }

  public updateConfig(patch: Partial<PersistentState['config']>) {
    if (patch.telegramBotToken !== undefined && !patch.telegramBotToken.trim()) {
      delete patch.telegramBotToken;
    }
    if (patch.telegramChatId !== undefined && !patch.telegramChatId.trim()) {
      delete patch.telegramChatId;
    }

    this.state.config = {
      ...this.state.config,
      ...patch,
    };
    this.save();
  }

  /**
   * CRITICAL REQUIREMENT: ONE ALERT PER 5-MINUTE MARKET WINDOW
   * Checks whether this unique 5-minute market window has already triggered an alert.
   */
  public hasAlertedForWindow(windowId: string): boolean {
    if (!windowId) return false;
    return Boolean(this.state.alertedWindows[windowId]);
  }

  public markWindowAlerted(
    windowId: string,
    details: { direction: string; confidence: number; windowRange: string; alertId: string }
  ) {
    if (!windowId) return;
    this.state.alertedWindows[windowId] = {
      timestamp: Date.now(),
      direction: details.direction,
      confidence: details.confidence,
      windowRange: details.windowRange,
      alertId: details.alertId,
    };

    // Keep history for the last 100 windows
    const entries = Object.entries(this.state.alertedWindows);
    if (entries.length > 100) {
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      this.state.alertedWindows = Object.fromEntries(entries.slice(0, 100));
    }
    this.save();
  }

  public addAlert(alert: AlertRecord) {
    this.state.alerts.unshift(alert);
    if (this.state.alerts.length > 100) {
      this.state.alerts = this.state.alerts.slice(0, 100);
    }
    this.save();
  }

  public getAlerts(): AlertRecord[] {
    return this.state.alerts;
  }

  public addLog(level: LogEntry['level'], message: string, data?: Record<string, unknown>) {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    };
    this.state.logs.unshift(entry);
    if (this.state.logs.length > 150) {
      this.state.logs = this.state.logs.slice(0, 150);
    }
    if (this.state.logs.length % 5 === 0) {
      this.save();
    }
  }

  public getLogs(): LogEntry[] {
    return this.state.logs;
  }
}

export const store = new Store();
