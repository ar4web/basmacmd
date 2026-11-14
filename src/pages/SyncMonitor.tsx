import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileClock, Database, Table2, FileSpreadsheet, RefreshCw, Trash2, Zap, Signal,
  CheckCircle2, AlertTriangle, XCircle, Timer, Activity, FolderSync, HeartPulse,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiGet, apiSend } from '../lib/api';
import { fmtNum } from '../lib/format';
import { Card, SectionTitle, Badge, Button, Spinner, EmptyState, ErrorState, ProgressBar } from '../components/ui/primitives';
import CountUp from '../components/ui/CountUp';

interface SyncFile {
  id: number; file_name: string; dataset: string; fingerprint: string | null;
  row_count: number; inserted: number; updated: number; skipped: number;
  error_count: number; duration_ms: number; status: string; last_synced_at: string;
}

interface PerfData {
  endpoints: { endpoint: string; calls: number; errors: number; avg: number; p95: number; okRate: number }[];
  overall: { calls24h: number; errors24h: number; avgMs: number; p95Ms: number; okRate: number; score: number; rating: string };
  recent: { id: number; endpoint: string; duration_ms: number; ok: boolean; created_at: string }[];
}

const DS_META: Record<string, { icon: React.ElementType; tone: string; label: string }> = {
  employees: { icon: Database, tone: 'emerald', label: 'Master Data' },
  timesheets: { icon: Table2, tone: 'gold', label: 'Timesheet / Salary' },
  expenses: { icon: FileSpreadsheet, tone: 'sky', label: 'Expenses' },
};

