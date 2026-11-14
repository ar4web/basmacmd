import { motion } from 'framer-motion';
import {
  SlidersHorizontal, ShieldAlert, Flag, Sun, LayoutPanelTop, RefreshCcw, BellRing,
  CalendarClock, Sparkles, Rows3, Timer, UserX, Percent, TimerReset, RotateCcw, Fingerprint,
} from 'lucide-react';
import { useApp, DEFAULT_RULES, type Rules } from '../context/AppContext';
import { Card, SectionTitle, Badge, Button } from '../components/ui/primitives';

/* ---------- square toggle switch (matches the design system) ---------- */
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative w-11 h-6 shrink-0 border transition-all duration-200 ${
        on
          ? 'bg-emerald-400/25 border-emerald-400/50 shadow-[0_0_12px_-2px_rgba(16,185,129,0.5)]'
          : 'bg-white/[0.05] border-white/[0.14] hover:border-white/[0.25]'
      }`}
    >
      <span
        className="absolute top-[3px] w-4 h-4 transition-all duration-200"
        style={{ left: on ? 'calc(100% - 19px)' : '3px', background: on ? '#34d399' : '#64748b' }}
      />
    </button>
  );
}

interface RuleRowDef {
  key: keyof Rules;
  icon: React.ElementType;
  title: string;
  desc: string;
  kind: 'toggle' | 'number';
  min?: number; max?: number; step?: number; unit?: string;
  tone: string;
}

const SECTIONS: { title: string; sub: string; rows: RuleRowDef[] }[] = [
  {
    title: 'Register Rules',
    sub: 'How the timesheet register audits and displays entries',
    rows: [
      { key: 'auditPanel', icon: ShieldAlert, kind: 'toggle', tone: 'rose',
        title: 'Rule-audit panel', desc: 'Show the collapsible audit heading that flags rows breaking pay rules' },
      { key: 'rowFlags', icon: Flag, kind: 'toggle', tone: 'rose',
        title: 'Row flag markers', desc: 'Mark violating rows with a flag icon and tinted background' },
      { key: 'fridayHighlight', icon: CalendarClock, kind: 'toggle', tone: 'gold',
        title: 'Friday highlighting', desc: 'Tint Friday columns gold in the day grid' },
      { key: 'holdRows', icon: Rows3, kind: 'toggle', tone: 'emerald',
        title: 'Hold rows by default', desc: 'Freeze the employee identity column while scrolling horizontally' },
      { key: 'otCap', icon: Timer, kind: 'number', min: 0, max: 60, step: 1, unit: 'h', tone: 'amber',
        title: 'Overtime cap', desc: 'Flag rows whose overtime exceeds this many hours per month' },
      { key: 'absenceFlag', icon: UserX, kind: 'number', min: 1, max: 15, step: 1, unit: 'd', tone: 'rose',
        title: 'Absence flag threshold', desc: 'Flag rows reaching this many absences in one month' },
      { key: 'deductionCap', icon: Percent, kind: 'number', min: 5, max: 90, step: 5, unit: '%', tone: 'sky',
        title: 'Deduction cap', desc: 'Flag rows whose deductions exceed this share of gross pay' },
    ],
  },
  {
    title: 'Compliance Windows',
    sub: 'Expiry buckets used by the document boards and badges',
    rows: [
      { key: 'criticalDays', icon: Fingerprint, kind: 'number', min: 7, max: 90, step: 1, unit: 'd', tone: 'amber',
        title: 'Critical window', desc: 'Documents expiring within this many days count as critical' },
      { key: 'warningDays', icon: TimerReset, kind: 'number', min: 15, max: 180, step: 5, unit: 'd', tone: 'gold',
        title: 'Warning window', desc: 'Documents expiring within this many days count as warnings' },
    ],
  },
  {
    title: 'Interface Rules',
    sub: 'How the command center looks and behaves',
    rows: [
      { key: 'animations', icon: Sparkles, kind: 'toggle', tone: 'violet',
        title: 'Page transitions', desc: 'Animate page entrances and number count-ups' },
      { key: 'compactDensity', icon: LayoutPanelTop, kind: 'toggle', tone: 'emerald',
        title: 'Compact density', desc: 'Reduced padding, gaps and margins across every page' },
      { key: 'pageFooter', icon: Sun, kind: 'toggle', tone: 'sky',
        title: 'Page-wise footer', desc: 'Pin the live info strip to the bottom, carrying only page-relevant figures' },
      { key: 'footerRefresh', icon: RefreshCcw, kind: 'toggle', tone: 'sky',
        title: 'Footer auto-refresh', desc: 'Re-poll footer figures every 60 seconds' },
      { key: 'sidebarAlerts', icon: BellRing, kind: 'toggle', tone: 'rose',
        title: 'Sidebar alert panel', desc: 'Show the urgent document alert panel inside the left sidebar' },
    ],
  },
];

const TONE_CLS: Record<string, string> = {
  emerald: 'from-emerald-500/20 to-transparent text-emerald-300 border-emerald-400/20',
  gold: 'from-gold-500/20 to-transparent text-gold-300 border-gold-400/25',
  rose: 'from-rose-500/20 to-transparent text-rose-300 border-rose-400/20',
  sky: 'from-sky-500/20 to-transparent text-sky-300 border-sky-400/20',
  amber: 'from-amber-500/20 to-transparent text-amber-300 border-amber-400/20',
  violet: 'from-violet-500/20 to-transparent text-violet-300 border-violet-400/20',
};

export default function RulesPage() {
  const { rules, setRule, resetRules, toast } = useApp();
  const enabled = SECTIONS.flatMap((s) => s.rows).filter((r) => r.kind === 'toggle' && rules[r.key] === true).length;
  const totalToggles = SECTIONS.flatMap((s) => s.rows).filter((r) => r.kind === 'toggle').length;

  return (
    <div className="space-y-4">
      {/* header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-5 flex flex-wrap items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-violet-500/25 to-transparent border border-violet-400/25 flex items-center justify-center text-violet-300 shrink-0">
            <SlidersHorizontal size={22} />
          </div>
          <div className="flex-1 min-w-[260px]">
            <h2 className="font-display text-[17px] font-bold text-white">Rule Setup</h2>
            <p className="text-[12px] text-slate-400 mt-1 leading-relaxed max-w-2xl">
              Define how the app behaves. Every toggle and threshold applies instantly, persists on this device, and drives the register audit, compliance windows and interface behavior across all pages.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="violet">{enabled}/{totalToggles} toggles on</Badge>
            <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => { resetRules(); toast('Rules restored to defaults', 'info'); }}>
              Defaults
            </Button>
          </div>
        </Card>
      </motion.div>

      {/* sections */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {SECTIONS.map((sec, si) => (
          <motion.div key={sec.title} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 + si * 0.06 }}>
            <Card className="p-5 h-full">
              <SectionTitle icon={si === 0 ? ShieldAlert : si === 1 ? Fingerprint : Sun} tone={si === 0 ? 'rose' : si === 1 ? 'amber' : 'sky'} title={sec.title} sub={sec.sub} />
              <div className="space-y-2">
                {sec.rows.map((r) => (
                  <div
                    key={r.key}
                    className={`flex items-center gap-3 border px-3.5 py-3 transition-all ${
                      r.kind === 'toggle' && rules[r.key] === true ? 'border-emerald-400/20 bg-emerald-400/[0.03]' : 'border-white/[0.06] bg-white/[0.02]'
                    }`}
                  >
                    <div className={`w-8 h-8 bg-gradient-to-br border flex items-center justify-center shrink-0 ${TONE_CLS[r.tone]}`}>
                      <r.icon size={14} strokeWidth={2.2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-bold text-slate-100">{r.title}</p>
                      <p className="text-[10.5px] text-slate-500 font-semibold leading-snug mt-0.5">{r.desc}</p>
                    </div>
                    {r.kind === 'toggle' ? (
                      <Toggle label={r.title} on={rules[r.key] as boolean} onChange={(v) => { setRule(r.key, v as never); toast(`${r.title} ${v ? 'enabled' : 'disabled'}`, 'info'); }} />
                    ) : (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          type="number"
                          min={r.min} max={r.max} step={r.step}
                          value={rules[r.key] as number}
                          onChange={(e) => {
                            const v = Math.max(r.min ?? 0, Math.min(r.max ?? 999, Number(e.target.value) || 0));
                            setRule(r.key, v as never);
                          }}
                          className="w-[64px] bg-white/[0.05] border border-white/[0.12] px-2 py-1.5 text-[13px] font-bold text-slate-100 text-center outline-none focus:border-emerald-400/50 tabular"
                        />
                        <span className="text-[10px] font-bold text-slate-500 uppercase">{r.unit}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* active rule summary */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Active profile</span>
            {([
              ['Audit', rules.auditPanel], ['Flags', rules.rowFlags], ['Fridays', rules.fridayHighlight],
              ['Hold rows', rules.holdRows], ['Motion', rules.animations], ['Compact', rules.compactDensity],
              ['Footer', rules.pageFooter], ['Refresh', rules.footerRefresh], ['Alerts', rules.sidebarAlerts],
            ] as [string, boolean][]).map(([l, on]) => (
              <span key={l} className={`inline-flex items-center gap-1.5 text-[10.5px] font-bold ${on ? 'text-emerald-300' : 'text-slate-600'}`}>
                <span className={`w-1.5 h-1.5 ${on ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                {l}
              </span>
            ))}
            <span className="ml-auto text-[10.5px] font-semibold text-slate-500">
              OT cap <b className="text-amber-300">{rules.otCap}h</b> · absence ≥ <b className="text-rose-300">{rules.absenceFlag}d</b> · deductions ≤ <b className="text-sky-300">{rules.deductionCap}%</b> · critical ≤ <b className="text-amber-300">{rules.criticalDays}d</b> · warning ≤ <b className="text-gold-300">{rules.warningDays}d</b>
            </span>
          </div>
        </Card>
      </motion.div>

      {/* defaults note */}
      <p className="text-[10.5px] text-slate-600 font-semibold px-1">
        Defaults: {DEFAULT_RULES.otCap}h OT cap · {DEFAULT_RULES.absenceFlag}d absence flag · {DEFAULT_RULES.deductionCap}% deduction cap · {DEFAULT_RULES.criticalDays}/{DEFAULT_RULES.warningDays}-day compliance windows. Compliance windows drive document boards and badges; the dashboard aggregation uses the server-side 30/60-day windows.
      </p>
    </div>
  );
}
