import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Fingerprint, HeartPulse, ShieldCheck, ShieldAlert, ShieldOff, Timer, RefreshCcw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiGet, apiSend } from '../lib/api';
import type { Employee } from '../lib/types';
import { fmtDate, daysUntil, daysLeftLabel } from '../lib/format';
import { Card, Badge, Button, Modal, Input, Spinner, ErrorState, Avatar, ProgressBar } from '../components/ui/primitives';

type FilterKey = 'all' | 'expired' | 'critical' | 'warning' | 'compliant';

interface DocRow {
  emp: Employee;
  ref: string | null;
  expiry: string | null;
  daysLeft: number | null;
  bucket: 'expired' | 'critical' | 'warning' | 'compliant';
}

function bucketOf(dl: number | null): DocRow['bucket'] {
  if (dl === null) return 'compliant';
  if (dl < 0) return 'expired';
  if (dl <= 30) return 'critical';
  if (dl <= 60) return 'warning';
  return 'compliant';
}

const BUCKET_META = {
  expired: { label: 'Expired', tone: 'rose', icon: ShieldOff },
  critical: { label: 'Critical ≤ 30d', tone: 'amber', icon: ShieldAlert },
  warning: { label: 'Warning ≤ 60d', tone: 'gold', icon: Timer },
  compliant: { label: 'Compliant', tone: 'emerald', icon: ShieldCheck },
} as const;

