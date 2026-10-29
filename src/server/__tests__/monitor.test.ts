import { test, describe } from 'node:test';
import assert from 'node:assert';
import { extractSignalFromHtml } from '../extractor.ts';
import { formatSignalMessage } from '../telegram.ts';
import { store } from '../store.ts';
import type { PredictionSignal } from '../types.ts';

describe('Website Signal Extractor Tests (#card-now only)', () => {
  test('Extracts ONLY #card-now (Now: current window) and ignores #card-next', () => {
    const mockHtml = `
      <section class="win-card" id="card-now">
        <h2>Now: current window</h2>
        <div class="small" id="now-window-range">12:30 PM – 12:35 PM</div>
        <div class="countdown" id="now-countdown">02:18</div>
        <div>
          <span class="price" id="now-price">$80,171.82</span>
          <span id="now-delta" class="small delta-up"> ▲ 28.18 (+0.04%)</span>
        </div>
        <div class="pred">
          <div class="arrow up" id="now-arrow">▲</div>
          <div>
            <div class="conf-label">Model says</div>
            <div class="conf-val" id="now-conf">UP · 100.0%</div>
            <div class="small" id="now-explain">Confidence 100% · based on momentum vs realised volatility</div>
          </div>
        </div>
        <a class="market-link" id="now-market-link" href="https://polymarket.com/event/btc-updown-5m-1793277000">Open</a>
      </section>
      <section class="win-card" id="card-next">
        <h2>Next window</h2>
        <div class="arrow down" id="next-arrow">▼</div>
        <div class="conf-val" id="next-conf">DOWN · 90.0%</div>
      </section>
    `;

    const result = extractSignalFromHtml(mockHtml);
    assert.strictEqual(result.success, true);
    assert.ok(result.signal);
    assert.strictEqual(result.signal.direction, 'UP');
    assert.strictEqual(result.signal.confidence, 100);
    assert.strictEqual(result.signal.windowId, '1793277000');
    assert.strictEqual(result.signal.windowStartEnd, '12:30 PM – 12:35 PM');
    assert.strictEqual(result.signal.referencePrice, '$80,171.82');
    assert.strictEqual(result.signal.countdown, '02:18');
    assert.strictEqual(result.signal.remainingSecondsInWindow, 138);
    assert.strictEqual(result.signal.isWindowTimeEligible, true);
  });

  test('Correctly identifies timer < 2:10 minutes (130s) as ineligible', () => {
    const under210Html = `
      <section class="win-card" id="card-now">
        <h2>Now: current window</h2>
        <div class="small" id="now-window-range">12:30 PM – 12:35 PM</div>
        <div class="countdown" id="now-countdown">01:45</div>
        <span class="price" id="now-price">$80,171.82</span>
        <div class="arrow up" id="now-arrow">▲</div>
        <div class="conf-val" id="now-conf">UP · 100.0%</div>
        <div class="small" id="now-explain">Confidence 100% · based on momentum vs realised volatility</div>
        <a class="market-link" id="now-market-link" href="https://polymarket.com/event/btc-updown-5m-1793277000">Open</a>
      </section>
    `;

    const result = extractSignalFromHtml(under210Html);
    assert.strictEqual(result.success, true);
    assert.ok(result.signal);
    assert.strictEqual(result.signal.countdown, '01:45');
    assert.strictEqual(result.signal.remainingSecondsInWindow, 105);
    assert.strictEqual(result.signal.isWindowTimeEligible, false); // 105 < 130s -> strictly ineligible
  });

  test('Extracts DOWN with 100% confidence correctly from #card-now', () => {
    const downHtml = `
      <section class="win-card" id="card-now">
        <h2>Now: current window</h2>
        <div class="small" id="now-window-range">12:35 PM – 12:40 PM</div>
        <span class="price" id="now-price">$80,050.00</span>
        <div class="arrow down" id="now-arrow">▼</div>
        <div class="conf-val" id="now-conf">DOWN · 0.0%</div>
        <div class="small" id="now-explain">Confidence 100% · based on momentum vs realised volatility</div>
        <a class="market-link" id="now-market-link" href="https://polymarket.com/event/btc-updown-5m-1793277300">Open</a>
      </section>
    `;

    const result = extractSignalFromHtml(downHtml);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.signal?.direction, 'DOWN');
    assert.strictEqual(result.signal?.confidence, 100);
    assert.strictEqual(result.signal?.windowId, '1793277300');
  });

  test('Rejects when confidence percentage is missing (Never assumes 100%)', () => {
    const missingConfHtml = `
      <section class="win-card" id="card-now">
        <h2>Now: current window</h2>
        <div class="arrow up" id="now-arrow">▲</div>
        <div class="small" id="now-explain">waiting for data…</div>
      </section>
    `;

    const result = extractSignalFromHtml(missingConfHtml);
    assert.strictEqual(result.success, false);
    assert.ok(result.error && (result.error.toLowerCase().includes('waiting') || result.error.includes('Confidence')));
  });
});

describe('Telegram Alert Formatter Tests', () => {
  test('Formats alert strictly according to user template specification', () => {
    const signal: PredictionSignal = {
      direction: 'UP',
      confidence: 100,
      window: '12:30 PM – 12:35 PM (#1793277000)',
      windowId: '1793277000',
      windowStartEnd: '12:30 PM – 12:35 PM',
      countdown: '03:45',
      remainingSecondsInWindow: 225,
      isWindowTimeEligible: true,
      referencePrice: '$80,051.00',
      timestamp: 1793275828000,
      source: 'https://rolflelieveld.com/BTC/predictor/',
    };

    const formatted = formatSignalMessage(signal, 5.2, false);
    assert.ok(formatted.includes('🚨 BTC 5-MINUTE CONFIRMED SIGNAL'));
    assert.ok(formatted.includes('Direction: UP'));
    assert.ok(formatted.includes('Confidence: 100%'));
    assert.ok(formatted.includes('Market window: 1793277000'));
    assert.ok(formatted.includes('Window start/end: 12:30 PM – 12:35 PM'));
    assert.ok(formatted.includes('Reference BTC price: $80,051.00'));
    assert.ok(formatted.includes('Confirmation: More than 5 seconds'));
    assert.ok(formatted.includes('Source: RollieLevel BTC Predictor'));
    assert.ok(formatted.includes('https://rollielevel.com/BTC/predictor/'));
  });
});

describe('Strict One Alert Per 5-Minute Window Deduplication Tests', () => {
  test('Blocks duplicate alert for same window ID even across different directions', () => {
    const testWindowId = 'test_window_' + Date.now();
    assert.strictEqual(store.hasAlertedForWindow(testWindowId), false);

    store.markWindowAlerted(testWindowId, {
      direction: 'UP',
      confidence: 100,
      windowRange: '01:00 PM – 01:05 PM',
      alertId: 'alert_1',
    });

    // Verify window is now locked
    assert.strictEqual(store.hasAlertedForWindow(testWindowId), true);
  });
});
