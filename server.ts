import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { apiRouter } from './src/server/api.ts';
import { monitor } from './src/server/monitor.ts';
import { store } from './src/server/store.ts';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Mount API router
app.use('/api', apiRouter);

// Serve static frontend files from 'dist' if they exist
const distDir = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.send('Server running. In development, run "npm run dev". For production, build first with "npm run build".');
  });
}

// Start monitor if configured to be enabled
const config = store.getConfig();
if (config.enabled) {
  console.log('[Server] Starting BTC 5-Minute Signal Monitor background worker...');
  monitor.start();
}

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Server listening on http://0.0.0.0:${PORT}`);
});

// Graceful shutdown
const shutdown = () => {
  console.log('[Server] Shutting down gracefully...');
  monitor.stop();
  store.save();
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
