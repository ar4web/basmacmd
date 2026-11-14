import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, Save, Search, Loader2, CheckCircle2, Flag, ShieldAlert, ChevronDown, Pin, PinOff, Highlighter, Eraser, Bold, ALargeSmall } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiGet, apiSend } from '../lib/api';
import type { TimesheetRow, Worksite, DayValue } from '../lib/types';
import { fmtSAR, fmtNum, MONTHS, MONTHS_SHORT, STATUS_TONE } from '../lib/format';
import { Card, SectionTitle, Badge, Spinner, EmptyState, ErrorState, Avatar } from '../components/ui/primitives';

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

// Quick-mark toolbar palettes
const MARK_COLORS = [
  { name: 'amber', bg: 'rgba(251,191,36,0.28)', swatch: '#fbbf24' },
  { name: 'emerald', bg: 'rgba(52,211,153,0.28)', swatch: '#34d399' },
  { name: 'rose', bg: 'rgba(251,113,133,0.30)', swatch: '#fb7185' },
  { name: 'sky', bg: 'rgba(56,189,248,0.28)', swatch: '#38bdf8' },
] as const;
const CELL_SIZES = [11, 12.5, 14];

interface Violation {
  rowId: number;
  employee: string;
  rule: string;
  detail: string;
  severity: 'critical' | 'warning';
}

interface AuditRules { otCap: number; absenceFlag: number; deductionCap: number }

// Rule engine: checks every register row against the worksite's pay rules.
// Thresholds come from the Rule Setup page.
function auditRows(rows: TimesheetRow[], cfg: AuditRules): Violation[] {
  const out: Violation[] = [];
  for (const r of rows) {
    const ws = r.employees?.worksites;
    const fmt = ws?.timesheet_format || '';
    const name = r.employees?.name || `#${r.employee_id}`;

    // 1. Invalid day value for the site's timesheet format
    const days = Array.isArray(r.days) ? r.days : [];
    const badIdx = days.findIndex((v) => {
      if (v === null || v === undefined || v === '') return false;
      if (fmt === 'P/A Tally') return v !== 'P' && v !== 'A';
      if (fmt === 'Direct Days') return Number(v) !== 1;
      const n = Number(v);
      return Number.isNaN(n) || n < 0 || n > 24;
    });
    if (badIdx >= 0) {
      out.push({ rowId: r.id, employee: name, rule: 'Invalid entry', severity: 'critical',
        detail: `Day ${badIdx + 1} holds "${days[badIdx]}" — breaks the ${fmt} format` });
    }
    // 2. Overtime policy cap
    if (Number(r.overtime_hours) > cfg.otCap) {
      out.push({ rowId: r.id, employee: name, rule: 'OT spike', severity: 'warning',
        detail: `${r.overtime_hours}h overtime exceeds the ${cfg.otCap}h monthly policy cap` });
    }
    // 3. Absence threshold
    if (Number(r.absent_days) >= cfg.absenceFlag) {
      out.push({ rowId: r.id, employee: name, rule: 'High absence', severity: 'critical',
        detail: `${r.absent_days} absences in a single month — supervisor review required` });
    }
    // 4. Deduction alignment
    if (Number(r.gross_pay) > 0 && Number(r.deductions) > (cfg.deductionCap / 100) * Number(r.gross_pay)) {
      out.push({ rowId: r.id, employee: name, rule: 'Excessive deduction', severity: 'critical',
        detail: `Deductions exceed ${cfg.deductionCap}% of gross pay — not aligned to payroll rule` });
    }
    // 5. Pay anomaly
    if (Number(r.present_days) > 0 && Number(r.net_pay) <= 0) {
      out.push({ rowId: r.id, employee: name, rule: 'Pay anomaly', severity: 'critical',
        detail: 'Presence logged but net pay is zero or negative' });
    }
    // 6. Empty register (excluding legitimately held rows)
    if (Number(r.present_days) === 0 && r.status !== 'On Hold') {
      out.push({ rowId: r.id, employee: name, rule: 'Empty register', severity: 'warning',
        detail: 'No day entries logged for this period' });
    }
  }
  return out;
}

