import { useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Users, CalendarClock, Activity, ShieldCheck, Wallet, Receipt, Building2, X, FolderSync, FileClock, BellRing, Fingerprint, HeartPulse, SlidersHorizontal,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiGet } from '../../lib/api';

interface AlertItem { employee: string; emp_no: string; doc: string; expiry: string; daysLeft: number; worksite: string }

function AlertsPanel() {
  const [notifs, setNotifs] = useState<{ count: number; items: AlertItem[] }>({ count: 0, items: [] });

  useEffect(() => {
    const fetchNotifs = () => apiGet<{ count: number; items: AlertItem[] }>('/api/notifications').then(setNotifs).catch(() => undefined);
    fetchNotifs();
    const t = setInterval(fetchNotifs, 60000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="rounded-xl border border-rose-400/20 bg-gradient-to-br from-rose-500/[0.08] to-transparent overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 pt-3 pb-2">
        <div className="relative">
          <BellRing size={14} className="text-rose-300" />
          {notifs.count > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-400" style={{ animation: 'pulse-dot 2s infinite' }} />}
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-rose-300">Alert Panel</p>
        <span className="ml-auto text-[9.5px] font-bold rounded-full bg-rose-400/15 border border-rose-400/25 text-rose-300 px-1.5 py-px tabular">{notifs.count}</span>
      </div>
      <div className="max-h-[168px] overflow-y-auto px-1.5 pb-1.5 space-y-1">
        {notifs.items.length === 0 && (
          <p className="text-[10px] font-semibold text-slate-500 px-2.5 py-3 text-center">All documents compliant — no alerts.</p>
        )}
        {notifs.items.slice(0, 4).map((n, i) => (
          <Link to="/compliance" key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.05] transition-colors">
            <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${n.doc === 'IQAMA' ? 'bg-sky-400/10 text-sky-300' : 'bg-rose-400/10 text-rose-300'}`}>
              {n.doc === 'IQAMA' ? <Fingerprint size={11} /> : <HeartPulse size={11} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-bold text-slate-200 truncate leading-tight">{n.employee}</p>
              <p className="text-[8.5px] font-semibold text-slate-500">{n.doc} renewal</p>
            </div>
            <span className={`text-[9px] font-bold rounded-full px-1.5 py-px shrink-0 tabular ${n.daysLeft < 0 ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-400/15 text-amber-300'}`}>
              {n.daysLeft < 0 ? `${Math.abs(n.daysLeft)}d over` : `${n.daysLeft}d`}
            </span>
          </Link>
        ))}
      </div>
      <Link to="/compliance" className="block text-center py-2 text-[9.5px] font-bold uppercase tracking-[0.14em] text-rose-300/90 hover:bg-rose-400/10 transition-colors border-t border-rose-400/15">
        View all alerts →
      </Link>
    </div>
  );
}

const NAV = [
  {
    group: 'Overview',
    items: [{ to: '/', label: 'Command Center', icon: LayoutDashboard }],
  },
  {
    group: 'Workforce',
    items: [
      { to: '/employees', label: 'Employees', icon: Users },
      { to: '/timesheet', label: 'Timesheet', icon: CalendarClock },
      { to: '/attendance', label: 'Attendance', icon: Activity },
      { to: '/compliance', label: 'Compliance', icon: ShieldCheck },
    ],
  },
  {
    group: 'Finance',
    items: [
      { to: '/payroll', label: 'Payroll', icon: Wallet },
      { to: '/expenses', label: 'Expenses', icon: Receipt },
    ],
  },
  {
    group: 'Operations',
    items: [
      { to: '/worksites', label: 'Worksites', icon: Building2 },
      { to: '/import', label: 'Data Import', icon: FolderSync },
      { to: '/sync', label: 'File Sync', icon: FileClock },
      { to: '/rules', label: 'Rule Setup', icon: SlidersHorizontal },
    ],
  },
];

function Logo({ rail = false }: { rail?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-5 pt-6 pb-5 ${rail ? 'lg:px-0 lg:justify-center' : ''}`}>
      <div className={`relative w-11 h-11 shrink-0 ${rail ? 'lg:w-12 lg:h-12' : ''}`}>
        <svg viewBox="0 0 64 64" className="w-full h-full drop-shadow-[0_0_14px_rgba(16,185,129,0.45)]">
          <defs>
            <linearGradient id="lg-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#34d399" /><stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="lg-gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f3d491" /><stop offset="100%" stopColor="#b3872f" />
            </linearGradient>
          </defs>
          <path d="M32 3 57 17.5v29L32 61 7 46.5v-29Z" fill="#0b1220" stroke="url(#lg-g)" strokeWidth="3" />
          <path d="M20 44V22l12 12 12-12v22" fill="none" stroke="url(#lg-gold)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="32" cy="14" r="2.6" fill="url(#lg-g)" />
        </svg>
      </div>
      <div className={`min-w-0 ${rail ? 'lg:hidden' : ''}`}>
        <p className="font-display font-bold text-[15px] tracking-[0.12em] text-white leading-none">BASMAT</p>
        <p className="text-[9.5px] font-bold tracking-[0.28em] text-emerald-400/90 mt-1.5 uppercase">Command Center</p>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const { sidebarOpen, setSidebarOpen, sidebarCollapsed, rules } = useApp();
  const location = useLocation();
  const rail = sidebarCollapsed; // desktop icon-rail mode

  return (
    <>
      {/* mobile backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside
        className={`fixed top-0 left-0 z-[80] h-full w-[248px] glass-deep border-r border-white/[0.07] flex flex-col transition-[width,transform] duration-300 lg:translate-x-0 ${rail ? 'lg:w-[72px]' : 'lg:w-[248px]'} ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-start justify-between">
          <Logo rail={rail} />
          <button className="lg:hidden mt-5 mr-4 text-slate-500 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
          {NAV.map((section) => (
            <div key={section.group}>
              <p className={`px-3 mb-2 text-[9.5px] font-bold uppercase tracking-[0.24em] text-slate-600 ${rail ? 'lg:hidden' : ''}`}>{section.group}</p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const active = location.pathname === item.to;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      title={item.label}
                      onClick={() => setSidebarOpen(false)}
                      className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all duration-200 group ${rail ? 'lg:justify-center lg:p-0 lg:w-12 lg:h-12 lg:mx-auto' : ''} ${
                        active ? 'text-white bg-white/[0.06]' : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.035]'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="nav-glow"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-full bg-gradient-to-b from-emerald-300 to-emerald-600 shadow-[0_0_12px_rgba(16,185,129,0.8)]"
                        />
                      )}
                      <item.icon
                        size={17}
                        strokeWidth={2.1}
                        className={active ? 'text-emerald-400' : 'text-slate-500 group-hover:text-emerald-300/80 transition-colors'}
                      />
                      <span className={rail ? 'lg:hidden' : ''}>{item.label}</span>
                      {active && <span className={`ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 ${rail ? 'lg:hidden' : ''}`} style={{ animation: 'pulse-dot 2s infinite' }} />}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-white/[0.06] space-y-2.5">
          {rules.sidebarAlerts && (
            <div className={rail ? 'lg:hidden' : ''}>
              <AlertsPanel />
            </div>
          )}
          {rail && rules.sidebarAlerts && (
            <Link to="/compliance" title="Open alert panel"
              className="hidden lg:flex relative w-12 h-12 mx-auto items-center justify-center border border-rose-400/25 bg-rose-500/[0.08] text-rose-300 hover:bg-rose-500/[0.15] transition-colors">
              <BellRing size={15} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-rose-400" style={{ animation: 'pulse-dot 2s infinite' }} />
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
