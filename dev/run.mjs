// Start the local API emulator and the Vite dev server together.
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';

const API_PORT = Number(process.env.DEV_API_PORT || 8787);
const WEB_PORT = Number(process.env.DEV_WEB_PORT || 5173);

function isFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', (e) => resolve(e.code === 'EADDRINUSE' ? false : true));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '0.0.0.0');
  });
}

async function preflight() {
  const checks = await Promise.all(
    [
      [API_PORT, 'API'],
      [WEB_PORT, 'web'],
    ].map(async ([p, label]) => [p, label, await isFree(p)]),
  );
  const taken = checks.filter(([, , free]) => !free);
  if (!taken.length) return;
  for (const [port, label] of taken) {
    console.error(`[dev] port ${port} (${label}) is already in use — refusing to start a duplicate.`);
  }
  process.exit(1);
}

await preflight();

const procs = [];
function start(name, cmd, args) {
  const p = spawn(cmd, args, { stdio: 'inherit', env: process.env });
  p.on('exit', (code) => {
    if (code && code !== 0) console.error(`[${name}] exited with code ${code}`);
    shutdown();
  });
  procs.push(p);
  return p;
}
function shutdown() {
  for (const p of procs) {
    try {
      p.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start('api', process.execPath, ['--import', './dev/register.mjs', 'dev/server.mjs']);
setTimeout(
  () =>
    start(
      'web',
      process.execPath,
      [
        path.resolve(process.cwd(), 'node_modules/vite/bin/vite.js'),
        '--host',
        '0.0.0.0',
        '--port',
        String(WEB_PORT),
        '--strictPort',
      ],
    ),
  1500,
);
