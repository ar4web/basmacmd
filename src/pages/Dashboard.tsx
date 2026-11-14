import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users, UserCheck, Building2, Wallet, Banknote, Gauge, Fingerprint, HeartPulse,
  TrendingUp, PieChart as PieIcon, BarChart3, ShieldAlert, UserX, Receipt, FilterX,
  ArrowUpRight, AlertTriangle, CircleDollarSign, Trophy, ChevronUp, ChevronDown,
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { useApi } from '../lib/api';
import type { DashboardData } from '../lib/types';
import { fmtSAR, fmtNum, fmtDate, daysLeftLabel, docTone, MONTHS_SHORT } from '../lib/format';
import { Card, SectionTitle, Badge, Skeleton, ErrorState, ProgressBar, Avatar } from '../components/ui/primitives';
import CountUp from '../components/ui/CountUp';
import Sparkline from '../components/ui/Sparkline';
import { ChartTooltip, ChartGradients, PALETTE, sarCompact } from '../components/charts/ChartKit';

/* ================= KPI CARD ================= */
function KpiCard({ icon: Icon, label, value, format, sub, tone, spark, sparkColor, delay }: {
  icon: React.ElementType; label: string; value: number; format?: (n: number) => string;
  sub?: React.ReactNode; tone: string; spark?: number[]; sparkColor?: string; delay: number;
}) {
  const tones: Record<string, string> = {
    emerald: 'from-emerald-500/20 to-transparent text-emerald-300 border-emerald-400/20',
    gold: 'from-gold-500/20 to-transparent text-gold-300 border-gold-400/25',
    rose: 'from-rose-500/20 to-transparent text-rose-300 border-rose-400/20',
    sky: 'from-sky-500/20 to-transparent text-sky-300 border-sky-400/20',
    violet: 'from-violet-500/20 to-transparent text-violet-300 border-violet-400/20',
    amber: 'from-amber-500/20 to-transparent text-amber-300 border-amber-400/20',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card hover className="p-4 h-full">
        <div className="flex items-start justify-between gap-2">
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br border flex items-center justify-center shrink-0 ${tones[tone]}`}>
            <Icon size={16} strokeWidth={2.2} />
          </div>
          {spark && spark.length > 1 && <Sparkline data={spark} stroke={sparkColor || '#34d399'} id={`kpi-${label.replace(/\W/g, '')}`} width={76} height={26} />}
        </div>
        <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <p className="font-display text-[22px] lg:text-[24px] font-bold text-white mt-1 tabular leading-none">
          <CountUp value={value} format={format} duration={1.1} />
        </p>
        {sub && <div className="mt-2 text-[11px] font-semibold text-slate-500 leading-snug">{sub}</div>}
      </Card>
    </motion.div>
  );
}

/* ================= MAIN ================= */
export default function Dashboard() {
  const { year, month, setPeriod, worksite, nationality, status, setWorksite, setNationality, setStatus, resetFilters, settings } = useApp();
  const url = `/api/dashboard?year=${year}&month=${month}&worksite=${encodeURIComponent(worksite)}&nationality=${encodeURIComponent(nationality)}&status=${encodeURIComponent(status)}`;
  const { data, loading, error, refetch } = useApi<DashboardData>(url, [url]);
  const [compTab, setCompTab] = useState<'iqama' | 'insurance'>('iqama');
  const [rankSort, setRankSort] = useState<{ key: string; dir: 1 | -1 }>({ key: 'payroll', dir: -1 });

  const RANK_COLS: { key: string; label: string; money?: boolean }[] = [
    { key: 'name', label: 'Worksite' },
    { key: 'headcount', label: 'Headcount' },
    { key: 'active', label: 'Active' },
    { key: 'salaryPool', label: 'Salary Pool', money: true },
    { key: 'payroll', label: 'Payroll (Period)', money: true },
    { key: 'avgCost', label: 'Avg / Employee', money: true },
    { key: 'absences', label: 'Absences' },
    { key: 'attendance', label: 'Attendance' },
    { key: 'iqamaDue', label: 'IQAMA Due' },
    { key: 'costShare', label: 'Cost Share' },
  ];

  const filtersActive = worksite !== 'All' || nationality !== 'All' || status !== 'All';

  const compData = useMemo(() => {
    if (!data) return { slices: [], pct: 0, total: 0 };
    const c = data.compliance[compTab];
    const total = c.expired + c.critical + c.warning + c.compliant;
    return {
      slices: [
        { name: 'Expired', value: c.expired, color: '#fb7185' },
        { name: '≤ 30 days', value: c.critical, color: '#fbbf24' },
        { name: '≤ 60 days', value: c.warning, color: '#fde047' },
        { name: 'Compliant', value: c.compliant, color: '#34d399' },
      ].filter((s) => s.value > 0),
      raw: c,
      pct: total ? Math.round((c.compliant / total) * 100) : 100,
      total,
    };
  }, [data, compTab]);

  const ranked = useMemo(() => {
    if (!data) return [];
    const rows = [...data.byWorksite];
    rows.sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[rankSort.key];
      const bv = (b as unknown as Record<string, unknown>)[rankSort.key];
      const cmp = typeof av === 'string' ? String(av).localeCompare(String(bv)) : Number(av ?? 0) - Number(bv ?? 0);
      return cmp * rankSort.dir;
    });
    return rows;
  }, [data, rankSort]);

  const toggleRankSort = (key: string) => {
    setRankSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'name' ? 1 : -1 }));
  };

  if (error) return <Card className="p-6"><ErrorState message={error} onRetry={refetch} /></Card>;

  const k = data?.kpis;

  return (
    <div className="space-y-5">
      {/* ===== Filter bar ===== */}
      <Card className="p-3.5 flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-2 pr-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400" style={{ animation: 'pulse-dot 2s infinite' }} />
          <select value={month} onChange={(e) => setPeriod(year, Number(e.target.value))} className="sel !py-1.5" title="Reporting month">
            {MONTHS_SHORT.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => setPeriod(Number(e.target.value), month)} className="sel !py-1.5" title="Reporting year">
            {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">· Live</span>
        </div>
        <div className="h-5 w-px bg-white/10 hidden sm:block" />
        <select value={worksite} onChange={(e) => setWorksite(e.target.value)} className="sel">
          <option value="All">All Worksites</option>
          {data?.byWorksite.map((w) => <option key={w.id} value={w.name}>{w.name}</option>)}
        </select>
        <select value={nationality} onChange={(e) => setNationality(e.target.value)} className="sel">
          <option value="All">All Nationalities</option>
          {data?.nationalityMix.map((n) => <option key={n.name} value={n.name}>{n.name}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="sel">
          <option value="All">Any Status</option>
          {['Active', 'On Leave', 'Suspended', 'Terminated'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {filtersActive && (
          <button onClick={resetFilters} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-300 hover:text-rose-200 transition-colors">
            <FilterX size={13} /> Reset
          </button>
        )}
        <p className="ml-auto hidden xl:block text-[10.5px] text-slate-600 font-semibold">Filters drive every KPI, chart and table on this page</p>
      </Card>

      {/* ===== KPI grid ===== */}
      {loading || !k ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[132px]" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard delay={0} icon={Users} tone="emerald" label="Total Workforce" value={k.totalEmployees}
            sub={<span>{k.onLeave} on leave · {k.suspended} suspended</span>} />
          <KpiCard delay={0.05} icon={UserCheck} tone="sky" label="Active Employees" value={k.active}
            sub={<span className="text-emerald-300/90">{k.totalEmployees ? Math.round((k.active / k.totalEmployees) * 100) : 0}% of workforce deployable</span>} />
          <KpiCard delay={0.1} icon={Building2} tone="gold" label="Worksites Live" value={k.worksites}
            sub={<span>Riyadh · Jeddah · Dammam · Khobar · Yanbu</span>} />
          <KpiCard delay={0.15} icon={Wallet} tone="emerald" label="Payroll Cost" value={k.payrollCost}
            format={(n) => fmtSAR(n, { compact: true })} spark={data?.trend.map((t) => t.gross + t.ot)}
            sub={<span>Overtime {fmtSAR(k.overtimePay, { compact: true })} included</span>} />
          <KpiCard delay={0.2} icon={Banknote} tone="gold" label="Net Payable" value={k.netPayable}
            format={(n) => fmtSAR(n, { compact: true })} spark={data?.trend.map((t) => t.net)} sparkColor="#e7b958"
            sub={<span>After {fmtSAR(k.deductions, { compact: true })} deductions</span>} />
          <KpiCard delay={0.25} icon={Gauge} tone={k.attendanceRate >= 92 ? 'emerald' : 'amber'} label="Attendance Rate" value={k.attendanceRate}
            format={(n) => `${n.toFixed(1)}%`}
            sub={<span>{fmtNum(k.absences)} absences · cost {fmtSAR(k.absenceCost, { compact: true })}</span>} />
          <KpiCard delay={0.3} icon={Fingerprint} tone={k.iqamaCritical > 0 ? 'rose' : 'emerald'} label="IQAMA Alerts" value={k.iqamaCritical}
            sub={<span>Expired or expiring ≤ 30 days</span>} />
          <KpiCard delay={0.35} icon={HeartPulse} tone={k.insuranceCritical > 0 ? 'rose' : 'emerald'} label="Insurance Alerts" value={k.insuranceCritical}
            sub={<span>Medical policies ≤ 30 days</span>} />
        </div>
      )}

      {/* ===== Row 2: trend + compliance ===== */}
      <div className="grid grid-cols-12 gap-4">
        <motion.div className="col-span-12 xl:col-span-8" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="p-5 h-full">
            <SectionTitle icon={TrendingUp} title="Financial Pulse" sub={`Net payroll vs operating expenses · ${year}`}
              right={
                <div className="flex items-center gap-4 text-[10.5px] font-bold text-slate-400">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /> Net payroll</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-gold-400" /> Expenses</span>
                </div>
              } />
            {loading || !data ? <Skeleton className="h-[290px]" /> : (
              <ResponsiveContainer width="100%" height={290}>
                <ComposedChart data={data.trend} margin={{ top: 8, right: 6, left: -8, bottom: 0 }}>
                  <ChartGradients />
                  <CartesianGrid strokeDasharray="3 6" stroke="rgba(148,163,184,0.09)" vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} dy={6} />
                  <YAxis tickFormatter={sarCompact} axisLine={false} tickLine={false} width={52} />
                  <Tooltip content={<ChartTooltip formatter={(v) => fmtSAR(v, { compact: true })} />} cursor={{ stroke: 'rgba(148,163,184,0.25)', strokeDasharray: '4 4' }} />
                  <Area type="monotone" dataKey="net" name="Net payroll" stroke="#34d399" strokeWidth={2.5} fill="url(#gEmerald)" dot={false} activeDot={{ r: 4, fill: '#34d399', stroke: '#04070d' }} />
                  <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#e7b958" strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={{ r: 4, fill: '#e7b958', stroke: '#04070d' }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </Card>
        </motion.div>

        <motion.div className="col-span-12 xl:col-span-4" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}>
          <Card className="p-5 h-full">
            <SectionTitle icon={ShieldAlert} tone="gold" title="Compliance Health"
              right={
                <div className="flex rounded-lg bg-white/[0.05] p-0.5 border border-white/[0.07]">
                  {(['iqama', 'insurance'] as const).map((t) => (
                    <button key={t} onClick={() => setCompTab(t)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${compTab === t ? 'bg-emerald-400/20 text-emerald-300' : 'text-slate-500 hover:text-slate-300'}`}>
                      {t === 'iqama' ? 'IQAMA' : 'Insurance'}
                    </button>
                  ))}
                </div>
              } sub="Document validity watch" />
            {loading || !data ? <Skeleton className="h-[240px]" /> : (
              <div className="flex flex-col items-center">
                <div className="relative">
                  <PieChart width={210} height={210}>
                    <Pie data={compData.slices} dataKey="value" innerRadius={74} outerRadius={96} paddingAngle={3}
                      stroke="rgba(4,7,13,0.8)" strokeWidth={2} startAngle={90} endAngle={-270}>
                      {compData.slices.map((s, i) => <Cell key={i} fill={s.color} />)}
                    </Pie>
                  </PieChart>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="font-display text-[30px] font-bold text-white leading-none"><CountUp value={compData.pct} format={(n) => `${Math.round(n)}%`} /></p>
                    <p className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-emerald-400 mt-1.5">Compliant</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-2 w-full px-2">
                  {[
                    { l: 'Expired', v: (compData as { raw?: { expired: number } }).raw?.expired ?? 0, c: '#fb7185' },
                    { l: '≤ 30 days', v: (compData as { raw?: { critical: number } }).raw?.critical ?? 0, c: '#fbbf24' },
                    { l: '≤ 60 days', v: (compData as { raw?: { warning: number } }).raw?.warning ?? 0, c: '#fde047' },
                    { l: 'Compliant', v: (compData as { raw?: { compliant: number } }).raw?.compliant ?? 0, c: '#34d399' },
                  ].map((r) => (
                    <div key={r.l} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.c }} />
                      <span className="text-[11px] font-semibold text-slate-400">{r.l}</span>
                      <span className="ml-auto text-[12px] font-bold text-slate-100 tabular">{r.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* ===== Row 3: worksite / nationality / waterfall ===== */}
      <div className="grid grid-cols-12 gap-4">
        <motion.div className="col-span-12 md:col-span-6 xl:col-span-4" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="p-5 h-full">
            <SectionTitle icon={BarChart3} title="Headcount by Worksite" sub="With period payroll depth" />
            {loading || !data ? <Skeleton className="h-[250px]" /> : (() => {
              const maxHc = Math.max(1, ...data.byWorksite.map((w) => w.headcount));
              const maxPay = Math.max(1, ...data.byWorksite.map((w) => w.payroll));
              return (
                <div className="space-y-3.5 pt-1">
                  {data.byWorksite.map((w, i) => (
                    <div key={w.id}>
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-[11.5px] font-bold text-slate-200 truncate">{w.name}</p>
                        <p className="text-[10.5px] font-bold text-slate-500 tabular shrink-0">
                          <span className="text-emerald-300">{w.headcount} heads</span> · <span className="text-gold-300">{fmtSAR(w.payroll, { compact: true })}</span>
                        </p>
                      </div>
                      <div className="mt-1.5 space-y-1">
                        <div className="h-2 bg-white/[0.05] overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${(w.headcount / maxHc) * 100}%` }}
                            transition={{ duration: 0.8, delay: 0.1 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400" />
                        </div>
                        <div className="h-1 bg-white/[0.05] overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${(w.payroll / maxPay) * 100}%` }}
                            transition={{ duration: 0.8, delay: 0.18 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                            className="h-full bg-gradient-to-r from-gold-600 to-gold-400" />
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-4 pt-1 text-[9.5px] font-bold text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-400" /> Headcount</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-gold-400" /> Period payroll</span>
                  </div>
                </div>
              );
            })()}
          </Card>
        </motion.div>

        <motion.div className="col-span-12 md:col-span-6 xl:col-span-4" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }}>
          <Card className="p-5 h-full">
            <SectionTitle icon={PieIcon} tone="sky" title="Nationality Mix" sub={`${data?.nationalityMix.length || 0} nationalities on register`} />
            {loading || !data ? <Skeleton className="h-[250px]" /> : (() => {
              const mix = data.nationalityMix;
              const total = mix.reduce((a, n) => a + n.value, 0);
              const top = mix.slice(0, 6);
              const rest = mix.slice(6);
              const slices = rest.length ? [...top, { name: 'Other', value: rest.reduce((a, n) => a + n.value, 0) }] : top;
              return (
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    <PieChart width={168} height={188}>
                      <Pie data={slices} dataKey="value" nameKey="name" innerRadius={56} outerRadius={80} paddingAngle={2.5}
                        stroke="rgba(4,7,13,0.8)" strokeWidth={2} startAngle={90} endAngle={-270}>
                        {slices.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <p className="font-display text-[22px] font-bold text-white leading-none tabular"><CountUp value={total} /></p>
                      <p className="text-[8.5px] font-bold uppercase tracking-[0.16em] text-slate-500 mt-1">Headcount</p>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2 min-w-0">
                    {slices.map((n, i) => {
                      const pct = total ? (n.value / total) * 100 : 0;
                      return (
                        <div key={n.name}>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                            <span className="text-[11px] font-semibold text-slate-400 truncate">{n.name}</span>
                            <span className="ml-auto text-[11.5px] font-bold text-slate-100 tabular">{n.value}</span>
                            <span className="text-[10px] font-bold text-slate-500 tabular w-9 text-right">{pct.toFixed(0)}%</span>
                          </div>
                          <div className="mt-1 h-1 bg-white/[0.05] overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.8, delay: 0.1 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                              className="h-full"
                              style={{ background: PALETTE[i % PALETTE.length] }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </Card>
        </motion.div>

        <motion.div className="col-span-12 xl:col-span-4" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}>
          <Card className="p-5 h-full">
            <SectionTitle icon={CircleDollarSign} tone="gold" title="Payroll Waterfall" sub={`${data?.period.label} · gross to net`} />
            {loading || !data ? <Skeleton className="h-[250px]" /> : (() => {
              const wf = data.waterfall;
              const scaleMax = Math.max(1, wf.gross + wf.overtime);
              const H = 150;
              const hpx = (v: number) => Math.max(2, Math.round((v / scaleMax) * H));
              const gH = hpx(wf.gross); const oH = hpx(wf.overtime); const dH = hpx(wf.deductions); const nH = hpx(wf.net);
              const cols = [
                { label: 'Gross', bottom: 0, height: gH, color: '#34d399', value: wf.gross },
                { label: '+ Overtime', bottom: gH, height: oH, color: '#38bdf8', value: wf.overtime },
                { label: '− Deduct.', bottom: gH + oH - dH, height: dH, color: '#fb7185', value: wf.deductions },
                { label: 'Net Pay', bottom: 0, height: nH, color: '#e7b958', value: wf.net },
              ];
              const connectors = [gH, gH + oH, nH];
              return (
                <div className="pt-2">
                  <div className="grid grid-cols-4 gap-6 items-end border-b border-white/[0.08]" style={{ height: H + 34 }}>
                    {cols.map((c, i) => (
                      <div key={c.label} className="relative h-full flex items-end">
                        <div className="relative w-full" style={{ height: H }}>
                          <motion.div
                            initial={{ height: 0, opacity: 0.4 }}
                            animate={{ height: c.height, opacity: 1 }}
                            transition={{ duration: 0.7, delay: 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                            className="absolute w-full"
                            style={{ bottom: c.bottom, background: `linear-gradient(180deg, ${c.color}, ${c.color}99)`, boxShadow: `0 0 18px -6px ${c.color}66` }}
                          />
                          <p className="absolute w-full text-center font-display text-[11px] font-bold tabular" style={{ bottom: c.bottom + c.height + 5, color: c.color }}>
                            {sarCompact(c.value)}
                          </p>
                          {i < 3 && (
                            <div className="absolute border-t border-dashed border-slate-500/50" style={{ bottom: connectors[i], left: '100%', width: 24 }} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-4 gap-6 mt-2">
                    {cols.map((c) => (
                      <p key={c.label} className="text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">{c.label}</p>
                    ))}
                  </div>
                </div>
              );
            })()}
          </Card>
        </motion.div>
      </div>

      {/* ===== Row: Worksite rankings (sortable) ===== */}
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.44 }}>
        <Card className="p-5">
          <SectionTitle icon={Trophy} tone="gold" title="Worksite Rankings"
            sub="Ranked by period payroll · click any column heading to re-rank"
            right={<Badge tone="gold">{data?.byWorksite.length || 0} sites</Badge>} />
          {loading || !data ? <Skeleton className="h-[230px]" /> : (
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full text-left min-w-[1020px]">
                <thead>
                  <tr className="text-[9.5px] font-bold uppercase tracking-[0.13em] text-slate-600 border-b border-white/[0.07]">
                    <th className="pb-2.5 pr-2 w-10">Rank</th>
                    {RANK_COLS.map((c) => {
                      const active = rankSort.key === c.key;
                      return (
                        <th
                          key={c.key}
                          onClick={() => toggleRankSort(c.key)}
                          className={`pb-2.5 pr-2 cursor-pointer select-none whitespace-nowrap transition-colors hover:text-slate-300 ${active ? 'text-emerald-300' : ''} ${c.key === 'name' ? '' : 'text-right'}`}
                        >
                          <span className="inline-flex items-center gap-1">
                            {c.label}
                            {active && (rankSort.dir === -1 ? <ChevronDown size={11} /> : <ChevronUp size={11} />)}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((w, i) => (
                    <tr key={w.id} className="border-b border-white/[0.045] hover:bg-white/[0.025] transition-colors">
                      <td className="py-2.5 pr-2">
                        <span className={`w-7 h-7 inline-flex items-center justify-center text-[11px] font-bold border ${
                          i === 0 ? 'bg-gold-400/15 text-gold-300 border-gold-400/35'
                          : i === 1 ? 'bg-slate-300/10 text-slate-300 border-slate-300/25'
                          : i === 2 ? 'bg-amber-600/15 text-amber-400 border-amber-600/30'
                          : 'bg-white/[0.04] text-slate-500 border-white/[0.08]'
                        }`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="py-2.5 pr-2">
                        <p className="text-[12.5px] font-bold text-slate-100">{w.name}</p>
                        <p className="text-[10px] text-slate-500 font-semibold">{w.city} · {w.format}</p>
                      </td>
                      <td className="py-2.5 pr-2 text-right text-[12.5px] font-bold text-slate-100 tabular">{w.headcount}</td>
                      <td className="py-2.5 pr-2 text-right text-[12.5px] font-bold text-emerald-300 tabular">{w.active}</td>
                      <td className="py-2.5 pr-2 text-right text-[12px] font-semibold text-slate-300 tabular">{fmtSAR(w.salaryPool)}</td>
                      <td className="py-2.5 pr-2 text-right font-display text-[13px] font-bold text-gold-300 tabular">{fmtSAR(w.payroll)}</td>
                      <td className="py-2.5 pr-2 text-right text-[12px] font-semibold text-slate-300 tabular">{fmtSAR(w.avgCost)}</td>
                      <td className={`py-2.5 pr-2 text-right text-[12.5px] font-bold tabular ${w.absences > 0 ? 'text-rose-300' : 'text-slate-600'}`}>{fmtNum(w.absences)}</td>
                      <td className="py-2.5 pr-2 text-right">
                        <span className={`text-[12px] font-bold tabular ${w.attendance >= 92 ? 'text-emerald-300' : w.attendance >= 82 ? 'text-amber-300' : 'text-rose-300'}`}>{w.attendance}%</span>
                      </td>
                      <td className="py-2.5 pr-2 text-right">
                        {w.iqamaDue > 0 ? <Badge tone="amber">{w.iqamaDue}</Badge> : <span className="text-[11px] font-semibold text-slate-600">Clear</span>}
                      </td>
                      <td className="py-2.5 pr-2">
                        <div className="flex items-center justify-end gap-2">
                          <ProgressBar value={w.costShare} tone="gold" className="w-16" />
                          <span className="text-[11.5px] font-bold text-slate-300 tabular w-11 text-right">{w.costShare}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </motion.div>

      {/* ===== Row 4: watchlist / absentees / expenses ===== */}
      <div className="grid grid-cols-12 gap-4">
        <motion.div className="col-span-12 xl:col-span-7" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.46 }}>
          <Card className="p-5 h-full">
            <SectionTitle icon={AlertTriangle} tone="rose" title="Compliance Watchlist" sub="Documents requiring action — earliest first"
              right={<Badge tone={data && data.watchlistTotal > 0 ? 'rose' : 'emerald'}>{data?.watchlistTotal ?? 0} open</Badge>} />
            {loading || !data ? <Skeleton className="h-[260px]" /> : data.watchlist.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-12">No documents expiring within 60 days — fully compliant.</p>
            ) : (
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-600 border-b border-white/[0.06]">
                      <th className="pb-2.5 font-bold">Employee</th>
                      <th className="pb-2.5 font-bold">Document</th>
                      <th className="pb-2.5 font-bold">Worksite</th>
                      <th className="pb-2.5 font-bold">Expiry</th>
                      <th className="pb-2.5 font-bold text-right">Window</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.watchlist.slice(0, 7).map((w, i) => {
                      const tone = docTone(w.expiry);
                      return (
                        <tr key={`${w.id}-${w.doc}-${i}`} className="border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors">
                          <td className="py-2.5 pr-2">
                            <div className="flex items-center gap-2.5">
                              <Avatar name={w.name} size={26} />
                              <div className="min-w-0">
                                <p className="text-[12px] font-bold text-slate-200 truncate">{w.name}</p>
                                <p className="text-[9.5px] text-slate-500 font-semibold">{w.emp_no}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 pr-2">
                            <Badge tone={w.doc === 'IQAMA' ? 'sky' : 'violet'}>{w.doc}</Badge>
                          </td>
                          <td className="py-2.5 pr-2 text-[11px] font-semibold text-slate-400">{w.worksite}</td>
                          <td className="py-2.5 pr-2 text-[11.5px] font-bold text-slate-300 tabular">{fmtDate(w.expiry)}</td>
                          <td className="py-2.5 text-right">
                            <Badge tone={tone === 'expired' ? 'rose' : tone === 'critical' ? 'amber' : 'gold'}>
                              {daysLeftLabel(w.expiry)}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div className="col-span-12 md:col-span-6 xl:col-span-5" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.52 }}>
          <Card className="p-5 h-full">
            <SectionTitle icon={UserX} tone="amber" title="Absence Watch" sub={`Highest absence counts · ${data?.period.label || ''}`} />
            {loading || !data ? <Skeleton className="h-[220px]" /> : (
              <div className="space-y-3">
                {data.topAbsentees.map((a, i) => (
                  <div key={a.id} className="flex items-center gap-3">
                    <span className="font-display text-[11px] font-bold text-slate-600 w-4">{String(i + 1).padStart(2, '0')}</span>
                    <Avatar name={a.name} size={28} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-[12px] font-bold text-slate-200 truncate">{a.name}</p>
                        <p className="text-[11px] font-bold text-amber-300 tabular shrink-0">{a.absences}d absent</p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <ProgressBar value={a.attendance} tone={a.attendance >= 90 ? 'emerald' : a.attendance >= 75 ? 'amber' : 'rose'} className="flex-1" />
                        <span className="text-[10px] font-bold text-slate-500 tabular w-10 text-right">{a.attendance}%</span>
                      </div>
                    </div>
                  </div>
                ))}
                {data.topAbsentees.length === 0 && <p className="text-xs text-slate-500 text-center py-10">Zero absences this period — outstanding discipline.</p>}
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div className="col-span-12 md:col-span-6 xl:col-span-12" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.56 }}>
          <Card className="p-5">
            <SectionTitle icon={Receipt} tone="gold" title="Expense Footprint" sub={`${data?.period.label} spend by category · budget ${fmtSAR(k?.budget || 0, { compact: true })} / mo`}
              right={
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Budget used</p>
                    <p className={`font-display text-[16px] font-bold tabular ${(k?.budgetUtil || 0) > 90 ? 'text-rose-300' : 'text-emerald-300'}`}>{k?.budgetUtil || 0}%</p>
                  </div>
                  <ArrowUpRight size={16} className="text-slate-600" />
                </div>
              } />
            {loading || !data ? <Skeleton className="h-[120px]" /> : (
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
                {data.expenseByCategory.slice(0, 6).map((c, i) => {
                  const max = data.expenseByCategory[0]?.value || 1;
                  return (
                    <div key={c.name} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PALETTE[(i + 1) % PALETTE.length] }} />
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">{c.name}</p>
                      </div>
                      <p className="font-display text-[16px] font-bold text-white mt-2 tabular">{fmtSAR(c.value, { compact: true })}</p>
                      <ProgressBar value={c.value} max={max} tone="gold" className="mt-2.5" />
                    </div>
                  );
                })}
                {data.expenseByCategory.length === 0 && <p className="text-xs text-slate-500 py-8 col-span-6 text-center">No expenses logged for this period.</p>}
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* status strip */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-1 pb-2">
        {[
          ['Register rows', fmtNum(k?.registerCount || 0)],
          ['Currency', settings.currency || 'SAR'],
          ['Entity', settings.company_name || 'Basmat'],
          ['YTD expenses', fmtSAR(k?.expenseYtd || 0, { compact: true })],
          ['Pending approvals', fmtNum(k?.pendingExpenses || 0)],
        ].map(([l, v]) => (
          <span key={l as string} className="text-[10.5px] font-semibold text-slate-600">
            <span className="uppercase tracking-[0.14em] text-slate-700 font-bold">{l}:</span>{' '}
            <span className="text-slate-400">{v}</span>
          </span>
        ))}
        {k && k.iqamaCritical + k.insuranceCritical > 0 && (
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-amber-300">
            <AlertTriangle size={12} /> {k.iqamaCritical + k.insuranceCritical} documents need renewal action
          </span>
        )}
      </div>

      <style>{`
        .sel {
          appearance: none;
          -webkit-appearance: none;
          background-color: rgba(255,255,255,0.04);
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237d8aa0' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 9px center;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          padding: 8px 26px 8px 10px;
          font-size: 11.5px;
          font-weight: 700;
          color: #cbd5e1;
          outline: none;
          cursor: pointer;
        }
        .sel:focus { border-color: rgba(16,185,129,0.4); }
        .sel > option { background: #18253d; color: #e2e8f0; }
      `}</style>
    </div>
  );
}
