export const PALETTE = ['#34d399', '#e7b958', '#38bdf8', '#a78bfa', '#fb7185', '#fbbf24', '#2dd4bf', '#f472b6', '#818cf8', '#4ade80', '#fb923c', '#94a3b8'];

export function ChartTooltip({ active, payload, label, formatter }: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string; payload?: Record<string, unknown> }>;
  label?: string;
  formatter?: (v: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const fmt = formatter || ((v: number) => v.toLocaleString('en-US'));
  return (
    <div className="glass-deep rounded-xl px-3.5 py-2.5 shadow-2xl min-w-[130px]">
      {label !== undefined && label !== '' && (
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 mb-1.5">{label}</p>
      )}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
              <span className="w-2 h-2 rounded-full" style={{ background: p.color || '#34d399' }} />
              {p.name}
            </span>
            <span className="text-[11.5px] font-bold text-slate-100 tabular">{typeof p.value === 'number' ? fmt(p.value) : p.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartGradients() {
  return (
    <defs>
      <linearGradient id="gEmerald" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#34d399" stopOpacity={0.55} />
        <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
      </linearGradient>
      <linearGradient id="gGold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#e7b958" stopOpacity={0.55} />
        <stop offset="100%" stopColor="#e7b958" stopOpacity={0.02} />
      </linearGradient>
      <linearGradient id="gRose" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fb7185" stopOpacity={0.6} />
        <stop offset="100%" stopColor="#fb7185" stopOpacity={0.05} />
      </linearGradient>
      <linearGradient id="gBarEmerald" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#34d399" />
        <stop offset="100%" stopColor="#059669" />
      </linearGradient>
      <linearGradient id="gBarGold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#f3d491" />
        <stop offset="100%" stopColor="#b3872f" />
      </linearGradient>
      <linearGradient id="gBarRose" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fda4af" />
        <stop offset="100%" stopColor="#e11d48" />
      </linearGradient>
      <linearGradient id="gBarSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#7dd3fc" />
        <stop offset="100%" stopColor="#0284c7" />
      </linearGradient>
    </defs>
  );
}

export function sarCompact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return `${v.toFixed(0)}`;
}
