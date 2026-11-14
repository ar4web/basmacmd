// Shared payroll computation engine — mirrors the workbook's formula logic.
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const r1 = (n) => Math.round((n + Number.EPSILON) * 10) / 10;

export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

// days: array of length = days in month; values: number hours | 'P' | 'A' | 1 | null
export function computeTimesheet(days, emp, ws, deductions = 0) {
  const dim = days.length;
  const std = Number(ws?.hours_per_day) || 8;
  const ppd = Number(ws?.pay_period_days) || 26;
  const salary = Number(emp?.base_salary) || 0;
  const daily = salary / ppd;
  const hourly = std > 0 ? daily / std : 0;
  const factor = { Unpaid: 0, 'Half Pay': 0.5, 'Full Pay': 1 }[ws?.absent_treatment] ?? 0;
  const mult = Number(ws?.overtime_multiplier) || 1.5;
  const expected = Math.min(ppd, dim);

  let present = 0, totalHours = 0, otHours = 0;
  for (const v of days) {
    if (v === null || v === undefined || v === '' || v === 'A') continue;
    if (v === 'P' || ws?.timesheet_format === 'Direct Days') { present += 1; totalHours += std; continue; }
    const h = Number(v);
    if (!Number.isNaN(h) && h > 0) { present += 1; totalHours += h; if (h > std) otHours += h - std; }
  }
  const absent = Math.max(0, expected - present);
  const paidDays = present + factor * absent;

  let gross, otPay;
  if (ws?.pay_method === 'Hourly Rate') {
    gross = (totalHours - otHours + factor * absent * std) * hourly;
    otPay = otHours * hourly * mult;
  } else {
    gross = paidDays * daily;
    otPay = otHours * hourly * mult;
  }
  const ded = Number(deductions) || 0;
  return {
    total_hours: r1(totalHours),
    present_days: present,
    absent_days: absent,
    paid_days: r1(paidDays),
    gross_pay: r2(gross),
    overtime_hours: r1(otHours),
    overtime_pay: r2(otPay),
    deductions: r2(ded),
    net_pay: r2(gross + otPay - ded),
  };
}

export function daysLeft(iso) {
  if (!iso) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
}

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export async function fetchAll(buildQuery) {
  const out = [];
  let from = 0;
  // PostgREST caps at 1000 rows per response — page through.
  for (;;) {
    const { data, error } = await buildQuery().range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return out;
}
