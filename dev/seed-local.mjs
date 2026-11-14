// Seed the local JSON store from scripts/seed-data.json (no Supabase needed).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { store, table, nextId, flush } from './store.mjs';

export function seed({ log = () => {} } = {}) {
  const data = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'scripts/seed-data.json'), 'utf8'),
  );

  const wsId = {};
  for (const w of data.worksites) {
    const rec = { id: nextId('worksites'), ...w };
    table('worksites').push(rec);
    wsId[w.name] = rec.id;
  }
  log(`worksites: ${data.worksites.length}`);

  const empIds = [];
  data.employees.forEach((e, i) => {
    const rec = {
      id: nextId('employees'),
      emp_no: e.emp_no || `ALM-${1001 + i}`,
      name: e.name,
      iqama: e.iqama,
      iqama_expiry: e.iqama_expiry,
      birth_date: e.birth_date,
      worksite_id: e.worksite ? wsId[e.worksite] ?? null : null,
      sponsor: e.sponsor,
      transfer_status: e.transfer_status,
      work_status: e.work_status,
      joining_date: e.joining_date,
      mobile: e.mobile,
      nationality: e.nationality,
      bank: e.bank,
      iban: e.iban,
      base_salary: e.base_salary,
      contract_type: e.contract_type,
      insurance_policy: e.insurance_policy,
      insurance_expiry: e.insurance_expiry,
      notes: e.notes,
    };
    table('employees').push(rec);
    empIds.push(rec.id);
  });
  log(`employees: ${empIds.length}`);

  for (const t of data.timesheets) {
    table('timesheets').push({
      id: nextId('timesheets'),
      employee_id: empIds[t.emp_index],
      year: t.year,
      month: t.month,
      days: t.days,
      total_hours: t.total_hours,
      present_days: t.present_days,
      absent_days: t.absent_days,
      paid_days: t.paid_days,
      gross_pay: t.gross_pay,
      overtime_hours: t.overtime_hours,
      overtime_pay: t.overtime_pay,
      deductions: t.deductions,
      net_pay: t.net_pay,
      status: t.status,
    });
  }
  log(`timesheets: ${data.timesheets.length}`);

  for (const e of data.expenses) {
    table('expenses').push({
      id: nextId('expenses'),
      expense_date: e.expense_date,
      category: e.category,
      description: e.description,
      vendor: e.vendor,
      amount: e.amount,
      worksite_id: e.worksite ? wsId[e.worksite] ?? null : null,
      payment_method: e.payment_method,
      reference: e.reference,
      status: e.status,
    });
  }
  log(`expenses: ${data.expenses.length}`);

  const settings = {
    company_name: 'Basmat',
    currency: 'SAR',
    reporting_year: 2026,
    reporting_month: 11,
    monthly_expense_budget: 0,
  };
  for (const [key, value] of Object.entries(settings)) {
    table('settings').push({ id: nextId('settings'), key, value: { v: value } });
  }

  flush();
  return {
    tables: Object.fromEntries(Object.entries(store.tables).map(([k, v]) => [k, v.length])),
  };
}

export function seedIfEmpty({ log = () => {} } = {}) {
  if (Object.keys(store.tables).length) return { skipped: true };
  return seed({ log });
}

// CLI: node --import ./dev/register.mjs dev/seed-local.mjs [--reset]
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--reset')) {
    const { reset } = await import('./store.mjs');
    reset();
  }
  const r = seed({ log: console.log });
  console.log('seeded:', r.tables);
}
