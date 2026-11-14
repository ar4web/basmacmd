export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '0';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(n));
}

export function fmtSAR(n: number | null | undefined, opts: { compact?: boolean; decimals?: number } = {}): string {
  const v = Number(n) || 0;
  if (opts.compact) {
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return `SAR ${(v / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `SAR ${(v / 1_000).toFixed(1)}K`;
    return `SAR ${v.toFixed(0)}`;
  }
  return `SAR ${new Intl.NumberFormat('en-US', { minimumFractionDigits: opts.decimals ?? 0, maximumFractionDigits: opts.decimals ?? 0 }).format(v)}`;
}

export function fmtCompact(n: number | null | undefined): string {
  const v = Number(n) || 0;
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
}

export type DocTone = 'expired' | 'critical' | 'warning' | 'ok' | 'none';

// Compliance windows \u2014 adjustable from the Rule Setup page, applied app-wide.
let DOC_THRESHOLDS = { critical: 30, warning: 60 };
export function setDocThresholds(critical: number, warning: number) {
  DOC_THRESHOLDS = { critical, warning };
}
export function getDocThresholds() { return DOC_THRESHOLDS; }

export function docTone(iso: string | null | undefined): DocTone {
  const dl = daysUntil(iso);
  if (dl === null) return 'none';
  if (dl < 0) return 'expired';
  if (dl <= DOC_THRESHOLDS.critical) return 'critical';
  if (dl <= DOC_THRESHOLDS.warning) return 'warning';
  return 'ok';
}

export function daysLeftLabel(iso: string | null | undefined): string {
  const dl = daysUntil(iso);
  if (dl === null) return 'No date';
  if (dl < 0) return `${Math.abs(dl)}d overdue`;
  if (dl === 0) return 'Expires today';
  return `${dl}d left`;
}

export const STATUS_TONE: Record<string, string> = {
  Active: 'emerald', 'On Leave': 'amber', Suspended: 'rose', Terminated: 'zinc',
  Draft: 'zinc', Approved: 'sky', Paid: 'emerald', 'On Hold': 'amber',
  Pending: 'amber', Rejected: 'rose', Operational: 'emerald',
  Transferred: 'emerald', 'Transfer Pending': 'amber', 'Under Process': 'sky', 'Not Required': 'zinc',
  'Full Time': 'emerald', Contract: 'sky', 'Part Time': 'violet', Temporary: 'amber',
};

export const AVATAR_HUES = [158, 42, 200, 262, 330, 12, 96, 184, 224, 282];
export function avatarHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