const STATUS_TONE_LOCAL: Record<string, string> = {
  Synced: 'emerald', Updated: 'sky', 'No changes': 'zinc', Failed: 'rose',
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function staleness(iso: string): { label: string; tone: string } {
  const days = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (days > 14) return { label: 'Stale — recheck source', tone: 'rose' };
  if (days > 7) return { label: 'Recheck advised', tone: 'amber' };
  return { label: 'Fresh', tone: 'emerald' };
}

export default function SyncMonitor() {
  const { toast } = useApp();
  const [files, setFiles] = useState<SyncFile[] | null>(null);
  const [perf, setPerf] = useState<PerfData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);

  const load = async (silent = false) => {
    if (!silent) setError(null);
    try {
      const [f, p] = await Promise.all([
        apiGet<{ files: SyncFile[] }>('/api/sync-files'),
        apiGet<PerfData>('/api/perf'),
      ]);
      setFiles(f.files);
      setPerf(p);
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : 'Failed to load');
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const fs = files || [];
    return {
      total: fs.length,
      rows: fs.reduce((a, f) => a + (f.row_count || 0), 0),
      updated: fs.filter((f) => f.status === 'Updated').length,
      failed: fs.filter((f) => f.status === 'Failed').length,
      stale: fs.filter((f) => staleness(f.last_synced_at).tone !== 'emerald').length,
      avgSpeed: Math.round(fs.reduce((a, f) => a + (f.row_count || 0), 0) / Math.max(0.001, fs.reduce((a, f) => a + (f.duration_ms || 0), 0) / 1000)),
    };
  }, [files]);

  const removeFile = async (f: SyncFile) => {
    try {
      await apiSend('/api/sync-files', 'DELETE', { id: f.id });
      toast(`${f.file_name} removed from monitor`, 'info');
      await load(true);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  if (error) return <Card className="p-6"><ErrorState message={error} onRetry={() => load()} /></Card>;

  const ov = perf?.overall;
  const ratingTone = !ov || ov.rating === 'Collecting' ? 'zinc' : ov.rating === 'Excellent' ? 'emerald' : ov.rating === 'Good' ? 'sky' : ov.rating === 'Degraded' ? 'amber' : 'rose';
  const maxAvg = Math.max(1, ...(perf?.endpoints.map((e) => e.avg) || [1]));

  return (
    <div className="space-y-4">
      {/* header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-5 flex flex-wrap items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500/25 to-transparent border border-sky-400/25 flex items-center justify-center text-sky-300 shrink-0">
            <FileClock size={22} />
          </div>
          <div className="flex-1 min-w-[260px]">
            <h2 className="font-display text-[17px] font-bold text-white">File Sync Monitor & App Health</h2>
            <p className="text-[12px] text-slate-400 mt-1 leading-relaxed max-w-2xl">
              Every Excel file synced through Data Import is fingerprinted and tracked here. Re-drop a file to detect updates instantly — and watch live API performance to see whether the app is running well or poorly.
            </p>
            {files && files.length > 0 && (() => {
              const fresh = files.filter((f) => staleness(f.last_synced_at).tone === 'emerald').length;
              const recheck = files.filter((f) => staleness(f.last_synced_at).tone === 'amber').length;
              const stale = files.filter((f) => staleness(f.last_synced_at).tone === 'rose').length;
              return (
                <div className="mt-2.5 max-w-md">
                  <div className="flex h-1.5 w-full overflow-hidden bg-white/[0.06]">
                    <div className="bg-emerald-400 transition-all duration-700" style={{ width: `${(fresh / files.length) * 100}%` }} />
                    <div className="bg-amber-400 transition-all duration-700" style={{ width: `${(recheck / files.length) * 100}%` }} />
                    <div className="bg-rose-400 transition-all duration-700" style={{ width: `${(stale / files.length) * 100}%` }} />
                  </div>
                  <div className="flex gap-4 mt-1.5 text-[9.5px] font-bold text-slate-500">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-400" />{fresh} fresh</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-amber-400" />{recheck} recheck</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-rose-400" />{stale} stale</span>
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="emerald" dot>Auto-refresh 30s</Badge>
            <Button variant="ghost" size="sm" icon={RefreshCw} loading={spinning} onClick={async () => { setSpinning(true); await load(); setSpinning(false); }}>Refresh</Button>
          </div>
        </Card>
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { icon: FolderSync, label: 'Tracked Files', value: stats.total, tone: 'sky', fmt: fmtNum },
          { icon: Database, label: 'Rows Synced', value: stats.rows, tone: 'emerald', fmt: fmtNum },
          { icon: RefreshCw, label: 'Updates Detected', value: stats.updated, tone: stats.updated > 0 ? 'gold' : 'zinc', fmt: fmtNum },
          { icon: Timer, label: 'Avg Sync Speed', value: stats.avgSpeed, tone: 'violet', fmt: (n: number) => `${fmtNum(n)} r/s` },
          { icon: Activity, label: 'API Calls (24h)', value: ov?.calls24h ?? 0, tone: 'emerald', fmt: fmtNum },
          { icon: HeartPulse, label: 'Health Score', value: ov?.score ?? 0, tone: ratingTone, fmt: (n: number) => `${Math.round(n)}/100` },
        ].map((kpi, i) => {
          const tones: Record<string, string> = {
            emerald: 'from-emerald-500/20 to-transparent text-emerald-300 border-emerald-400/20',
            sky: 'from-sky-500/20 to-transparent text-sky-300 border-sky-400/20',
            gold: 'from-gold-500/20 to-transparent text-gold-300 border-gold-400/25',
            violet: 'from-violet-500/20 to-transparent text-violet-300 border-violet-400/20',
            rose: 'from-rose-500/20 to-transparent text-rose-300 border-rose-400/20',
            amber: 'from-amber-500/20 to-transparent text-amber-300 border-amber-400/20',
            zinc: 'from-slate-500/20 to-transparent text-slate-400 border-slate-400/20',
          };
          return (
            <motion.div key={kpi.label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card hover className="p-4">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br border flex items-center justify-center ${tones[kpi.tone]}`}>
                  <kpi.icon size={16} strokeWidth={2.2} />
                </div>
                <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{kpi.label}</p>
                <p className="font-display text-[22px] font-bold text-white mt-1 tabular leading-none">
                  <CountUp value={kpi.value} format={kpi.fmt} />
                </p>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* files table */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className="overflow-hidden">
          <div className="px-5 pt-4">
            <SectionTitle icon={FolderSync} title="Synced Files" sub="Fingerprint-checked · re-drop a file in Data Import to test for updates" />
          </div>
          {!files ? <Spinner label="Loading sync registry…" /> : files.length === 0 ? (
            <EmptyState icon={FolderSync} title="No files tracked yet" sub="Import an Excel file from the Data Import page and it will appear here with its fingerprint and sync state." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[1020px]">
                <thead>
                  <tr className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-600 border-b border-white/[0.07] bg-white/[0.015]">
                    <th className="px-5 py-3">File</th>
                    <th className="px-3 py-3">Dataset</th>
                    <th className="px-3 py-3">Fingerprint</th>
                    <th className="px-3 py-3 text-center">Rows</th>
                    <th className="px-3 py-3 text-center">Last Result</th>
                    <th className="px-3 py-3 text-center">Sync Status</th>
                    <th className="px-3 py-3">Freshness</th>
                    <th className="px-3 py-3 text-right">Last Synced</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {files.map((f) => {
                    const meta = DS_META[f.dataset] || DS_META.employees;
                    const stale = staleness(f.last_synced_at);
                    return (
                      <tr key={f.id} className="border-b border-white/[0.045] hover:bg-white/[0.025] transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${f.dataset === 'employees' ? 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20' : f.dataset === 'timesheets' ? 'bg-gold-400/10 text-gold-300 border-gold-400/20' : 'bg-sky-400/10 text-sky-300 border-sky-400/20'}`}>
                              <meta.icon size={14} />
                            </div>
                            <div>
                              <p className="text-[12.5px] font-bold text-slate-100">{f.file_name}</p>
                              <p className="text-[9.5px] text-slate-500 font-semibold">{(f.duration_ms / 1000).toFixed(1)}s last sync</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3"><Badge tone={meta.tone} dot={false}>{meta.label}</Badge></td>
                        <td className="px-3 py-3">
                          <span className="font-mono text-[10px] font-semibold text-slate-400 bg-white/[0.04] border border-white/[0.08] px-2 py-1">{f.fingerprint || '—'}</span>
                        </td>
                        <td className="px-3 py-3 text-center text-[12.5px] font-bold text-slate-200 tabular">{fmtNum(f.row_count)}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold">
                            <span className="text-emerald-300 tabular">+{f.inserted}</span>
                            <span className="text-slate-600">/</span>
                            <span className="text-sky-300 tabular">↻{f.updated}</span>
                            <span className="text-slate-600">/</span>
                            <span className={f.error_count > 0 ? 'text-rose-300 tabular' : 'text-slate-600 tabular'}>×{f.error_count}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Badge tone={STATUS_TONE_LOCAL[f.status] || 'zinc'}>{f.status}</Badge>
                        </td>
                        <td className="px-3 py-3"><Badge tone={stale.tone} dot={false} className="!normal-case !tracking-normal">{stale.label}</Badge></td>
                        <td className="px-3 py-3 text-right text-[11px] font-semibold text-slate-400 tabular">{timeAgo(f.last_synced_at)}</td>
                        <td className="px-3 py-3 text-right">
                          <button onClick={() => removeFile(f)} className="w-7 h-7 rounded-lg hover:bg-white/[0.07] flex items-center justify-center text-slate-600 hover:text-rose-300 transition-colors" title="Remove from monitor"><Trash2 size={13} /></button>
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

      {/* performance */}
      <div className="grid grid-cols-12 gap-4">
        <motion.div className="col-span-12 xl:col-span-4" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="p-5 h-full">
            <SectionTitle icon={HeartPulse} tone={ratingTone === 'zinc' ? 'emerald' : (ratingTone as 'emerald' | 'rose' | 'amber' | 'sky')} title="App Performance Verdict" sub="Live API behaviour · last 24 hours" />
            {!perf ? <Spinner label="Measuring…" /> : (
              <div className="flex flex-col items-center pt-2">
                <div className="relative w-[150px] h-[150px]">
                  <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(148,163,184,0.1)" strokeWidth="9" />
                    <motion.circle
                      cx="60" cy="60" r="52" fill="none"
                      stroke={ov?.rating === 'Poor' || ov?.rating === 'Degraded' ? '#fb7185' : ov?.rating === 'Good' ? '#38bdf8' : '#34d399'}
                      strokeWidth="9" strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 52}
                      initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - (ov?.score ?? 0) / 100) }}
                      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="font-display text-[32px] font-bold text-white leading-none tabular"><CountUp value={ov?.score ?? 0} /></p>
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500 mt-1">Score</p>
                  </div>
                </div>
                <Badge tone={ratingTone} className="mt-3">{ov?.rating || 'Collecting'}</Badge>
                <div className="grid grid-cols-3 gap-2 w-full mt-4">
                  {[
                    ['Avg latency', `${ov?.avgMs ?? 0}ms`],
                    ['P95 latency', `${ov?.p95Ms ?? 0}ms`],
                    ['Success rate', `${ov?.okRate ?? 100}%`],
                  ].map(([l, v]) => (
                    <div key={l} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5 text-center">
                      <p className="font-display text-[14px] font-bold text-slate-100 tabular">{v}</p>
                      <p className="text-[8.5px] font-bold uppercase tracking-wider text-slate-600 mt-0.5">{l}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[10.5px] text-slate-600 font-semibold mt-3 text-center leading-relaxed">
                  {(ov?.calls24h ?? 0) < 5
                    ? 'Using the app generates samples — browse a few pages and return.'
                    : ov?.rating === 'Excellent' || ov?.rating === 'Good'
                      ? 'The application is performing well across all endpoints.'
                      : 'Performance is degraded — check slow endpoints in the table.'}
                </p>
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div className="col-span-12 xl:col-span-8" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}>
          <Card className="p-5 h-full">
            <SectionTitle icon={Signal} tone="sky" title="Endpoint Latency" sub="Average and P95 response time per API route"
              right={<Badge tone="zinc" dot={false}>{ov?.calls24h ?? 0} calls / 24h</Badge>} />
            {!perf ? <Spinner label="Measuring…" /> : perf.endpoints.length === 0 ? (
              <EmptyState icon={Activity} title="No samples yet" sub="API calls are timed automatically as you use the app." />
            ) : (
              <div className="space-y-2.5">
                {perf.endpoints.slice(0, 8).map((e) => {
                  const tone = e.avg < 400 ? 'emerald' : e.avg < 900 ? 'sky' : e.avg < 1600 ? 'amber' : 'rose';
                  return (
                    <div key={e.endpoint} className="rounded-xl bg-white/[0.02] border border-white/[0.05] px-3.5 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${e.okRate >= 99 ? 'bg-emerald-400' : e.okRate >= 95 ? 'bg-amber-400' : 'bg-rose-400'}`} />
                        <p className="text-[12px] font-bold text-slate-200 font-mono truncate flex-1">{e.endpoint}</p>
                        <span className="text-[10px] font-semibold text-slate-500 tabular">{e.calls} calls</span>
                        <span className="text-[10px] font-semibold text-slate-500 tabular hidden sm:inline">p95 {e.p95}ms</span>
                        <span className={`text-[12px] font-bold tabular w-[64px] text-right ${tone === 'emerald' ? 'text-emerald-300' : tone === 'sky' ? 'text-sky-300' : tone === 'amber' ? 'text-amber-300' : 'text-rose-300'}`}>{e.avg}ms</span>
                      </div>
                      <ProgressBar value={e.avg} max={maxAvg} tone={tone === 'emerald' ? 'emerald' : tone === 'sky' ? 'sky' : tone === 'amber' ? 'amber' : 'rose'} className="mt-2" />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* recent calls */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="p-5">
          <SectionTitle icon={Zap} tone="gold" title="Live Request Feed" sub="Most recent API calls with round-trip time" />
          {!perf || perf.recent.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-8">Requests will appear here in real time as you navigate the app.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {perf.recent.slice(0, 9).map((r) => (
                <div key={r.id} className="flex items-center gap-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05] px-3 py-2">
                  {r.ok ? <CheckCircle2 size={13} className="text-emerald-400 shrink-0" /> : <XCircle size={13} className="text-rose-400 shrink-0" />}
                  <p className="text-[11px] font-mono font-semibold text-slate-300 truncate flex-1">{r.endpoint}</p>
                  <span className={`text-[10.5px] font-bold tabular ${r.duration_ms < 400 ? 'text-emerald-300' : r.duration_ms < 900 ? 'text-sky-300' : 'text-amber-300'}`}>{r.duration_ms}ms</span>
                  <span className="text-[9.5px] text-slate-600 font-semibold tabular">{timeAgo(r.created_at)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 flex items-center gap-2 text-[10.5px] font-semibold text-slate-600">
            <AlertTriangle size={12} className="text-gold-400" />
            Thresholds: under 400ms excellent · 400–900ms good · 900–1600ms degraded · over 1600ms poor. Files older than 7 days are flagged for re-check.
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
