# AGENTS.md

Guidance for AI agents working in this repository. Read this before making changes.

## What this is

**Basmat** — workforce, payroll, compliance and expense dashboard for Saudi operations.

- **Frontend:** React 19 + Vite 7 + TypeScript 5.9 + Tailwind CSS 4 (`src/`)
- **Backend:** Vercel-style serverless functions, one file per endpoint (`api/`)
- **Data:** Supabase in production; a local JSON-file emulator in development (`dev/`) — no cloud account needed
- **Excel:** import/export handled client-side with `xlsx` (`src/pages/ImportCenter.tsx`)

## Tech stack

| Piece | Choice |
|---|---|
| UI | React 19, react-router-dom 7, recharts, framer-motion, lucide-react |
| Build | Vite 7, TypeScript 5.9, Tailwind 4 (`@tailwindcss/vite`) |
| API | `@supabase/supabase-js` (swapped for local emulator in dev) |
| Excel | `xlsx` 0.18 |
| Runtime | Node 18+ (developed on Node 24) |

## Quick start

```bash
npm install
npm run dev:local     # API emulator on 8787 + Vite on 5173
```

Open http://localhost:5173. Data is seeded automatically from `scripts/seed-data.json` on first start.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev:local` | **Recommended.** API emulator + Vite dev server together |
| `npm run dev` | Vite only — `/api` calls fail unless `dev:api` is also running |
| `npm run dev:api` | API emulator only (port 8787) |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run db:seed` | Reset + reseed the local database |
| `npm run db:reset` | Delete `.data/` (reseeded on next start) |
| `npm run templates` | Regenerate blank Excel templates in `data/templates/` |
| `npm run smoke` | (if present) endpoint smoke test |

## Repository layout

```
api/                 # Serverless endpoints, one file each (Express-style req/res)
├── _calc.js         #   Payroll math engine + shared helpers (cors, fetchAll)
├── db-client.js     #   Supabase client (env-driven)
├── dashboard.js     #   Aggregated KPIs, trends, heatmap, watchlists
├── employees.js     #   Employee registry CRUD
├── timesheets.js    #   Monthly register: edits, approve/pay, recompute
├── expenses.js      #   Expense ledger CRUD
├── import.js        #   Excel import engine (employees/timesheets/expenses)
├── sync-files.js    #   File fingerprint registry
├── perf.js          #   API latency sampler
├── notifications.js #   IQAMA / insurance expiry feed
├── footer-stats.js  #   Page footer aggregates
├── settings.js      #   Company settings (key/value)
└── worksites.js     #   Worksite configuration CRUD

src/
├── main.tsx         # Entry
├── App.tsx          # Router
├── context/AppContext.tsx  # Period, filters, sidebar, toasts
├── lib/             # api.ts (fetch wrappers), format.ts, constants.ts, types.ts
├── components/      # layout/ (AppLayout, Sidebar, Topbar), charts/, ui/
└── pages/           # Dashboard, Employees, Timesheet, Payroll, Attendance,
                     # Compliance, Expenses, Worksites, ImportCenter, SyncMonitor, Rules

dev/                 # Local-only harness (never deployed)
├── server.mjs       #   Serves api/*.js locally on 8787
├── supabase-local.mjs  # Query-builder emulator over the JSON store
├── store.mjs        #   JSON-file store (.data/db.json)
├── hooks.mjs        #   Module resolve hook → swaps @supabase/supabase-js
├── register.mjs     #   `--import` entry that installs the hook
├── seed-local.mjs   #   Seeds .data/db.json from scripts/seed-data.json
├── run.mjs          #   Starts API + Vite together
└── make-templates.mjs   # Regenerates data/templates/*.xlsx

data/                # Your Excel files live here (see data/README.md)
├── templates/       #   Blank templates matching the importer
├── master-data/     #   Employee master files
├── timesheets/      #   Monthly salary registers
├── expenses/        #   Expense ledgers
└── archive/         #   Processed / old files

scripts/seed-data.json   # Demo dataset (worksites, 120 employees, 1411 timesheets, 211 expenses)
```

## Local development model

- **No Supabase needed.** `dev/hooks.mjs` intercepts `@supabase/supabase-js` and replaces it with `dev/supabase-local.mjs`, which implements the subset of the query builder the API uses (`from/select/eq/neq/gt/gte/lt/lte/like/ilike/or/not/in/order/limit/range/single/maybeSingle/insert/update/upsert/delete`, plus `select('*', {count, head})`).
- **Data file:** `.data/db.json` (gitignored). The server seeds it on first start if empty.
- **Ports:** API emulator `8787`, Vite `5173`. Vite proxies `/api` → `8787` when `VITE_DEMO_MODE=1` in `.env`.
- **Env:** `.env` holds dummy local values only (`local-anon-key`, placeholder URL). No real credentials.
- **If you add a new Supabase operator** that the emulator doesn't support, extend `dev/supabase-local.mjs` (`matchOp`, `parseSelect`, `RELATIONS`) — otherwise the endpoint works in production but fails locally.

## Conventions

- **API handlers** are Express-style: `export default async function handler(req, res)` with `req.query`, `req.body`, `res.status(...).json(...)`, and a `cors(res)` call at the top. Keep that shape so the same file runs on Vercel and locally.
- **Money** is SAR; format helpers live in `src/lib/format.ts`.
- **Brand** is "Basmat". Do not reintroduce the old product name in UI copy.
- **localStorage keys** are `almanar.*` (historical) — do not rename them, users' saved theme/period/filters depend on them.
- **Excel headers** are fuzzy-matched; the canonical lists are `templateHeaders` in `src/pages/ImportCenter.tsx`. Keep `data/templates/*.xlsx` in sync when they change (`npm run templates`).

## Common tasks

**Add an API endpoint:** create `api/<name>.js` with the handler shape above. It is picked up automatically by `dev/server.mjs` (any `api/*.js` that isn't `_`-prefixed or `db-client`/`db-wake`) and by Vercel.

**Add a page:** add `src/pages/<Name>.tsx`, register the route in `src/App.tsx`, and add a nav entry in `src/components/layout/Sidebar.tsx`.

**Add an importable field:** extend the matching dataset in `src/pages/ImportCenter.tsx` (`fields`, `templateHeaders`, `templateSample`), handle it in `api/import.js`, and regenerate templates.

**Change the local seed:** edit `scripts/seed-data.json` or the defaults in `dev/seed-local.mjs`, then `npm run db:reset` and restart.

## Gotchas

- `npm run dev` alone serves no `/api` — always use `npm run dev:local` (or run `dev:api` alongside).
- The emulator is schemaless; tables are created on first use. It does not enforce types or foreign keys.
- `.data/` is local state: never commit it, and assume the user may have modified it.
- Excel files are parsed client-side; large files are chunked (max 1500 rows per import call).

## Verification

```bash
npm run build        # type-check + production build
npm run dev:local    # then open http://localhost:5173
```
