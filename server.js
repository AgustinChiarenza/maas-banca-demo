// Demo MaaS Banca — servidor sin dependencias (Node 18+). Corre igual en
// Windows, macOS, Linux y contenedores (ECS, Docker, etc.).
// Sirve la app web y hace de proxy hacia cualquier endpoint compatible con
// OpenAI (/chat/completions), para evitar problemas de CORS desde el navegador.
//
//   node server.js                         -> http://127.0.0.1:5173 (local)
//   HOST=0.0.0.0 PORT=8090 node server.js  -> contenedor / servidor
//
// Endpoint, API key y modelo se configuran desde la app (panel Configuración).
//
// Variables de entorno (todas opcionales):
//   HOST, PORT        Dónde escuchar. En contenedor usar HOST=0.0.0.0.
//   NO_OPEN=1         No abrir el navegador al iniciar.
//   DEMO_PASSWORD     Si está definida, pide usuario y clave (Basic Auth).
//   DEMO_USER         Usuario para DEMO_PASSWORD (por defecto "demo").

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');

const env = process.env;
const PORT = Number(env.PORT) || 5173;
const IN_CONTAINER = fs.existsSync('/.dockerenv') || !!env.ECS_CONTAINER_METADATA_URI_V4 || !!env.KUBERNETES_SERVICE_HOST;
const HOST = env.HOST || (IN_CONTAINER ? '0.0.0.0' : '127.0.0.1');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY = 25 * 1024 * 1024; // imágenes en base64

const SERVER = {
  user: env.DEMO_USER || 'demo',
  password: env.DEMO_PASSWORD || '',
};

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function chatUrl(endpoint) {
  let u = String(endpoint || '').trim().replace(/\/+$/, '');
  if (!/\/chat\/completions$/.test(u)) u += '/chat/completions';
  return u;
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw Object.assign(new Error('too_large'), { code: 'too_large' });
    chunks.push(c);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function authorized(req) {
  if (!SERVER.password) return true;
  const m = /^Basic (.+)$/i.exec(req.headers.authorization || '');
  if (!m) return false;
  const [user, ...rest] = Buffer.from(m[1], 'base64').toString('utf8').split(':');
  return safeEqual(user, SERVER.user) & safeEqual(rest.join(':'), SERVER.password);
}

async function proxyChat(req, res) {
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (e) {
    if (e.code === 'too_large') return sendJson(res, 413, { error: { message: 'El request supera los 25 MB. Probá con una imagen más chica.' } });
    return sendJson(res, 400, { error: { message: 'El cuerpo del request no es JSON válido.' } });
  }
  const { endpoint, apiKey, payload } = body || {};
  if (!endpoint || !/^https?:\/\//i.test(endpoint)) {
    return sendJson(res, 400, { error: { message: 'Falta el endpoint o no empieza con http(s)://' } });
  }
  if (!payload || !Array.isArray(payload.messages)) {
    return sendJson(res, 400, { error: { message: 'Falta payload.messages' } });
  }

  const url = chatUrl(endpoint);
  try { new URL(url); } catch {
    return sendJson(res, 400, { error: { message: 'El endpoint no es una URL válida.' } });
  }

  const ctl = new AbortController();
  res.on('close', () => { if (!res.writableFinished) ctl.abort(); });

  const t0 = Date.now();
  let upstream;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: ctl.signal,
    });
  } catch (e) {
    if (ctl.signal.aborted) return;
    const why = e.cause?.code || e.cause?.message || e.message;
    console.log(`  ✗ ${payload.model} -> ${url} (${why})`);
    return sendJson(res, 502, { error: { message: `No se pudo conectar con ${url}: ${why}` } });
  }

  console.log(`  → ${payload.model} ${payload.stream ? '[stream] ' : ''}${upstream.status} ${url} (${Date.now() - t0} ms a primer byte)`);
  res.writeHead(upstream.status, {
    'Content-Type': upstream.headers.get('content-type') || 'application/json',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no', // que nginx u otros proxies no acumulen el streaming
  });
  if (!upstream.body) return res.end();
  try {
    for await (const chunk of upstream.body) res.write(chunk);
  } catch {
    // cliente o upstream cortaron la conexión
  }
  res.end();
}

function serveStatic(req, res) {
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end(); }
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const file = path.resolve(PUBLIC_DIR, rel);
  if (file !== PUBLIC_DIR && !file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('No encontrado'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const route = (req.url || '/').split('?')[0];
  if (route === '/healthz') return sendJson(res, 200, { ok: true });
  if (!authorized(req)) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="MaaS Banca", charset="UTF-8"' });
    return res.end('Se requiere usuario y clave');
  }
  if (req.method === 'POST' && route === '/api/chat') return proxyChat(req, res);
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res);
  res.writeHead(405); res.end();
});
// Las respuestas con razonamiento pueden tardar varios minutos.
server.requestTimeout = 0;
server.keepAliveTimeout = 65_000; // mayor que el idle timeout por defecto de un ALB (60 s)

server.listen(PORT, HOST, () => {
  const shown = HOST === '0.0.0.0' || HOST === '::' ? 'localhost' : HOST;
  const url = `http://${shown}:${PORT}`;
  console.log(`\n  Demo MaaS Banca lista en ${url}  (escuchando en ${HOST}:${PORT})`);
  if (SERVER.password) console.log(`  Acceso protegido con usuario "${SERVER.user}"`);
  else if (HOST !== '127.0.0.1') console.log('  Aviso: la app es accesible desde la red sin clave. Definí DEMO_PASSWORD.');
  console.log('  (Ctrl+C para cortar)\n');

  const canOpen = !env.NO_OPEN && !IN_CONTAINER && !env.CI
    && (process.platform === 'win32' || process.platform === 'darwin' || env.DISPLAY || env.WAYLAND_DISPLAY);
  if (canOpen) {
    const cmd = process.platform === 'win32' ? `start "" "${url}"`
      : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
    exec(cmd, () => {});
  }
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error(`\n  El puerto ${PORT} está ocupado. Probá con otro: PORT=8091 node server.js\n`);
  else console.error(e);
  process.exit(1);
});

// Apagado prolijo (ECS/Docker mandan SIGTERM).
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
