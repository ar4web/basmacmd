import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users, Plus, Search, Pencil, Trash2, Eye, Download, ChevronLeft, ChevronRight,
  Fingerprint, HeartPulse, Landmark, Wallet, BadgeCheck, MapPin, Phone, CalendarDays,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiGet, apiSend } from '../lib/api';
import type { Employee, Worksite, TimesheetRow } from '../lib/types';
import {
  fmtSAR, fmtDate, daysLeftLabel, docTone, STATUS_TONE, MONTHS_SHORT,
} from '../lib/format';
import { NATIONALITIES, BANKS, WORK_STATUSES, TRANSFER_STATUSES, CONTRACT_TYPES, SPONSORS } from '../lib/constants';
import {
  Card, Badge, Button, Modal, Drawer, Input, Select, Field, Spinner, EmptyState, ErrorState, Avatar,
} from '../components/ui/primitives';
import Sparkline from '../components/ui/Sparkline';

const PAGE_SIZE = 12;

interface EmpForm {
  name: string; iqama: string; iqama_expiry: string; birth_date: string;
  worksite_id: string; sponsor: string; transfer_status: string; work_status: string;
  joining_date: string; mobile: string; nationality: string; bank: string; iban: string;
  base_salary: string; contract_type: string; insurance_policy: string; insurance_expiry: string; notes: string;
}

const emptyForm: EmpForm = {
  name: '', iqama: '', iqama_expiry: '', birth_date: '', worksite_id: '', sponsor: SPONSORS[0],
  transfer_status: 'Not Required', work_status: 'Active', joining_date: '', mobile: '',
  nationality: 'Saudi', bank: BANKS[0], iban: '', base_salary: '', contract_type: 'Full Time',
  insurance_policy: '', insurance_expiry: '', notes: '',
};

function empToForm(e: Employee): EmpForm {
  return {
    name: e.name || '', iqama: e.iqama || '', iqama_expiry: e.iqama_expiry || '', birth_date: e.birth_date || '',
    worksite_id: e.worksite_id ? String(e.worksite_id) : '', sponsor: e.sponsor || SPONSORS[0],
    transfer_status: e.transfer_status || 'Not Required', work_status: e.work_status || 'Active',
    joining_date: e.joining_date || '', mobile: e.mobile || '', nationality: e.nationality || 'Saudi',
    bank: e.bank || BANKS[0], iban: e.iban || '', base_salary: String(e.base_salary ?? ''),
    contract_type: e.contract_type || 'Full Time', insurance_policy: e.insurance_policy || '',
    insurance_expiry: e.insurance_expiry || '', notes: e.notes || '',
  };
}

function DocChip({ date, label }: { date: string | null; label: string }) {
  const tone = docTone(date);
  const tones: Record<string, string> = { expired: 'rose', critical: 'amber', warning: 'gold', ok: 'emerald', none: 'zinc' };
  return <Badge tone={tones[tone]} className="!normal-case !tracking-normal !text-[10px]">{label}: {daysLeftLabel(date)}</Badge>;
}

