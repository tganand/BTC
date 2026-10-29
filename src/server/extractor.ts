import * as cheerio from 'cheerio';
import fs from 'node:fs';
import path from 'node:path';
import type { PredictionSignal, SignalDirection } from './types.ts';

export interface ExtractionResult {
  success: boolean;
  signal?: PredictionSignal;
  error?: string;
  sourceHtmlSnippet?: string;
}

// Persistent Playwright browser session manager
let pwBrowser: any = null;
let pwPage: any = null;
let isInitializing = false;
let lastInitAttempt = 0;
let currentBrowserUrl = '';

/**
 * Auto-discovers the installed Chromium headless binary path
 */
function getChromeExecutablePath(): string | undefined {
  if (process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH)) {
    return process.env.CHROMIUM_PATH;
  }
  const knownPaths = [
    '/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell',
    '/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
    '/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
  ];
  for (const p of knownPaths) {
    if (fs.existsSync(p)) return p;
  }
  try {
    if (fs.existsSync('/ms-playwright')) {
      const entries = fs.readdirSync('/ms-playwright');
      for (const entry of entries) {
        if (entry.includes('chromium') || entry.includes('chrome')) {
          const sub = path.join('/ms-playwright', entry, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
          if (fs.existsSync(sub)) return sub;
          const alt = path.join('/ms-playwright', entry, 'chrome-linux', 'chrome');
          if (fs.existsSync(alt)) return alt;
        }
      }
    }
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * Ensures a single persistent headless browser session is running and loaded at targetUrl.
 */
async function ensureBrowserSession(targetUrl: string) {
  const now = Date.now();
  if (pwPage && currentBrowserUrl === targetUrl && !pwPage.isClosed()) {
    return pwPage;
  }

  // Prevent multiple simultaneous initializations
  if (isInitializing) return null;
  // Rate limit retries if failing
  if (now - lastInitAttempt < 3000) return null;

  isInitializing = true;
  lastInitAttempt = now;

  try {
    // Dynamically load playwright-core
    const pw = await import('playwright-core');
    if (!pwBrowser || !pwBrowser.isConnected()) {
      const executablePath = getChromeExecutablePath();
      pwBrowser = await pw.chromium.launch({
        headless: true,
        ...(executablePath ? { executablePath } : {}),
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      });
    }

    if (!pwPage || pwPage.isClosed()) {
      pwPage = await pwBrowser.newPage();
      await pwPage.setViewportSize({ width: 1280, height: 800 });
    }

    currentBrowserUrl = targetUrl;
    await pwPage.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // Wait for the dynamic script on the page to warm up (it fetches Binance candles)
    await pwPage.waitForFunction(() => {
      const explain = document.getElementById('now-explain')?.textContent || '';
      const conf = document.getElementById('now-conf')?.textContent || '';
      return !explain.includes('waiting for data') && !conf.includes('—');
    }, { timeout: 8000 }).catch(() => {
      // Timeout waiting is okay; next tick will check again
    });

    isInitializing = false;
    return pwPage;
  } catch (err: any) {
    console.warn('[Extractor] Failed to initialize Playwright session:', err.message);
    isInitializing = false;
    if (pwPage && pwPage.isClosed()) pwPage = null;
    return null;
  }
}

/**
 * Extracts live signal values from an active DOM evaluation result or Cheerio parsed object
 */
export function parsePredictionData(
  data: {
    cardFound: boolean;
    confText: string;
    explainText: string;
    arrowClass: string;
    arrowText: string;
    windowRange: string;
    countdown?: string;
    price: string;
    marketLink: string;
  },
  sourceUrl: string
): ExtractionResult {
  if (!data.cardFound) {
    return {
      success: false,
      error: 'Could not locate "NOW: CURRENT WINDOW" card (#card-now) in page DOM.',
    };
  }

  const { confText, explainText, arrowClass, arrowText, windowRange, countdown, price, marketLink } = data;

  // 1. Check for initialization / warming up state
  if (
    explainText.toLowerCase().includes('waiting for data') ||
    confText.trim() === '—' ||
    confText.trim() === ''
  ) {
    return {
      success: false,
      error: 'Waiting for predictor model data to initialize on target page (model warming up).',
    };
  }

  // 2. Extract Direction (ONLY from #card-now)
  let direction: SignalDirection = 'UNKNOWN';
  const combinedDirStr = `${arrowClass} ${arrowText} ${confText}`.toUpperCase();

  if (combinedDirStr.includes('ARROW DOWN') || combinedDirStr.includes('▼') || confText.toUpperCase().startsWith('DOWN')) {
    direction = 'DOWN';
  } else if (combinedDirStr.includes('ARROW UP') || combinedDirStr.includes('▲') || confText.toUpperCase().startsWith('UP')) {
    direction = 'UP';
  }

  if (direction === 'UNKNOWN') {
    return {
      success: false,
      error: 'Signal direction (UP/DOWN) could not be determined from current window card.',
    };
  }

  // 3. Extract Confidence Percentage
  let confidence: number | null = null;

  const explainMatch = explainText.match(/Confidence\s*(\d{1,3}(?:\.\d+)?)\s*%/i);
  if (explainMatch && explainMatch[1]) {
    const val = parseFloat(explainMatch[1]);
    if (!isNaN(val) && val >= 0 && val <= 100) {
      confidence = Math.round(val);
    }
  }

  // Fallback to #now-conf if explain did not match
  if (confidence === null) {
    const confMatch = confText.match(/(?:UP|DOWN)\s*·\s*(\d{1,3}(?:\.\d+)?)\s*%/i);
    if (confMatch && confMatch[1]) {
      const p = parseFloat(confMatch[1]);
      if (!isNaN(p)) {
        if (direction === 'UP') {
          confidence = Math.round(p);
        } else {
          confidence = Math.round(100 - p);
        }
      }
    }
  }

  // STRICT RULE: Do not interpret missing or unreadable confidence as 100%!
  if (confidence === null || isNaN(confidence)) {
    return {
      success: false,
      error: 'Confidence percentage could not be extracted from current window card (Missing or unparseable percentage).',
    };
  }

  // 4. Extract Unique 5-Minute Market Window Identifier
  let windowId = '';
  const polyMatch = marketLink.match(/btc-updown-5m-(\d+)/i);
  if (polyMatch && polyMatch[1]) {
    windowId = polyMatch[1];
  }

  if (!windowId) {
    const nowSec = Math.floor(Date.now() / 1000);
    const windowStartSec = Math.floor(nowSec / 300) * 300;
    windowId = String(windowStartSec);
  }

  const cleanRange = windowRange && windowRange !== '—' ? windowRange.trim() : `Window #${windowId}`;

  // 5. Parse Window Countdown & 2:10 Cutoff Rule (130 seconds)
  let remainingSecondsInWindow = 0;
  let cleanCountdown = countdown ? countdown.trim() : '';

  const clockMatch = cleanCountdown.match(/(\d+):(\d+)/);
  if (clockMatch) {
    const mins = parseInt(clockMatch[1], 10);
    const secs = parseInt(clockMatch[2], 10);
    remainingSecondsInWindow = mins * 60 + secs;
  } else if (windowId) {
    const winStart = parseInt(windowId, 10);
    if (!isNaN(winStart)) {
      const nowSec = Math.floor(Date.now() / 1000);
      remainingSecondsInWindow = Math.max(0, (winStart + 300) - nowSec);
      const m = Math.floor(remainingSecondsInWindow / 60);
      const s = remainingSecondsInWindow % 60;
      cleanCountdown = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
  }

  // Rule: Must have at least 2:10 minutes (130 seconds) remaining to be eligible for notification
  const isWindowTimeEligible = remainingSecondsInWindow >= 130;

  // 6. Clean Reference Price
  const cleanPrice = price && price !== '$—' ? price.trim() : 'Waiting for price…';

  const signal: PredictionSignal = {
    direction,
    confidence,
    window: `${cleanRange} (#${windowId})`,
    windowId,
    windowStartEnd: cleanRange,
    countdown: cleanCountdown || '00:00',
    remainingSecondsInWindow,
    isWindowTimeEligible,
    referencePrice: cleanPrice,
    timestamp: Date.now(),
    source: sourceUrl,
    rawText: `${direction} ${confidence}% | ${cleanRange} | ${cleanCountdown} | ${cleanPrice}`,
    rawExplain: explainText,
  };

  return {
    success: true,
    signal,
  };
}

/**
 * Parses raw HTML string using Cheerio (Used for test suites, HTML inspector, and static validation)
 */
export function extractSignalFromHtml(html: string, sourceUrl = 'https://rolflelieveld.com/BTC/predictor/'): ExtractionResult {
  if (!html || typeof html !== 'string' || html.trim().length === 0) {
    return {
      success: false,
      error: 'Empty HTML received',
    };
  }

  try {
    const $ = cheerio.load(html);

    // Specifically target the "NOW: CURRENT WINDOW" card by ID or header
    let nowCard = $('#card-now');
    if (!nowCard.length) {
      // Find card containing "Now: current window"
      const candidate = $('section, div').filter((_, el) => {
        const h2 = $(el).find('h2').text().trim().toLowerCase();
        return h2.includes('now') && h2.includes('current window');
      }).first();
      if (candidate.length) {
        nowCard = candidate;
      }
    }

    if (!nowCard.length) {
      return {
        success: false,
        error: 'Could not locate "NOW: CURRENT WINDOW" card (#card-now) in HTML markup.',
      };
    }

    // Exclude NEXT WINDOW card if somehow nested
    nowCard.find('#card-next, [id*="next"]').remove();

    const confText = nowCard.find('#now-conf, .conf-val').first().text().trim();
    const explainText = nowCard.find('#now-explain, .small:contains("Confidence")').first().text().trim();
    const arrowEl = nowCard.find('#now-arrow, .arrow').first();
    const windowRange = nowCard.find('#now-window-range, .small').first().text().trim();
    const countdown = nowCard.find('#now-countdown, .countdown').first().text().trim();
    const price = nowCard.find('#now-price, .price').first().text().trim();
    const marketLink = nowCard.find('#now-market-link, a[href*="btc-updown-5m"]').first().attr('href') || '';

    return parsePredictionData(
      {
        cardFound: true,
        confText,
        explainText,
        arrowClass: arrowEl.attr('class') || '',
        arrowText: arrowEl.text().trim(),
        windowRange,
        countdown,
        price,
        marketLink,
      },
      sourceUrl
    );
  } catch (err: any) {
    return {
      success: false,
      error: `Cheerio parsing failure: ${err?.message || 'Unknown error'}`,
    };
  }
}

/**
 * Evaluates the live dynamic page via persistent Playwright headless browser session.
 */
export async function fetchAndExtractSignal(targetUrl: string): Promise<ExtractionResult> {
  try {
    const page = await ensureBrowserSession(targetUrl);
    if (!page) {
      return {
        success: false,
        error: 'Initializing headless browser session to render live JavaScript predictor...',
      };
    }

    // Evaluate live DOM values in page context
    const data = await page.evaluate(() => {
      const card = document.getElementById('card-now');
      if (!card) {
        return { cardFound: false, confText: '', explainText: '', arrowClass: '', arrowText: '', windowRange: '', countdown: '', price: '', marketLink: '' };
      }

      return {
        cardFound: true,
        confText: document.getElementById('now-conf')?.textContent || '',
        explainText: document.getElementById('now-explain')?.textContent || '',
        arrowClass: document.getElementById('now-arrow')?.className || '',
        arrowText: document.getElementById('now-arrow')?.textContent || '',
        windowRange: document.getElementById('now-window-range')?.textContent || '',
        countdown: document.getElementById('now-countdown')?.textContent || '',
        price: document.getElementById('now-price')?.textContent || '',
        marketLink: document.getElementById('now-market-link')?.getAttribute('href') || '',
      };
    });

    return parsePredictionData(data, targetUrl);
  } catch (err: any) {
    // If browser crashed or connection dropped, reset handle so it recreates next tick
    console.warn('[Extractor] Evaluation error, resetting page handle:', err.message);
    pwPage = null;
    return {
      success: false,
      error: `Live browser extraction error: ${err.message || 'Page evaluation failed'}`,
    };
  }
}

/**
 * Gracefully cleans up browser process on server exit
 */
export async function closeBrowserSession() {
  try {
    if (pwBrowser) {
      await pwBrowser.close();
      pwBrowser = null;
      pwPage = null;
    }
  } catch {
    // ignore
  }
}
