import 'dotenv/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import { apiApp } from './src/server/api.ts';
import { monitor } from './src/server/monitor.ts';
import { store } from './src/server/store.ts';

function apiBackendPlugin(): Plugin {
  return {
    name: 'api-backend-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/api') || req.url === '/health') {
          return (apiApp as any)(req, res, next);
        }
        next();
      });

      const config = store.getConfig();
      if (config.enabled) {
        console.log('[Vite Dev] Starting Signal Monitor background worker...');
        monitor.start();
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiBackendPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
