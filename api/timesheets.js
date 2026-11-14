import supabase from './db-client.js';
import { cors, computeTimesheet, daysInMonth, fetchAll } from './_calc.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { year, month, worksite_id, search, employee_id, status, limit } = req.query;
      let q = supabase.from('timesheets').select(
        '*, employees!inner(id, name, emp_no, iqama, nationality, work_status, base_salary, worksite_id, worksites(id, name, city, timesheet_format, pay_method, pay_period_days, hours_per_day, absent_treatment, overtime_multiplier))'
      );
      if (year) q = q.eq('year', Number(year));
      if (month) q = q.eq('month', Number(month));
      if (employee_id) q = q.eq('employee_id', Number(employee_id));
      if (worksite_id) q = q.eq('employees.worksite_id', Number(worksite_id));
      if (search) q = q.ilike('employees.name', `%${search}%`);
      if (status && status !== 'All') q = q.eq('status', status);
      q = q.order('employee_id', { ascending: true }).order('month', { ascending: true });
      if (limit) q = q.limit(Number(limit));
      const data = await fetchAll(() => q);
      return res.status(200).json(data);
    }

    if (req.method === 'PUT') {
      const b = req.body || {};
      // Bulk status transition (approve / mark paid)
      if (Array.isArray(b.ids)) {
        if (!b.status) return res.status(400).json({ error: 'status is required' });
        const { error } = await supabase.from('timesheets').update({ status: b.status }).in('id', b.ids);
        if (error) throw error;
        return res.status(200).json({ ok: true, updated: b.ids.length });
      }
      if (!b.id) return res.status(400).json({ error: 'id is required' });

      const { data: row, error: rerr } = await supabase
        .from('timesheets')
        .select('*, employees(id, base_salary, worksites(*))')
        .eq('id', b.id)
        .single();
      if (rerr) throw rerr;
      if (!row) return res.status(404).json({ error: 'Timesheet row not found' });

      const days = Array.isArray(b.days) ? b.days.slice(0, 31) : row.days;
      const deductions = b.deductions !== undefined ? Number(b.deductions) || 0 : Number(row.deductions) || 0;
      const emp = row.employees || {};
      const ws = emp.worksites || {};
      const calc = computeTimesheet(days, { base_salary: emp.base_salary }, ws, deductions);
      const patch = { days, ...calc };
      if (b.status) patch.status = b.status;

      const { data, error } = await supabase.from('timesheets').update(patch).eq('id', b.id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.employee_id || !b.year || !b.month) return res.status(400).json({ error: 'employee_id, year and month are required' });
      const { data: emp } = await supabase.from('employees').select('*, worksites(*)').eq('id', b.employee_id).single();
      if (!emp) return res.status(404).json({ error: 'Employee not found' });
      const dim = daysInMonth(Number(b.year), Number(b.month));
      const days = Array.isArray(b.days) ? b.days : Array(dim).fill(null);
      const calc = computeTimesheet(days, emp, emp.worksites || {}, b.deductions || 0);
      const { data, error } = await supabase.from('timesheets')
        .insert({ employee_id: emp.id, year: Number(b.year), month: Number(b.month), days, status: b.status || 'Draft', ...calc })
        .select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { error } = await supabase.from('timesheets').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('timesheets API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
