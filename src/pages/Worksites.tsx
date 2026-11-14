import { motion } from 'framer-motion';
import { Building2, MapPin, Users, Wallet, Gauge, Trophy, Clock3, CalendarDays, CircleDollarSign } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useApi } from '../lib/api';
import type { DashboardData } from '../lib/types';
import { fmtSAR, fmtNum } from '../lib/format';
import { Card, SectionTitle, Badge, Skeleton, ErrorState, ProgressBar } from '../components/ui/primitives';
import Sparkline from '../components/ui/Sparkline';
import CountUp from '../components/ui/CountUp';

export default function Worksites() {
  const { year, month } = useApp();
  const { data, loading, error, refetch } = useApi<DashboardData>(`/api/dashboard?year=${year}&month=${month}`, [year, month]);

  if (error) return <Card className="p-6"><ErrorState message={error} onRetry={refetch} /></Card>;

  const ranked = data ? [...data.byWorksite].sort((a, b) => b.payroll - a.payroll) : [];
  const topId = ranked[0]?.id;

  return (
    <div className="space-y-4">
      {/* site cards */}
      {loading || !data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[240px]" />)}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.byWorksite.map((w, i) => (
            <motion.div key={w.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <Card hover className="p-5 relative overflow-hidden">
                {w.id === topId && (
                  <div className="absolute top-4 right-4"><Badge tone="gold"><Trophy size={10} className="mr-0.5" /> Top cost center</Badge></div>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500/25 to-transparent border border-emerald-400/25 flex items-center justify-center text-emerald-300">
                    <Building2 size={19} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-[15px] font-bold text-white truncate">{w.name}</h3>
                    <p className="text-[10.5px] font-semibold text-slate-500 flex items-center gap-1"><MapPin size={10} /> {w.city} · {w.format}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5 text-center">
                    <Users size={12} className="mx-auto text-slate-500" />
                    <p className="font-display text-[17px] font-bold text-white mt-1 tabular leading-none"><CountUp value={w.headcount} /></p>
                    <p className="text-[8.5px] font-bold uppercase tracking-wider text-slate-600 mt-1">Heads</p>
                  </div>
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5 text-center">
                    <Wallet size={12} className="mx-auto text-slate-500" />
                    <p className="font-display text-[17px] font-bold text-gold-300 mt-1 tabular leading-none"><CountUp value={w.payroll} format={(n) => fmtSAR(n, { compact: true })} /></p>
                    <p className="text-[8.5px] font-bold uppercase tracking-wider text-slate-600 mt-1">Payroll</p>
                  </div>
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5 text-center">
                    <Gauge size={12} className="mx-auto text-slate-500" />
                    <p className={`font-display text-[17px] font-bold mt-1 tabular leading-none ${w.attendance >= 92 ? 'text-emerald-300' : w.attendance >= 82 ? 'text-amber-300' : 'text-rose-300'}`}>{w.attendance}%</p>
                    <p className="text-[8.5px] font-bold uppercase tracking-wider text-slate-600 mt-1">Attend.</p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1.5">
                    <span>Cost share of network payroll</span>
                    <span className="text-emerald-300 tabular">{w.costShare}%</span>
                  </div>
                  <ProgressBar value={w.costShare} tone="emerald" />
                </div>

                <div className="flex items-end justify-between mt-4 pt-3 border-t border-white/[0.06]">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="sky" dot={false} className="!text-[9px]"><Clock3 size={9} className="mr-0.5" />{w.hoursPerDay}h · {w.periodDays}d</Badge>
                    <Badge tone="violet" dot={false} className="!text-[9px]">{w.payMethod}</Badge>
                    {w.iqamaDue > 0 && <Badge tone="amber" dot={false} className="!text-[9px]">{w.iqamaDue} IQAMA due</Badge>}
                  </div>
                  <Sparkline data={w.monthly} width={86} height={28} stroke="#e7b958" id={`ws-${w.id}`} />
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* summary table */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="overflow-hidden">
          <div className="px-5 pt-4">
            <SectionTitle icon={CalendarDays} title="Worksite Summary" sub={`Headcount, cost & compliance · ${data?.period.label || ''}`} />
          </div>
          {loading || !data ? <Skeleton className="h-[240px] m-5" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[1000px]">
                <thead>
                  <tr className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-600 border-b border-white/[0.07] bg-white/[0.015]">
                    <th className="px-5 py-3">Rank</th>
                    <th className="px-3 py-3">Worksite</th>
                    <th className="px-3 py-3 text-center">Headcount</th>
                    <th className="px-3 py-3 text-center">Active</th>
                    <th className="px-3 py-3 text-right">Salary Pool</th>
                    <th className="px-3 py-3 text-right">Payroll (Period)</th>
                    <th className="px-3 py-3 text-right">Avg / Employee</th>
                    <th className="px-3 py-3 text-center">Absences</th>
                    <th className="px-3 py-3 text-center">Attendance</th>
                    <th className="px-3 py-3 text-center">IQAMA Due</th>
                    <th className="px-3 py-3 text-right">Cost Share</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((w, i) => (
                    <tr key={w.id} className="border-b border-white/[0.045] hover:bg-white/[0.025] transition-colors">
                      <td className="px-5 py-3">
                        <span className={`w-7 h-7 rounded-lg inline-flex items-center justify-center text-[11px] font-bold ${i === 0 ? 'bg-gold-400/15 text-gold-300 border border-gold-400/30' : 'bg-white/[0.04] text-slate-500 border border-white/[0.07]'}`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-[12.5px] font-bold text-slate-100">{w.name}</p>
                        <p className="text-[10px] text-slate-500 font-semibold">{w.city} · {w.format} · {w.absentTreatment} absence</p>
                      </td>
                      <td className="px-3 py-3 text-center text-[12.5px] font-bold text-slate-200 tabular">{w.headcount}</td>
                      <td className="px-3 py-3 text-center text-[12.5px] font-bold text-emerald-300 tabular">{w.active}</td>
                      <td className="px-3 py-3 text-right text-[12.5px] font-semibold text-slate-300 tabular">{fmtSAR(w.salaryPool)}</td>
                      <td className="px-3 py-3 text-right font-display text-[13px] font-bold text-gold-300 tabular">{fmtSAR(w.payroll)}</td>
                      <td className="px-3 py-3 text-right text-[12.5px] font-semibold text-slate-300 tabular">{fmtSAR(w.avgCost)}</td>
                      <td className={`px-3 py-3 text-center text-[12.5px] font-bold tabular ${w.absences > 0 ? 'text-rose-300' : 'text-slate-600'}`}>{fmtNum(w.absences)}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`text-[12px] font-bold tabular ${w.attendance >= 92 ? 'text-emerald-300' : w.attendance >= 82 ? 'text-amber-300' : 'text-rose-300'}`}>{w.attendance}%</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {w.iqamaDue > 0 ? <Badge tone="amber">{w.iqamaDue}</Badge> : <span className="text-[11px] text-slate-600 font-semibold">Clear</span>}
                      </td>
                      <td className="px-3 py-3 text-right">
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
          <div className="px-5 py-3.5 border-t border-white/[0.06] flex items-center gap-2 text-[10.5px] font-semibold text-slate-600">
            <CircleDollarSign size={12} className="text-gold-400" />
            Network payroll this period: <span className="text-gold-300 font-bold">{fmtSAR(data?.kpis.netPayable || 0)}</span>
            <span className="mx-1">·</span> Salary pool deployed: <span className="text-slate-300 font-bold">{fmtSAR(data?.byWorksite.reduce((a, w) => a + w.salaryPool, 0) || 0)}</span>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
