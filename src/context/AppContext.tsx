import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';
import type { Settings } from '../lib/types';
import { apiGet } from '../lib/api';
import { setDocThresholds } from '../lib/format';

export interface Toast { id: number; msg: string; tone: 'success' | 'error' | 'info' }

/* ---------------- Rule engine: user-defined app behavior ---------------- */
export interface Rules {
  auditPanel: boolean;      // timesheet rule-audit panel
  rowFlags: boolean;        // flag icons on violating rows
  fridayHighlight: boolean; // gold Friday columns
  holdRows: boolean;        // hold row identity while scrolling (default)
  animations: boolean;      // page transitions
  compactDensity: boolean;  // reduced padding/gaps
  pageFooter: boolean;      // page-wise live footer
  footerRefresh: boolean;   // footer auto-refresh every 60s
  sidebarAlerts: boolean;   // alert panel in the sidebar
  otCap: number;            // audit: overtime hours cap
  absenceFlag: number;      // audit: absences that trigger a flag
  deductionCap: number;     // audit: max deduction % of gross
  criticalDays: number;     // compliance: critical window
  warningDays: number;      // compliance: warning window
}

export const DEFAULT_RULES: Rules = {
  auditPanel: true, rowFlags: true, fridayHighlight: true, holdRows: true,
  animations: true, compactDensity: true, pageFooter: true, footerRefresh: true, sidebarAlerts: true,
  otCap: 20, absenceFlag: 5, deductionCap: 25, criticalDays: 30, warningDays: 60,
};

function loadRules(): Rules {
  try {
    const raw = localStorage.getItem('almanar.rules');
    if (raw) return { ...DEFAULT_RULES, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_RULES;
}

interface AppState {
  year: number;
  month: number;
  worksite: string;
  nationality: string;
  status: string;
  settings: Settings;
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  setPeriod: (year: number, month: number) => void;
  toggleSidebarCollapsed: () => void;
  setWorksite: (v: string) => void;
  setNationality: (v: string) => void;
  setStatus: (v: string) => void;
  resetFilters: () => void;
  setSidebarOpen: (v: boolean) => void;
  toast: (msg: string, tone?: Toast['tone']) => void;
  rules: Rules;
  setRule: <K extends keyof Rules>(key: K, value: Rules[K]) => void;
  resetRules: () => void;
}

const AppContext = createContext<AppState | null>(null);

function loadPeriod(): { year: number; month: number } {
  try {
    const raw = localStorage.getItem('almanar.period');
    if (raw) {
      const p = JSON.parse(raw);
      if (p.year && p.month) return { year: p.year, month: p.month };
    }
  } catch { /* ignore */ }
  return { year: 2026, month: 11 };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [period, setPeriodState] = useState(loadPeriod);
  const [worksite, setWorksite] = useState('All');
  const [nationality, setNationality] = useState('All');
  const [status, setStatus] = useState('All');
  const [settings, setSettings] = useState<Settings>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('almanar.sidebar') === '1'; } catch { return false; }
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [rules, setRules] = useState<Rules>(loadRules);

  // Apply rules globally the moment they change.
  useEffect(() => {
    try { localStorage.setItem('almanar.rules', JSON.stringify(rules)); } catch { /* ignore */ }
    document.documentElement.dataset.density = rules.compactDensity ? 'compact' : 'roomy';
    setDocThresholds(rules.criticalDays, rules.warningDays);
  }, [rules]);

  const setRule = useCallback(<K extends keyof Rules>(key: K, value: Rules[K]) => {
    setRules((r) => ({ ...r, [key]: value }));
  }, []);

  const resetRules = useCallback(() => setRules(DEFAULT_RULES), []);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((v) => {
      try { localStorage.setItem('almanar.sidebar', String(!v)); } catch { /* ignore */ }
      return !v;
    });
  }, []);

  useEffect(() => {
    apiGet<Settings>('/api/settings').then((s) => {
      setSettings(s);
      setPeriodState((cur) => {
        const stored = localStorage.getItem('almanar.period');
        if (!stored && s.reporting_year && s.reporting_month) {
          return { year: s.reporting_year, month: s.reporting_month };
        }
        return cur;
      });
    }).catch(() => { /* keep defaults */ });
  }, []);

  const setPeriod = useCallback((year: number, month: number) => {
    setPeriodState({ year, month });
    localStorage.setItem('almanar.period', JSON.stringify({ year, month }));
  }, []);

  const resetFilters = useCallback(() => {
    setWorksite('All'); setNationality('All'); setStatus('All');
  }, []);

  const toast = useCallback((msg: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  return (
    <AppContext.Provider value={{
      year: period.year, month: period.month,
      worksite, nationality, status, settings, sidebarOpen, sidebarCollapsed,
      setPeriod, setWorksite, setNationality, setStatus, resetFilters, setSidebarOpen, toggleSidebarCollapsed, toast,
      rules, setRule, resetRules,
    }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 60, scale: 0.92 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              className="glass-deep pointer-events-auto flex items-center gap-2.5 rounded-xl px-4 py-3 shadow-2xl min-w-[260px] max-w-[360px]"
            >
              {t.tone === 'success' && <CheckCircle2 size={17} className="text-emerald-400 shrink-0" />}
              {t.tone === 'error' && <XCircle size={17} className="text-rose-400 shrink-0" />}
              {t.tone === 'info' && <Info size={17} className="text-sky-400 shrink-0" />}
              {t.tone !== 'success' && t.tone !== 'error' && t.tone !== 'info' && <AlertTriangle size={17} className="text-amber-400 shrink-0" />}
              <span className="text-[13px] font-semibold text-slate-200 leading-snug">{t.msg}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </AppContext.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
