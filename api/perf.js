import supabase from './db-client.js';
import { cors, fetchAll } from './_calc.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'POST') {
      const { endpoint, duration_ms, ok } = req.body || {};
      if (!endpoint || typeof duration_ms !== 'number') return res.status(400).json({ error: 'endpoint and duration_ms required' });
      // fire-and-forget insert; never block the caller's UX
      supabase.from('perf_logs').insert({ endpoint: String(endpoint).slice(0, 60), duration_ms: Math.round(duration_ms), ok: ok !== false }).then(() => undefined);
      return res.status(202).json({ ok: true });
    }

    if (req.method === 'GET') {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const logs = await fetchAll(() => supabase.from('perf_logs').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(500));

      const byEndpoint = {};
      for (const l of logs) {
        const k = l.endpoint;
        if (!byEndpoint[k]) byEndpoint[k] = { endpoint: k, calls: 0, errors: 0, durations: [] };
        byEndpoint[k].calls += 1;
        if (!l.ok) byEndpoint[k].errors += 1;
        byEndpoint[k].durations.push(l.duration_ms || 0);
      }
      const pct = (arr, p) => {
        if (!arr.length) return 0;
        const s = [...arr].sort((a, b) => a - b);
        return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
      };
      const endpoints = Object.values(byEndpoint).map((e) => ({
        endpoint: e.endpoint,
        calls: e.calls,
        errors: e.errors,
        avg: Math.round(e.durations.reduce((a, d) => a + d, 0) / Math.max(1, e.durations.length)),
        p95: pct(e.durations, 95),
        okRate: Math.round(((e.calls - e.errors) / Math.max(1, e.calls)) * 1000) / 10,
      })).sort((a, b) => b.calls - a.calls);

      const totalCalls = logs.length;
      const totalErrors = logs.filter((l) => !l.ok).length;
      const allDurations = logs.map((l) => l.duration_ms || 0);
      const avgAll = Math.round(allDurations.reduce((a, d) => a + d, 0) / Math.max(1, allDurations.length));
      const okRate = totalCalls ? ((totalCalls - totalErrors) / totalCalls) * 100 : 100;
      const latencyScore = Math.max(0, 100 - avgAll / 12);
      const score = Math.round(Math.min(100, Math.max(0, okRate * 0.5 + latencyScore * 0.5)));
      const rating = totalCalls < 5 ? 'Collecting' : score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 55 ? 'Degraded' : 'Poor';

      return res.status(200).json({
        endpoints,
        overall: { calls24h: totalCalls, errors24h: totalErrors, avgMs: avgAll, p95Ms: pct(allDurations, 95), okRate: Math.round(okRate * 10) / 10, score, rating },
        recent: logs.slice(0, 12),
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('perf API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
