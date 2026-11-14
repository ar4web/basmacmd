import supabase from './db-client.js';
import { cors } from './_calc.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('worksites').select('*').order('id', { ascending: true });
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.name) return res.status(400).json({ error: 'Worksite name is required' });
      const { data, error } = await supabase.from('worksites').insert({
        name: b.name, city: b.city || null, monthly_salary: Number(b.monthly_salary) || 0,
        pay_period_days: Number(b.pay_period_days) || 26, hours_per_day: Number(b.hours_per_day) || 8,
        timesheet_format: b.timesheet_format || '8-Hour Daily', absent_treatment: b.absent_treatment || 'Unpaid',
        pay_method: b.pay_method || 'Daily Rate', overtime_multiplier: Number(b.overtime_multiplier) || 1.5,
        notes: b.notes || null, status: b.status || 'Operational',
      }).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      const b = req.body || {};
      if (!b.id) return res.status(400).json({ error: 'id is required' });
      const allowed = ['name','city','monthly_salary','pay_period_days','hours_per_day','timesheet_format','absent_treatment','pay_method','overtime_multiplier','notes','status'];
      const patch = {};
      for (const k of allowed) if (k in b) patch[k] = b[k];
      const { data, error } = await supabase.from('worksites').update(patch).eq('id', b.id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { error } = await supabase.from('worksites').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('worksites API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
