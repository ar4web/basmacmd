// Local API server: serves the real /api handlers against the in-memory
// Supabase emulator, so the frontend runs end-to-end with no cloud project.
// Development only.
import './env.mjs';
import { register } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { seedIfEmpty } from './seed-local.mjs';

register('./hooks.mjs', import.meta.url);

const PORT = Number(process.env.DEV_API_PORT || 8787);
const HOST = process.env.DEV_API_HOST || '0.0.0.0';
const API_DIR = path.resolve(process.cwd(), 'api');

const ROUTES = new Map();
for (const f of fs.readdirSync(API_DIR)) {
  if (!f.endsWith('.js') || f.startsWith('_') || f === 'db-client.js' || f === 'db-wake.js') continue;
  ROUTES.set(`/api/${f.replace(/\.js$/, '')}`, path.join(API_DIR, f));
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 20 * 1024 * 1024) req.destroy();
    });
    req.on('end', () => {
      if (!raw) return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
  });
}

function makeRes(res) {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(k, v) {
      res.setHeader(k, v);
      return this;
    },
    json(obj) {
      const body = JSON.stringify(obj);
      res.writeHead(this.statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
      });
      res.end(body);
    },
    end(body) {
      res.writeHead(this.statusCode);
      res.end(body ?? '');
    },
  };
}

function jsonBody(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname.replace(/\/+$/, '') || '/';
  const query = Object.fromEntries(url.searchParams.entries());

  if (p === '/api/health') {
    return jsonBody(res, 200, { ok: true, mode: 'local', routes: [...ROUTES.keys()] });
  }

  const file = ROUTES.get(p);
  if (!file) return jsonBody(res, 404, { error: `No local route for ${p}` });

  try {
    const mod = await import(pathToFileURL(file).href);
    const body = req.method === 'GET' || req.method === 'HEAD' ? null : await readBody(req);
    const reqShim = {
      method: req.method,
      headers: req.headers,
      query,
      body,
      url: req.url,
      socket: req.socket,
    };
    await mod.default(reqShim, makeRes(res));
  } catch (e) {
    console.error(`[dev-api] ${p} failed:`, e);
    if (!res.headersSent) jsonBody(res, 500, { error: e.message });
  }
});

try {
  const r = seedIfEmpty({ log: (...a) => console.log('[dev-api]', ...a) });
  if (r.skipped) console.log('[dev-api] database already seeded');
  else console.log('[dev-api] seeded tables:', r.tables);
} catch (e) {
  console.error('[dev-api] bootstrap failed:', e);
  process.exit(1);
}
server.listen(PORT, HOST, () => {
  console.log(`[dev-api] local API on http://${HOST}:${PORT} (${ROUTES.size} routes)`);
});
