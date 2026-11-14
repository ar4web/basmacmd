import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Menu, ChevronRight, Sun, Moon, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiGet } from '../../lib/api';
import { Avatar } from '../ui/primitives';



interface SearchEmp { id: number; name: string; emp_no: string; iqama: string | null; work_status: string; worksites?: { name: string } | null }

function ThemeToggle() {
  const [theme, setTheme] = useState<string>(() => {
    try { return localStorage.getItem('almanar.theme') || 'dark'; } catch { return 'dark'; }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('almanar.theme', theme); } catch { /* ignore */ }
  }, [theme]);
  const dark = theme === 'dark';
  return (
    <button
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="relative w-[62px] h-9 rounded-full border border-white/[0.1] bg-white/[0.05] flex items-center px-1 transition-all hover:border-emerald-400/40"
    >
      <span
        className="absolute w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_0_14px_rgba(16,185,129,0.5)] flex items-center justify-center transition-all duration-300"
        style={{ left: dark ? '4px' : 'calc(100% - 32px)' }}
      >
        {dark ? <Moon size={13} className="text-emerald-950" /> : <Sun size={13} className="text-emerald-950" />}
      </span>
      <Sun size={12} className="ml-auto mr-2 text-amber-300/70" />
      <Moon size={12} className="ml-2 mr-auto text-slate-500" />
    </button>
  );
}

export default function Topbar() {
  const { setSidebarOpen, sidebarCollapsed, toggleSidebarCollapsed } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchEmp[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      apiGet<SearchEmp[]>(`/api/employees?search=${encodeURIComponent(query.trim())}&limit=6`)
        .then((r) => { setResults(r); setSearchOpen(true); })
        .catch(() => undefined);
    }, 240);
    return () => clearTimeout(t);
  }, [query]);

  const goToEmployee = (name: string) => {
    setSearchOpen(false);
    setQuery('');
    navigate(`/employees?q=${encodeURIComponent(name)}`);
  };

  return (
    <header className="sticky top-0 z-[60] glass-deep border-b border-white/[0.06] px-4 sm:px-6 py-3 flex items-center gap-3">
      <button className="lg:hidden w-9 h-9 rounded-xl bg-white/[0.05] flex items-center justify-center text-slate-300" onClick={() => setSidebarOpen(true)}>
        <Menu size={17} />
      </button>
      <button
        className="hidden lg:flex w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] items-center justify-center text-slate-400 hover:text-white hover:border-emerald-400/40 transition-all"
        onClick={toggleSidebarCollapsed}
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
      </button>

      <div className="min-w-0">
        <h1 className="font-mono text-[13px] sm:text-sm font-bold text-slate-200 tracking-wide truncate">
          {location.pathname}
        </h1>
      </div>

      <div ref={searchRef} className="relative ml-auto hidden md:block w-[240px] lg:w-[320px]">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setSearchOpen(true)}
          placeholder="Search employee, IQAMA, ID…"
          className="w-full h-9 rounded-full border border-white/[0.1] bg-white/[0.05] pl-9 pr-4 text-[12.5px] font-medium text-slate-200 placeholder:text-slate-600 outline-none focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/10 transition-all"
        />
        <AnimatePresence>
          {searchOpen && results.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
              className="absolute top-full mt-2 left-0 right-0 glass-deep rounded-xl overflow-hidden shadow-2xl"
            >
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => goToEmployee(r.name)}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-white/[0.05] transition-colors text-left"
                >
                  <Avatar name={r.name} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-bold text-slate-200 truncate">{r.name}</p>
                    <p className="text-[10px] text-slate-500 font-semibold">{r.emp_no} · {r.worksites?.name || 'Unassigned'}</p>
                  </div>
                  <ChevronRight size={13} className="text-slate-600" />
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ThemeToggle />
    </header>
  );
}
