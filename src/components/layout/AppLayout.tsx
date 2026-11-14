import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useApp } from '../../context/AppContext';
import { apiGet } from '../../lib/api';
import { fmtNum, fmtSAR, MONTHS_SHORT } from '../../lib/format';

interface FooterStats {
  total: number; active: number; onLeave: number; suspended: number; terminated: number;
  registerRows: number; drafts: number; approved: number; paid: number;
  pendingMonth: number; monthExpenses: number; ytdExpenses: number;
  iqamaDue: number; insDue: number; docsDue: number;
  sites: number; trackedFiles: number; updatedFiles: number;
  lastSync: string | null; lastSyncFile: string | null;
  apiAvgMs: number | null; apiOkRate: number;
  currency: string; entity: string | null;
}

function ago(iso: string | null): string {
  if (!iso) return 'never';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

type Item = [string, string];

// Page-wise footer: each route carries only its own relevant information.
function pageItems(path: string, s: FooterStats, period: string): Item[] {
  switch (path) {
    case '/employees':
      return [['Employees', fmtNum(s.total)], ['Active', fmtNum(s.active)], ['On leave', fmtNum(s.onLeave)], ['Suspended', fmtNum(s.suspended)], ['Terminated', fmtNum(s.terminated)]];
    case '/timesheet':
      return [['Register rows', fmtNum(s.registerRows)], ['Period', period], ['Draft', fmtNum(s.drafts)], ['Approved', fmtNum(s.approved)], ['Paid', fmtNum(s.paid)]];
    case '/payroll':
      return [['Payslips', fmtNum(s.registerRows)], ['Period', period], ['To approve', fmtNum(s.drafts)], ['Approved', fmtNum(s.approved)], ['Paid', fmtNum(s.paid)], ['Currency', s.currency]];
    case '/attendance':
      return [['Register rows', fmtNum(s.registerRows)], ['Period', period], ['Active workforce', fmtNum(s.active)]];
    case '/compliance':
      return [['IQAMA due ≤30d', fmtNum(s.iqamaDue)], ['Insurance due ≤30d', fmtNum(s.insDue)], ['On register', fmtNum(s.total)]];
    case '/expenses':
      return [['Month spend', fmtSAR(s.monthExpenses, { compact: true })], ['YTD expenses', fmtSAR(s.ytdExpenses, { compact: true })], ['Pending approvals', fmtNum(s.pendingMonth)], ['Currency', s.currency]];
    case '/worksites':
      return [['Worksites live', fmtNum(s.sites)], ['Active workforce', fmtNum(s.active)], ['Entity', s.entity || '—']];
    case '/import':
      return [['Tracked files', fmtNum(s.trackedFiles)], ['Last sync', `${ago(s.lastSync)}${s.lastSyncFile ? ` · ${s.lastSyncFile}` : ''}`], ['Updates detected', fmtNum(s.updatedFiles)]];
    case '/sync':
      return [['Tracked files', fmtNum(s.trackedFiles)], ['Updates detected', fmtNum(s.updatedFiles)], ['Last sync', ago(s.lastSync)], ['API', s.apiAvgMs != null ? `${s.apiAvgMs}ms · ${s.apiOkRate}% ok` : '—']];
    case '/rules':
      return [['Entity', s.entity || '—'], ['Currency', s.currency], ['Register rows', fmtNum(s.registerRows)]];
    default:
      return [['Register rows', fmtNum(s.registerRows)], ['Currency', s.currency], ['Entity', s.entity || '—'], ['YTD expenses', fmtSAR(s.ytdExpenses, { compact: true })], ['Pending approvals', fmtNum(s.pendingMonth)]];
  }
}

function FooterBar() {
  const { year, month, rules } = useApp();
  const location = useLocation();
  const [stats, setStats] = useState<FooterStats | null>(null);

  useEffect(() => {
    const load = () => apiGet<FooterStats>(`/api/footer-stats?year=${year}&month=${month}`).then(setStats).catch(() => undefined);
    load();
    if (!rules.footerRefresh) return;
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [year, month, rules.footerRefresh]);

  const period = `${MONTHS_SHORT[month - 1]}-${String(year).slice(2)}`;
  const path = location.pathname;
  const items: Item[] = stats ? pageItems(path, stats, period) : [];
  const showRenewalNote = (path === '/' || path === '/compliance') && stats && stats.docsDue > 0;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5">
      {items.map(([label, value]) => (
        <span key={label} className="text-[10.5px] font-semibold text-slate-500">
          <span className="uppercase tracking-[0.14em] text-slate-600 font-bold">{label}:</span>{' '}
          <span className="text-slate-300 font-bold">{value}</span>
        </span>
      ))}
      {!stats && <span className="text-[10.5px] font-semibold text-slate-600">Loading live figures…</span>}
      {showRenewalNote && (
        <span className="text-[10.5px] font-bold text-amber-300">
          {stats.docsDue} documents need renewal action.
        </span>
      )}
      {(path === '/' || path === '/compliance') && stats && stats.docsDue === 0 && (
        <span className="text-[10.5px] font-bold text-emerald-300">All documents compliant.</span>
      )}
    </div>
  );
}

export default function AppLayout() {
  const location = useLocation();
  const { sidebarCollapsed, rules } = useApp();
  return (
    <div className="min-h-screen">
      <div className="bg-stage" />
      <div className="bg-grid" />
      <Sidebar />
      <div className={`flex flex-col min-h-screen transition-[padding] duration-300 ${sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[248px]'}`}>
        <Topbar />
        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
          {rules.animations ? (
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <Outlet />
            </motion.div>
          ) : (
            <Outlet />
          )}
        </main>
        {rules.pageFooter && (
          <footer className="sticky bottom-0 z-40 glass-deep border-t border-white/[0.07] px-6 py-2.5">
            <FooterBar />
          </footer>
        )}
      </div>
    </div>
  );
}
