import supabase from './db-client.js';
import { cors, computeTimesheet, daysInMonth } from './_calc.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { search, worksite_id, nationality, status, limit } = req.query;
      let q = supabase
        .from('employees')
        .select('*, worksites(id, name, city, timesheet_format, pay_method, pay_period_days, hours_per_day)')
        .order('id', { ascending: true });
      if (search) q = q.or(`name.ilike.%${search}%,iqama.ilike.%${search}%,emp_no.ilike.%${search}%`);
      if (worksite_id) q = q.eq('worksite_id', Number(worksite_id));
      if (nationality && nationality !== 'All') q = q.eq('nationality', nationality);
      if (status && status !== 'All') q = q.eq('work_status', status);
      if (limit) q = q.limit(Number(limit));
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.name || !String(b.name).trim()) return res.status(400).json({ error: 'Employee name is required' });
      if (b.iqama && !/^\d{10}$/.test(String(b.iqama))) return res.status(400).json({ error: 'IQAMA number must be exactly 10 digits' });
      if (b.base_salary !== undefined && Number(b.base_salary) < 0) return res.status(400).json({ error: 'Base salary must be positive' });

      const { data: maxRow } = await supabase.from('employees').select('emp_no').order('id', { ascending: false }).limit(1);
      let nextNo = 1001;
      if (maxRow && maxRow[0]?.emp_no) {
        const m = /ALM-(\d+)/.exec(maxRow[0].emp_no);
        if (m) nextNo = Number(m[1]) + 1;
      }
      const row = {
        emp_no: `ALM-${nextNo}`,
        name: String(b.name).trim(),
        iqama: b.iqama || null, iqama_expiry: b.iqama_expiry || null, birth_date: b.birth_date || null,
        worksite_id: b.worksite_id ? Number(b.worksite_id) : null,
        sponsor: b.sponsor || null, transfer_status: b.transfer_status || 'Not Required',
        work_status: b.work_status || 'Active', joining_date: b.joining_date || null,
        mobile: b.mobile || null, nationality: b.nationality || null, bank: b.bank || null,
        iban: b.iban || null, base_salary: Number(b.base_salary) || 0,
        contract_type: b.contract_type || 'Full Time', insurance_policy: b.insurance_policy || null,
        insurance_expiry: b.insurance_expiry || null, notes: b.notes || null,
      };
      const { data, error } = await supabase.from('employees').insert(row).select('*, worksites(id, name, city)').single();
      if (error) throw error;

      // Auto-create a blank register row for the current reporting period so the
      // new hire appears on the timesheet immediately.
      const { data: ys } = await supabase.from('settings').select('value').eq('key', 'reporting_year').maybeSingle();
      const { data: ms } = await supabase.from('settings').select('value').eq('key', 'reporting_month').maybeSingle();
      const year = ys?.value?.v ?? new Date().getFullYear();
      const month = ms?.value?.v ?? new Date().getMonth() + 1;
      const { data: wsRow } = data.worksite_id
        ? await supabase.from('worksites').select('*').eq('id', data.worksite_id).maybeSingle()
        : { data: null };
      const dim = daysInMonth(year, month);
      const days = Array(dim).fill(null);
      const calc = computeTimesheet(days, row, wsRow || {}, 0);
      // A fresh register must not accrue pay before any entry is logged — start at zero.
      await supabase.from('timesheets').insert({
        employee_id: data.id, year, month, days, status: 'Draft',
        total_hours: 0, present_days: 0, absent_days: 0, paid_days: 0,
        gross_pay: 0, overtime_hours: 0, overtime_pay: 0, deductions: 0, net_pay: 0,
      });
      void calc;

      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const b = req.body || {};
      if (!b.id) return res.status(400).json({ error: 'id is required' });
      if (b.iqama && !/^\d{10}$/.test(String(b.iqama))) return res.status(400).json({ error: 'IQAMA number must be exactly 10 digits' });
      const allowed = ['name','iqama','iqama_expiry','birth_date','worksite_id','sponsor','transfer_status','work_status','joining_date','mobile','nationality','bank','iban','base_salary','contract_type','insurance_policy','insurance_expiry','notes'];
      const patch = {};
      for (const k of allowed) if (k in b) patch[k] = b[k] === '' ? null : b[k];
      if ('worksite_id' in patch && patch.worksite_id) patch.worksite_id = Number(patch.worksite_id);
      if ('base_salary' in patch) patch.base_salary = Number(patch.base_salary) || 0;
      const { data, error } = await supabase.from('employees').update(patch).eq('id', b.id).select('*, worksites(id, name, city)').single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('employees API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
