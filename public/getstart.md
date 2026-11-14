# Basmat — Get Started

Enterprise workforce, payroll, expense and compliance command center for Saudi operations.
Runs as a hosted web app **and** locally on Windows / macOS, reading the Excel files you already keep in your data folder.

---

## 0. Local Development (no Supabase, fully offline)

The repo ships a local harness that emulates Supabase with a JSON file (`.data/db.json`) — no cloud account needed.

```bash
npm install
npm run dev:local     # starts the API emulator (8787) + Vite (5173) together
```

Open http://localhost:5173. Data is seeded automatically from `scripts/seed-data.json` on first start.

| Command | Purpose |
|---|---|
| `npm run dev:local` | API emulator + Vite dev server (recommended) |
| `npm run dev:api` | API emulator only (port 8787) |
| `npm run dev` | Vite only — `/api` calls fail unless `dev:api` is also running |
| `npm run db:seed` | Reset + reseed the local database |
| `npm run db:reset` | Delete the local database (reseeded on next start) |

---

## 1. Directory Diagram

```
basmat-command-center/
│
├── api/                          # Serverless API — one file = one endpoint
│   ├── _calc.js                  #   Payroll math engine (daily/hourly rates, OT, absence treatments) + shared helpers
│   ├── db-client.js              #   Supabase client (pre-wired, auto-recovery)
│   ├── db-wake.js                #   Database wake-on-500 hook
│   ├── dashboard.js              #   Aggregated KPIs, trends, heatmap, watchlists (filter-aware)
│   ├── employees.js              #   Employee registry CRUD + auto register-row creation
│   ├── timesheets.js             #   Monthly register: day-grid edits, bulk approve/pay, recompute
│   ├── expenses.js               #   Expense ledger CRUD with auto references (EXP-YYYYMM-####)
│   ├── worksites.js              #   Worksite configuration CRUD
│   ├── import.js                 #   Excel import engine — column-by-column, row-by-row upsert
│   ├── sync-files.js             #   File fingerprint registry (Synced / Updated / No changes / Failed)
│   ├── perf.js                   #   API latency sampler (powers the health score)
│   ├── notifications.js          #   IQAMA / insurance ≤30-day alert feed
│   ├── footer-stats.js           #   Page-wise footer aggregates (count-only queries)
│   └── settings.js               #   Company settings (name, currency, budget, period)
│
├── src/
│   ├── main.tsx                  # React entry
│   ├── App.tsx                   # Router (Import page lazy-loaded)
│   ├── index.css                 # Design system: dark/light themes, square corners, compact density
│   │
│   ├── context/
│   │   └── AppContext.tsx        # Period, filters, sidebar state, toasts
│   │
│   ├── lib/
│   │   ├── api.ts                # Fetch wrappers + useApi hook + automatic perf logging
│   │   ├── format.ts             # SAR/date/number formatters, document-expiry tones
│   │   ├── constants.ts          # Lookup lists (nationalities, banks, categories…)
│   │   └── types.ts              # TypeScript models
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx     #   Shell + page-wise live footer (fixed to viewport)
│   │   │   ├── Sidebar.tsx       #   Collapsible 72px icon-rail nav + alert panel
│   │   │   └── Topbar.tsx        #   Single-line title · path, global search, theme toggle
│   │   ├── charts/ChartKit.tsx   #   Chart theme, tooltips, gradients
│   │   └── ui/                   #   Card, Modal, Drawer, Badge, Button, CountUp, Sparkline…
│   │
│   └── pages/
│       ├── Dashboard.tsx         #   Command center: KPIs, trend, waterfall, rankings, watchlist
│       ├── Employees.tsx         #   Registry: search/filter/CSV export/profile drawer/CRUD
│       ├── Timesheet.tsx         #   Day-grid register, rule-audit flags, hold/release rows
│       ├── Payroll.tsx           #   Salary register: approve → disburse, payslips, history
│       ├── Attendance.tsx        #   Presence heatmap, absence cost, per-site discipline
│       ├── Compliance.tsx        #   IQAMA + insurance expiry boards with renewals
│       ├── Expenses.tsx          #   Ledger, budgets, category split, approval workflow
│       ├── Worksites.tsx         #   Site cards, cost share, ranked summary
│       ├── ImportCenter.tsx      #   Excel drop-zone: auto column map, row validation, import
│       └── SyncMonitor.tsx       #   File sync registry + app performance verdict
│
├── public/
│   ├── favicon.svg
│   └── getstart.md               # This guide (served by the app)
│
├── scripts/
│   ├── seed.mjs                  # Database seeder (bulk insert via Supabase)
│   └── seed-data.json            # Generated seed dataset
│
├── getstart.md                   # This guide (repo root)
├── index.html                    # Shell (title, favicon, theme init)
├── vercel.json                   # Deploy config + SPA rewrites
└── package.json
```

---

