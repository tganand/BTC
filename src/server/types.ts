export type SignalDirection = 'UP' | 'DOWN' | 'UNKNOWN';

export interface PredictionSignal {
  direction: SignalDirection;
  confidence: number; // 0 to 100
  window: string; // e.g. "12:30 PM – 12:35 PM (#1793277000)"
  windowId: string; // Unique 5-minute window timestamp e.g. "1793277000"
  windowStartEnd: string; // e.g. "12:30 PM – 12:35 PM"
  countdown: string; // e.g. "02:18"
  remainingSecondsInWindow: number; // Seconds remaining in 5m window
  isWindowTimeEligible: boolean; // True if >= 130s (2:10 cutoff rule)
  referencePrice: string; // e.g. "$80,051.00"
  timestamp: number; // Epoch ms
  source: string;
  isStale?: boolean;
  rawText?: string;
  rawExplain?: string;
}

export type ConfirmationStatus = 'IDLE' | 'CONFIRMING' | 'ALERTED' | 'CANCELLED';

export interface ConfirmationState {
  status: ConfirmationStatus;
  targetDirection: SignalDirection | null;
  targetConfidence: number | null;
  targetWindowId: string | null;
  targetWindowRange: string | null;
  startedAt: number | null;
  targetSeconds: number; // default 5.0
  elapsedSeconds: number;
  remainingSeconds: number;
  lastCancelReason?: string;
  lastCancelTimestamp?: number;
}

export interface MonitorConfig {
  enabled: boolean;
  targetUrl: string;
  pollIntervalMs: number; // default 1000ms
  signalDirection: 'UP' | 'DOWN' | 'BOTH';
  minConfidence: number; // default 100
  confirmationSeconds: number; // default 5
  minTimeRemainingSeconds: number; // default 130 (2 minutes 10 seconds cutoff)
  telegramEnabled: boolean;
  telegramBotTokenMasked: string;
  telegramChatIdMasked: string;
  isCustomTokenSet: boolean;
  dashboardPin: string;
}

export interface AlertRecord {
  id: string;
  timestamp: string; // ISO
  signal: PredictionSignal;
  windowId: string;
  confirmedDurationSeconds: number;
  status: 'SENT' | 'FAILED' | 'SKIPPED_DUPLICATE_WINDOW';
  telegramMessageId?: number;
  errorMessage?: string;
  isSimulation: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
  message: string;
  data?: Record<string, unknown>;
}

export interface MonitorStatus {
  state: 'RUNNING' | 'STOPPED' | 'ERROR';
  lastCheckTime: string | null;
  lastError: string | null;
  consecutiveErrors: number;
  currentSignal: PredictionSignal | null;
  confirmation: ConfirmationState;
  activeWindowId: string | null;
  activeWindowAlertSent: boolean;
  simulationActive: boolean;
  stats: {
    totalChecks: number;
    totalAlerts: number;
    uptimeSeconds: number;
    startedAt: string;
  };
}
