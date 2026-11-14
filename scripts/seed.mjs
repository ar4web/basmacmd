import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^"|"$/g,'')];}));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const seed = JSON.parse(fs.readFileSync('scripts/seed-data.json','utf8'));

const { data: wsRows } = await sb.from('worksites').select('id,name');
const wsId = Object.fromEntries(wsRows.map(w=>[w.name,w.id]));

// Employees
const empRows = seed.employees.map(e => ({
  emp_no: e.emp_no, name: e.name, iqama: e.iqama, iqama_expiry: e.iqama_expiry,
  birth_date: e.birth_date, worksite_id: wsId[e.worksite], sponsor: e.sponsor,
  transfer_status: e.transfer_status, work_status: e.work_status,
  joining_date: e.joining_date, mobile: e.mobile, nationality: e.nationality,
  bank: e.bank, iban: e.iban, base_salary: e.base_salary,
  contract_type: e.contract_type, insurance_policy: e.insurance_policy,
  insurance_expiry: e.insurance_expiry, notes: e.notes,
}));
const empIds = [];
for (let i = 0; i < empRows.length; i += 50) {
  const batch = empRows.slice(i, i+50);
  const { data, error } = await sb.from('employees').insert(batch).select('id');
  if (error) { console.error('EMP ERR', error.message); process.exit(1); }
  data.forEach(d => empIds.push(d.id));
  process.stdout.write(`employees ${Math.min(i+50, empRows.length)}/${empRows.length}\r`);
}
console.log('\nemployees done:', empIds.length);

// Timesheets
const tsRows = seed.timesheets.map(t => ({
  employee_id: empIds[t.emp_index], year: t.year, month: t.month, days: t.days,
  total_hours: t.total_hours, present_days: t.present_days, absent_days: t.absent_days,
  paid_days: t.paid_days, gross_pay: t.gross_pay, overtime_hours: t.overtime_hours,
  overtime_pay: t.overtime_pay, deductions: t.deductions, net_pay: t.net_pay, status: t.status,
}));
for (let i = 0; i < tsRows.length; i += 100) {
  const { error } = await sb.from('timesheets').insert(tsRows.slice(i, i+100));
  if (error) { console.error('TS ERR', error.message); process.exit(1); }
  process.stdout.write(`timesheets ${Math.min(i+100, tsRows.length)}/${tsRows.length}\r`);
}
console.log('\ntimesheets done:', tsRows.length);

// Expenses
const exRows = seed.expenses.map(e => ({
  expense_date: e.expense_date, category: e.category, description: e.description,
  vendor: e.vendor, amount: e.amount, worksite_id: e.worksite ? wsId[e.worksite] : null,
  payment_method: e.payment_method, reference: e.reference, status: e.status,
}));
for (let i = 0; i < exRows.length; i += 100) {
  const { error } = await sb.from('expenses').insert(exRows.slice(i, i+100));
  if (error) { console.error('EXP ERR', error.message); process.exit(1); }
  process.stdout.write(`expenses ${Math.min(i+100, exRows.length)}/${exRows.length}\r`);
}
console.log('\nexpenses done:', exRows.length);
console.log('SEED COMPLETE');
