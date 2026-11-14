import supabase from './db-client.js';
import { cors } from './_calc.js';

// Lightweight aggregate for the app-shell footer — count-only queries, no row payloads.
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const year = Number(req.query.year) || 2026;
    const month = Number(req.query.month) || 11;
    const mm = String(month).padStart(2, '0');

    const headCount = async (table, build) => {
      let q = supabase.from(table).select('*', { count: 'exact', head: true });
      if (build) q = build(q);
      const { count, error } = await q;
      if (error) throw error;
      return count || 0;
    };

    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    const [
      total, active, onLeave, suspended, terminated,
      registerRows, drafts, approved, paid,
      pendingMonth, monthRows, ytdRows,
      iqamaDue, insDue, sites,
      trackedFiles, updatedFiles, syncRow, perfRows, settingsRows,
    ] = await Promise.all([
      headCount('employees'),
      headCount('employees', (q) => q.eq('work_status', 'Active')),
      headCount('employees', (q) => q.eq('work_status', 'On Leave')),
      headCount('employees', (q) => q.eq('work_status', 'Suspended')),
      headCount('employees', (q) => q.eq('work_status', 'Terminated')),
      headCount('timesheets', (q) => q.eq('year', year).eq('month', month)),
      headCount('timesheets', (q) => q.eq('year', year).eq('month', month).eq('status', 'Draft')),
      headCount('timesheets', (q) => q.eq('year', year).eq('month', month).eq('status', 'Approved')),
      headCount('timesheets', (q) => q.eq('year', year).eq('month', month).eq('status', 'Paid')),
      headCount('expenses', (q) => q.eq('status', 'Pending').gte('expense_date', `${year}-${mm}-01`).lte('expense_date', `${year}-${mm}-31`)),
      supabase.from('expenses').select('amount').gte('expense_date', `${year}-${mm}-01`).lte('expense_date', `${year}-${mm}-31`),
      supabase.from('expenses').select('amount').gte('expense_date', `${year}-01-01`).lte('expense_date', `${year}-12-31`),
      headCount('employees', (q) => q.not('iqama_expiry', 'is', null).lte('iqama_expiry', in30).neq('work_status', 'Terminated')),
      headCount('employees', (q) => q.not('insurance_expiry', 'is', null).lte('insurance_expiry', in30).neq('work_status', 'Terminated')),
      headCount('worksites', (q) => q.eq('status', 'Operational')),
      headCount('sync_files'),
      headCount('sync_files', (q) => q.eq('status', 'Updated')),
      supabase.from('sync_files').select('last_synced_at, file_name').order('last_synced_at', { ascending: false }).limit(1),
      supabase.from('perf_logs').select('duration_ms, ok').gte('created_at', new Date(Date.now() - 3600000).toISOString()).limit(200),
      supabase.from('settings').select('key, value'),
    ]);

    const monthExpenses = Math.round((monthRows.data || []).reduce((a, r) => a + (Number(r.amount) || 0), 0));
    const ytdExpenses = Math.round((ytdRows.data || []).reduce((a, r) => a + (Number(r.amount) || 0), 0));
    const settingsMap = {};
    for (const s of settingsRows.data || []) settingsMap[s.key] = s.value?.v ?? s.value;
    const perf = perfRows.data || [];
    const apiAvgMs = perf.length ? Math.round(perf.reduce((a, r) => a + (r.duration_ms || 0), 0) / perf.length) : null;
    const apiOkRate = perf.length ? Math.round((perf.filter((r) => r.ok).length / perf.length) * 1000) / 10 : 100;

    return res.status(200).json({
      total, active, onLeave, suspended, terminated,
      registerRows, drafts, approved, paid,
      pendingMonth, monthExpenses, ytdExpenses,
      iqamaDue: iqamaDue || 0, insDue: insDue || 0, docsDue: (iqamaDue || 0) + (insDue || 0),
      sites, trackedFiles, updatedFiles,
      lastSync: syncRow.data?.[0]?.last_synced_at || null,
      lastSyncFile: syncRow.data?.[0]?.file_name || null,
      apiAvgMs, apiOkRate,
      currency: settingsMap.currency || 'SAR',
      entity: settingsMap.company_name || null,
    });
  } catch (err) {
    console.error('footer-stats API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