## 2. Run Locally (Windows & macOS)

Prerequisites: **Node.js LTS (18+)** — download from nodejs.org (works identically on Windows PowerShell and macOS Terminal).

```bash
npm install        # one-time
npm run dev        # serves locally at http://localhost:5173
```

Keep this folder (or a shortcut) next to your data folder. Recommended data-folder layout:

```
MyDataFolder/
├── master-data.xlsx              # employee master data
├── timesheet-register-2026.xlsx  # monthly timesheet / salary register
├── salary-sheet-2026-11.xlsx     # any month’s salary sheet (same layout)
└── expenses.xlsx                 # expense ledger
```

Open the app → **Data Import** → drag a file in. Headers are auto-detected, every column is auto-mapped, and every row is validated before import. Re-dropping a changed file updates rows **in place** (idempotent — never duplicates) and is logged in **File Sync** with a fingerprint, so you can always see whether a file has updates or not.

---

## 3. How Many Timesheet & Salary Sheet Styles Work?

**Five timesheet entry styles** are supported — one per worksite rule set — plus **one salary-register layout** that carries them all. All of them import and compute correctly in this app:

| # | Timesheet Style | What you type in Day columns | Used by (seeded) | Pay rule applied |
|---|-----------------|------------------------------|------------------|------------------|
| 1 | **8-Hour Daily** | Hours worked (`8`, `10`…) | Riyadh Logistics Hub | Daily rate = salary ÷ 26; hours beyond 8 count as OT @ 1.5× |
| 2 | **P/A Tally** | `P` (present) / `A` (absent) | Al Khobar Retail Mall | Daily rate × present days; absences at Half Pay |
| 3 | **Direct Days** | `1` for each worked day | Jeddah Facilities | Daily rate × worked days; absences at Half Pay |
| 4 | **Hourly Total** | Total hours per day (`10`, `12`…) | Dammam Industrial Site | Hourly rate = salary ÷ 30 ÷ 10h; OT beyond 10h @ 1.5× |
| 5 | **Mixed** | Hours; follows the site’s pay method | Yanbu Port Support | Hourly rate, 12h standard, absences Full Pay |

**Salary sheet (register) layout** — one row = one employee for one month:

```
Year | Month | Employee Name | IQAMA | Day 1 … Day 31 | Deductions (SAR)
```

Blank day cells mean “not scheduled”. On import the app recomputes present/absent days, hours, overtime, gross, deductions and net pay automatically from the worksite rule set — exactly like the original workbook’s formulas. You may import **any number of months and any number of employees per file** (batches of 1,500 rows per call, chunked automatically).

---

## 4. Column Maps (auto-detected, editable before import)

**Master data (Employees)** — matches on IQAMA or Emp No, updates existing records:
`Employee Name, IQAMA Number, IQAMA Expiry, Birth Date, Worksite, Sponsor, Transfer Status, Work Status, Joining Date, Mobile, Nationality, Bank, IBAN, Base Salary (SAR), Contract Type, Insurance Policy No, Insurance Expiry, Notes`

**Timesheet / Salary register** — matches employee by IQAMA (or exact name) + Year + Month:
`Year, Month, Employee Name, IQAMA, Day 1 … Day 31, Deductions (SAR)`

**Expenses** — duplicates skipped by Reference:
`Date, Category, Description, Vendor, Amount (SAR), Worksite, Payment Method, Status`

Header names are fuzzy-matched (e.g. “Basic Salary”, “Monthly Salary” → Base Salary). Excel dates, date serials and both `YYYY-MM-DD` / `DD-MM-YYYY` text are normalized automatically.

---

## 5. Template & Master-Dataset Exporter

In **Data Import**, for each dataset there are two exporter buttons:

- **Template** — downloads a blank `.xlsx` with the exact headers and one sample row, ready to fill up.
- **Export live data** — downloads the *current database contents* in the same import layout:
  - *Master Data* → a ready-made employee master dataset (`basmat-master-data-YYYY-MM-DD.xlsx`) — edit it offline and re-import to apply changes in place.
  - *Timesheet* → the salary register of the currently selected month (`basmat-salary-register-YYYY-MM.xlsx`).
  - *Expenses* → the full ledger with references (`basmat-expenses-YYYY-MM-DD.xlsx`).

Round-trip safe: exported files re-import cleanly — employees update by IQAMA, register rows upsert by employee + period, expenses skip existing references.

---

## 6. What Happens After Import

| Page | Reads |
|------|-------|
| Command Center | KPIs, trends, compliance, rankings — all filter-aware |
| Timesheet | Editable day grid with rule-audit flags and row hold/release |
| Payroll | Draft → Approved → Paid workflow with payslips |
| Attendance | Presence heatmap and absence cost |
| Compliance | IQAMA / insurance boards with renewals |
| Expenses | Budget tracking and approvals |
| File Sync | File fingerprints, update detection, app performance verdict |