export default function Employees() {
  const { toast, year } = useApp();
  const [params, setParams] = useSearchParams();
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [worksites, setWorksites] = useState<Worksite[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState(params.get('q') || '');
  const [wsFilter, setWsFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [natFilter, setNatFilter] = useState('All');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmpForm>(emptyForm);
  const [formErr, setFormErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [drawerEmp, setDrawerEmp] = useState<Employee | null>(null);
  const [empHistory, setEmpHistory] = useState<TimesheetRow[]>([]);

  const load = async () => {
    try {
      setError(null);
      const [emps, wss] = await Promise.all([
        apiGet<Employee[]>('/api/employees'),
        apiGet<Worksite[]>('/api/worksites'),
      ]);
      setEmployees(emps);
      setWorksites(wss);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const qp = params.get('q');
    if (qp) { setQ(qp); setParams({}, { replace: true }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!drawerEmp) return;
    apiGet<TimesheetRow[]>(`/api/timesheets?employee_id=${drawerEmp.id}&year=${year}&limit=12`)
      .then((rows) => setEmpHistory(rows.sort((a, b) => b.month - a.month).slice(0, 6)))
      .catch(() => setEmpHistory([]));
  }, [drawerEmp, year]);

  const filtered = useMemo(() => {
    if (!employees) return [];
    const needle = q.trim().toLowerCase();
    return employees.filter((e) => {
      if (needle && !(e.name.toLowerCase().includes(needle) || (e.iqama || '').includes(needle) || (e.emp_no || '').toLowerCase().includes(needle))) return false;
      if (wsFilter !== 'All' && e.worksites?.name !== wsFilter) return false;
      if (statusFilter !== 'All' && e.work_status !== statusFilter) return false;
      if (natFilter !== 'All' && e.nationality !== natFilter) return false;
      return true;
    });
  }, [employees, q, wsFilter, statusFilter, natFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setFormErr({}); setModalOpen(true); };
  const openEdit = (e: Employee) => { setEditing(e); setForm(empToForm(e)); setFormErr({}); setModalOpen(true); };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Full name is required';
    if (form.iqama && !/^\d{10}$/.test(form.iqama)) errs.iqama = 'Must be exactly 10 digits';
    if (!form.base_salary || Number(form.base_salary) <= 0) errs.base_salary = 'Enter a valid salary';
    if (!form.worksite_id) errs.worksite_id = 'Assign a worksite';
    setFormErr(errs);
    return Object.keys(errs).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { ...form, base_salary: Number(form.base_salary), worksite_id: form.worksite_id ? Number(form.worksite_id) : null };
      if (editing) {
        await apiSend('/api/employees', 'PUT', { id: editing.id, ...payload });
        toast(`${form.name} updated`);
      } else {
        await apiSend('/api/employees', 'POST', payload);
        toast(`${form.name} added to registry`);
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
    setDeleting(true);
    try {
      await apiSend('/api/employees', 'DELETE', { id: deleteTarget.id });
      toast(`${deleteTarget.name} removed`, 'info');
      setDeleteTarget(null);
      setDrawerEmp(null);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Delete failed', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const exportCsv = () => {
    const rows = [['Emp No', 'Name', 'IQAMA', 'IQAMA Expiry', 'Worksite', 'Nationality', 'Status', 'Base Salary SAR', 'Bank', 'IBAN']];
    filtered.forEach((e) => rows.push([
      e.emp_no, e.name, e.iqama || '', e.iqama_expiry || '', e.worksites?.name || '',
      e.nationality || '', e.work_status, String(e.base_salary), e.bank || '', e.iban || '',
    ]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `basmat-employees-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast(`Exported ${filtered.length} employees`, 'info');
  };

  if (error) return <Card className="p-6"><ErrorState message={error} onRetry={load} /></Card>;

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <Card className="p-3.5 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Search name, IQAMA or employee no…"
            className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] pl-9 pr-3 py-2.5 text-[12.5px] font-medium text-slate-200 placeholder:text-slate-600 outline-none focus:border-emerald-400/40 transition-all"
          />
        </div>
        <select value={wsFilter} onChange={(e) => { setWsFilter(e.target.value); setPage(1); }} className="sel">
          <option value="All">All Worksites</option>
          {worksites.map((w) => <option key={w.id} value={w.name}>{w.name}</option>)}
        </select>
        <select value={natFilter} onChange={(e) => { setNatFilter(e.target.value); setPage(1); }} className="sel">
          <option value="All">All Nationalities</option>
          {NATIONALITIES.map((n) => <option key={n}>{n}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="sel">
          <option value="All">Any Status</option>
          {WORK_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" icon={Download} onClick={exportCsv}>Export</Button>
          <Button size="sm" icon={Plus} onClick={openAdd}>Add Employee</Button>
        </div>
      </Card>

      {/* table */}
      <Card className="overflow-hidden">
        {!employees ? <Spinner label="Loading employee registry…" /> : pageRows.length === 0 ? (
          <EmptyState icon={Users} title="No employees match" sub="Adjust the search or filters, or add a new employee to the registry." action={<Button size="sm" icon={Plus} onClick={openAdd}>Add Employee</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[980px]">
              <thead>
                <tr className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-600 border-b border-white/[0.07] bg-white/[0.015]">
                  <th className="px-5 py-3.5">Employee</th>
                  <th className="px-3 py-3.5">IQAMA</th>
                  <th className="px-3 py-3.5">Worksite</th>
                  <th className="px-3 py-3.5">Nationality</th>
                  <th className="px-3 py-3.5 text-right">Base Salary</th>
                  <th className="px-3 py-3.5">Documents</th>
                  <th className="px-3 py-3.5">Status</th>
                  <th className="px-3 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((e, i) => {
                  const iqTone = docTone(e.iqama_expiry);
                  const inTone = docTone(e.insurance_expiry);
                  return (
                    <motion.tr
                      key={e.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                      className="border-b border-white/[0.045] hover:bg-white/[0.025] transition-colors cursor-pointer"
                      onClick={() => setDrawerEmp(e)}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={e.name} size={34} />
                          <div className="min-w-0">
                            <p className="text-[13px] font-bold text-slate-100 truncate">{e.name}</p>
                            <p className="text-[10px] text-slate-500 font-semibold">{e.emp_no} · {e.contract_type}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-[12px] font-bold text-slate-300 tabular">{e.iqama || '—'}</p>
                        <p className={`text-[10px] font-semibold ${iqTone === 'expired' ? 'text-rose-400' : iqTone === 'critical' ? 'text-amber-300' : 'text-slate-500'}`}>{fmtDate(e.iqama_expiry)}</p>
                      </td>
                      <td className="px-3 py-3 text-[12px] font-semibold text-slate-300">{e.worksites?.name || '—'}</td>
                      <td className="px-3 py-3 text-[12px] font-semibold text-slate-400">{e.nationality}</td>
                      <td className="px-3 py-3 text-right font-display text-[13px] font-bold text-slate-100 tabular">{fmtSAR(e.base_salary)}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <span title={`IQAMA: ${daysLeftLabel(e.iqama_expiry)}`} className={`w-2.5 h-2.5 rounded-full ${iqTone === 'ok' ? 'bg-emerald-400' : iqTone === 'warning' ? 'bg-yellow-300' : iqTone === 'critical' ? 'bg-amber-400' : iqTone === 'expired' ? 'bg-rose-400' : 'bg-slate-600'}`} />
                          <span title={`Insurance: ${daysLeftLabel(e.insurance_expiry)}`} className={`w-2.5 h-2.5 rounded-full ${inTone === 'ok' ? 'bg-emerald-400' : inTone === 'warning' ? 'bg-yellow-300' : inTone === 'critical' ? 'bg-amber-400' : inTone === 'expired' ? 'bg-rose-400' : 'bg-slate-600'}`} />
                        </div>
                      </td>
                      <td className="px-3 py-3"><Badge tone={STATUS_TONE[e.work_status] || 'zinc'}>{e.work_status}</Badge></td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1" onClick={(ev) => ev.stopPropagation()}>
                          <button onClick={() => setDrawerEmp(e)} className="w-8 h-8 rounded-lg hover:bg-white/[0.07] flex items-center justify-center text-slate-500 hover:text-sky-300 transition-colors" title="View profile"><Eye size={14} /></button>
                          <button onClick={() => openEdit(e)} className="w-8 h-8 rounded-lg hover:bg-white/[0.07] flex items-center justify-center text-slate-500 hover:text-emerald-300 transition-colors" title="Edit"><Pencil size={14} /></button>
                          <button onClick={() => setDeleteTarget(e)} className="w-8 h-8 rounded-lg hover:bg-white/[0.07] flex items-center justify-center text-slate-500 hover:text-rose-300 transition-colors" title="Delete"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* pagination */}
        {employees && filtered.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/[0.06]">
            <p className="text-[11px] font-semibold text-slate-500">
              Showing <span className="text-slate-300">{(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)}</span> of <span className="text-slate-300">{filtered.length}</span> employees
            </p>
            <div className="flex items-center gap-1.5">
              <button disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-400 disabled:opacity-35 hover:border-emerald-400/30 transition-all"><ChevronLeft size={14} /></button>
              {Array.from({ length: Math.min(5, pages) }).map((_, i) => {
                let p = i + 1;
                if (pages > 5) {
                  const start = Math.min(Math.max(1, safePage - 2), pages - 4);
                  p = start + i;
                }
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-[12px] font-bold transition-all ${p === safePage ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30' : 'bg-white/[0.04] border border-white/[0.08] text-slate-400 hover:text-white'}`}>
                    {p}
                  </button>
                );
              })}
              <button disabled={safePage >= pages} onClick={() => setPage(safePage + 1)} className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-400 disabled:opacity-35 hover:border-emerald-400/30 transition-all"><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </Card>

      {/* ===== Add/Edit modal ===== */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit — ${editing.name}` : 'Register New Employee'} sub={editing ? editing.emp_no : 'A timesheet register row is created automatically'} wide>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full Name" error={formErr.name}><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ahmed Al Harbi" /></Field>
          <Field label="IQAMA Number" error={formErr.iqama}><Input value={form.iqama} onChange={(e) => setForm({ ...form, iqama: e.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="10 digits" /></Field>
          <Field label="IQAMA Expiry"><Input type="date" value={form.iqama_expiry} onChange={(e) => setForm({ ...form, iqama_expiry: e.target.value })} /></Field>
          <Field label="Birth Date"><Input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} /></Field>
          <Field label="Worksite" error={formErr.worksite_id}>
            <Select value={form.worksite_id} onChange={(e) => setForm({ ...form, worksite_id: e.target.value })}>
              <option value="">Select worksite…</option>
              {worksites.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </Select>
          </Field>
          <Field label="Sponsor">
            <Select value={form.sponsor} onChange={(e) => setForm({ ...form, sponsor: e.target.value })}>
              {SPONSORS.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Transfer Status">
            <Select value={form.transfer_status} onChange={(e) => setForm({ ...form, transfer_status: e.target.value })}>
              {TRANSFER_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Work Status">
            <Select value={form.work_status} onChange={(e) => setForm({ ...form, work_status: e.target.value })}>
              {WORK_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Joining Date"><Input type="date" value={form.joining_date} onChange={(e) => setForm({ ...form, joining_date: e.target.value })} /></Field>
          <Field label="Mobile"><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="05xxxxxxxx" /></Field>
          <Field label="Nationality">
            <Select value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })}>
              {NATIONALITIES.map((n) => <option key={n}>{n}</option>)}
            </Select>
          </Field>
          <Field label="Base Salary (SAR)" error={formErr.base_salary}><Input type="number" min="0" value={form.base_salary} onChange={(e) => setForm({ ...form, base_salary: e.target.value })} placeholder="4200" /></Field>
          <Field label="Bank">
            <Select value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })}>
              {BANKS.map((b) => <option key={b}>{b}</option>)}
            </Select>
          </Field>
          <Field label="IBAN"><Input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value.toUpperCase().slice(0, 24) })} placeholder="SA…" /></Field>
          <Field label="Contract Type">
            <Select value={form.contract_type} onChange={(e) => setForm({ ...form, contract_type: e.target.value })}>
              {CONTRACT_TYPES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Insurance Policy No"><Input value={form.insurance_policy} onChange={(e) => setForm({ ...form, insurance_policy: e.target.value })} placeholder="INS-0000" /></Field>
          <Field label="Insurance Expiry"><Input type="date" value={form.insurance_expiry} onChange={(e) => setForm({ ...form, insurance_expiry: e.target.value })} /></Field>
          <Field label="Notes" className="sm:col-span-2"><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional remarks…" /></Field>
        </div>
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-white/[0.06]">
          <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={save} loading={saving} icon={BadgeCheck}>{editing ? 'Save Changes' : 'Register Employee'}</Button>
        </div>
      </Modal>

      {/* ===== Delete confirm ===== */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Remove Employee" sub="This also removes their timesheet history">
        <p className="text-[13px] text-slate-400 leading-relaxed">
          Remove <span className="font-bold text-slate-200">{deleteTarget?.name}</span> ({deleteTarget?.emp_no}) from the registry? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Keep</Button>
          <Button variant="danger" onClick={doDelete} loading={deleting} icon={Trash2}>Remove</Button>
        </div>
      </Modal>

      {/* ===== Profile drawer ===== */}
      <Drawer open={!!drawerEmp} onClose={() => setDrawerEmp(null)} width={520}
        title={drawerEmp?.name || ''}
        sub={drawerEmp ? `${drawerEmp.emp_no} · joined ${fmtDate(drawerEmp.joining_date)}` : ''}>
        {drawerEmp && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar name={drawerEmp.name} size={56} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone={STATUS_TONE[drawerEmp.work_status] || 'zinc'}>{drawerEmp.work_status}</Badge>
                  <Badge tone={STATUS_TONE[drawerEmp.contract_type || ''] || 'zinc'}>{drawerEmp.contract_type}</Badge>
                  <Badge tone="sky">{drawerEmp.nationality}</Badge>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <DocChip date={drawerEmp.iqama_expiry} label="IQAMA" />
                  <DocChip date={drawerEmp.insurance_expiry} label="Insurance" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Fingerprint, l: 'IQAMA Number', v: drawerEmp.iqama || '—' },
                { icon: CalendarDays, l: 'IQAMA Expiry', v: fmtDate(drawerEmp.iqama_expiry) },
                { icon: MapPin, l: 'Worksite', v: drawerEmp.worksites?.name || '—' },
                { icon: Users, l: 'Sponsor', v: drawerEmp.sponsor || '—' },
                { icon: Phone, l: 'Mobile', v: drawerEmp.mobile || '—' },
                { icon: HeartPulse, l: 'Policy', v: drawerEmp.insurance_policy || '—' },
                { icon: Landmark, l: 'Bank', v: drawerEmp.bank || '—' },
                { icon: Wallet, l: 'Base Salary', v: fmtSAR(drawerEmp.base_salary) },
              ].map((r) => (
                <div key={r.l} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <r.icon size={12} />
                    <p className="text-[9.5px] font-bold uppercase tracking-[0.12em]">{r.l}</p>
                  </div>
                  <p className="text-[13px] font-bold text-slate-200 mt-1.5 truncate">{r.v}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate-500">IBAN</p>
              <p className="text-[12.5px] font-bold text-gold-300 mt-1.5 tabular tracking-wider break-all">{drawerEmp.iban || '—'}</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Recent Net Pay</p>
                {empHistory.length > 1 && <Sparkline data={[...empHistory].reverse().map((h) => h.net_pay)} width={90} height={26} stroke="#e7b958" id="emp-hist" />}
              </div>
              <div className="space-y-1.5">
                {empHistory.map((h) => (
                  <div key={h.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] border border-white/[0.05] px-3.5 py-2.5">
                    <span className="text-[12px] font-bold text-slate-300">{MONTHS_SHORT[h.month - 1]} {h.year}</span>
                    <span className="text-[10.5px] font-semibold text-slate-500">{h.present_days}d present · {h.absent_days}d absent</span>
                    <span className="font-display text-[13px] font-bold text-emerald-300 tabular">{fmtSAR(h.net_pay)}</span>
                  </div>
                ))}
                {empHistory.length === 0 && <p className="text-xs text-slate-600 py-3 text-center">No payroll history yet.</p>}
              </div>
            </div>

            {drawerEmp.notes && (
              <div className="rounded-xl border border-gold-400/20 bg-gold-400/[0.05] p-3.5">
                <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-gold-400/80">Notes</p>
                <p className="text-[12.5px] text-slate-300 mt-1">{drawerEmp.notes}</p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button className="flex-1" icon={Pencil} onClick={() => { setDrawerEmp(null); openEdit(drawerEmp); }}>Edit Record</Button>
              <Button variant="danger" icon={Trash2} onClick={() => setDeleteTarget(drawerEmp)}>Remove</Button>
            </div>
          </div>
        )}
      </Drawer>

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
