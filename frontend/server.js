import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const BASE_PORT = 3000;

const API_PROXY_TARGET =
  process.env.API_PROXY_TARGET || process.env.BACKEND_URL || 'http://127.0.0.1:8001';

const distDir = path.join(__dirname, 'dist');
const uploadsDir = path.join(__dirname, 'uploads');

function staticGetOnly(mw) {
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }
    return mw(req, res, next);
  };
}

// Статика только для GET/HEAD — иначе POST /api/* может обрабатываться serve-static и не дойти до прокси.
// Прокси до body-parser: тело POST не должно читаться раньше пересылки на FastAPI.
app.use(staticGetOnly(express.static(distDir)));
app.use('/uploads', staticGetOnly(express.static(uploadsDir)));

app.use(
  '/api',
  createProxyMiddleware({
    target: API_PROXY_TARGET,
    changeOrigin: true,
    timeout: 60_000,
    proxyTimeout: 60_000,
    pathRewrite: (path) => {
      if (path.startsWith('/api')) return path;
      return '/api' + (path.startsWith('/') ? path : `/${path}`);
    },
    on: {
      proxyReq: (proxyReq, req) => {
        const auth = req.headers.authorization;
        if (auth) {
          proxyReq.setHeader('Authorization', auth);
        }
      },
      error: (err, req, res) => {
        console.error('[api proxy]', API_PROXY_TARGET, err.message);
        if (!res.headersSent) {
          res.status(502).json({
            detail: `Прокси: бэкенд недоступен (${API_PROXY_TARGET}). Запустите API (Docker/Uvicorn).`,
          });
        }
      },
    },
  }),
);

// SPA fallback: любые не-API GET-запросы отдают index.html, роутинг делает vue-router.
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

function findAvailablePort(startPort, callback) {
  const testApp = express();
  const server = testApp.listen(startPort, () => {
    server.close();
    callback(startPort);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Порт ${startPort} занят, пробую ${startPort + 1}...`);
      findAvailablePort(startPort + 1, callback);
    } else {
      console.error('Ошибка:', err);
    }
  });
}

findAvailablePort(BASE_PORT, (port) => {
  app.listen(port, () => {
    console.log(
      '\n╔══════════════════════════════════════════════════════════╗',
    );
    console.log('║     🐾 ПОТЕРЯШКИ - Сервис поиска потерянных вещей 🐾     ║');
    console.log(
      '╚══════════════════════════════════════════════════════════╝\n',
    );
    console.log(`✅ Сервер успешно запущен!`);
    console.log(`📍 Локальный доступ: http://localhost:${port}`);
    console.log(`\n🔌 API /api → прокси на ${API_PROXY_TARGET}`);
    console.log(
      '   (запустите бэкенд FastAPI; иначе запросы к /api дадут 502)',
    );
    console.log(`\n✨ Потеряшки готовы к работе! ✨\n`);
  });
});
