// Self-contained smoke test: starts the local API server in-process, hits every
// endpoint the frontend uses, prints the responses, cleans up, then exits.
import './env.mjs';

process.env.DEV_API_PORT = '8791';
await import('./server.mjs');
await new Promise((r) => setTimeout(r, 800));

const BASE = 'http://127.0.0.1:8791';

const EPS = [
  '/api/health',
  '/api/worksites',
  '/api/dashboard?year=2026&month=11',
  '/api/employees?limit=2',
  '/api/timesheets?year=2026&month=11&limit=2',
  '/api/footer-stats?year=2026&month=11',
  '/api/settings',
  '/api/notifications',
  '/api/sync-files',
  '/api/perf',
];

let failures = 0;
for (const ep of EPS) {
  try {
    const res = await fetch(`${BASE}${ep}`);
    const text = await res.text();
    console.log(`--- ${ep} -> ${res.status}`);
    console.log(text.slice(0, 350));
    if (!res.ok) failures += 1;
  } catch (e) {
    failures += 1;
    console.log(`--- ${ep} -> ERROR ${e.message}`);
  }
}

// Exercise a write path: create an employee, read it back, then clean up.
const headers = { 'Content-Type': 'application/json' };
const create = await fetch(`${BASE}/api/employees`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ name: 'Smoke Test Employee', iqama: '1234567890', base_salary: 5000 }),
});
const created = await create.json().catch(() => ({}));
console.log('--- POST /api/employees ->', create.status, JSON.stringify(created).slice(0, 200));
if (!create.ok) failures += 1;

const list = await fetch(`${BASE}/api/employees?search=Smoke`);
const listBody = await list.json();
console.log('--- GET /api/employees?search=Smoke ->', list.status, JSON.stringify(listBody).slice(0, 200));
if (!list.ok || !Array.isArray(listBody) || listBody.length !== 1) failures += 1;

// Cleanup so the local database is left untouched.
if (created.id) {
  const ts = await fetch(`${BASE}/api/timesheets?employee_id=${created.id}`);
  const rows = await ts.json().catch(() => []);
  for (const r of Array.isArray(rows) ? rows : []) {
    await fetch(`${BASE}/api/timesheets`, { method: 'DELETE', headers, body: JSON.stringify({ id: r.id }) });
  }
  await fetch(`${BASE}/api/employees`, { method: 'DELETE', headers, body: JSON.stringify({ id: created.id }) });
  console.log('--- cleanup done');
}

console.log(failures === 0 ? 'SMOKE OK' : `SMOKE FAILURES: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
