import { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Loader2, Inbox } from 'lucide-react';
import { avatarHue, initials } from '../../lib/format';

/* ---------- Card ---------- */
export function Card({ children, className = '', hover = false }: { children: ReactNode; className?: string; hover?: boolean }) {
  return (
    <div className={`glass rounded-2xl ${hover ? 'card-hover' : ''} ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ icon: Icon, title, sub, right, tone = 'emerald' }: {
  icon?: React.ElementType; title: string; sub?: string; right?: ReactNode; tone?: 'emerald' | 'gold' | 'rose' | 'sky' | 'amber' | 'violet';
}) {
  const tones: Record<string, string> = {
    emerald: 'from-emerald-500/25 to-emerald-500/5 text-emerald-300 border-emerald-400/20',
    gold: 'from-gold-500/25 to-gold-500/5 text-gold-300 border-gold-400/25',
    rose: 'from-rose-500/25 to-rose-500/5 text-rose-300 border-rose-400/20',
    sky: 'from-sky-500/25 to-sky-500/5 text-sky-300 border-sky-400/20',
    amber: 'from-amber-500/25 to-amber-500/5 text-amber-300 border-amber-400/20',
    violet: 'from-violet-500/25 to-violet-500/5 text-violet-300 border-violet-400/20',
  };
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br border flex items-center justify-center shrink-0 ${tones[tone]}`}>
            <Icon size={17} strokeWidth={2.2} />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-display text-[15px] font-600 tracking-wide text-slate-100 font-semibold truncate">{title}</h3>
          {sub && <p className="text-[11.5px] text-slate-500 font-medium mt-0.5 truncate">{sub}</p>}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

/* ---------- Badge ---------- */
const BADGE_TONES: Record<string, string> = {
  emerald: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/25',
  rose: 'bg-rose-400/10 text-rose-300 border-rose-400/25',
  amber: 'bg-amber-400/10 text-amber-300 border-amber-400/25',
  sky: 'bg-sky-400/10 text-sky-300 border-sky-400/25',
  violet: 'bg-violet-400/10 text-violet-300 border-violet-400/25',
  gold: 'bg-gold-400/10 text-gold-300 border-gold-400/30',
  zinc: 'bg-slate-400/10 text-slate-400 border-slate-400/20',
};

export function Badge({ children, tone = 'zinc', dot = true, className = '' }: { children: ReactNode; tone?: string; dot?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[10.5px] font-bold tracking-wide uppercase ${BADGE_TONES[tone] || BADGE_TONES.zinc} ${className}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* ---------- Buttons ---------- */
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'gold' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'xs';
  loading?: boolean;
  icon?: React.ElementType;
}

export function Button({ children, variant = 'primary', size = 'md', loading = false, icon: Icon, className = '', disabled, ...rest }: BtnProps) {
  const variants: Record<string, string> = {
    primary: 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-emerald-950 font-bold shadow-[0_8px_24px_-8px_rgba(16,185,129,0.6)] hover:from-emerald-400 hover:to-emerald-500 border border-emerald-300/30',
    gold: 'bg-gradient-to-br from-gold-400 to-gold-600 text-ink-950 font-bold shadow-[0_8px_24px_-8px_rgba(231,185,88,0.5)] hover:brightness-110 border border-gold-300/40',
    ghost: 'bg-white/[0.04] text-slate-300 border border-white/[0.09] hover:bg-white/[0.08] hover:text-white',
    outline: 'bg-transparent text-emerald-300 border border-emerald-400/30 hover:bg-emerald-400/10',
    danger: 'bg-rose-500/15 text-rose-300 border border-rose-400/30 hover:bg-rose-500/25',
  };
  const sizes: Record<string, string> = {
    xs: 'px-2.5 py-1.5 text-[11px] rounded-lg gap-1.5',
    sm: 'px-3.5 py-2 text-xs rounded-xl gap-1.5',
    md: 'px-4 py-2.5 text-[13px] rounded-xl gap-2',
  };
  return (
    <button
      className={`inline-flex items-center justify-center font-semibold transition-all duration-200 active:scale-[0.97] disabled:opacity-45 disabled:pointer-events-none ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : Icon ? <Icon size={size === 'md' ? 16 : 14} strokeWidth={2.4} /> : null}
      {children}
    </button>
  );
}

/* ---------- Form fields ---------- */
export function Field({ label, error, children, className = '' }: { label: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-1.5">{label}</label>
      {children}
      {error && <p className="mt-1 text-[11px] font-semibold text-rose-400">{error}</p>}
    </div>
  );
}

const inputBase = 'w-full rounded-xl bg-white/[0.04] border border-white/[0.09] px-3.5 py-2.5 text-[13px] font-medium text-slate-200 placeholder:text-slate-600 outline-none transition-all focus:border-emerald-400/50 focus:bg-emerald-400/[0.04] focus:ring-2 focus:ring-emerald-400/15';

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputBase} ${className}`} {...rest} />;
}

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${inputBase} cursor-pointer appearance-none pr-8 bg-no-repeat ${className}`}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237d8aa0' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundPosition: 'right 12px center' }}
      {...rest}
    >
      {children}
    </select>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, sub, children, wide = false }: {
  open: boolean; onClose: () => void; title: string; sub?: string; children: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className={`glass-deep rounded-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[88vh] overflow-y-auto shadow-2xl`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-white/[0.06] sticky top-0 bg-ink-900/80 backdrop-blur-xl z-10">
              <div>
                <h2 className="font-display text-lg font-semibold text-white">{title}</h2>
                {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                <X size={15} />
              </button>
            </div>
            <div className="p-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Drawer ---------- */
export function Drawer({ open, onClose, title, sub, children, width = 480 }: {
  open: boolean; onClose: () => void; title: ReactNode; sub?: string; children: ReactNode; width?: number;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="absolute right-0 top-0 h-full glass-deep border-l border-white/10 overflow-y-auto shadow-2xl"
            style={{ width: `min(${width}px, 94vw)` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-white/[0.06] sticky top-0 bg-ink-900/85 backdrop-blur-xl z-10">
              <div className="min-w-0">
                <div className="font-display text-lg font-semibold text-white truncate">{title}</div>
                {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-slate-400 hover:text-white transition-colors shrink-0 ml-3">
                <X size={15} />
              </button>
            </div>
            <div className="p-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Loading / empty ---------- */
export function Spinner({ label = 'Loading data…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="relative w-11 h-11">
        <div className="absolute inset-0 rounded-full border-2 border-emerald-400/15" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-400 animate-spin" />
        <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-gold-400/70 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.4s' }} />
      </div>
      <p className="text-xs font-semibold text-slate-500 tracking-wide">{label}</p>
    </div>
  );
}

export function EmptyState({ title, sub, icon: Icon = Inbox, action }: { title: string; sub?: string; icon?: React.ElementType; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-2 text-center">
      <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-500 mb-1">
        <Icon size={20} />
      </div>
      <p className="text-sm font-bold text-slate-300">{title}</p>
      {sub && <p className="text-xs text-slate-500 max-w-[300px]">{sub}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
      <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-400/25 flex items-center justify-center text-rose-400">
        <X size={20} />
      </div>
      <p className="text-sm font-bold text-rose-300">Something went wrong</p>
      <p className="text-xs text-slate-500 max-w-[340px]">{message}</p>
      {onRetry && <Button variant="ghost" size="sm" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-white/[0.05] ${className}`} />;
}

/* ---------- Avatar ---------- */
export function Avatar({ name, size = 36, className = '' }: { name: string; size?: number; className?: string }) {
  const hue = avatarHue(name);
  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold shrink-0 border ${className}`}
      style={{
        width: size, height: size, fontSize: size * 0.34,
        background: `linear-gradient(135deg, hsl(${hue} 45% 22%), hsl(${(hue + 40) % 360} 55% 14%))`,
        borderColor: `hsl(${hue} 60% 45% / 0.4)`,
        color: `hsl(${hue} 80% 78%)`,
      }}
    >
      {initials(name)}
    </div>
  );
}

/* ---------- Progress bar ---------- */
export function ProgressBar({ value, max = 100, tone = 'emerald', className = '' }: { value: number; max?: number; tone?: 'emerald' | 'gold' | 'rose' | 'sky' | 'amber'; className?: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const tones: Record<string, string> = {
    emerald: 'from-emerald-500 to-emerald-300',
    gold: 'from-gold-500 to-gold-300',
    rose: 'from-rose-500 to-rose-300',
    sky: 'from-sky-500 to-sky-300',
    amber: 'from-amber-500 to-amber-300',
  };
  return (
    <div className={`h-1.5 rounded-full bg-white/[0.06] overflow-hidden ${className}`}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className={`h-full rounded-full bg-gradient-to-r ${tones[tone]}`}
      />
    </div>
  );
}
