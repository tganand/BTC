import type { PredictionSignal } from './types.ts';

export interface TelegramSendResult {
  ok: boolean;
  messageId?: number;
  error?: string;
  responseBody?: unknown;
}

/**
 * Formats signal alert into the exact template requested by the user
 */
export function formatSignalMessage(
  signal: PredictionSignal,
  confirmedSeconds: number,
  isSimulation = false
): string {
  const prefix = isSimulation ? '🧪 [TEST SIMULATION]\n' : '';
  const dateObj = new Date(signal.timestamp);
  const detectedAtStr = `${dateObj.toISOString().replace('T', ' ').slice(0, 19)} UTC`;

  return `${prefix}🚨 BTC 5-MINUTE CONFIRMED SIGNAL

Direction: ${signal.direction}
Confidence: ${signal.confidence}%
Market window: ${signal.windowId || signal.window}
Window start/end: ${signal.windowStartEnd || signal.window}
Reference BTC price: ${signal.referencePrice || 'N/A'}
Confirmation: More than 5 seconds (${confirmedSeconds.toFixed(1)}s elapsed)
Detected at: ${detectedAtStr}

Source: RollieLevel BTC Predictor
https://rollielevel.com/BTC/predictor/

This notification reports the website's model output and does not guarantee that the market will move in that direction.`;
}

/**
 * Sends a message via the official Telegram Bot API
 */
export async function sendTelegramNotification(
  token: string,
  chatId: string,
  text: string
): Promise<TelegramSendResult> {
  if (!token || !chatId) {
    return {
      ok: false,
      error: 'Telegram Bot Token or Chat ID is not configured.',
    };
  }

  const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        disable_web_page_preview: false,
      }),
    });

    clearTimeout(timeout);

    const data: any = await response.json().catch(() => null);

    if (!response.ok || !data?.ok) {
      const desc = data?.description || `HTTP ${response.status} ${response.statusText}`;
      return {
        ok: false,
        error: `Telegram API Error: ${desc}`,
        responseBody: data,
      };
    }

    return {
      ok: true,
      messageId: data.result?.message_id,
      responseBody: data.result,
    };
  } catch (err: any) {
    let msg = err.message || 'Telegram network request failed';
    if (err.name === 'AbortError') {
      msg = 'Telegram request timed out after 10 seconds';
    }
    return {
      ok: false,
      error: msg,
    };
  }
}

/**
 * Sends a lightweight test notification to verify credentials
 */
export async function sendTestNotification(
  token: string,
  chatId: string,
  initiator = 'Dashboard Admin'
): Promise<TelegramSendResult> {
  const timestamp = new Date().toUTCString();
  const testMessage = `🤖 BTC 5-Minute Monitor Test Handshake

Status: Connection Verified Successfully!
Initiated by: ${initiator}
Time: ${timestamp}
Bot: @BTcpridicion1_bot
Chat ID: ${chatId}

Your Telegram bot connection is active and ready for confirmed 5-second signals.`;

  return sendTelegramNotification(token, chatId, testMessage);
}
