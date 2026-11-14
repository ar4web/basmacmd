// Self-contained smoke test: starts the local API server in-process, hits every
// endpoint the frontend uses, prints the responses, then exits.
import './env.mjs';

process.env.DEV_API_PORT = '8791';
await import('./server.mjs');
await new Promise((r) => setTimeout(r, 800));

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
    const res = await fetch(`http://127.0.0.1:8791${ep}`);
    const text = await res.text();
    console.log(`--- ${ep} -> ${res.status}`);
    console.log(text.slice(0, 350));
    if (!res.ok) failures += 1;
  } catch (e) {
    failures += 1;
    console.log(`--- ${ep} -> ERROR ${e.message}`);
  }
}

// exercise a write path: create an employee, then read it back
const create = await fetch('http://127.0.0.1:8791/api/employees', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Smoke Test Employee', iqama: '1234567890', base_salary: 5000 }),
});
console.log('--- POST /api/employees ->', create.status, (await create.text()).slice(0, 300));
if (!create.ok) failures += 1;

const list = await fetch('http://127.0.0.1:8791/api/employees?search=Smoke');
const listBody = await list.json();
console.log('--- GET /api/employees?search=Smoke ->', list.status, JSON.stringify(listBody).slice(0, 300));
if (!list.ok || !Array.isArray(listBody) || listBody.length !== 1) failures += 1;

console.log(failures === 0 ? 'SMOKE OK' : `SMOKE FAILURES: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
