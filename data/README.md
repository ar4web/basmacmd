# Data Folder — where your Excel files live

The app does **not** watch this folder automatically. You keep files here for
organisation, then import them through the app: **Data Import → drag & drop**.

```
data/
├── README.md                      ← you are here
├── templates/                     ← blank templates (safe to keep, do not delete)
│   ├── master-data-template.xlsx
│   ├── timesheet-register-template.xlsx
│   └── expenses-template.xlsx
├── master-data/                   ← employee master files
├── timesheets/                    ← monthly salary registers / timesheets
├── expenses/                      ← expense ledgers
└── archive/                       ← processed or old files you want to keep
```

## How to add a file

1. Copy or create the file in the matching folder above.
2. Open the app → **Data Import**.
3. Pick the matching dataset tab and drag the file in.
4. Check the column mapping → **Import**.

## Naming conventions (optional but helpful)

| Folder | Example |
|---|---|
| `master-data/` | `master-data-2026-11.xlsx` |
| `timesheets/` | `timesheet-register-2026-11.xlsx`, `timesheet-register-2026-12.xlsx` |
| `expenses/` | `expenses-2026-11.xlsx` |
| `archive/` | anything you no longer import |

## Rules the importer applies

- **Master Data** — matches on IQAMA or Emp No, updates existing employees.
- **Timesheets** — matches employee by IQAMA (or name) + Year + Month, recomputes
  pay from the worksite rule set. Any number of months per file is fine.
- **Expenses** — duplicates are skipped by Reference; references auto-generate if blank.

Re-dropping a changed file updates rows **in place** (never duplicates) and is
logged in **File Sync** with a fingerprint.

## Round-trip

Use **Export live data** on each dataset tab to download the current database
contents in the same layout. Edit that file, then re-import it — that is the
fastest way to update many rows at once.

## Templates

`data/templates/` holds blank files with the exact headers the importer expects
plus one sample row. To regenerate them:

```bash
npm run templates
```