export default function Timesheet() {
  const { year, month, toast, rules } = useApp();
  const [worksites, setWorksites] = useState<Worksite[]>([]);
  const [wsId, setWsId] = useState<string>('1');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<TimesheetRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState<Record<number, { days: DayValue[]; deductions: number }>>({});
  const [saving, setSaving] = useState<Record<number, 'saving' | 'saved' | undefined>>({});
  const [auditOpen, setAuditOpen] = useState(true);
  const [highlightRow, setHighlightRow] = useState<number | null>(null);
  // Hold = employee identity column stays frozen during horizontal scroll; Release = it scrolls with the grid.
  // Default comes from Rule Setup.
  const [holdRows, setHoldRows] = useState(rules.holdRows);
  useEffect(() => { setHoldRows(rules.holdRows); }, [rules.holdRows]);

  // ---- quick-mark toolbar state ----
  const [markColor, setMarkColor] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [cellBold, setCellBold] = useState(false);
  const [cellSizeIdx, setCellSizeIdx] = useState(0);

  const markKey = `almanar.marks.${year}-${month}-${wsId}`;
  useEffect(() => {
    try { setMarks(JSON.parse(localStorage.getItem(markKey) || '{}')); } catch { setMarks({}); }
  }, [markKey]);

  const toggleMark = (k: string) => {
    if (!markColor) return;
    setMarks((m) => {
      const n = { ...m };
      if (n[k]) delete n[k]; else n[k] = markColor;
      try { localStorage.setItem(markKey, JSON.stringify(n)); } catch { /* ignore */ }
      return n;
    });
  };
  const clearMarks = () => {
    setMarks({});
    try { localStorage.removeItem(markKey); } catch { /* ignore */ }
  };

  const dim = daysInMonth(year, month);

  useEffect(() => {
    apiGet<Worksite[]>('/api/worksites').then((ws) => {
      setWorksites(ws);
      if (ws.length > 0) setWsId(String(ws[0].id));
    }).catch(() => undefined);
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ year: String(year), month: String(month) });
      if (wsId !== 'all') params.set('worksite_id', wsId);
      if (search.trim()) params.set('search', search.trim());
      const data = await apiGet<TimesheetRow[]>(`/api/timesheets?${params.toString()}`);
      setRows(data);
      setDirty({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (wsId) load(); }, [year, month, wsId]);

  const firstSearchRun = useRef(true);
  useEffect(() => {
    if (firstSearchRun.current) { firstSearchRun.current = false; return; }
    const t = setTimeout(() => { if (wsId) load(); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const currentWs = worksites.find((w) => String(w.id) === wsId);
  // Columns follow the site's pay-period rule (e.g. 26 days), not the raw calendar length.
  const periodDays = Math.min(currentWs?.pay_period_days ?? dim, dim);

  const setCell = (row: TimesheetRow, dayIdx: number, value: DayValue) => {
    const base = dirty[row.id]?.days ? [...dirty[row.id].days] : [...row.days];
    while (base.length < dim) base.push(null);
    base[dayIdx] = value;
    setDirty((d) => ({ ...d, [row.id]: { days: base, deductions: d[row.id]?.deductions ?? row.deductions } }));
  };

  const setDeductions = (row: TimesheetRow, value: number) => {
    setDirty((d) => ({ ...d, [row.id]: { days: d[row.id]?.days ?? [...row.days], deductions: value } }));
  };

  const saveRow = async (row: TimesheetRow) => {
    const d = dirty[row.id];
    if (!d) return;
    setSaving((s) => ({ ...s, [row.id]: 'saving' }));
    try {
      const updated = await apiSend<TimesheetRow>('/api/timesheets', 'PUT', { id: row.id, days: d.days, deductions: d.deductions });
      setRows((rs) => rs ? rs.map((r) => (r.id === row.id ? { ...r, ...updated, employees: r.employees } : r)) : rs);
      setDirty((dd) => { const n = { ...dd }; delete n[row.id]; return n; });
      setSaving((s) => ({ ...s, [row.id]: 'saved' }));
      setTimeout(() => setSaving((s) => ({ ...s, [row.id]: undefined })), 1600);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Save failed', 'error');
      setSaving((s) => ({ ...s, [row.id]: undefined }));
    }
  };

  const violations = useMemo(
    () => (rows && (rules.auditPanel || rules.rowFlags)
      ? auditRows(rows, { otCap: rules.otCap, absenceFlag: rules.absenceFlag, deductionCap: rules.deductionCap })
      : []),
    [rows, rules.auditPanel, rules.rowFlags, rules.otCap, rules.absenceFlag, rules.deductionCap],
  );
  const flaggedRows = useMemo(() => new Set(violations.map((v) => v.rowId)), [violations]);

  const jumpToRow = (rowId: number) => {
    const el = document.getElementById(`ts-row-${rowId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightRow(rowId);
      setTimeout(() => setHighlightRow(null), 2400);
    }
  };

  const totals = useMemo(() => {
    if (!rows) return { present: 0, absent: 0, hours: 0, ot: 0, net: 0 };
    return {
      present: rows.reduce((a, r) => a + (r.present_days || 0), 0),
      absent: rows.reduce((a, r) => a + (r.absent_days || 0), 0),
      hours: rows.reduce((a, r) => a + (r.total_hours || 0), 0),
      ot: rows.reduce((a, r) => a + (r.overtime_hours || 0), 0),
      net: rows.reduce((a, r) => a + (r.net_pay || 0), 0),
    };
  }, [rows]);

  const cellKind = (format?: string): 'hours' | 'pa' | 'days' => {
    if (format === 'P/A Tally') return 'pa';
    if (format === 'Direct Days') return 'days';
    return 'hours';
  };

  const renderCell = (row: TimesheetRow, dayIdx: number) => {
    const emp = row.employees;
    const format = emp?.worksites?.timesheet_format;
    const kind = cellKind(format);
    const val = dirty[row.id]?.days?.[dayIdx] ?? row.days?.[dayIdx] ?? null;
    const date = new Date(year, month - 1, dayIdx + 1);
    const isFriday = rules.fridayHighlight && date.getDay() === 5;
    const dirtyCell = dirty[row.id] && dirty[row.id].days[dayIdx] !== row.days?.[dayIdx];

    const cls = `h-9 border-r border-b border-white/[0.045] ts-cell ${isFriday ? 'bg-gold-400/[0.04]' : ''} ${dirtyCell ? 'bg-emerald-400/[0.09]' : ''} ${val === 'A' ? 'bg-rose-500/[0.07]' : ''}`;
    const mk = marks[`${row.id}-${dayIdx}`];
    const markProps = {
      onMouseDown: (e: React.MouseEvent) => {
        if (!markColor) return;
        e.preventDefault();
        toggleMark(`${row.id}-${dayIdx}`);
      },
      style: mk ? { background: MARK_COLORS.find((c) => c.name === mk)?.bg } : undefined,
    };

    if (kind === 'pa') {
      return (
        <td key={dayIdx} className={cls} {...markProps}>
          <select value={val === null || val === '' ? '' : String(val)} onChange={(e) => setCell(row, dayIdx, e.target.value === '' ? null : e.target.value)}>
            <option value="">·</option>
            <option value="P">P</option>
            <option value="A">A</option>
          </select>
        </td>
      );
    }
    if (kind === 'days') {
      return (
        <td key={dayIdx} className={cls} {...markProps}>
          <select value={val ? '1' : ''} onChange={(e) => setCell(row, dayIdx, e.target.value === '' ? null : 1)}>
            <option value="">·</option>
            <option value="1">1</option>
          </select>
        </td>
      );
    }
    return (
      <td key={dayIdx} className={cls} {...markProps}>
        <input
          type="number" min={0} max={24} step={1}
          value={val === null || val === '' || val === 'A' ? '' : String(val)}
          placeholder="·"
          onChange={(e) => {
            const v = e.target.value;
            setCell(row, dayIdx, v === '' ? null : Math.max(0, Math.min(24, Number(v))));
          }}
        />
      </td>
    );
  };

  if (error) return <Card className="p-6"><ErrorState message={error} onRetry={load} /></Card>;

  return (
    <div className="space-y-4">
      <Card className="p-3.5 flex flex-wrap items-center gap-2.5">
        <div className="flex rounded-xl bg-white/[0.04] border border-white/[0.08] p-1 gap-1 overflow-x-auto">
          {worksites.map((w) => (
            <button
              key={w.id}
              onClick={() => setWsId(String(w.id))}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${String(w.id) === wsId ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/25' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}
            >
              {w.name}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name…"
            className="rounded-xl bg-white/[0.04] border border-white/[0.08] pl-8 pr-3 py-2 text-[12px] font-medium text-slate-200 placeholder:text-slate-600 outline-none focus:border-emerald-400/40 w-[170px]"
          />
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] font-semibold text-slate-500">
          <span>Present <b className="text-emerald-300 tabular">{fmtNum(totals.present)}</b></span>
          <span>Absent <b className="text-rose-300 tabular">{fmtNum(totals.absent)}</b></span>
          <span>Hours <b className="text-sky-300 tabular">{fmtNum(totals.hours)}</b></span>
          <span>OT <b className="text-amber-300 tabular">{fmtNum(totals.ot)}h</b></span>
          <span>Net <b className="text-gold-300 tabular">{fmtSAR(totals.net, { compact: true })}</b></span>
        </div>
      </Card>

      {/* ===== Register Audit — collapsible rule-check panel (toggleable in Rule Setup) ===== */}
      {rules.auditPanel && (
      <Card className="overflow-hidden">
        <button
          onClick={() => setAuditOpen((o) => !o)}
          className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.025] transition-colors text-left"
        >
          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${violations.length > 0 ? 'bg-rose-500/15 text-rose-300 border-rose-400/25' : 'bg-emerald-500/15 text-emerald-300 border-emerald-400/25'}`}>
            <ShieldAlert size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-bold text-white">Register Audit — Rule Checks</p>
            <p className="text-[10.5px] font-semibold text-slate-500">
              {loading ? 'Scanning register…' : violations.length === 0
                ? 'Every row is aligned to worksite pay rules — nothing to flag'
                : `${violations.length} flag${violations.length === 1 ? '' : 's'} raised · click a flag to jump to the row`}
            </p>
          </div>
          <Badge tone={violations.some((v) => v.severity === 'critical') ? 'rose' : violations.length > 0 ? 'amber' : 'emerald'}>
            {violations.length} flag{violations.length === 1 ? '' : 's'}
          </Badge>
          <motion.span animate={{ rotate: auditOpen ? 180 : 0 }} transition={{ duration: 0.25 }} className="text-slate-500">
            <ChevronDown size={16} />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {auditOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden border-t border-white/[0.06]"
            >
              <div className="max-h-[210px] overflow-y-auto p-3 space-y-1.5">
                {violations.length === 0 && !loading && (
                  <div className="flex items-center gap-2.5 rounded-lg bg-emerald-400/[0.05] border border-emerald-400/15 px-3.5 py-3">
                    <CheckCircle2 size={15} className="text-emerald-300 shrink-0" />
                    <p className="text-[11.5px] font-semibold text-emerald-200">Register clean — formats, overtime caps, absence thresholds and deductions all conform.</p>
                  </div>
                )}
                {violations.map((v, i) => (
                  <button
                    key={`${v.rowId}-${v.rule}-${i}`}
                    onClick={() => jumpToRow(v.rowId)}
                    className="w-full flex items-center gap-3 rounded-lg bg-white/[0.02] border border-white/[0.05] px-3.5 py-2.5 hover:border-rose-400/30 hover:bg-rose-400/[0.04] transition-all text-left"
                  >
                    <Flag size={13} className={v.severity === 'critical' ? 'text-rose-400 shrink-0' : 'text-amber-300 shrink-0'} />
                    <span className="text-[12px] font-bold text-slate-200 shrink-0">{v.employee}</span>
                    <Badge tone={v.severity === 'critical' ? 'rose' : 'amber'} dot={false} className="!text-[8.5px] !px-1.5 !py-[1px] shrink-0">{v.rule}</Badge>
                    <span className="text-[11px] font-semibold text-slate-500 truncate">{v.detail}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
      )}

      <Card className="overflow-hidden">
        <div className="px-5 pt-4">
          <SectionTitle icon={CalendarClock} title={`${MONTHS[month - 1]} ${year} Register`}
            sub={currentWs ? `${currentWs.timesheet_format} · ${currentWs.pay_method} · ${currentWs.hours_per_day}h standard · absent = ${currentWs.absent_treatment} · columns 1–${periodDays}` : 'Daily entries recompute pay instantly on save'}
            right={
              <div className="flex items-center gap-2">
                <Badge tone="gold" dot={false} className="!text-[10px]">{MONTHS_SHORT[month - 1]}-{String(year).slice(2)}</Badge>
              <button
                onClick={() => setHoldRows((h) => !h)}
                title={holdRows ? 'Row identity is HELD while scrolling — click to release' : 'Row identity is RELEASED — click to hold it while scrolling'}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-all ${
                  holdRows
                    ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300 shadow-[0_0_16px_-4px_rgba(16,185,129,0.5)]'
                    : 'border-white/[0.12] bg-white/[0.04] text-slate-400 hover:text-slate-200'
                }`}
              >
                {holdRows ? <Pin size={12} /> : <PinOff size={12} />}
                {holdRows ? 'Rows held' : 'Rows released'}
              </button>
              </div>
            } />
        </div>

        {/* quick-mark toolbar — highlight cells/names, bold & resize text */}
        <div className={`mx-5 mb-2.5 flex flex-wrap items-center gap-2 border px-3 py-2 transition-all ${markColor ? 'border-gold-400/40 bg-gold-400/[0.05]' : 'border-white/[0.07] bg-white/[0.02]'}`}>
          <span className="inline-flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-500">
            <Highlighter size={12} className="text-gold-400" /> Marker
          </span>
          {MARK_COLORS.map((c) => (
            <button
              key={c.name}
              onClick={() => setMarkColor((cur) => (cur === c.name ? null : c.name))}
              title={`${c.name} marker ${markColor === c.name ? '(armed — click cells or names to mark)' : ''}`}
              className={`w-5 h-5 border transition-all ${markColor === c.name ? 'border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.25)]' : 'border-white/25 hover:border-white/60'}`}
              style={{ background: c.swatch }}
            />
          ))}
          <button
            onClick={clearMarks}
            title="Clear all marks"
            className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-rose-300 hover:bg-white/[0.06] transition-all"
          >
            <Eraser size={13} />
          </button>
          <span className="h-5 w-px bg-white/[0.09]" />
          <button
            onClick={() => setCellBold((b) => !b)}
            title="Bold cell text"
            className={`w-7 h-7 flex items-center justify-center border transition-all ${cellBold ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-300' : 'border-white/[0.1] text-slate-400 hover:text-white'}`}
          >
            <Bold size={13} />
          </button>
          <button
            onClick={() => setCellSizeIdx((i) => (i + 1) % CELL_SIZES.length)}
            title="Increase cell text size"
            className={`h-7 px-2 flex items-center gap-1.5 border transition-all ${cellSizeIdx > 0 ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-300' : 'border-white/[0.1] text-slate-400 hover:text-white'}`}
          >
            <ALargeSmall size={14} />
            <span className="text-[10px] font-bold tabular">{CELL_SIZES[cellSizeIdx]}px</span>
          </button>
          <span className="ml-auto text-[10px] font-semibold text-slate-500">
            {markColor ? 'Marker armed — click day cells or employee names to mark' : `${Object.keys(marks).length} marked`}
          </span>
        </div>
        <style>{`.ts-cell input, .ts-cell select { font-size: ${CELL_SIZES[cellSizeIdx]}px !important; font-weight: ${cellBold ? 800 : 600} !important; }`}</style>

        {loading ? <Spinner label="Loading register…" /> : !rows || rows.length === 0 ? (
          <EmptyState icon={CalendarClock} title="No register rows" sub="No timesheet entries found for this worksite and period." />
        ) : (
          <div className="overflow-auto max-h-[62vh] pb-3 relative">
            <table className="border-collapse" style={{ minWidth: 340 + periodDays * 34 + 460 }}>
              <thead>
                <tr className="text-[9px] font-bold uppercase tracking-wider text-slate-600">
                  <th className={`sticky top-0 bg-[#111c30] px-4 py-2 text-left border-b border-white/[0.08] min-w-[210px] ${holdRows ? 'left-0 z-50' : 'z-30'}`}>Employee</th>
                  <th className="sticky top-0 z-30 bg-[#111c30] px-2 py-2 border-b border-white/[0.08] min-w-[86px] text-left">Format</th>
                  {Array.from({ length: periodDays }).map((_, i) => {
                    const isFriday = rules.fridayHighlight && new Date(year, month - 1, i + 1).getDay() === 5;
                    return (
                      <th key={i} className={`sticky top-0 z-30 bg-[#111c30] py-2 border-b border-r border-white/[0.06] text-center w-[34px] ${isFriday ? 'text-gold-400/90' : ''}`}>
                        {i + 1}
                      </th>
                    );
                  })}
                  <th className="sticky top-0 z-30 bg-[#111c30] px-2 py-2 border-b border-l border-white/[0.08] text-center min-w-[58px]">Present</th>
                  <th className="sticky top-0 z-30 bg-[#111c30] px-2 py-2 border-b border-white/[0.08] text-center min-w-[54px]">Absent</th>
                  <th className="sticky top-0 z-30 bg-[#111c30] px-2 py-2 border-b border-white/[0.08] text-center min-w-[58px]">Hours</th>
                  <th className="sticky top-0 z-30 bg-[#111c30] px-2 py-2 border-b border-white/[0.08] text-center min-w-[52px]">OT (h)</th>
                  <th className="sticky top-0 z-30 bg-[#111c30] px-2 py-2 border-b border-white/[0.08] text-center min-w-[96px]">Deductions (SAR)</th>
                  <th className="sticky top-0 z-30 bg-[#111c30] px-2 py-2 border-b border-white/[0.08] text-right min-w-[96px]">Net Pay</th>
                  <th className="sticky top-0 z-30 bg-[#111c30] px-2 py-2 border-b border-white/[0.08] text-center min-w-[86px]">Status</th>
                  <th className="sticky top-0 z-30 bg-[#111c30] px-2 py-2 border-b border-white/[0.08] text-center min-w-[52px]">Save</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const emp = row.employees;
                  const isDirty = !!dirty[row.id];
                  const saveState = saving[row.id];
                  const isFlagged = rules.rowFlags && flaggedRows.has(row.id);
                  return (
                    <tr key={row.id} id={`ts-row-${row.id}`}
                      className={`hover:bg-white/[0.02] transition-colors ${highlightRow === row.id ? 'bg-rose-400/[0.10] outline outline-1 outline-rose-400/50' : isFlagged ? 'bg-rose-400/[0.03]' : ''}`}>
                      <td
                        className={`px-4 py-1.5 border-b border-r border-white/[0.06] ${marks[`${row.id}-name`] ? '' : 'bg-[#111c30]'} ${holdRows ? 'sticky left-0 z-10' : ''} ${markColor ? 'cursor-crosshair' : ''}`}
                        style={marks[`${row.id}-name`] ? { background: MARK_COLORS.find((c) => c.name === marks[`${row.id}-name`])?.bg } : undefined}
                        onMouseDown={(e) => {
                          if (!markColor) return;
                          e.preventDefault();
                          toggleMark(`${row.id}-name`);
                        }}
                      >
                        <div className="flex items-center gap-2.5">
                          <Avatar name={emp?.name || '?'} size={26} />
                          <div className="min-w-0">
                            <p className="text-[11.5px] font-bold text-slate-200 truncate max-w-[130px] flex items-center gap-1.5">
                              {emp?.name}
                              {isFlagged && <Flag size={10} className="text-rose-400 shrink-0" />}
                            </p>
                            <p className="text-[9px] text-slate-600 font-semibold">{emp?.emp_no}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 border-b border-r border-white/[0.045]">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">{emp?.worksites?.timesheet_format || '—'}</span>
                      </td>
                      {Array.from({ length: periodDays }).map((_, i) => renderCell(row, i))}
                      <td className="px-2 py-1.5 border-b border-l border-white/[0.06] text-center text-[11.5px] font-bold text-emerald-300 tabular">{row.present_days}</td>
                      <td className={`px-2 py-1.5 border-b border-white/[0.045] text-center text-[11.5px] font-bold tabular ${row.absent_days > 0 ? 'text-rose-300' : 'text-slate-600'}`}>{row.absent_days}</td>
                      <td className="px-2 py-1.5 border-b border-white/[0.045] text-center text-[11.5px] font-semibold text-sky-300 tabular">{row.total_hours}</td>
                      <td className="px-2 py-1.5 border-b border-white/[0.045] text-center text-[11.5px] font-semibold text-amber-300 tabular">{row.overtime_hours}</td>
                      <td className="px-1 py-1 border-b border-white/[0.045]">
                        <input
                          type="number" min={0}
                          value={dirty[row.id]?.deductions ?? row.deductions ?? 0}
                          onChange={(e) => setDeductions(row, Math.max(0, Number(e.target.value) || 0))}
                          className="w-full bg-white/[0.04] border border-white/[0.07] rounded-md px-1.5 py-1 text-[11px] font-semibold text-rose-200 text-center outline-none focus:border-rose-400/40"
                        />
                      </td>
                      <td className="px-2 py-1.5 border-b border-white/[0.045] text-right font-display text-[12.5px] font-bold text-gold-300 tabular">{fmtSAR(row.net_pay)}</td>
                      <td className="px-2 py-1.5 border-b border-white/[0.045] text-center">
                        <Badge tone={STATUS_TONE[row.status] || 'zinc'} dot={false} className="!px-2 !py-[2px] !text-[9px]">{row.status}</Badge>
                      </td>
                      <td className="px-2 py-1.5 border-b border-white/[0.045] text-center">
                        {saveState === 'saving' ? (
                          <Loader2 size={14} className="animate-spin text-emerald-400 mx-auto" />
                        ) : saveState === 'saved' ? (
                          <CheckCircle2 size={14} className="text-emerald-400 mx-auto" />
                        ) : isDirty ? (
                          <button onClick={() => saveRow(row)} className="w-7 h-7 rounded-lg bg-emerald-400/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 hover:bg-emerald-400/30 transition-all mx-auto" title="Save row">
                            <Save size={13} />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