function DocBoard({ title, sub, icon: Icon, tone, rows, onRenew, filter, setFilter }: {
  title: string; sub: string; icon: React.ElementType; tone: 'sky' | 'rose';
  rows: DocRow[]; onRenew: (r: DocRow) => void; filter: FilterKey; setFilter: (f: FilterKey) => void;
}) {
  const counts = useMemo(() => {
    const c: Record<string, number> = { expired: 0, critical: 0, warning: 0, compliant: 0 };
    rows.forEach((r) => { c[r.bucket] += 1; });
    return c;
  }, [rows]);

  const shown = rows.filter((r) => filter === 'all' || r.bucket === filter);

  return (
    <Card className="overflow-hidden">
      <div className="p-5 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${tone === 'sky' ? 'bg-sky-500/15 text-sky-300 border-sky-400/25' : 'bg-rose-500/15 text-rose-300 border-rose-400/25'}`}>
            <Icon size={18} strokeWidth={2.2} />
          </div>
          <div>
            <h3 className="font-display text-[16px] font-bold text-white">{title}</h3>
            <p className="text-[11px] text-slate-500 font-semibold">{sub}</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 mt-4">
          {(Object.keys(BUCKET_META) as Array<keyof typeof BUCKET_META>).map((bkey) => {
            const meta = BUCKET_META[bkey];
            const active = filter === bkey;
            return (
              <button
                key={bkey}
                onClick={() => setFilter(active ? 'all' : bkey)}
                className={`rounded-xl border p-3 text-left transition-all ${
                  active ? 'border-emerald-400/40 bg-emerald-400/[0.08]' : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.16]'
                }`}
              >
                <meta.icon size={14} className={`text-${meta.tone === 'gold' ? 'gold-400' : `${meta.tone}-400`}`} />
                <p className="font-display text-[19px] font-bold text-white mt-1.5 tabular leading-none">{counts[bkey]}</p>
                <p className="text-[8.5px] font-bold uppercase tracking-[0.1em] text-slate-500 mt-1">{meta.label}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-h-[420px] overflow-y-auto">
        {shown.length === 0 && <p className="text-xs text-slate-500 text-center py-10">Nothing in this bucket.</p>}
        {shown.map((r) => {
          const meta = BUCKET_META[r.bucket];
          return (
            <div key={r.emp.id} className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
              <Avatar name={r.emp.name} size={32} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[12.5px] font-bold text-slate-100 truncate">{r.emp.name}</p>
                  <Badge tone={meta.tone} dot={false} className="!text-[8.5px] !px-1.5 !py-[1px]">{meta.label}</Badge>
                </div>
                <p className="text-[10px] text-slate-500 font-semibold truncate">
                  {r.ref || r.emp.emp_no} · {r.emp.worksites?.name || '—'} · expires {fmtDate(r.expiry)}
                </p>
                <ProgressBar
                  value={r.daysLeft === null ? 100 : Math.max(0, Math.min(90, r.daysLeft))}
                  max={90}
                  tone={r.bucket === 'expired' ? 'rose' : r.bucket === 'critical' ? 'amber' : r.bucket === 'warning' ? 'gold' : 'emerald'}
                  className="mt-1.5 max-w-[220px]"
                />
              </div>
              <div className="text-right shrink-0 mr-1">
                <p className={`font-display text-[15px] font-bold tabular ${r.bucket === 'expired' ? 'text-rose-300' : r.bucket === 'critical' ? 'text-amber-300' : r.bucket === 'warning' ? 'text-gold-300' : 'text-emerald-300'}`}>
                  {daysLeftLabel(r.expiry)}
                </p>
              </div>
              {(r.bucket === 'expired' || r.bucket === 'critical' || r.bucket === 'warning') && (
                <Button size="xs" variant="outline" icon={RefreshCcw} onClick={() => onRenew(r)}>Renew</Button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function Compliance() {
  const { toast } = useApp();
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [iqFilter, setIqFilter] = useState<FilterKey>('all');
  const [insFilter, setInsFilter] = useState<FilterKey>('all');
  const [renewTarget, setRenewTarget] = useState<{ row: DocRow; doc: 'iqama' | 'insurance' } | null>(null);
  const [newDate, setNewDate] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setError(null);
      setEmployees(await apiGet<Employee[]>('/api/employees'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  };

  useEffect(() => { load(); }, []);

  const boards = useMemo(() => {
    if (!employees) return { iqama: [], insurance: [] };
    const live = employees.filter((e) => e.work_status !== 'Terminated');
    const mk = (getRef: (e: Employee) => string | null, getExp: (e: Employee) => string | null): DocRow[] =>
      live.map((emp) => {
        const expiry = getExp(emp);
        const dl = expiry ? daysUntil(expiry) : null;
        return { emp, ref: getRef(emp), expiry, daysLeft: dl, bucket: bucketOf(dl) };
      }).sort((a, b) => (a.daysLeft ?? 99999) - (b.daysLeft ?? 99999));
    return {
      iqama: mk((e) => e.iqama, (e) => e.iqama_expiry),
      insurance: mk((e) => e.insurance_policy, (e) => e.insurance_expiry),
    };
  }, [employees]);

  const renew = async () => {
    if (!renewTarget || !newDate) return;
    setSaving(true);
    try {
      const patch = renewTarget.doc === 'iqama' ? { iqama_expiry: newDate } : { insurance_expiry: newDate };
      await apiSend('/api/employees', 'PUT', { id: renewTarget.row.emp.id, ...patch });
      toast(`${renewTarget.row.emp.name} — ${renewTarget.doc === 'iqama' ? 'IQAMA' : 'insurance'} renewed to ${fmtDate(newDate)}`);
      setRenewTarget(null);
      setNewDate('');
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Renewal failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (error) return <Card className="p-6"><ErrorState message={error} onRetry={load} /></Card>;

  const totalUrgent = boards.iqama.filter((r) => r.bucket === 'expired' || r.bucket === 'critical').length
    + boards.insurance.filter((r) => r.bucket === 'expired' || r.bucket === 'critical').length;

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/25 to-transparent border border-emerald-400/25 flex items-center justify-center text-emerald-300">
              <ShieldCheck size={18} />
            </div>
            <div>
              <p className="font-display text-[15px] font-bold text-white">Document Compliance Radar</p>
              <p className="text-[11px] text-slate-500 font-semibold">Live expiry tracking · Muqeem & CCHI aligned windows</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-5">
            <div className="text-right">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">Urgent actions</p>
              <p className={`font-display text-[22px] font-bold tabular leading-none ${totalUrgent > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{totalUrgent}</p>
            </div>
            <div className="h-9 w-px bg-white/10" />
            <div className="text-right">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">On register</p>
              <p className="font-display text-[22px] font-bold text-white tabular leading-none">{employees?.length ?? '—'}</p>
            </div>
          </div>
        </Card>
      </motion.div>

      {!employees ? <Card><Spinner label="Scanning documents…" /></Card> : (
        <motion.div className="grid grid-cols-1 xl:grid-cols-2 gap-4" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <DocBoard title="IQAMA Expiry Watch" sub="Residency permit validity · earliest first" icon={Fingerprint} tone="sky"
            rows={boards.iqama} filter={iqFilter} setFilter={setIqFilter}
            onRenew={(row) => { setRenewTarget({ row, doc: 'iqama' }); setNewDate(''); }} />
          <DocBoard title="Medical Insurance Watch" sub="Policy validity · earliest first" icon={HeartPulse} tone="rose"
            rows={boards.insurance} filter={insFilter} setFilter={setInsFilter}
            onRenew={(row) => { setRenewTarget({ row, doc: 'insurance' }); setNewDate(''); }} />
        </motion.div>
      )}

      <Modal open={!!renewTarget} onClose={() => setRenewTarget(null)}
        title={`Renew ${renewTarget?.doc === 'iqama' ? 'IQAMA' : 'Insurance'}`}
        sub={renewTarget ? `${renewTarget.row.emp.name} · current expiry ${fmtDate(renewTarget.row.expiry)}` : ''}>
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-1.5">New Expiry Date</label>
            <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRenewTarget(null)}>Cancel</Button>
            <Button onClick={renew} loading={saving} disabled={!newDate} icon={RefreshCcw}>Confirm Renewal</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
