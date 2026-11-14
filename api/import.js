import supabase from './db-client.js';
import { cors, computeTimesheet, daysInMonth } from './_calc.js';

const norm = (s) => String(s ?? '').trim().toLowerCase();
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const str = (v) => (v === undefined || v === null || v === '' ? null : String(v).trim());

/* ---------------- employees ---------------- */
async function importEmployees(rows) {
  const { data: worksites } = await supabase.from('worksites').select('id,name');
  const wsMap = new Map((worksites || []).map((w) => [norm(w.name), w.id]));
  const { data: existing } = await supabase.from('employees').select('id, iqama, emp_no');
  const byIqama = new Map((existing || []).filter((e) => e.iqama).map((e) => [String(e.iqama), e.id]));
  const byEmpNo = new Map((existing || []).filter((e) => e.emp_no).map((e) => [e.emp_no, e.id]));
  let maxNo = Math.max(1000, ...(existing || []).map((e) => { const m = /ALM-(\d+)/.exec(e.emp_no || ''); return m ? Number(m[1]) : 1000; }));

  const report = { inserted: 0, updated: 0, errors: [] };
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      if (!str(r.name)) throw new Error('Missing employee name');
      if (r.iqama && !/^\d{10}$/.test(String(r.iqama))) throw new Error(`IQAMA "${r.iqama}" must be 10 digits`);
      const rec = {
        name: str(r.name), iqama: str(r.iqama), iqama_expiry: str(r.iqama_expiry),
        birth_date: str(r.birth_date), worksite_id: wsMap.get(norm(r.worksite)) ?? null,
        sponsor: str(r.sponsor), transfer_status: str(r.transfer_status) || 'Not Required',
        work_status: str(r.work_status) || 'Active', joining_date: str(r.joining_date),
        mobile: str(r.mobile), nationality: str(r.nationality), bank: str(r.bank),
        iban: str(r.iban), base_salary: num(r.base_salary),
        contract_type: str(r.contract_type) || 'Full Time',
        insurance_policy: str(r.insurance_policy), insurance_expiry: str(r.insurance_expiry),
        notes: str(r.notes),
      };
      const id = (rec.iqama && byIqama.get(rec.iqama)) || (r.emp_no && byEmpNo.get(String(r.emp_no).trim()));
      if (id) {
        const { error } = await supabase.from('employees').update(rec).eq('id', id);
        if (error) throw error;
        report.updated += 1;
      } else {
        maxNo += 1;
        const emp_no = `ALM-${maxNo}`;
        const { data, error } = await supabase.from('employees').insert({ emp_no, ...rec }).select('id').single();
        if (error) throw error;
        byIqama.set(rec.iqama || emp_no, data.id);
        byEmpNo.set(emp_no, data.id);
        report.inserted += 1;
      }
    } catch (err) {
      report.errors.push({ row: i + 1, message: err.message });
    }
  }
  return report;
}

/* ---------------- timesheets (salary register) ---------------- */
async function importTimesheets(rows) {
  const { data: emps } = await supabase.from('employees').select('id, name, iqama, base_salary, worksites(*)');
  const byIqama = new Map((emps || []).filter((e) => e.iqama).map((e) => [String(e.iqama), e]));
  const byName = new Map((emps || []).map((e) => [norm(e.name), e]));

  const report = { inserted: 0, updated: 0, errors: [] };
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      const emp = (r.iqama && byIqama.get(String(r.iqama))) || byName.get(norm(r.employee || r.name));
      if (!emp) throw new Error(`No employee matches "${r.employee || r.name || r.iqama}"`);
      const year = num(r.year);
      const month = num(r.month);
      if (!year || !month || month < 1 || month > 12) throw new Error(`Invalid period ${year}/${month}`);
      const dim = daysInMonth(year, month);
      const days = (Array.isArray(r.days) ? r.days : []).slice(0, dim);
      while (days.length < dim) days.push(null);
      const calc = computeTimesheet(days, emp, emp.worksites || {}, num(r.deductions));
      const payload = { days, ...calc, status: str(r.status) || 'Draft' };

      const { data: existing } = await supabase.from('timesheets')
        .select('id').eq('employee_id', emp.id).eq('year', year).eq('month', month).maybeSingle();
      if (existing) {
        const { error } = await supabase.from('timesheets').update(payload).eq('id', existing.id);
        if (error) throw error;
        report.updated += 1;
      } else {
        const { error } = await supabase.from('timesheets').insert({ employee_id: emp.id, year, month, ...payload });
        if (error) throw error;
        report.inserted += 1;
      }
    } catch (err) {
      report.errors.push({ row: i + 1, message: err.message });
    }
  }
  return report;
}

/* ---------------- expenses ---------------- */
async function importExpenses(rows) {
  const { data: worksites } = await supabase.from('worksites').select('id,name');
  const wsMap = new Map((worksites || []).map((w) => [norm(w.name), w.id]));
  const { data: existing } = await supabase.from('expenses').select('reference');
  const refSet = new Set((existing || []).map((e) => e.reference));
  let maxSeq = Math.max(0, ...(existing || []).map((e) => { const m = /(\d+)$/.exec(e.reference || ''); return m ? Number(m[1]) : 0; }));

  const report = { inserted: 0, updated: 0, skipped: 0, errors: [] };
  const batch = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      if (!str(r.expense_date)) throw new Error('Missing date');
      if (!str(r.category)) throw new Error('Missing category');
      const amount = num(r.amount);
      if (amount <= 0) throw new Error('Amount must be positive');
      if (r.reference && refSet.has(String(r.reference))) { report.skipped += 1; continue; }
      maxSeq += 1;
      const ym = String(r.expense_date).slice(0, 7).replace('-', '');
      const reference = str(r.reference) || `EXP-${ym}-${String(maxSeq).padStart(4, '0')}`;
      refSet.add(reference);
      batch.push({
        expense_date: str(r.expense_date), category: str(r.category), description: str(r.description),
        vendor: str(r.vendor), amount,
        worksite_id: wsMap.get(norm(r.worksite)) ?? null,
        payment_method: str(r.payment_method) || 'Bank Transfer',
        reference, status: str(r.status) || 'Pending',
      });
    } catch (err) {
      report.errors.push({ row: i + 1, message: err.message });
    }
  }
  for (let i = 0; i < batch.length; i += 200) {
    const { error } = await supabase.from('expenses').insert(batch.slice(i, i + 200));
    if (error) {
      report.errors.push({ row: i + 1, message: error.message });
    } else {
      report.inserted += Math.min(200, batch.length - i);
    }
  }
  return report;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { resource, rows } = req.body || {};
    if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'rows array is required' });
    if (rows.length > 1500) return res.status(400).json({ error: 'Max 1500 rows per batch' });

    if (resource === 'employees') return res.status(200).json(await importEmployees(rows));
    if (resource === 'timesheets') return res.status(200).json(await importTimesheets(rows));
    if (resource === 'expenses') return res.status(200).json(await importExpenses(rows));
    return res.status(400).json({ error: `Unknown resource "${resource}"` });
  } catch (err) {
    console.error('import API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
