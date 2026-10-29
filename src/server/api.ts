import express, { type Request, type Response } from 'express';
import { store } from './store.ts';
import { monitor } from './monitor.ts';
import { sendTestNotification } from './telegram.ts';
import { extractSignalFromHtml, fetchAndExtractSignal } from './extractor.ts';

export const apiRouter = express.Router();
export const apiApp = express();

apiRouter.use(express.json());
apiApp.use(express.json());
apiApp.use('/api', apiRouter);
apiApp.use(apiRouter);

// Public health check for Cloud Run and container platforms
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    monitorRunning: monitor.getStatus().state === 'RUNNING',
  });
});

// GET /api/status - Current status, active confirmation, signal, alerts, and logs
apiRouter.get('/status', (_req: Request, res: Response) => {
  try {
    const status = monitor.getStatus();
    const config = store.getConfig();
    const alerts = store.getAlerts().slice(0, 30);
    const logs = store.getLogs().slice(0, 50);

    res.json({
      status,
      config,
      alerts,
      logs,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper PIN check
function verifyPin(req: Request, res: Response): boolean {
  const pinHeader = req.headers['x-dashboard-pin'] as string | undefined;
  const pinBody = req.body?.pin as string | undefined;
  const provided = pinHeader || pinBody;
  const creds = store.getRawCredentials();

  // If no PIN is configured in settings, allow
  if (!creds.pin || creds.pin.trim() === '') {
    return true;
  }

  if (provided !== creds.pin) {
    res.status(401).json({
      error: 'Unauthorized: Invalid PIN provided. Default PIN is 1234 or configured in settings.',
    });
    return false;
  }
  return true;
}

// POST /api/control - Start or stop monitor
apiRouter.post('/control', (req: Request, res: Response) => {
  if (!verifyPin(req, res)) return;

  const { action } = req.body;
  if (action === 'start') {
    monitor.start();
    store.updateConfig({ enabled: true });
    res.json({ success: true, state: 'RUNNING' });
  } else if (action === 'stop') {
    monitor.stop();
    store.updateConfig({ enabled: false });
    res.json({ success: true, state: 'STOPPED' });
  } else {
    res.status(400).json({ error: 'Invalid action. Must be "start" or "stop".' });
  }
});

// POST /api/config - Update monitoring configurations
apiRouter.post('/config', (req: Request, res: Response) => {
  if (!verifyPin(req, res)) return;

  const {
    targetUrl,
    pollIntervalMs,
    signalDirection,
    minConfidence,
    confirmationSeconds,
    minTimeRemainingSeconds,
    telegramEnabled,
    telegramBotToken,
    telegramChatId,
    newPin,
  } = req.body;

  const patch: any = {};
  if (typeof targetUrl === 'string' && targetUrl.trim()) patch.targetUrl = targetUrl.trim();
  if (typeof pollIntervalMs === 'number' && pollIntervalMs >= 500 && pollIntervalMs <= 60000) {
    patch.pollIntervalMs = pollIntervalMs;
  }
  if (['UP', 'DOWN', 'BOTH'].includes(signalDirection)) {
    patch.signalDirection = signalDirection;
  }
  if (typeof minConfidence === 'number' && minConfidence >= 1 && minConfidence <= 100) {
    patch.minConfidence = minConfidence;
  }
  if (typeof confirmationSeconds === 'number' && confirmationSeconds >= 1 && confirmationSeconds <= 60) {
    patch.confirmationSeconds = confirmationSeconds;
  }
  if (typeof minTimeRemainingSeconds === 'number' && minTimeRemainingSeconds >= 0 && minTimeRemainingSeconds <= 300) {
    patch.minTimeRemainingSeconds = minTimeRemainingSeconds;
  }
  if (typeof telegramEnabled === 'boolean') {
    patch.telegramEnabled = telegramEnabled;
  }
  if (typeof telegramBotToken === 'string' && telegramBotToken.trim()) {
    patch.telegramBotToken = telegramBotToken.trim();
  }
  if (typeof telegramChatId === 'string' && telegramChatId.trim()) {
    patch.telegramChatId = telegramChatId.trim();
  }
  if (typeof newPin === 'string') {
    patch.dashboardPin = newPin.trim();
  }

  store.updateConfig(patch);
  store.addLog('INFO', 'Monitor settings updated by user.');

  res.json({
    success: true,
    config: store.getConfig(),
  });
});

// POST /api/telegram/test - Dispatch test message to Telegram
apiRouter.post('/telegram/test', async (req: Request, res: Response) => {
  if (!verifyPin(req, res)) return;

  const creds = store.getRawCredentials();
  const token = req.body.token?.trim() || creds.token;
  const chatId = req.body.chatId?.trim() || creds.chatId;

  if (!token || !chatId) {
    return res.status(400).json({
      error: 'Cannot test Telegram: Telegram Bot Token or Chat ID is empty.',
    });
  }

  const result = await sendTestNotification(token, chatId, req.body.initiator || 'Dashboard UI');
  if (result.ok) {
    store.addLog('SUCCESS', `Manual test notification sent to Telegram chat ${chatId}`);
    res.json({ success: true, messageId: result.messageId });
  } else {
    store.addLog('ERROR', `Manual test notification failed: ${result.error}`);
    res.status(400).json({ success: false, error: result.error });
  }
});

// POST /api/simulate - Trigger simulation sequence for test scenarios
apiRouter.post('/simulate', (req: Request, res: Response) => {
  const { type } = req.body;
  const validScenarios = [
    'scenario-1-up-success',
    'scenario-2-drop-at-3s',
    'scenario-3-flip-down-before-5s',
    'scenario-4-same-window-repeat',
    'scenario-5-next-window-permitted',
    'scenario-6-restart-dedup',
    'scenario-7-extraction-fail',
    'scenario-8-under-210-blocked',
    // legacy aliases
    'up-100-success',
    'up-100-cancel',
    'down-100-success',
  ];

  if (validScenarios.includes(type)) {
    const mappedType = type === 'up-100-success' ? 'scenario-1-up-success'
      : type === 'up-100-cancel' ? 'scenario-2-drop-at-3s'
      : type === 'down-100-success' ? 'scenario-1-up-success'
      : type;
    monitor.startSimulation(mappedType as any);
    res.json({ success: true, simulation: type });
  } else if (type === 'stop') {
    monitor.stopSimulation();
    res.json({ success: true, simulation: 'stopped' });
  } else {
    res.status(400).json({ error: `Invalid simulation type. Valid: ${validScenarios.join(', ')}` });
  }
});

// POST /api/extract-test - Test parsing of arbitrary HTML or live URL test
apiRouter.post('/extract-test', async (req: Request, res: Response) => {
  const { html, url } = req.body;

  if (html && typeof html === 'string') {
    const result = extractSignalFromHtml(html, url || 'test-snippet');
    return res.json(result);
  }

  if (url && typeof url === 'string') {
    const result = await fetchAndExtractSignal(url);
    return res.json(result);
  }

  res.status(400).json({ error: 'Provide either html string or url string to test extraction.' });
});
