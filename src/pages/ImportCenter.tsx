import { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { motion } from 'framer-motion';
import {
  FolderSync, FileSpreadsheet, UploadCloud, Download, Database, CheckCircle2,
  AlertTriangle, Loader2, FileUp, Table2, MonitorCheck, Apple, AppWindow, FileDown,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiGet, apiSend } from '../lib/api';
import { Card, SectionTitle, Badge, Button } from '../components/ui/primitives';

/* =============== dataset definitions =============== */
interface FieldDef { key: string; label: string; required?: boolean; aliases: string[]; date?: boolean }

type DatasetKey = 'employees' | 'timesheets' | 'expenses';

const DATASETS: Record<DatasetKey, {
  title: string; fileHint: string; desc: string; icon: React.ElementType; tone: string;
  fields: FieldDef[]; templateHeaders: string[]; templateSample: (string | number)[];
}> = {
  employees: {
    title: 'Master Data · Employees', fileHint: 'master data.xlsx / employees sheet',
    desc: 'Employee registry — IQAMA, banking, contracts, documents. Matches on IQAMA / Emp No and updates existing records.',
    icon: Database, tone: 'emerald',
    fields: [
      { key: 'emp_no', label: 'Emp No', aliases: ['empno', 'emp no', 'employee no', '#', 'no', 'id'] },
      { key: 'name', label: 'Employee Name', required: true, aliases: ['employee name', 'name', 'full name', 'employee'] },
      { key: 'iqama', label: 'IQAMA Number', aliases: ['iqama number', 'iqama', 'iqama no', 'iqama#'] },
      { key: 'iqama_expiry', label: 'IQAMA Expiry', date: true, aliases: ['iqama expiry', 'iqama expiry date', 'iqama exp'] },
      { key: 'birth_date', label: 'Birth Date', date: true, aliases: ['birth date', 'date of birth', 'dob'] },
      { key: 'worksite', label: 'Worksite', aliases: ['worksite', 'site', 'work site', 'location'] },
      { key: 'sponsor', label: 'Sponsor', aliases: ['sponsor', 'sponsor name', 'kafeel'] },
      { key: 'transfer_status', label: 'Transfer Status', aliases: ['transfer status'] },
      { key: 'work_status', label: 'Work Status', aliases: ['work status', 'status'] },
      { key: 'joining_date', label: 'Joining Date', date: true, aliases: ['joining date', 'join date', 'hire date'] },
      { key: 'mobile', label: 'Mobile', aliases: ['mobile', 'phone', 'mobile no', 'contact'] },
      { key: 'nationality', label: 'Nationality', aliases: ['nationality'] },
      { key: 'bank', label: 'Bank', aliases: ['bank', 'bank name'] },
      { key: 'iban', label: 'IBAN', aliases: ['iban'] },
      { key: 'base_salary', label: 'Base Salary (SAR)', required: true, aliases: ['base salary (sar)', 'base salary', 'salary', 'monthly salary', 'basic salary'] },
      { key: 'contract_type', label: 'Contract Type', aliases: ['contract type', 'contract'] },
      { key: 'insurance_policy', label: 'Insurance Policy No', aliases: ['insurance policy no', 'insurance policy', 'policy no'] },
      { key: 'insurance_expiry', label: 'Insurance Expiry', date: true, aliases: ['insurance expiry', 'insurance expiry date'] },
      { key: 'notes', label: 'Notes', aliases: ['notes', 'remarks'] },
    ],
    templateHeaders: ['Employee Name','IQAMA Number','IQAMA Expiry','Birth Date','Worksite','Sponsor','Transfer Status','Work Status','Joining Date','Mobile','Nationality','Bank','IBAN','Base Salary (SAR)','Contract Type','Insurance Policy No','Insurance Expiry','Notes'],
    templateSample: ['Fahad Al Otaybi','2112345678','2027-06-14','1992-04-08','Riyadh Logistics Hub','Al Manar HR Solutions','Transfer Pending','Active','2024-02-01','0553000001','Saudi','SNB','SA0380000000123456789012',4300,'Full Time','INS-2001','2027-02-28','Night shift'],
  },
  timesheets: {
    title: 'Timesheet · Salary Register', fileHint: 'timesheet.xlsx / salary sheet',
    desc: 'Monthly register — Year, Month, employee and Day 1–31 entries. Pay is recomputed automatically from worksite rules on import.',
    icon: Table2, tone: 'gold',
    fields: [
      { key: 'employee', label: 'Employee Name', aliases: ['employee name', 'name', 'employee'] },
      { key: 'iqama', label: 'IQAMA (matcher)', aliases: ['iqama', 'iqama number'] },
      { key: 'year', label: 'Year', required: true, aliases: ['year', 'yyyy'] },
      { key: 'month', label: 'Month', required: true, aliases: ['month', 'mm'] },
      { key: 'deductions', label: 'Deductions (SAR)', aliases: ['deductions (sar)', 'deductions', 'deduction'] },
      { key: 'status', label: 'Status', aliases: ['status', 'status / check'] },
    ],
    templateHeaders: ['Year','Month','Employee Name','IQAMA', ...Array.from({ length: 31 }, (_, i) => `Day ${i + 1}`), 'Deductions (SAR)'],
    templateSample: [2026, 11, 'Ahmed Al Harbi', '1012345678', ...Array.from({ length: 31 }, () => 8), 0],
  },
  expenses: {
    title: 'Expenses Ledger', fileHint: 'expenses.xlsx',
    desc: 'Operational spend — date, category, vendor, amount. References are auto-generated; existing references are skipped, never duplicated.',
    icon: FileSpreadsheet, tone: 'sky',
    fields: [
      { key: 'expense_date', label: 'Date', required: true, date: true, aliases: ['date', 'expense date'] },
      { key: 'category', label: 'Category', required: true, aliases: ['category', 'expense category'] },
      { key: 'description', label: 'Description', aliases: ['description', 'details', 'particulars'] },
      { key: 'vendor', label: 'Vendor', aliases: ['vendor', 'supplier', 'payee'] },
      { key: 'amount', label: 'Amount (SAR)', required: true, aliases: ['amount', 'amount (sar)', 'value', 'cost', 'total'] },
      { key: 'worksite', label: 'Worksite', aliases: ['worksite', 'site'] },
      { key: 'payment_method', label: 'Payment Method', aliases: ['payment method', 'method', 'paid via'] },
      { key: 'reference', label: 'Reference', aliases: ['reference', 'ref', 'ref no', 'receipt no'] },
      { key: 'status', label: 'Status', aliases: ['status'] },
    ],
    templateHeaders: ['Date','Category','Description','Vendor','Amount (SAR)','Worksite','Payment Method','Status'],
    templateSample: ['2026-11-05','Utilities','Electricity bill - site offices','Saudi Electricity Co',8450,'Dammam Industrial Site','Bank Transfer','Paid'],
  },
};

const normalize = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const pad2 = (n: number | string) => String(n).padStart(2, '0');

function toIso(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date && !Number.isNaN(+v)) return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}`;
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${pad2(d.m)}-${pad2(d.d)}`;
  }
  const s = String(v).trim();
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(s);
  if (m) return `${m[3]}-${pad2(m[2])}-${pad2(m[1])}`;
  return s;
}

