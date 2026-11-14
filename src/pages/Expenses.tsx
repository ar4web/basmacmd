import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Receipt, Plus, Search, Pencil, Trash2, Check, X, BadgeDollarSign, Wallet,
  Gauge, Hourglass, Fuel, Home, Stamp, Shield, Wrench, Zap, UtensilsCrossed, HardHat, Drill, Briefcase, Wifi, GraduationCap,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { apiGet, apiSend } from '../lib/api';
import type { Expense, Worksite } from '../lib/types';
import { fmtSAR, fmtDate, MONTHS_SHORT, STATUS_TONE } from '../lib/format';
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from '../lib/constants';
import { Card, SectionTitle, Badge, Button, Modal, Input, Select, Field, Spinner, EmptyState, ErrorState, Skeleton } from '../components/ui/primitives';
import CountUp from '../components/ui/CountUp';
import { ChartTooltip, ChartGradients, PALETTE } from '../components/charts/ChartKit';

const CAT_ICONS: Record<string, React.ElementType> = {
  'Fuel & Transport': Fuel, 'Accommodation & Housing': Home, 'Visa & Govt Fees': Stamp,
  'Insurance Premiums': Shield, 'Maintenance & Repairs': Wrench, Utilities: Zap,
  'Catering & Food Supplies': UtensilsCrossed, 'Safety Gear & PPE': HardHat,
  'Equipment & Tools': Drill, 'Office & Admin': Briefcase, 'Telecom & IT': Wifi,
  'Training & Development': GraduationCap,
};

interface ExpForm {
  expense_date: string; category: string; description: string; vendor: string;
  amount: string; worksite_id: string; payment_method: string; status: string;
}

