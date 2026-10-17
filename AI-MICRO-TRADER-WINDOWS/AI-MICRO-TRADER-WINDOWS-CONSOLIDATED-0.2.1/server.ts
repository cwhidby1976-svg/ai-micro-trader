import express from 'express';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './src/server/routes';
import { verifySupabaseConnection } from './src/server/supabaseStartup';

function resolveEngineDir(): string {
  if (process.env.AMT_ENGINE_ROOT) return path.resolve(process.env.AMT_ENGINE_ROOT);
  const metaUrl = import.meta.url;
  if (metaUrl) return path.dirname(fileURLToPath(metaUrl));
  return process.cwd();
}
const __dirname = resolveEngineDir();

function localAddresses(): string[] {
  const found: string[] = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const net of entries || []) {
      if (net.family === 'IPv4' && !net.internal) found.push(net.address);
    }
  }
  return found;
}

async function startServer() {
  await verifySupabaseConnection();
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const HOST = process.env.HOST || '0.0.0.0';

  app.use(express.json({ limit: '256kb' }));
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      mode: 'local-device',
      timestamp: new Date().toISOString(),
      port: PORT,
      bind: HOST,
      origin: `${req.protocol}://${req.get('host')}`,
    });
  });
  app.use('/api', apiRouter);

  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    const distPath = process.env.AMT_DIST_PATH || path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        host: HOST,
        port: PORT,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, HOST, () => {
    const extras = localAddresses().map((ip) => `http://${ip}:${PORT}`);
    console.log(`[AI Micro Trader] Local engine listening on http://127.0.0.1:${PORT}`);
    if (extras.length) console.log(`[AI Micro Trader] Device addresses: ${extras.join(', ')}`);
    console.log('[AI Micro Trader] Enter your own Jupiter and GoPlus API keys in API Setup. Keys stay on this device.');
  });
}

startServer().catch((err) => {
  console.error('Server startup failed:', err);
  process.exit(1);
});