interface Parsed {
  fileName: string;
  headers: string[];
  rows: unknown[][];
  dayCols: number[]; // indexes of Day 1..31 columns (timesheets)
}

interface ImportReport { inserted: number; updated: number; skipped?: number; errors: { row: number; message: string }[] }

// Content fingerprint — lets the Sync Monitor detect whether a re-dropped file actually changed.
function fingerprintOf(records: unknown[]): string {
  const s = JSON.stringify(records);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  return `${h.toString(16)}-${records.length}`;
}

export default function ImportCenter() {
  const { toast, year, month } = useApp();
  const [dataset, setDataset] = useState<DatasetKey>('employees');
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const def = DATASETS[dataset];

  const switchDataset = (k: DatasetKey) => {
    setDataset(k); setParsed(null); setMapping({}); setReport(null); setProgress(0);
  };

  /* ---------- file parsing ---------- */
  const handleFile = async (file: File) => {
    try {
      setReport(null);
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
      const pick = (re: RegExp) => wb.SheetNames.find((n) => re.test(n));
      const sheetName =
        dataset === 'employees' ? (pick(/employee|master|import/i) ?? wb.SheetNames[0])
        : dataset === 'timesheets' ? (pick(/time|salary|payroll|register/i) ?? wb.SheetNames[0])
        : (pick(/expense|ledger|spend/i) ?? wb.SheetNames[0]);
      const ws = wb.Sheets[sheetName];
      const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });

      // locate header row: max alias hits within first 10 rows
      let best = 0; let bestScore = -1;
      for (let r = 0; r < Math.min(10, grid.length); r++) {
        const cells = (grid[r] || []).map(normalize);
        let score = 0;
        for (const f of def.fields) if (f.aliases.some((a) => cells.includes(a))) score += 2;
        score += cells.filter((c) => c !== '').length * 0.1;
        if (/^day\s*1$|^1$/.test(cells.join('|'))) score += 1;
        if (score > bestScore) { bestScore = score; best = r; }
      }
      const headers = (grid[best] || []).map((c) => String(c ?? '').trim());
      const rows = grid.slice(best + 1).filter((r) => (r || []).some((c) => c !== null && c !== '' && String(c).trim() !== ''));

      // auto-map fields → headers
      const normHeaders = headers.map(normalize);
      const auto: Record<string, string> = {};
      for (const f of def.fields) {
        for (const alias of f.aliases) {
          const idx = normHeaders.indexOf(alias);
          if (idx >= 0) { auto[f.key] = headers[idx]; break; }
        }
      }
      // day columns for timesheets
      const dayCols: number[] = [];
      if (dataset === 'timesheets') {
        normHeaders.forEach((h, i) => {
          const m = /^day\s*(\d{1,2})$/.exec(h) || (/^\d{1,2}$/.test(h) ? [h, h] as RegExpExecArray | string[] : null);
          if (m && Number(m[1]) >= 1 && Number(m[1]) <= 31) dayCols[Number(m[1]) - 1] = i;
        });
      }

      setParsed({ fileName: file.name, headers, rows, dayCols });
      setMapping(auto);
      setProgress(0);
      toast(`Parsed "${file.name}" — ${rows.length} data rows found`, 'info');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not parse file', 'error');
    }
  };

  /* ---------- build records ---------- */
  const colIndex = (header: string) => (parsed ? parsed.headers.indexOf(header) : -1);

  const records = useMemo(() => {
    if (!parsed) return [];
    return parsed.rows.map((row) => {
      const rec: Record<string, unknown> = {};
      for (const f of def.fields) {
        const h = mapping[f.key];
        if (!h) continue;
        const idx = colIndex(h);
        if (idx < 0) continue;
        const v = row[idx];
        rec[f.key] = f.date ? toIso(v) : (v === '' ? null : v);
      }
      if (dataset === 'timesheets') {
        const days: (number | string | null)[] = [];
        for (let d = 0; d < 31; d++) {
          const ci = parsed.dayCols[d];
          const v = ci === undefined || ci < 0 ? null : row[ci];
          if (v === null || v === undefined || v === '') days.push(null);
          else if (typeof v === 'number') days.push(v);
          else {
            const s = String(v).trim().toUpperCase();
            days.push(s === 'P' || s === 'A' ? s : (Number.isFinite(Number(s)) ? Number(s) : null));
          }
        }
        rec.days = days;
        rec.year = Number(rec.year);
        rec.month = Number(rec.month);
      }
      if (dataset === 'employees' && rec.iqama) rec.iqama = String(rec.iqama).replace(/\D/g, '');
      return rec;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, mapping, dataset]);

  /* ---------- validation ---------- */
  const rowIssue = (rec: Record<string, unknown>): string | null => {
    if (dataset === 'employees') {
      if (!rec.name) return 'Missing name';
      if (rec.iqama && !/^\d{10}$/.test(String(rec.iqama))) return 'IQAMA not 10 digits';
      if (rec.base_salary !== undefined && rec.base_salary !== null && Number.isNaN(Number(rec.base_salary))) return 'Salary not numeric';
    }
    if (dataset === 'timesheets') {
      if (!rec.employee && !rec.iqama) return 'No employee matcher';
      if (!rec.year || !rec.month || Number(rec.month) < 1 || Number(rec.month) > 12) return 'Bad period';
    }
    if (dataset === 'expenses') {
      if (!rec.expense_date) return 'Missing date';
      if (!rec.category) return 'Missing category';
      if (!(Number(rec.amount) > 0)) return 'Bad amount';
    }
    return null;
  };

  const issues = useMemo(() => records.map(rowIssue), [records]);
  const validCount = issues.filter((i) => i === null).length;
  const mappedRequired = def.fields.filter((f) => f.required && mapping[f.key]).length;
  const requiredTotal = def.fields.filter((f) => f.required).length;
  const mappedCount = def.fields.filter((f) => mapping[f.key]).length + (dataset === 'timesheets' && parsed ? (parsed.dayCols.filter((x) => x !== undefined).length > 0 ? 1 : 0) : 0);

  /* ---------- import ---------- */
  const runImport = async () => {
    if (!parsed || records.length === 0) return;
    setBusy(true); setProgress(0); setReport(null); setSyncStatus(null);
    const t0 = performance.now();
    const agg: ImportReport = { inserted: 0, updated: 0, skipped: 0, errors: [] };
    try {
      const CHUNK = 400;
      for (let i = 0; i < records.length; i += CHUNK) {
        const slice = records.slice(i, i + CHUNK);
        const rep = await apiSend<ImportReport>('/api/import', 'POST', { resource: dataset, rows: slice });
        agg.inserted += rep.inserted; agg.updated += rep.updated; agg.skipped = (agg.skipped || 0) + (rep.skipped || 0);
        agg.errors.push(...rep.errors.map((e) => ({ row: e.row + i, message: e.message })));
        setProgress(Math.round(((i + slice.length) / records.length) * 100));
      }
      setReport(agg);
      // Register the file in the Sync Monitor — fingerprint decides Synced vs Updated vs No changes.
      try {
        const sync = await apiSend<{ status: string }>('/api/sync-files', 'POST', {
          file_name: parsed.fileName, dataset, fingerprint: fingerprintOf(records),
          row_count: records.length, inserted: agg.inserted, updated: agg.updated,
          skipped: agg.skipped || 0, error_count: agg.errors.length,
          duration_ms: Math.round(performance.now() - t0),
        });
        setSyncStatus(sync.status);
      } catch { /* sync registry is best-effort */ }
      if (agg.errors.length === 0) toast(`Import complete — ${agg.inserted} added, ${agg.updated} updated`);
      else toast(`Imported with ${agg.errors.length} row errors`, 'error');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Import failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([def.templateHeaders, def.templateSample]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `basmat-${dataset}-template.xlsx`);
    toast('Template downloaded', 'info');
  };

  // Live-data exporter \u2014 downloads the current database contents in the exact import layout,
  // so users can edit offline and re-import (idempotent upsert) or use it as a filled master dataset.
  const exportLiveData = async () => {
    try {
      let aoa: (string | number)[][] = [];
      let name = '';
      if (dataset === 'employees') {
        const rows = await apiGet<Record<string, unknown>[]>('/api/employees');
        aoa = [def.templateHeaders, ...rows.map((e) => {
          const wsRef = e.worksites as { name?: string } | null;
          return [e.name, e.iqama, e.iqama_expiry, e.birth_date, wsRef?.name || '', e.sponsor, e.transfer_status,
            e.work_status, e.joining_date, e.mobile, e.nationality, e.bank, e.iban, e.base_salary,
            e.contract_type, e.insurance_policy, e.insurance_expiry, e.notes || ''] as (string | number)[];
        })];
        name = `basmat-master-data-${new Date().toISOString().slice(0, 10)}.xlsx`;
      } else if (dataset === 'timesheets') {
        const rows = await apiGet<Record<string, unknown>[]>(`/api/timesheets?year=${year}&month=${month}`);
        aoa = [def.templateHeaders, ...rows.map((r) => {
          const emp = r.employees as { name?: string; iqama?: string } | undefined;
          const days = (r.days as (string | number | null)[]) || [];
          return [r.year, r.month, emp?.name || '', emp?.iqama || '',
            ...Array.from({ length: 31 }, (_, i) => days[i] ?? ''), r.deductions ?? 0] as (string | number)[];
        })];
        name = `basmat-salary-register-${year}-${String(month).padStart(2, '0')}.xlsx`;
      } else {
        const rows = await apiGet<Record<string, unknown>[]>('/api/expenses');
        aoa = [[...def.templateHeaders, 'Reference'], ...rows.map((x) => {
          const wsRef = x.worksites as { name?: string } | null;
          return [x.expense_date, x.category, x.description || '', x.vendor || '', x.amount,
            wsRef?.name || '', x.payment_method || '', x.status, x.reference] as (string | number)[];
        })];
        name = `basmat-expenses-${new Date().toISOString().slice(0, 10)}.xlsx`;
      }
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, dataset === 'employees' ? 'Employees' : dataset === 'timesheets' ? 'Register' : 'Expenses');
      XLSX.writeFile(wb, name);
      toast(`Exported ${aoa.length - 1} rows \u2014 ${name}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Export failed', 'error');
    }
  };

  const toneCls: Record<string, string> = {
    emerald: 'from-emerald-500/20 to-transparent text-emerald-300 border-emerald-400/25',
    gold: 'from-gold-500/20 to-transparent text-gold-300 border-gold-400/25',
    sky: 'from-sky-500/20 to-transparent text-sky-300 border-sky-400/25',
  };

  return (
    <div className="space-y-4">
      {/* hero */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-transparent border border-emerald-400/25 flex items-center justify-center text-emerald-300 shrink-0">
              <FolderSync size={22} />
            </div>
            <div className="flex-1 min-w-[260px]">
              <h2 className="font-display text-[17px] font-bold text-white">Local Excel Sync — column by column, row by row</h2>
              <p className="text-[12px] text-slate-400 mt-1 leading-relaxed max-w-2xl">
                Keep your <b className="text-slate-200">master data</b>, <b className="text-slate-200">timesheet / salary</b> and <b className="text-slate-200">expense</b> Excel files in one folder on your Windows PC or Mac. Drop any of them here — every column is auto-mapped and every row is validated and written into the live system. Existing records update in place; nothing is duplicated.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="emerald"><AppWindow size={11} className="mr-0.5" /> Windows</Badge>
              <Badge tone="sky"><Apple size={11} className="mr-0.5" /> macOS</Badge>
              <Badge tone="gold"><MonitorCheck size={11} className="mr-0.5" /> .xlsx / .xls / .csv</Badge>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* guided step flow */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { n: 1, label: 'Choose dataset', done: true, active: !parsed },
          { n: 2, label: 'Drop Excel file', done: !!parsed, active: !parsed },
          { n: 3, label: 'Map & verify rows', done: !!parsed && mappedRequired === requiredTotal && validCount > 0, active: !!parsed && !report },
          { n: 4, label: 'Import rows', done: !!report, active: !!parsed && !report },
        ].map((s) => (
          <div key={s.n} className={`glass px-3.5 py-2.5 flex items-center gap-2.5 border ${s.done ? 'border-emerald-400/30' : s.active ? 'border-gold-400/40' : 'border-white/[0.06]'}`}>
            <span className={`w-6 h-6 flex items-center justify-center text-[10.5px] font-bold shrink-0 border ${s.done ? 'bg-emerald-400/15 text-emerald-300 border-emerald-400/40' : s.active ? 'bg-gold-400/15 text-gold-300 border-gold-400/40' : 'bg-white/[0.04] text-slate-500 border-white/[0.08]'}`}>
              {s.done ? <CheckCircle2 size={12} /> : s.n}
            </span>
            <div className="min-w-0">
              <p className={`text-[11px] font-bold truncate ${s.done ? 'text-emerald-300' : s.active ? 'text-slate-100' : 'text-slate-500'}`}>{s.label}</p>
              <p className="text-[8.5px] font-bold uppercase tracking-[0.14em] text-slate-600">{s.done ? 'Done' : s.active ? 'In progress' : 'Waiting'}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* step 1: dataset */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(Object.keys(DATASETS) as DatasetKey[]).map((k, i) => {
          const d = DATASETS[k];
          const active = dataset === k;
          return (
            <motion.button
              key={k}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.05 }}
              onClick={() => switchDataset(k)}
              className={`glass rounded-2xl p-4 text-left transition-all duration-200 ${active ? 'border-emerald-400/45 shadow-[0_0_30px_-10px_rgba(16,185,129,0.5)]' : 'hover:border-white/20'}`}
            >
              <div className="flex items-center justify-between">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br border flex items-center justify-center ${toneCls[d.tone]}`}>
                  <d.icon size={18} />
                </div>
                {active && <Badge tone="emerald">Selected</Badge>}
              </div>
              <p className="font-display text-[14px] font-bold text-white mt-3">{d.title}</p>
              <p className="text-[10.5px] text-slate-500 font-semibold mt-0.5">{d.fileHint}</p>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">{d.desc}</p>
            </motion.button>
          );
        })}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* step 2: dropzone */}
        <div className="col-span-12 xl:col-span-5 space-y-4">
          <Card className="p-5">
            <SectionTitle icon={UploadCloud} title="2 · Drop your Excel file" sub={parsed ? `Loaded: ${parsed.fileName}` : 'From your local data folder'} />
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
              onClick={() => fileRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${dragging ? 'border-emerald-400/70 bg-emerald-400/[0.06]' : 'border-white/[0.12] hover:border-emerald-400/40 hover:bg-white/[0.02]'}`}
            >
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
              {parsed ? (
                <>
                  <FileSpreadsheet size={28} className="mx-auto text-emerald-300" />
                  <p className="text-[13px] font-bold text-emerald-200 mt-2.5 truncate max-w-[92%] mx-auto">{parsed.fileName}</p>
                  <p className="text-[10.5px] text-slate-500 font-semibold mt-1">{parsed.rows.length} rows detected · drop another file to replace</p>
                </>
              ) : (
                <>
                  <FileUp size={30} className={`mx-auto ${dragging ? 'text-emerald-300' : 'text-slate-500'}`} />
                  <p className="text-[13px] font-bold text-slate-200 mt-3">{dragging ? 'Release to parse' : 'Drag & drop or click to browse'}</p>
                  <p className="text-[10.5px] text-slate-500 font-semibold mt-1">Headers are auto-detected · Excel dates & serials handled</p>
                </>
              )}
            </div>

            <div className="flex items-center justify-between mt-4 gap-2">
              <p className="text-[10.5px] font-semibold text-slate-500">Blank layout or a filled master dataset:</p>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" icon={Download} onClick={downloadTemplate}>Template</Button>
                <Button variant="outline" size="sm" icon={FileDown} onClick={exportLiveData}>Export live data</Button>
              </div>
            </div>
          </Card>

          {/* report */}
          {report && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="p-5">
                <SectionTitle icon={CheckCircle2} tone={report.errors.length ? 'amber' : 'emerald'} title="Import report" sub={parsed?.fileName} />
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['Added', report.inserted, 'text-emerald-300'],
                    ['Updated', report.updated, 'text-sky-300'],
                    ['Errors', report.errors.length, report.errors.length ? 'text-rose-300' : 'text-slate-400'],
                  ].map(([l, v, c]) => (
                    <div key={l as string} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
                      <p className={`font-display text-[20px] font-bold tabular ${c}`}>{v as number}</p>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mt-0.5">{l}</p>
                    </div>
                  ))}
                </div>
                {(report.skipped ?? 0) > 0 && <p className="text-[11px] text-slate-500 font-semibold mt-3">{report.skipped} duplicate references skipped.</p>}
                {syncStatus && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-sky-400/[0.06] border border-sky-400/20 px-3 py-2">
                    <FolderSync size={13} className="text-sky-300 shrink-0" />
                    <p className="text-[11px] font-semibold text-sky-200">
                      Sync Monitor: {syncStatus === 'Updated' ? 'file had updates — changes applied' : syncStatus === 'No changes' ? 'file unchanged since last sync' : syncStatus === 'Synced' ? 'file registered as synced' : 'sync failed'}
                    </p>
                  </div>
                )}
                {report.errors.length > 0 && (
                  <div className="mt-3 max-h-[160px] overflow-y-auto space-y-1.5">
                    {report.errors.slice(0, 10).map((e, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-lg bg-rose-400/[0.06] border border-rose-400/15 px-3 py-2">
                        <AlertTriangle size={12} className="text-rose-300 mt-0.5 shrink-0" />
                        <p className="text-[11px] font-semibold text-rose-200">Row {e.row}: {e.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </motion.div>
          )}
        </div>

        {/* step 3: mapping + preview */}
        <div className="col-span-12 xl:col-span-7">
          <Card className="p-5 min-h-[420px]">
            <SectionTitle icon={Table2} tone="gold" title="3 · Map columns & verify rows"
              sub={parsed ? `${parsed.rows.length} rows · ${validCount} valid · ${parsed.rows.length - validCount} with issues` : 'Waiting for a file'}
              right={parsed ? (
                <Badge tone={mappedRequired === requiredTotal ? 'emerald' : 'amber'} dot={false}>
                  {mappedCount}/{def.fields.length + (dataset === 'timesheets' ? 1 : 0)} mapped
                </Badge>
              ) : undefined} />

            {!parsed ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileSpreadsheet size={28} className="text-slate-600" />
                <p className="text-[13px] font-bold text-slate-400 mt-3">No file loaded yet</p>
                <p className="text-[11px] text-slate-600 mt-1 max-w-[300px]">Drop the Excel file from your local folder — the column mapper and row validator appear here.</p>
              </div>
            ) : (
              <>
                {/* mapping */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {def.fields.map((f) => {
                    const mapped = mapping[f.key];
                    return (
                      <div key={f.key} className={`rounded-xl border p-2.5 ${f.required && !mapped ? 'border-rose-400/35 bg-rose-400/[0.04]' : 'border-white/[0.07] bg-white/[0.02]'}`}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${mapped ? 'bg-emerald-400' : f.required ? 'bg-rose-400' : 'bg-slate-600'}`} />
                          <p className="text-[10px] font-bold text-slate-400 truncate">{f.label}{f.required ? ' *' : ''}</p>
                        </div>
                        <select
                          value={mapped || ''}
                          onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                          className="w-full appearance-none bg-ink-800 border border-white/[0.08] rounded-lg pl-2 pr-7 py-1.5 text-[11px] font-semibold text-slate-200 outline-none focus:border-emerald-400/40 cursor-pointer bg-no-repeat"
                          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%237d8aa0' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundPosition: 'right 8px center' }}
                        >
                          <option value="">— skip —</option>
                          {parsed.headers.filter((h) => h).map((h) => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                    );
                  })}
                  {dataset === 'timesheets' && (
                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${parsed.dayCols.filter((x) => x !== undefined).length > 0 ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                        <p className="text-[10px] font-bold text-slate-400">Day 1–31 columns</p>
                      </div>
                      <p className="text-[11px] font-bold text-emerald-300">{parsed.dayCols.filter((x) => x !== undefined).length} detected automatically</p>
                    </div>
                  )}
                </div>

                {/* preview */}
                <div className="mt-4 overflow-x-auto rounded-xl border border-white/[0.07]">
                  <table className="w-full text-left min-w-[560px]">
                    <thead>
                      <tr className="bg-white/[0.03] text-[9px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="px-3 py-2 w-10">#</th>
                        {def.fields.filter((f) => mapping[f.key]).slice(0, 5).map((f) => <th key={f.key} className="px-3 py-2">{f.label}</th>)}
                        <th className="px-3 py-2 text-right">Check</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.slice(0, 6).map((rec, i) => (
                        <tr key={i} className="border-t border-white/[0.05]">
                          <td className="px-3 py-2 text-[10px] font-bold text-slate-600">{i + 1}</td>
                          {def.fields.filter((f) => mapping[f.key]).slice(0, 5).map((f) => (
                            <td key={f.key} className="px-3 py-2 text-[11px] font-semibold text-slate-300 truncate max-w-[160px]">{String(rec[f.key] ?? '—')}</td>
                          ))}
                          <td className="px-3 py-2 text-right">
                            {issues[i] === null
                              ? <Badge tone="emerald" dot={false} className="!text-[9px]">OK</Badge>
                              : <Badge tone="rose" dot={false} className="!text-[9px]">{issues[i]}</Badge>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {records.length > 6 && <p className="text-[10px] text-slate-600 font-semibold px-3 py-2">+ {records.length - 6} more rows ready…</p>}
                </div>

                {/* import action */}
                <div className="flex items-center gap-3 mt-4">
                  <Button onClick={runImport} loading={busy} disabled={validCount === 0 || mappedRequired < requiredTotal} icon={UploadCloud} className="min-w-[190px]">
                    {busy ? `Importing ${progress}%` : `Import ${records.length} rows`}
                  </Button>
                  {mappedRequired < requiredTotal && <p className="text-[11px] font-semibold text-rose-300">Map all required (*) columns first</p>}
                  {busy && (
                    <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                      <motion.div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300" animate={{ width: `${progress}%` }} transition={{ ease: 'easeOut' }} />
                    </div>
                  )}
                  {busy && <Loader2 size={15} className="animate-spin text-emerald-400" />}
                </div>
              </>
            )}
          </Card>
        </div>
      </div>

      {/* local run note */}
      <Card className="p-4 flex flex-wrap items-center gap-x-8 gap-y-2">
        <p className="text-[11px] font-bold text-slate-300">Running fully offline on a workstation?</p>
        <p className="text-[11px] text-slate-500 leading-relaxed flex-1 min-w-[280px]">
          This same codebase runs locally on Windows and macOS with Node.js LTS — <span className="text-emerald-300 font-semibold">npm install → npm run dev</span> — then keep this page open next to your data folder and drop files in whenever they change. Imports are idempotent: re-dropping the same file updates rows in place instead of duplicating them.
        </p>
        <Badge tone="emerald"><CheckCircle2 size={11} className="mr-0.5" /> Idempotent sync</Badge>
        <a href="/getstart.md" target="_blank" rel="noreferrer" className="text-[11px] font-bold text-sky-300 hover:text-sky-200 transition-colors">Read getstart.md \u2192</a>
      </Card>
    </div>
  );
}
