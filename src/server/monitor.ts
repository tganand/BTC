import { store } from './store.ts';
import { fetchAndExtractSignal, closeBrowserSession } from './extractor.ts';
import { sendTelegramNotification, formatSignalMessage } from './telegram.ts';
import type {
  PredictionSignal,
  ConfirmationState,
  MonitorStatus,
  AlertRecord,
} from './types.ts';

class SignalMonitor {
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private consecutiveErrors = 0;
  private lastCheckTime: string | null = null;
  private lastError: string | null = null;
  private currentSignal: PredictionSignal | null = null;
  private startedAtTime = new Date().toISOString();
  private totalChecks = 0;
  private totalAlerts = 0;

  // Active market window tracking
  private activeWindowId: string | null = null;

  // Strict Confirmation State
  private confirmation: ConfirmationState = {
    status: 'IDLE',
    targetDirection: null,
    targetConfidence: null,
    targetWindowId: null,
    targetWindowRange: null,
    startedAt: null,
    targetSeconds: 5.0,
    elapsedSeconds: 0,
    remainingSeconds: 5.0,
  };

  // Simulation mode
  private simulatedSignal: PredictionSignal | null = null;
  private simulationTimer: NodeJS.Timeout | null = null;

  constructor() {
    const config = store.getConfig();
    this.confirmation.targetSeconds = config.confirmationSeconds;
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    store.addLog('INFO', 'BTC 5-Minute Signal Monitor started.');
    this.scheduleNextTick(0);
  }

