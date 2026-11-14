import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet, Banknote, TrendingDown, TrendingUp, CheckCheck, BadgeDollarSign, Eye,
  Search, FileText, Landmark,
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { apiGet, apiSend, useApi } from '../lib/api';
import type { TimesheetRow, DashboardData } from '../lib/types';
import { fmtSAR, MONTHS, MONTHS_SHORT, STATUS_TONE, fmtDate } from '../lib/format';
import { Card, SectionTitle, Badge, Button, Spinner, EmptyState, ErrorState, Avatar, Skeleton, Drawer } from '../components/ui/primitives';
import CountUp from '../components/ui/CountUp';
import { ChartTooltip, ChartGradients, sarCompact } from '../components/charts/ChartKit';

function Stat({ label, value, tone = 'text-white', icon: Icon, iconCls }: {
  label: string; value: number; tone?: string; icon: React.ElementType; iconCls: string;
}) {
  return (
    <Card hover className="p-4 flex items-center gap-3.5">
      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${iconCls}`}>
        <Icon size={17} strokeWidth={2.2} />
      </div>
      <div className="min-w-0">
        <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <p className={`font-display text-[19px] font-bold tabular leading-tight ${tone}`}>
          <CountUp value={value} format={(n) => fmtSAR(n, { compact: true })} />
        </p>
      </div>
    </Card>
  );
}

export default function Payroll() {
  const { year, month, toast } = useApp();
  const [rows, setRows] = useState<TimesheetRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [payslip, setPayslip] = useState<TimesheetRow | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const dash = useApi<DashboardData>(`/api/dashboard?year=${year}&month=${month}`, [year, month]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<TimesheetRow[]>(`/api/timesheets?year=${year}&month=${month}`);
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [year, month]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const n = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (n && !r.employees?.name.toLowerCase().includes(n)) return false;
      if (statusFilter !== 'All' && r.status !== statusFilter) return false;
      return true;
    });
  }, [rows, search, statusFilter]);

  const sums = useMemo(() => ({
    gross: filtered.reduce((a, r) => a + (r.gross_pay || 0), 0),
    ot: filtered.reduce((a, r) => a + (r.overtime_pay || 0), 0),
    ded: filtered.reduce((a, r) => a + (r.deductions || 0), 0),
    net: filtered.reduce((a, r) => a + (r.net_pay || 0), 0),
    drafts: filtered.filter((r) => r.status === 'Draft').length,
    approved: filtered.filter((r) => r.status === 'Approved').length,
    paid: filtered.filter((r) => r.status === 'Paid').length,
  }), [filtered]);

  const setStatus = async (row: TimesheetRow, status: string) => {
    try {
      await apiSend('/api/timesheets', 'PUT', { id: row.id, status });
      setRows((rs) => rs ? rs.map((r) => (r.id === row.id ? { ...r, status } : r)) : rs);
      toast(`${row.employees?.name} → ${status}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed', 'error');
    }
  };

  const bulkSet = async (from: string, to: string) => {
    const ids = (rows || []).filter((r) => r.status === from).map((r) => r.id);
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      await apiSend('/api/timesheets', 'PUT', { ids, status: to });
      toast(`${ids.length} payslips moved to ${to}`);
      await load();
      dash.refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bulk update failed', 'error');
    } finally {
      setBulkBusy(false);
    }
  };

  if (error) return <Card className="p-6"><ErrorState message={error} onRetry={load} /></Card>;

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Stat label="Gross Payroll" value={sums.gross} icon={Wallet} iconCls="bg-emerald-500/15 text-emerald-300 border-emerald-400/20" />
        <Stat label="Overtime" value={sums.ot} icon={TrendingUp} iconCls="bg-sky-500/15 text-sky-300 border-sky-400/20" />
        <Stat label="Deductions" value={sums.ded} icon={TrendingDown} iconCls="bg-rose-500/15 text-rose-300 border-rose-400/20" />
        <Stat label="Net Payable" value={sums.net} icon={Banknote} iconCls="bg-gold-500/15 text-gold-300 border-gold-400/25" tone="text-gold-300" />
        <Card hover className="p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl border bg-violet-500/15 text-violet-300 border-violet-400/20 flex items-center justify-center shrink-0"><FileText size={17} /></div>
          <div>
            <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-500">On Register</p>
            <p className="font-display text-[19px] font-bold text-white tabular leading-tight"><CountUp value={filtered.length} /></p>
          </div>
        </Card>
        <Card hover className="p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl border bg-amber-500/15 text-amber-300 border-amber-400/20 flex items-center justify-center shrink-0"><BadgeDollarSign size={17} /></div>
          <div>
            <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-500">Avg Net / Employee</p>
            <p className="font-display text-[19px] font-bold text-white tabular leading-tight"><CountUp value={filtered.length ? sums.net / filtered.length : 0} format={(n) => fmtSAR(n, { compact: true })} /></p>
          </div>
        </Card>
      </div>

      {/* history chart */}
      <Card className="p-5">
        <SectionTitle icon={Landmark} tone="gold" title={`Payroll History · ${year}`} sub="Net disbursement and register headcount month by month"
          right={<div className="flex items-center gap-2 text-[10.5px] font-bold text-slate-400"><span className="w-2.5 h-2.5 rounded-sm bg-gold-400" /> Net pay<span className="w-2.5 h-2.5 rounded-full bg-sky-400 ml-2" /> Headcount</div>} />
        {dash.loading || !dash.data ? <Skeleton className="h-[220px]" /> : (
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={dash.data.trend} margin={{ top: 6, right: 4, left: -6, bottom: 0 }}>
              <ChartGradients />
              <CartesianGrid strokeDasharray="3 6" stroke="rgba(148,163,184,0.09)" vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} dy={6} />
              <YAxis yAxisId="l" tickFormatter={sarCompact} axisLine={false} tickLine={false} width={48} />
              <YAxis yAxisId="r" orientation="right" axisLine={false} tickLine={false} width={36} />
              <Tooltip content={<ChartTooltip formatter={(v) => fmtSAR(v, { compact: true })} />} cursor={{ fill: 'rgba(148,163,184,0.05)' }} />
              <Bar yAxisId="l" dataKey="net" name="Net pay" fill="url(#gBarGold)" radius={[5, 5, 0, 0]} barSize={22} />
              <Line yAxisId="r" type="monotone" dataKey="headcount" name="Headcount" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3, fill: '#38bdf8', strokeWidth: 0 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* register */}
      <Card className="overflow-hidden">
        <div className="px-5 pt-4 pb-1 flex flex-wrap items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-500/25 to-transparent border border-gold-400/25 flex items-center justify-center text-gold-300">
            <Banknote size={16} />
          </div>
          <div>
            <h3 className="font-display text-[15px] font-bold text-white">Salary Register — {MONTHS[month - 1]} {year}</h3>
            <p className="text-[10.5px] text-slate-500 font-semibold">WPS disbursement period · approve then pay</p>
          </div>
          <Badge tone="gold" className="ml-auto">{MONTHS_SHORT[month - 1]}-{String(year).slice(2)}</Badge>
        </div>
        <div className="p-3.5 flex flex-wrap items-center gap-2.5 border-b border-white/[0.06]">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee…"
              className="rounded-xl bg-white/[0.04] border border-white/[0.08] pl-8 pr-3 py-2 text-[12px] font-medium text-slate-200 placeholder:text-slate-600 outline-none focus:border-emerald-400/40 w-[190px]" />
          </div>
          <div className="flex rounded-xl bg-white/[0.04] border border-white/[0.08] p-0.5 gap-0.5">
            {['All', 'Draft', 'Approved', 'Paid', 'On Hold'].map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${statusFilter === s ? 'bg-emerald-400/20 text-emerald-300' : 'text-slate-500 hover:text-slate-300'}`}>
                {s}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" icon={CheckCheck} disabled={sums.drafts === 0} loading={bulkBusy} onClick={() => bulkSet('Draft', 'Approved')}>
              Approve {sums.drafts > 0 ? `${sums.drafts} drafts` : 'drafts'}
            </Button>
            <Button variant="gold" size="sm" icon={BadgeDollarSign} disabled={sums.approved === 0} loading={bulkBusy} onClick={() => bulkSet('Approved', 'Paid')}>
              Disburse {sums.approved > 0 ? `${sums.approved} approved` : 'approved'}
            </Button>
          </div>
        </div>

        {loading ? <Spinner label="Loading payroll register…" /> : filtered.length === 0 ? (
          <EmptyState icon={Wallet} title="No payslips" sub="No register rows match this period and filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[1080px]">
              <thead>
                <tr className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-600 border-b border-white/[0.07] bg-white/[0.015]">
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-3 py-3">Worksite</th>
                  <th className="px-3 py-3 text-center">Paid Days</th>
                  <th className="px-3 py-3 text-center">Absences</th>
                  <th className="px-3 py-3 text-right">Gross</th>
                  <th className="px-3 py-3 text-right">Overtime</th>
                  <th className="px-3 py-3 text-right">Deductions</th>
                  <th className="px-3 py-3 text-right">Net Pay</th>
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.012, 0.3) }}
                    className="border-b border-white/[0.045] hover:bg-white/[0.025] transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.employees?.name || '?'} size={30} />
                        <div>
                          <p className="text-[12.5px] font-bold text-slate-100">{r.employees?.name}</p>
                          <p className="text-[9.5px] text-slate-500 font-semibold">{r.employees?.emp_no}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[11.5px] font-semibold text-slate-400">{r.employees?.worksites?.name}</td>
                    <td className="px-3 py-3 text-center text-[12px] font-bold text-emerald-300 tabular">{r.paid_days}</td>
                    <td className={`px-3 py-3 text-center text-[12px] font-bold tabular ${r.absent_days > 0 ? 'text-rose-300' : 'text-slate-600'}`}>{r.absent_days}</td>
                    <td className="px-3 py-3 text-right text-[12.5px] font-semibold text-slate-200 tabular">{fmtSAR(r.gross_pay)}</td>
                    <td className="px-3 py-3 text-right text-[12.5px] font-semibold text-sky-300 tabular">{fmtSAR(r.overtime_pay)}</td>
                    <td className="px-3 py-3 text-right text-[12.5px] font-semibold text-rose-300 tabular">{r.deductions > 0 ? `−${fmtSAR(r.deductions)}` : '—'}</td>
                    <td className="px-3 py-3 text-right font-display text-[13.5px] font-bold text-gold-300 tabular">{fmtSAR(r.net_pay)}</td>
                    <td className="px-3 py-3 text-center"><Badge tone={STATUS_TONE[r.status] || 'zinc'}>{r.status}</Badge></td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => setPayslip(r)} className="w-8 h-8 rounded-lg hover:bg-white/[0.07] flex items-center justify-center text-slate-500 hover:text-sky-300 transition-colors" title="Payslip"><Eye size={14} /></button>
                        {r.status === 'Draft' && <Button size="xs" variant="outline" onClick={() => setStatus(r, 'Approved')}>Approve</Button>}
                        {r.status === 'Approved' && <Button size="xs" variant="gold" onClick={() => setStatus(r, 'Paid')}>Pay</Button>}
                        {r.status === 'Paid' && <Badge tone="emerald" dot={false} className="!text-[9px]">Settled</Badge>}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* payslip drawer */}
      <Drawer open={!!payslip} onClose={() => setPayslip(null)} width={440}
        title="Payslip" sub={payslip ? `${MONTHS[payslip.month - 1]} ${payslip.year} · ${payslip.status}` : ''}>
        {payslip && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-gold-400/20 bg-gradient-to-br from-gold-400/[0.07] to-transparent p-4 flex items-center gap-4">
              <Avatar name={payslip.employees?.name || '?'} size={48} />
              <div className="min-w-0">
                <p className="font-display text-[16px] font-bold text-white truncate">{payslip.employees?.name}</p>
                <p className="text-[11px] font-semibold text-slate-400">{payslip.employees?.emp_no} · {payslip.employees?.worksites?.name}</p>
                <p className="text-[10px] font-semibold text-slate-500 mt-0.5">IQAMA {payslip.employees?.iqama} · {payslip.employees?.nationality}</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 mb-2">Earnings</p>
              <div className="space-y-1.5">
                {[
                  [`Base · ${payslip.paid_days} paid days`, payslip.gross_pay],
                  [`Overtime · ${payslip.overtime_hours}h @ 1.5×`, payslip.overtime_pay],
                ].map(([l, v]) => (
                  <div key={l as string} className="flex items-center justify-between rounded-lg bg-emerald-400/[0.05] border border-emerald-400/10 px-3.5 py-2.5">
                    <span className="text-[12px] font-semibold text-slate-300">{l}</span>
                    <span className="text-[13px] font-bold text-emerald-300 tabular">{fmtSAR(v as number)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 mb-2">Deductions</p>
              <div className="flex items-center justify-between rounded-lg bg-rose-400/[0.05] border border-rose-400/10 px-3.5 py-2.5">
                <span className="text-[12px] font-semibold text-slate-300">Advances & adjustments</span>
                <span className="text-[13px] font-bold text-rose-300 tabular">−{fmtSAR(payslip.deductions)}</span>
              </div>
            </div>

            <div className="rounded-2xl bg-gradient-to-br from-emerald-500/15 to-emerald-500/[0.03] border border-emerald-400/25 p-4.5 flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Net Pay</p>
                <p className="text-[10.5px] text-slate-500 mt-0.5">Transfer via {payslip.employees?.bank || 'bank'}</p>
              </div>
              <p className="font-display text-[26px] font-bold text-emerald-300 tabular">{fmtSAR(payslip.net_pay)}</p>
            </div>

            <div className="text-[10.5px] text-slate-600 leading-relaxed border-t border-white/[0.06] pt-3">
              Generated by Basmat on {fmtDate(new Date().toISOString().slice(0, 10))} · WPS-compliant register entry · Ref {payslip.year}{String(payslip.month).padStart(2, '0')}-{payslip.id}
            </div>

            {payslip.status !== 'Paid' && (
              <Button className="w-full" icon={BadgeDollarSign}
                onClick={() => { setStatus(payslip, payslip.status === 'Draft' ? 'Approved' : 'Paid'); setPayslip(null); }}>
                {payslip.status === 'Draft' ? 'Approve Payslip' : 'Mark as Paid'}
              </Button>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