export default function Expenses() {
  const { year, month, toast, settings } = useApp();
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [worksites, setWorksites] = useState<Worksite[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpForm>({ expense_date: '', category: EXPENSE_CATEGORIES[0], description: '', vendor: '', amount: '', worksite_id: '', payment_method: 'Bank Transfer', status: 'Pending' });
  const [formErr, setFormErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const load = async () => {
    try {
      setError(null);
      const [exps, wss] = await Promise.all([
        apiGet<Expense[]>('/api/expenses'),
        apiGet<Worksite[]>('/api/worksites'),
      ]);
      setExpenses(exps);
      setWorksites(wss);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  };

  useEffect(() => { load(); }, []);

  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const monthRows = useMemo(() => (expenses || []).filter((e) => e.expense_date.startsWith(monthKey)), [expenses, monthKey]);

  const monthTotal = monthRows.filter((e) => e.status !== 'Rejected').reduce((a, e) => a + Number(e.amount), 0);
  const budget = Number(settings.monthly_expense_budget) || 0;
  const util = budget > 0 ? (monthTotal / budget) * 100 : 0;
  const pendingCount = monthRows.filter((e) => e.status === 'Pending').length;
  const ytd = (expenses || []).filter((e) => e.expense_date.startsWith(String(year)) && e.status !== 'Rejected').reduce((a, e) => a + Number(e.amount), 0);

  const trend = useMemo(() => {
    const out: { label: string; total: number; current: boolean }[] = [];
    for (let m = 1; m <= 12; m++) {
      const k = `${year}-${String(m).padStart(2, '0')}`;
      out.push({
        label: MONTHS_SHORT[m - 1],
        total: Math.round((expenses || []).filter((e) => e.expense_date.startsWith(k) && e.status !== 'Rejected').reduce((a, e) => a + Number(e.amount), 0)),
        current: m === month,
      });
    }
    return out;
  }, [expenses, year, month]);

  const byCat = useMemo(() => {
    const map: Record<string, number> = {};
    monthRows.filter((e) => e.status !== 'Rejected').forEach((e) => { map[e.category] = (map[e.category] || 0) + Number(e.amount); });
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);
  }, [monthRows]);

  const tableRows = useMemo(() => {
    const n = search.trim().toLowerCase();
    return monthRows.filter((e) => {
      if (catFilter !== 'All' && e.category !== catFilter) return false;
      if (statusFilter !== 'All' && e.status !== statusFilter) return false;
      if (n && !(`${e.description || ''} ${e.vendor || ''} ${e.reference}`.toLowerCase().includes(n))) return false;
      return true;
    });
  }, [monthRows, catFilter, statusFilter, search]);

  const setStatus = async (e: Expense, status: string) => {
    try {
      await apiSend('/api/expenses', 'PUT', { id: e.id, status });
      setExpenses((xs) => xs ? xs.map((x) => (x.id === e.id ? { ...x, status } : x)) : xs);
      toast(`${e.reference} → ${status}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed', 'error');
    }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ expense_date: `${monthKey}-${String(Math.min(28, new Date().getDate())).padStart(2, '0')}`, category: EXPENSE_CATEGORIES[0], description: '', vendor: '', amount: '', worksite_id: '', payment_method: 'Bank Transfer', status: 'Pending' });
    setFormErr({});
    setModalOpen(true);
  };

  const openEdit = (e: Expense) => {
    setEditing(e);
    setForm({
      expense_date: e.expense_date, category: e.category, description: e.description || '',
      vendor: e.vendor || '', amount: String(e.amount), worksite_id: e.worksite_id ? String(e.worksite_id) : '',
      payment_method: e.payment_method || 'Bank Transfer', status: e.status,
    });
    setFormErr({});
    setModalOpen(true);
  };

  const save = async () => {
    const errs: Record<string, string> = {};
    if (!form.expense_date) errs.expense_date = 'Pick a date';
    if (!form.amount || Number(form.amount) <= 0) errs.amount = 'Enter a valid amount';
    if (!form.description.trim()) errs.description = 'Description required';
    setFormErr(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    try {
      const payload = { ...form, amount: Number(form.amount), worksite_id: form.worksite_id ? Number(form.worksite_id) : null };
      if (editing) {
        await apiSend('/api/expenses', 'PUT', { id: editing.id, ...payload });
        toast('Expense updated');
      } else {
        await apiSend('/api/expenses', 'POST', payload);
        toast('Expense logged');
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiSend('/api/expenses', 'DELETE', { id: deleteTarget.id });
      toast(`${deleteTarget.reference} removed`, 'info');
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  if (error) return <Card className="p-6"><ErrorState message={error} onRetry={load} /></Card>;

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <motion.div className="grid grid-cols-2 xl:grid-cols-4 gap-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card hover className="p-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-500/25 to-transparent border border-gold-400/25 flex items-center justify-center text-gold-300"><Wallet size={16} /></div>
          <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Spend · {MONTHS_SHORT[month - 1]} {year}</p>
          <p className="font-display text-[22px] font-bold text-white mt-1 tabular leading-none"><CountUp value={monthTotal} format={(n) => fmtSAR(n, { compact: true })} /></p>
          <p className="mt-1.5 text-[11px] font-semibold text-slate-500">{monthRows.length} transactions logged</p>
        </Card>
        <Card hover className="p-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/25 to-transparent border border-emerald-400/20 flex items-center justify-center text-emerald-300"><Gauge size={16} /></div>
          <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Budget Utilization</p>
          <p className={`font-display text-[22px] font-bold mt-1 tabular leading-none ${util > 95 ? 'text-rose-300' : util > 75 ? 'text-amber-300' : 'text-emerald-300'}`}><CountUp value={util} format={(n) => `${n.toFixed(1)}%`} /></p>
          <div className="mt-2 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, util)}%` }} transition={{ duration: 1 }}
              className={`h-full rounded-full ${util > 95 ? 'bg-gradient-to-r from-rose-500 to-rose-300' : 'bg-gradient-to-r from-emerald-500 to-emerald-300'}`} />
          </div>
          <p className="mt-1.5 text-[11px] font-semibold text-slate-500">of {fmtSAR(budget, { compact: true })} monthly cap</p>
        </Card>
        <Card hover className="p-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500/25 to-transparent border border-sky-400/20 flex items-center justify-center text-sky-300"><Receipt size={16} /></div>
          <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Year-to-Date Spend</p>
          <p className="font-display text-[22px] font-bold text-white mt-1 tabular leading-none"><CountUp value={ytd} format={(n) => fmtSAR(n, { compact: true })} /></p>
          <p className="mt-1.5 text-[11px] font-semibold text-slate-500">across {EXPENSE_CATEGORIES.length} categories</p>
        </Card>
        <Card hover className="p-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/25 to-transparent border border-amber-400/20 flex items-center justify-center text-amber-300"><Hourglass size={16} /></div>
          <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Pending Approvals</p>
          <p className="font-display text-[22px] font-bold text-white mt-1 tabular leading-none"><CountUp value={pendingCount} /></p>
          <p className="mt-1.5 text-[11px] font-semibold text-slate-500">awaiting finance sign-off</p>
        </Card>
      </motion.div>

      {/* charts */}
      <div className="grid grid-cols-12 gap-4">
        <motion.div className="col-span-12 xl:col-span-7" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <Card className="p-5 h-full">
            <SectionTitle icon={Receipt} tone="gold" title={`Spend Trajectory · ${year}`} sub="Approved + paid operating expenses per month" />
            {!expenses ? <Skeleton className="h-[240px]" /> : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={trend} margin={{ top: 8, right: 6, left: -8, bottom: 0 }}>
                  <ChartGradients />
                  <CartesianGrid strokeDasharray="3 6" stroke="rgba(148,163,184,0.09)" vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} dy={6} />
                  <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}K`} axisLine={false} tickLine={false} width={44} />
                  <Tooltip content={<ChartTooltip formatter={(v) => fmtSAR(v)} />} cursor={{ fill: 'rgba(148,163,184,0.05)' }} />
                  <Bar dataKey="total" name="Expenses" radius={[6, 6, 0, 0]} barSize={26}>
                    {trend.map((t, i) => <Cell key={i} fill={t.current ? 'url(#gBarGold)' : 'rgba(212,165,63,0.28)'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </motion.div>

        <motion.div className="col-span-12 xl:col-span-5" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
          <Card className="p-5 h-full">
            <SectionTitle icon={Gauge} title="Category Split" sub={`${MONTHS_SHORT[month - 1]} ${year} · rejected excluded`} />
            {!expenses ? <Skeleton className="h-[240px]" /> : byCat.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-16">No expenses this month.</p>
            ) : (
              <div className="flex items-center gap-3">
                <PieChart width={170} height={220}>
                  <Pie data={byCat.slice(0, 6)} dataKey="value" nameKey="name" innerRadius={56} outerRadius={80} paddingAngle={3} stroke="rgba(4,7,13,0.8)" strokeWidth={2}>
                    {byCat.slice(0, 6).map((_, i) => <Cell key={i} fill={PALETTE[(i + 1) % PALETTE.length]} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip formatter={(v) => fmtSAR(v, { compact: true })} />} />
                </PieChart>
                <div className="flex-1 space-y-2 min-w-0">
                  {byCat.slice(0, 6).map((c, i) => {
                    const IconC = CAT_ICONS[c.name] || Receipt;
                    return (
                      <div key={c.name} className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${PALETTE[(i + 1) % PALETTE.length]}1f`, color: PALETTE[(i + 1) % PALETTE.length] }}>
                          <IconC size={12} />
                        </span>
                        <span className="text-[11px] font-semibold text-slate-400 truncate">{c.name}</span>
                        <span className="ml-auto text-[11.5px] font-bold text-slate-100 tabular">{fmtSAR(c.value, { compact: true })}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* ledger */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="overflow-hidden">
          <div className="p-3.5 flex flex-wrap items-center gap-2.5 border-b border-white/[0.06]">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vendor, description, ref…"
                className="rounded-xl bg-white/[0.04] border border-white/[0.08] pl-8 pr-3 py-2 text-[12px] font-medium text-slate-200 placeholder:text-slate-600 outline-none focus:border-emerald-400/40 w-[230px]" />
            </div>
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="sel">
              <option value="All">All Categories</option>
              {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sel">
              <option value="All">Any Status</option>
              {['Pending', 'Approved', 'Paid', 'Rejected'].map((s) => <option key={s}>{s}</option>)}
            </select>
            <Button className="ml-auto" size="sm" icon={Plus} onClick={openAdd}>Log Expense</Button>
          </div>

          {!expenses ? <Spinner label="Loading ledger…" /> : tableRows.length === 0 ? (
            <EmptyState icon={Receipt} title="No expenses found" sub="Adjust filters or log a new expense for this period." action={<Button size="sm" icon={Plus} onClick={openAdd}>Log Expense</Button>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[1020px]">
                <thead>
                  <tr className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-600 border-b border-white/[0.07] bg-white/[0.015]">
                    <th className="px-5 py-3">Reference</th>
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Category</th>
                    <th className="px-3 py-3">Description / Vendor</th>
                    <th className="px-3 py-3">Worksite</th>
                    <th className="px-3 py-3">Method</th>
                    <th className="px-3 py-3 text-right">Amount</th>
                    <th className="px-3 py-3 text-center">Status</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((e) => {
                    const IconC = CAT_ICONS[e.category] || Receipt;
                    return (
                      <tr key={e.id} className="border-b border-white/[0.045] hover:bg-white/[0.025] transition-colors">
                        <td className="px-5 py-3 text-[11px] font-bold text-slate-500 tabular">{e.reference}</td>
                        <td className="px-3 py-3 text-[11.5px] font-semibold text-slate-400 tabular">{fmtDate(e.expense_date)}</td>
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-300">
                            <IconC size={13} className="text-gold-400" /> {e.category}
                          </span>
                        </td>
                        <td className="px-3 py-3 max-w-[240px]">
                          <p className="text-[12px] font-semibold text-slate-200 truncate">{e.description}</p>
                          <p className="text-[10px] text-slate-500 font-semibold truncate">{e.vendor}</p>
                        </td>
                        <td className="px-3 py-3 text-[11px] font-semibold text-slate-400">{e.worksites?.name || 'Corporate'}</td>
                        <td className="px-3 py-3 text-[11px] font-semibold text-slate-500">{e.payment_method}</td>
                        <td className="px-3 py-3 text-right font-display text-[13px] font-bold text-white tabular">{fmtSAR(e.amount)}</td>
                        <td className="px-3 py-3 text-center"><Badge tone={STATUS_TONE[e.status] || 'zinc'}>{e.status}</Badge></td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {e.status === 'Pending' && (
                              <>
                                <button onClick={() => setStatus(e, 'Approved')} className="w-7 h-7 rounded-lg hover:bg-emerald-400/15 flex items-center justify-center text-slate-500 hover:text-emerald-300 transition-colors" title="Approve"><Check size={13} /></button>
                                <button onClick={() => setStatus(e, 'Rejected')} className="w-7 h-7 rounded-lg hover:bg-rose-400/15 flex items-center justify-center text-slate-500 hover:text-rose-300 transition-colors" title="Reject"><X size={13} /></button>
                              </>
                            )}
                            {e.status === 'Approved' && (
                              <button onClick={() => setStatus(e, 'Paid')} className="w-7 h-7 rounded-lg hover:bg-gold-400/15 flex items-center justify-center text-slate-500 hover:text-gold-300 transition-colors" title="Mark paid"><BadgeDollarSign size={14} /></button>
                            )}
                            <button onClick={() => openEdit(e)} className="w-7 h-7 rounded-lg hover:bg-white/[0.07] flex items-center justify-center text-slate-500 hover:text-sky-300 transition-colors" title="Edit"><Pencil size={13} /></button>
                            <button onClick={() => setDeleteTarget(e)} className="w-7 h-7 rounded-lg hover:bg-white/[0.07] flex items-center justify-center text-slate-500 hover:text-rose-300 transition-colors" title="Delete"><Trash2 size={13} /></button>
                          </div>
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

      {/* add/edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit ${editing.reference}` : 'Log New Expense'} sub="Finance-controlled ledger entry" wide>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Date" error={formErr.expense_date}><Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} /></Field>
          <Field label="Category">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Amount (SAR)" error={formErr.amount}><Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" /></Field>
          <Field label="Vendor"><Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="e.g. Saudi Electricity Co" /></Field>
          <Field label="Description" error={formErr.description} className="sm:col-span-2"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What was this spend for?" /></Field>
          <Field label="Worksite (optional)">
            <Select value={form.worksite_id} onChange={(e) => setForm({ ...form, worksite_id: e.target.value })}>
              <option value="">Corporate / shared</option>
              {worksites.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </Select>
          </Field>
          <Field label="Payment Method">
            <Select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
              {PAYMENT_METHODS.map((p) => <option key={p}>{p}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {['Pending', 'Approved', 'Paid', 'Rejected'].map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-white/[0.06]">
          <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={save} loading={saving}>{editing ? 'Save Changes' : 'Log Expense'}</Button>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Expense" sub={deleteTarget?.reference}>
        <p className="text-[13px] text-slate-400">Delete <span className="font-bold text-slate-200">{deleteTarget?.description}</span> ({fmtSAR(deleteTarget?.amount || 0)})? This cannot be undone.</p>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Keep</Button>
          <Button variant="danger" icon={Trash2} onClick={doDelete}>Delete</Button>
        </div>
      </Modal>

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