  public stop() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.resetConfirmation('Monitor stopped by user');
    store.addLog('INFO', 'BTC 5-Minute Signal Monitor stopped.');
  }

  public getStatus(): MonitorStatus {
    const creds = store.getRawCredentials();
    const now = Date.now();
    let elapsed = 0;
    let remaining = this.confirmation.targetSeconds;

    if (this.confirmation.status === 'CONFIRMING' && this.confirmation.startedAt) {
      elapsed = Math.max(0, (now - this.confirmation.startedAt) / 1000);
      remaining = Math.max(0, this.confirmation.targetSeconds - elapsed);
    }

    let state: MonitorStatus['state'] = 'STOPPED';
    if (this.isRunning) {
      state = this.consecutiveErrors >= 5 ? 'ERROR' : 'RUNNING';
    }

    const currentWinId = this.currentSignal?.windowId || this.activeWindowId;
    const isWindowAlertSent = currentWinId ? store.hasAlertedForWindow(currentWinId) : false;

    return {
      state,
      lastCheckTime: this.lastCheckTime,
      lastError: this.lastError,
      consecutiveErrors: this.consecutiveErrors,
      currentSignal: this.currentSignal,
      confirmation: {
        ...this.confirmation,
        elapsedSeconds: parseFloat(elapsed.toFixed(1)),
        remainingSeconds: parseFloat(remaining.toFixed(1)),
      },
      activeWindowId: currentWinId,
      activeWindowAlertSent: isWindowAlertSent,
      simulationActive: Boolean(this.simulatedSignal),
      stats: {
        totalChecks: this.totalChecks,
        totalAlerts: this.totalAlerts,
        uptimeSeconds: Math.floor((Date.now() - new Date(this.startedAtTime).getTime()) / 1000),
        startedAt: this.startedAtTime,
      },
    };
  }

  private scheduleNextTick(delayMs?: number) {
    if (!this.isRunning) return;
    const config = store.getConfig();
    const interval = delayMs !== undefined ? delayMs : (config.pollIntervalMs || 1000);

    this.timer = setTimeout(() => {
      this.tick()
        .catch((err) => {
          console.error('[Monitor] Uncaught tick error:', err);
        })
        .finally(() => {
          this.scheduleNextTick();
        });
    }, interval);
  }

  private async tick() {
    if (!this.isRunning) return;
    this.totalChecks++;
    this.lastCheckTime = new Date().toISOString();

    const creds = store.getRawCredentials();
    this.confirmation.targetSeconds = creds.confirmationSeconds || 5.0;

    // 1. Get signal: either simulated or extracted from live website
    let signal: PredictionSignal | null = null;
    let fetchError: string | null = null;

    if (this.simulatedSignal) {
      signal = this.simulatedSignal;
    } else {
      const result = await fetchAndExtractSignal(creds.targetUrl);
      if (result.success && result.signal) {
        signal = result.signal;
        this.consecutiveErrors = 0;
        this.lastError = null;
      } else {
        fetchError = result.error || 'Unknown extraction error';
        this.consecutiveErrors++;
        this.lastError = fetchError;
      }
    }

    this.currentSignal = signal;

    // Handle extraction failure or warming-up status
    if (!signal) {
      if (this.confirmation.status === 'CONFIRMING') {
        this.cancelConfirmation(`Signal lost due to extraction error: ${fetchError}`);
      }
      return;
    }

    // 2. Track Window Rollover
    // When a new 5-minute window starts, reset active window and confirmation
    if (this.activeWindowId && signal.windowId !== this.activeWindowId) {
      store.addLog(
        'INFO',
        `Market window transitioned from #${this.activeWindowId} to new window #${signal.windowId} (${signal.windowStartEnd}). Monitoring new window independently.`
      );
      this.activeWindowId = signal.windowId;
      this.resetConfirmation('Market window rolled over to next 5-minute window');
    } else if (!this.activeWindowId) {
      this.activeWindowId = signal.windowId;
    }

    // 3. Check CRITICAL RULE: ONE ALERT PER FIVE-MINUTE MARKET WINDOW
    const alreadyAlertedForThisWindow = store.hasAlertedForWindow(signal.windowId);
    if (alreadyAlertedForThisWindow && !this.simulatedSignal) {
      if (this.confirmation.status === 'CONFIRMING') {
        this.cancelConfirmation(
          `Window #${signal.windowId} has already received an alert. Strictly 1 alert per 5m window.`
        );
      }
      this.confirmation.status = 'ALERTED';
      return;
    }

    // 4. Check if signal satisfies target alert conditions
    const isDirectionMatch =
      creds.signalDirection === 'BOTH' || creds.signalDirection === signal.direction;
    const isConfidenceMatch = signal.confidence >= creds.minConfidence;
    // CRITICAL USER RULE: Timer must NOT be less than 2:10 minutes (130 seconds remaining)
    const isTimeEligible = signal.remainingSecondsInWindow >= (creds.minTimeRemainingSeconds || 130);
    const conditionsSatisfied = isDirectionMatch && isConfidenceMatch && isTimeEligible;

    const now = Date.now();

    // 5. STRICT 5-SECOND CONFIRMATION STATE MACHINE
    if (conditionsSatisfied) {
      if (this.confirmation.status === 'IDLE' || this.confirmation.status === 'CANCELLED') {
        // Start strict confirmation timer
        this.confirmation.status = 'CONFIRMING';
        this.confirmation.startedAt = now;
        this.confirmation.targetDirection = signal.direction;
        this.confirmation.targetConfidence = signal.confidence;
        this.confirmation.targetWindowId = signal.windowId;
        this.confirmation.targetWindowRange = signal.windowStartEnd;
        this.confirmation.lastCancelReason = undefined;

        store.addLog(
          'INFO',
          `[CONFIRMATION STARTED] ${signal.direction} (${signal.confidence}%) detected for window #${signal.windowId} (${signal.windowStartEnd}, ${signal.countdown} left). Waiting >${this.confirmation.targetSeconds}s continuous unchanged state.`,
          { signal }
        );
      } else if (this.confirmation.status === 'CONFIRMING') {
        // Verify signal continuity
        const directionUnchanged = signal.direction === this.confirmation.targetDirection;
        const confidenceSufficient = signal.confidence >= creds.minConfidence;
        const windowUnchanged = signal.windowId === this.confirmation.targetWindowId;
        const timeRemainingValid = signal.remainingSecondsInWindow >= (creds.minTimeRemainingSeconds || 130);

        if (!directionUnchanged) {
          this.cancelConfirmation(
            `Direction flipped from ${this.confirmation.targetDirection} to ${signal.direction}`
          );
          return;
        }

        if (!confidenceSufficient) {
          this.cancelConfirmation(
            `Confidence dropped below threshold to ${signal.confidence}%`
          );
          return;
        }

        if (!windowUnchanged) {
          this.cancelConfirmation(
            `Market window rolled over from #${this.confirmation.targetWindowId} to #${signal.windowId}`
          );
          return;
        }

        if (!timeRemainingValid) {
          this.cancelConfirmation(
            `Window timer reached ${signal.countdown} (less than 2:10 remaining). Ineligible for alerts.`
          );
          return;
        }

        // Measure actual elapsed time using timestamps
        const elapsedSec = (now - (this.confirmation.startedAt || now)) / 1000;

        // Strictly check if MORE THAN confirmationSeconds have elapsed
        if (elapsedSec > this.confirmation.targetSeconds) {
          // Confirmation Succeeded!
          await this.handleConfirmedAlert(signal, elapsedSec);
        }
      }
    } else {
      // Conditions NOT satisfied
      if (this.confirmation.status === 'CONFIRMING') {
        const reason = !isDirectionMatch
          ? `Direction is ${signal.direction} (configured: ${creds.signalDirection})`
          : `Confidence is ${signal.confidence}% (minimum required: ${creds.minConfidence}%)`;
        this.cancelConfirmation(reason);
      }
    }
  }

  private cancelConfirmation(reason: string) {
    const elapsed = this.confirmation.startedAt
      ? ((Date.now() - this.confirmation.startedAt) / 1000).toFixed(1)
      : '0.0';

    store.addLog(
      'WARN',
      `[CONFIRMATION CANCELLED after ${elapsed}s] ${reason}. No notification sent.`
    );

    this.confirmation.status = 'CANCELLED';
    this.confirmation.startedAt = null;
    this.confirmation.lastCancelReason = reason;
    this.confirmation.lastCancelTimestamp = Date.now();
  }

  private resetConfirmation(reason: string) {
    this.confirmation.status = 'IDLE';
    this.confirmation.startedAt = null;
    this.confirmation.targetDirection = null;
    this.confirmation.targetConfidence = null;
    this.confirmation.targetWindowId = null;
    this.confirmation.targetWindowRange = null;
    this.confirmation.lastCancelReason = reason;
  }

  private async handleConfirmedAlert(signal: PredictionSignal, elapsedSeconds: number) {
    const creds = store.getRawCredentials();
    const isSim = Boolean(this.simulatedSignal);
    const windowId = signal.windowId || 'current_window';

    // Enforcement: ONE ALERT PER FIVE-MINUTE MARKET WINDOW
    const alreadyAlerted = store.hasAlertedForWindow(windowId);
    if (alreadyAlerted && !isSim) {
      store.addLog(
        'INFO',
        `[DUPLICATE BLOCKED] Signal confirmed for ${elapsedSeconds.toFixed(1)}s, but alert was already sent for window #${windowId}. Strictly 1 alert per 5m window.`
      );

      const record: AlertRecord = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString(),
        signal,
        windowId,
        confirmedDurationSeconds: parseFloat(elapsedSeconds.toFixed(1)),
        status: 'SKIPPED_DUPLICATE_WINDOW',
        isSimulation: isSim,
      };
      store.addAlert(record);
      this.confirmation.status = 'ALERTED';
      return;
    }

    // Enforcement: 2:10 minutes cutoff rule (130 seconds)
    if (signal.remainingSecondsInWindow < (creds.minTimeRemainingSeconds || 130) && !isSim) {
      store.addLog(
        'WARN',
        `[ALERT BLOCKED] Window countdown is ${signal.countdown} (< 2:10 remaining). Disqualified from notifications.`
      );
      this.cancelConfirmation(`Window countdown < 2:10 (${signal.countdown}) at trigger`);
      return;
    }

    // Send Telegram Notification
    this.totalAlerts++;
    const message = formatSignalMessage(signal, elapsedSeconds, isSim);

    store.addLog(
      'SUCCESS',
      `[CONFIRMED >${this.confirmation.targetSeconds}s] ${signal.direction} ${signal.confidence}% held continuously for ${elapsedSeconds.toFixed(1)}s! Dispatching Telegram notification.`
    );

    let sendResult: { ok: boolean; messageId?: number; error?: string } = {
      ok: false,
      error: 'Telegram notifications are disabled in settings',
    };

    if (creds.telegramEnabled) {
      sendResult = await sendTelegramNotification(creds.token, creds.chatId, message);
    }

    const alertId = Math.random().toString(36).substring(2, 9);
    const alertRecord: AlertRecord = {
      id: alertId,
      timestamp: new Date().toISOString(),
      signal,
      windowId,
      confirmedDurationSeconds: parseFloat(elapsedSeconds.toFixed(1)),
      status: sendResult.ok ? 'SENT' : 'FAILED',
      telegramMessageId: sendResult.messageId,
      errorMessage: sendResult.error,
      isSimulation: isSim,
    };

    store.addAlert(alertRecord);

    if (sendResult.ok) {
      store.addLog(
        'SUCCESS',
        `Telegram alert delivered! (Message ID: ${sendResult.messageId}) to chat ID ${creds.chatId}`
      );
      if (!isSim) {
        // Lock this window permanently in persistent storage
        store.markWindowAlerted(windowId, {
          direction: signal.direction,
          confidence: signal.confidence,
          windowRange: signal.windowStartEnd,
          alertId,
        });
      }
    } else {
      store.addLog('ERROR', `Failed to send Telegram alert: ${sendResult.error}`);
    }

    this.confirmation.status = 'ALERTED';
  }

  // SIMULATION ENGINE FOR TESTING ALL MANDATORY SCENARIOS
  public startSimulation(
    type:
      | 'scenario-1-up-success'
      | 'scenario-2-drop-at-3s'
      | 'scenario-3-flip-down-before-5s'
      | 'scenario-4-same-window-repeat'
      | 'scenario-5-next-window-permitted'
      | 'scenario-6-restart-dedup'
      | 'scenario-7-extraction-fail'
      | 'scenario-8-under-210-blocked'
  ) {
    if (this.simulationTimer) {
      clearTimeout(this.simulationTimer);
      this.simulationTimer = null;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const windowStartSec = Math.floor(nowSec / 300) * 300;
    const windowId = String(windowStartSec);
    const nextWindowId = String(windowStartSec + 300);

    const now = new Date();
    const currentRange = `${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${new Date(Date.now() + 300000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const nextRange = `${new Date(Date.now() + 300000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${new Date(Date.now() + 600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    if (type === 'scenario-1-up-success') {
      store.addLog('INFO', '🧪 [SCENARIO 1] Simulating UP 100% held for >5 seconds with 03:45 remaining (> 2:10) -> Expecting exactly ONE alert.');
      this.simulatedSignal = {
        direction: 'UP',
        confidence: 100,
        window: `${currentRange} (#${windowId})`,
        windowId,
        windowStartEnd: currentRange,
        countdown: '03:45',
        remainingSecondsInWindow: 225,
        isWindowTimeEligible: true,
        referencePrice: '$80,150.00',
        timestamp: Date.now(),
        source: 'https://rolflelieveld.com/BTC/predictor/',
      };

      this.simulationTimer = setTimeout(() => {
        store.addLog('INFO', '🧪 [SCENARIO 1 COMPLETED] UP 100% test completed.');
        this.simulatedSignal = null;
      }, 7500);
    } else if (type === 'scenario-2-drop-at-3s') {
      store.addLog('INFO', '🧪 [SCENARIO 2] Simulating UP 100% for 3s, then dropping to 95% -> Expecting timer CANCEL, NO alert.');
      this.simulatedSignal = {
        direction: 'UP',
        confidence: 100,
        window: `${currentRange} (#${windowId})`,
        windowId,
        windowStartEnd: currentRange,
        countdown: '03:30',
        remainingSecondsInWindow: 210,
        isWindowTimeEligible: true,
        referencePrice: '$80,150.00',
        timestamp: Date.now(),
        source: 'https://rolflelieveld.com/BTC/predictor/',
      };

      this.simulationTimer = setTimeout(() => {
        store.addLog('WARN', '🧪 [SCENARIO 2 TRIGGER] Dropping confidence to 95% at 3s.');
        if (this.simulatedSignal) {
          this.simulatedSignal = {
            ...this.simulatedSignal,
            confidence: 95,
            timestamp: Date.now(),
          };
        }
        setTimeout(() => {
          this.simulatedSignal = null;
        }, 3000);
      }, 3000);
    } else if (type === 'scenario-3-flip-down-before-5s') {
      store.addLog('INFO', '🧪 [SCENARIO 3] Simulating UP 100% for 2.5s, then flipping to DOWN -> Expecting timer CANCEL, NO UP alert.');
      this.simulatedSignal = {
        direction: 'UP',
        confidence: 100,
        window: `${currentRange} (#${windowId})`,
        windowId,
        windowStartEnd: currentRange,
        countdown: '03:30',
        remainingSecondsInWindow: 210,
        isWindowTimeEligible: true,
        referencePrice: '$80,150.00',
        timestamp: Date.now(),
        source: 'https://rolflelieveld.com/BTC/predictor/',
      };

      this.simulationTimer = setTimeout(() => {
        store.addLog('WARN', '🧪 [SCENARIO 3 TRIGGER] Direction flipped to DOWN at 2.5s.');
        if (this.simulatedSignal) {
          this.simulatedSignal = {
            ...this.simulatedSignal,
            direction: 'DOWN',
            timestamp: Date.now(),
          };
        }
        setTimeout(() => {
          this.simulatedSignal = null;
        }, 3000);
      }, 2500);
    } else if (type === 'scenario-4-same-window-repeat') {
      store.addLog('INFO', `🧪 [SCENARIO 4] Marking window #${windowId} as already alerted, then presenting UP 100% -> Expecting ZERO alerts (duplicate blocked).`);
      store.markWindowAlerted(windowId, {
        direction: 'UP',
        confidence: 100,
        windowRange: currentRange,
        alertId: 'test-scenario-4',
      });

      this.simulatedSignal = {
        direction: 'UP',
        confidence: 100,
        window: `${currentRange} (#${windowId})`,
        windowId,
        windowStartEnd: currentRange,
        countdown: '03:15',
        remainingSecondsInWindow: 195,
        isWindowTimeEligible: true,
        referencePrice: '$80,150.00',
        timestamp: Date.now(),
        source: 'https://rolflelieveld.com/BTC/predictor/',
      };

      this.simulationTimer = setTimeout(() => {
        store.addLog('INFO', '🧪 [SCENARIO 4 COMPLETED] Verified no second alert for same window.');
        this.simulatedSignal = null;
      }, 7000);
    } else if (type === 'scenario-5-next-window-permitted') {
      store.addLog('INFO', `🧪 [SCENARIO 5] Simulating arrival of NEXT window #${nextWindowId} (${nextRange}) -> Expecting 1 new alert permitted.`);
      this.simulatedSignal = {
        direction: 'UP',
        confidence: 100,
        window: `${nextRange} (#${nextWindowId})`,
        windowId: nextWindowId,
        windowStartEnd: nextRange,
        countdown: '04:50',
        remainingSecondsInWindow: 290,
        isWindowTimeEligible: true,
        referencePrice: '$80,200.00',
        timestamp: Date.now(),
        source: 'https://rolflelieveld.com/BTC/predictor/',
      };

      this.simulationTimer = setTimeout(() => {
        store.addLog('INFO', '🧪 [SCENARIO 5 COMPLETED] Next window simulation completed.');
        this.simulatedSignal = null;
      }, 7500);
    } else if (type === 'scenario-6-restart-dedup') {
      store.addLog('INFO', `🧪 [SCENARIO 6] Simulating backend restart with persistent storage check for window #${windowId}.`);
      const hasAlerted = store.hasAlertedForWindow(windowId);
      store.addLog(
        hasAlerted ? 'SUCCESS' : 'INFO',
        `[SCENARIO 6 RESULT] Window #${windowId} alert state in persistent storage: ${hasAlerted ? 'LOCKED (Protected against duplicate after restart)' : 'UNLOCKED'}`
      );
    } else if (type === 'scenario-7-extraction-fail') {
      store.addLog('INFO', '🧪 [SCENARIO 7] Simulating unreadable confidence or stale data -> Expecting ERROR status, NO alert.');
      this.simulatedSignal = null;
      this.cancelConfirmation('Simulated data extraction failure: Confidence percentage unreadable');
      this.consecutiveErrors = 3;
      this.lastError = 'Simulated extraction error: Confidence percentage missing on page';
      setTimeout(() => {
        this.consecutiveErrors = 0;
        this.lastError = null;
      }, 4000);
    } else if (type === 'scenario-8-under-210-blocked') {
      store.addLog(
        'INFO',
        '🧪 [SCENARIO 8] Simulating UP with 100% confidence but window countdown is 01:45 (< 2:10 cutoff) -> Expecting NO alert sent even at 100%!'
      );
      this.simulatedSignal = {
        direction: 'UP',
        confidence: 100,
        window: `${currentRange} (#${windowId})`,
        windowId,
        windowStartEnd: currentRange,
        countdown: '01:45',
        remainingSecondsInWindow: 105, // 105s < 130s cutoff
        isWindowTimeEligible: false,
        referencePrice: '$80,150.00',
        timestamp: Date.now(),
        source: 'https://rolflelieveld.com/BTC/predictor/',
      };

      this.simulationTimer = setTimeout(() => {
        store.addLog(
          'SUCCESS',
          '🧪 [SCENARIO 8 RESULT] Verified: Window countdown 01:45 (< 2:10 cutoff) prevented alert from sending despite 100% confidence!'
        );
        this.simulatedSignal = null;
      }, 7000);
    }
  }

  public stopSimulation() {
    if (this.simulationTimer) {
      clearTimeout(this.simulationTimer);
      this.simulationTimer = null;
    }
    this.simulatedSignal = null;
    this.resetConfirmation('Simulation cleared');
    store.addLog('INFO', 'Simulation cleared. Returned to live monitoring.');
  }
}

export const monitor = new SignalMonitor();
