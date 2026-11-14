import { motion } from 'framer-motion';
import { Activity, CalendarCheck2, CalendarX2, Gauge, Flame, Building2, Timer, Coins } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useApi } from '../lib/api';
import type { DashboardData } from '../lib/types';
import { fmtSAR, fmtNum } from '../lib/format';
import { Card, SectionTitle, Skeleton, ErrorState, ProgressBar, Avatar } from '../components/ui/primitives';
import CountUp from '../components/ui/CountUp';

function Head({ icon: Icon, label, value, format, sub, tone }: {
  icon: React.ElementType; label: string; value: number; format?: (n: number) => string; sub?: string; tone: string;
}) {
  const tones: Record<string, string> = {
    emerald: 'from-emerald-500/20 to-transparent text-emerald-300 border-emerald-400/20',
    rose: 'from-rose-500/20 to-transparent text-rose-300 border-rose-400/20',
    sky: 'from-sky-500/20 to-transparent text-sky-300 border-sky-400/20',
    gold: 'from-gold-500/20 to-transparent text-gold-300 border-gold-400/25',
    amber: 'from-amber-500/20 to-transparent text-amber-300 border-amber-400/20',
    violet: 'from-violet-500/20 to-transparent text-violet-300 border-violet-400/20',
  };
  return (
    <Card hover className="p-4">
      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br border flex items-center justify-center ${tones[tone]}`}>
        <Icon size={16} strokeWidth={2.2} />
      </div>
      <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="font-display text-[22px] font-bold text-white mt-1 tabular leading-none">
        <CountUp value={value} format={format} />
      </p>
      {sub && <p className="mt-1.5 text-[11px] font-semibold text-slate-500">{sub}</p>}
    </Card>
  );
}

export default function Attendance() {
  const { year, month } = useApp();
  const { data, loading, error, refetch } = useApi<DashboardData>(`/api/dashboard?year=${year}&month=${month}`, [year, month]);

  if (error) return <Card className="p-6"><ErrorState message={error} onRetry={refetch} /></Card>;

  const k = data?.kpis as (DashboardData['kpis'] & { presentDays?: number; expectedDays?: number }) | undefined;
  const daysLogged = k?.presentDays ?? 0;
  const maxHeat = data ? Math.max(1, ...data.heatmap.flatMap((h) => h.days)) : 1;

  return (
    <div className="space-y-4">
      {/* headline */}
      {loading || !k ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[124px]" />)}</div>
      ) : (
        <motion.div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Head icon={CalendarCheck2} tone="emerald" label="Days Logged" value={daysLogged} format={fmtNum} sub={`${data?.period.label} register`} />
          <Head icon={CalendarX2} tone="rose" label="Absences" value={k.absences} format={fmtNum} sub="Unworked expected days" />
          <Head icon={Gauge} tone={k.attendanceRate >= 92 ? 'emerald' : 'amber'} label="Attendance Rate" value={k.attendanceRate} format={(n) => `${n.toFixed(1)}%`} sub="Present ÷ expected" />
          <Head icon={Coins} tone="gold" label="Absence Cost" value={k.absenceCost} format={(n) => fmtSAR(n, { compact: true })} sub="Lost productivity value" />
          <Head icon={Timer} tone="sky" label="Overtime Paid" value={k.overtimePay} format={(n) => fmtSAR(n, { compact: true })} sub="1.5× hourly premium" />
          <Head icon={Building2} tone="violet" label="Sites Reporting" value={data?.heatmap.length || 0} format={fmtNum} sub="With daily presence data" />
        </motion.div>
      )}

      {/* heatmap */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="p-5">
          <SectionTitle icon={Flame} tone="gold" title="Presence Heat Map" sub={`Staff present per worksite per day · ${data?.period.label || ''}`}
            right={<div className="flex items-center gap-1.5 text-[9.5px] font-bold text-slate-500">Quiet
              {[0.15, 0.35, 0.6, 0.85].map((o) => <span key={o} className="w-3.5 h-3.5 rounded" style={{ background: `rgba(52, 211, 153, ${o})` }} />)}
              Peak</div>} />
          {loading || !data ? <Skeleton className="h-[220px]" /> : (
            <div className="overflow-x-auto">
              <div className="min-w-[860px] space-y-1.5">
                <div className="flex gap-1 pl-[150px]">
                  {Array.from({ length: data.period.dim }).map((_, i) => (
                    <div key={i} className="w-[18px] text-center text-[8.5px] font-bold text-slate-600">{(i + 1) % 5 === 1 || i === 0 ? i + 1 : ''}</div>
                  ))}
                </div>
                {data.heatmap.map((h) => (
                  <div key={h.worksite} className="flex items-center gap-1">
                    <p className="w-[142px] shrink-0 text-[10.5px] font-bold text-slate-400 truncate pr-2">{h.worksite}</p>
                    {h.days.map((v, i) => {
                      const intensity = v / maxHeat;
                      return (
                        <div
                          key={i}
                          title={`${h.worksite} · Day ${i + 1} · ${v} present`}
                          className="heat-cell w-[18px] h-[18px] rounded-[4px]"
                          style={{
                            background: v === 0 ? 'rgba(148,163,184,0.07)' : `rgba(52, 211, 153, ${0.12 + intensity * 0.78})`,
                          }}
                        />
                      );
                    })}
                    <span className="ml-2 text-[10px] font-bold text-slate-500 tabular">{Math.max(...h.days)} peak</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </motion.div>

      {/* by worksite + absentees */}
      <div className="grid grid-cols-12 gap-4">
        <motion.div className="col-span-12 xl:col-span-7" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
          <Card className="p-5 h-full">
            <SectionTitle icon={Activity} title="Attendance by Worksite" sub="Presence discipline across all sites" />
            {loading || !data ? <Skeleton className="h-[260px]" /> : (
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full text-left min-w-[560px]">
                  <thead>
                    <tr className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-600 border-b border-white/[0.06]">
                      <th className="pb-2.5">Worksite</th>
                      <th className="pb-2.5 text-center">Headcount</th>
                      <th className="pb-2.5 text-center">Absences</th>
                      <th className="pb-2.5 text-center">OT Paid</th>
                      <th className="pb-2.5 w-[34%]">Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byWorksite.map((w) => (
                      <tr key={w.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 pr-2">
                          <p className="text-[12.5px] font-bold text-slate-200">{w.name}</p>
                          <p className="text-[10px] text-slate-500 font-semibold">{w.city} · {w.format}</p>
                        </td>
                        <td className="py-3 text-center text-[12.5px] font-bold text-slate-200 tabular">{w.headcount}</td>
                        <td className={`py-3 text-center text-[12.5px] font-bold tabular ${w.absences > 0 ? 'text-rose-300' : 'text-slate-600'}`}>{w.absences}</td>
                        <td className="py-3 text-center text-[12px] font-semibold text-sky-300 tabular">{fmtSAR(w.overtime, { compact: true })}</td>
                        <td className="py-3 pr-1">
                          <div className="flex items-center gap-2.5">
                            <ProgressBar value={w.attendance} tone={w.attendance >= 92 ? 'emerald' : w.attendance >= 82 ? 'amber' : 'rose'} className="flex-1" />
                            <span className={`text-[12px] font-bold tabular w-12 text-right ${w.attendance >= 92 ? 'text-emerald-300' : w.attendance >= 82 ? 'text-amber-300' : 'text-rose-300'}`}>{w.attendance}%</span>
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

        <motion.div className="col-span-12 xl:col-span-5" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
          <Card className="p-5 h-full">
            <SectionTitle icon={CalendarX2} tone="rose" title="Top Absentees" sub="Requires supervisor follow-up" />
            {loading || !data ? <Skeleton className="h-[260px]" /> : data.topAbsentees.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-14">Zero absences recorded — perfect period.</p>
            ) : (
              <div className="space-y-2.5">
                {data.topAbsentees.map((a, i) => (
                  <div key={a.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.05] px-3.5 py-3">
                    <span className="font-display text-[13px] font-bold text-slate-600 w-5">{i + 1}</span>
                    <Avatar name={a.name} size={32} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-bold text-slate-200 truncate">{a.name}</p>
                      <p className="text-[10px] text-slate-500 font-semibold">{a.worksite}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[14px] font-display font-bold text-rose-300 tabular">{a.absences}d</p>
                      <p className="text-[9.5px] font-bold text-slate-500">{a.attendance}% present</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
