import supabase from './db-client.js';
import { cors, daysLeft, fetchAll, daysInMonth } from './_calc.js';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const year = Number(req.query.year) || 2026;
    const month = Number(req.query.month) || 11;
    const worksiteF = req.query.worksite || 'All';
    const natF = req.query.nationality || 'All';
    const statusF = req.query.status || 'All';

    const [employees, worksites, tsYear, expYear, settingsRows] = await Promise.all([
      fetchAll(() => supabase.from('employees').select('id, emp_no, name, iqama, iqama_expiry, insurance_expiry, insurance_policy, nationality, work_status, base_salary, worksite_id, joining_date, worksites(id, name, city, pay_period_days, hours_per_day, pay_method, timesheet_format)').order('id')),
      fetchAll(() => supabase.from('worksites').select('*').order('id')),
      fetchAll(() => supabase.from('timesheets').select('*').eq('year', year)),
      fetchAll(() => supabase.from('expenses').select('*').gte('expense_date', `${year}-01-01`).lte('expense_date', `${year}-12-31`)),
      fetchAll(() => supabase.from('settings').select('*')),
    ]);

    const settings = {};
    for (const s of settingsRows) settings[s.key] = s.value?.v ?? s.value;
    const budget = Number(settings.monthly_expense_budget) || 0;

    // ----- filter employee universe -----
    const filtered = employees.filter((e) =>
      (worksiteF === 'All' || e.worksites?.name === worksiteF) &&
      (natF === 'All' || e.nationality === natF) &&
      (statusF === 'All' || e.work_status === statusF)
    );
    const ids = new Set(filtered.map((e) => e.id));
    const empMap = new Map(filtered.map((e) => [e.id, e]));

    const tsFiltered = tsYear.filter((t) => ids.has(t.employee_id));
    const periodRows = tsFiltered.filter((t) => t.month === month);
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const expMonth = expYear.filter((x) => x.expense_date?.startsWith(monthKey));
    const dim = daysInMonth(year, month);

    // ----- KPIs -----
    const sum = (arr, k) => arr.reduce((a, r) => a + (Number(r[k]) || 0), 0);
    const grossPay = sum(periodRows, 'gross_pay');
    const overtimePay = sum(periodRows, 'overtime_pay');
    const deductions = sum(periodRows, 'deductions');
    const netPayable = sum(periodRows, 'net_pay');
    const present = sum(periodRows, 'present_days');
    const absences = sum(periodRows, 'absent_days');
    const attendanceRate = present + absences > 0 ? (present / (present + absences)) * 100 : 0;

    let absenceCost = 0;
    for (const t of periodRows) {
      const e = empMap.get(t.employee_id);
      const ppd = Number(e?.worksites?.pay_period_days) || 26;
      absenceCost += (Number(t.absent_days) || 0) * ((Number(e?.base_salary) || 0) / ppd);
    }

    const bucket = (dl) => (dl === null ? 'compliant' : dl < 0 ? 'expired' : dl <= 30 ? 'critical' : dl <= 60 ? 'warning' : 'compliant');
    const compliance = { iqama: { expired: 0, critical: 0, warning: 0, compliant: 0 }, insurance: { expired: 0, critical: 0, warning: 0, compliant: 0 } };
    for (const e of filtered) {
      compliance.iqama[bucket(daysLeft(e.iqama_expiry))] += 1;
      compliance.insurance[bucket(daysLeft(e.insurance_expiry))] += 1;
    }

    // ----- trend (respects filters) -----
    const trend = [];
    for (let m = 1; m <= 12; m++) {
      const rows = tsFiltered.filter((t) => t.month === m);
      const ex = expYear.filter((x) => Number(x.expense_date?.slice(5, 7)) === m);
      trend.push({
        m, label: MONTHS[m - 1],
        net: Math.round(sum(rows, 'net_pay')),
        gross: Math.round(sum(rows, 'gross_pay')),
        ot: Math.round(sum(rows, 'overtime_pay')),
        ded: Math.round(sum(rows, 'deductions')),
        headcount: rows.length,
        expenses: Math.round(ex.reduce((a, r) => a + (Number(r.amount) || 0), 0)),
      });
    }

    // ----- by worksite -----
    const totalNet = netPayable || 1;
    const byWorksite = worksites.map((w) => {
      const emps = filtered.filter((e) => e.worksite_id === w.id);
      const wids = new Set(emps.map((e) => e.id));
      const rows = periodRows.filter((t) => wids.has(t.employee_id));
      const p = sum(rows, 'present_days');
      const a = sum(rows, 'absent_days');
      const payroll = sum(rows, 'net_pay');
      const monthly = [];
      for (let m = 1; m <= 12; m++) monthly.push(Math.round(sum(tsFiltered.filter((t) => t.month === m && wids.has(t.employee_id)), 'net_pay')));
      return {
        id: w.id, name: w.name, city: w.city,
        format: w.timesheet_format, payMethod: w.pay_method, absentTreatment: w.absent_treatment,
        hoursPerDay: w.hours_per_day, periodDays: w.pay_period_days,
        headcount: emps.length,
        active: emps.filter((e) => e.work_status === 'Active').length,
        salaryPool: Math.round(emps.reduce((s2, e) => s2 + (Number(e.base_salary) || 0), 0)),
        payroll: Math.round(payroll),
        avgCost: emps.length ? Math.round(payroll / Math.max(1, emps.length)) : 0,
        absences: a,
        attendance: p + a > 0 ? Math.round((p / (p + a)) * 1000) / 10 : 0,
        iqamaDue: emps.filter((e) => { const dl = daysLeft(e.iqama_expiry); return dl !== null && dl <= 30; }).length,
        overtime: Math.round(sum(rows, 'overtime_pay')),
        costShare: Math.round((payroll / totalNet) * 1000) / 10,
        monthly,
      };
    }).filter((w) => w.headcount > 0 || worksiteF === 'All');

    // ----- nationality mix -----
    const natCount = {};
    for (const e of filtered) natCount[e.nationality || 'Unknown'] = (natCount[e.nationality || 'Unknown'] || 0) + 1;
    const nationalityMix = Object.entries(natCount).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    // ----- heatmap: present heads per worksite per day -----
    const heatmap = worksites.map((w) => {
      const wids = new Set(filtered.filter((e) => e.worksite_id === w.id).map((e) => e.id));
      const days = Array(dim).fill(0);
      for (const t of periodRows) {
        if (!wids.has(t.employee_id) || !Array.isArray(t.days)) continue;
        t.days.forEach((v, i) => {
          if (i < dim && v !== null && v !== '' && v !== 'A') days[i] += 1;
        });
      }
      return { worksite: w.name, days };
    }).filter((h) => h.days.some((d) => d > 0));

    // ----- watchlist & absentees -----
    const watchlist = [];
    for (const e of filtered) {
      const iq = daysLeft(e.iqama_expiry);
      const ins = daysLeft(e.insurance_expiry);
      if (iq !== null && iq <= 60) watchlist.push({ id: e.id, emp_no: e.emp_no, name: e.name, worksite: e.worksites?.name || '—', doc: 'IQAMA', ref: e.iqama, expiry: e.iqama_expiry, daysLeft: iq });
      if (ins !== null && ins <= 60) watchlist.push({ id: e.id, emp_no: e.emp_no, name: e.name, worksite: e.worksites?.name || '—', doc: 'Insurance', ref: e.insurance_policy, expiry: e.insurance_expiry, daysLeft: ins });
    }
    watchlist.sort((a, b) => a.daysLeft - b.daysLeft);

    const topAbsentees = periodRows
      .filter((t) => (Number(t.absent_days) || 0) > 0)
      .sort((a, b) => Number(b.absent_days) - Number(a.absent_days))
      .slice(0, 6)
      .map((t) => {
        const e = empMap.get(t.employee_id);
        const exp = (Number(t.present_days) || 0) + (Number(t.absent_days) || 0);
        return {
          id: t.employee_id, name: e?.name || `#${t.employee_id}`, worksite: e?.worksites?.name || '—',
          absences: Number(t.absent_days) || 0,
          attendance: exp > 0 ? Math.round(((Number(t.present_days) || 0) / exp) * 1000) / 10 : 0,
        };
      });

    // ----- expenses -----
    const catMap = {};
    for (const x of expMonth) catMap[x.category] = (catMap[x.category] || 0) + Number(x.amount || 0);
    const expenseByCategory = Object.entries(catMap).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);
    const expenseMonthTotal = Math.round(expMonth.reduce((a, r) => a + (Number(r.amount) || 0), 0));
    const expenseYtd = Math.round(expYear.reduce((a, r) => a + (Number(r.amount) || 0), 0));
    const pendingExpenses = expMonth.filter((x) => x.status === 'Pending').length;

    return res.status(200).json({
      period: { year, month, label: `${MONTHS[month - 1]} ${year}`, dim },
      kpis: {
        totalEmployees: filtered.length,
        active: filtered.filter((e) => e.work_status === 'Active').length,
        onLeave: filtered.filter((e) => e.work_status === 'On Leave').length,
        suspended: filtered.filter((e) => e.work_status === 'Suspended').length,
        terminated: filtered.filter((e) => e.work_status === 'Terminated').length,
        worksites: worksites.filter((w) => w.status === 'Operational').length,
        payrollCost: Math.round(grossPay + overtimePay),
        grossPay: Math.round(grossPay), overtimePay: Math.round(overtimePay),
        deductions: Math.round(deductions), netPayable: Math.round(netPayable),
        attendanceRate: Math.round(attendanceRate * 10) / 10,
        absences, absenceCost: Math.round(absenceCost),
        presentDays: present, expectedDays: present + absences,
        iqamaCritical: compliance.iqama.expired + compliance.iqama.critical,
        insuranceCritical: compliance.insurance.expired + compliance.insurance.critical,
        expenseMonth: expenseMonthTotal, expenseYtd, budget,
        budgetUtil: budget > 0 ? Math.round((expenseMonthTotal / budget) * 1000) / 10 : 0,
        pendingExpenses,
        registerCount: periodRows.length,
      },
      trend, byWorksite, nationalityMix, compliance, heatmap,
      waterfall: { gross: Math.round(grossPay), overtime: Math.round(overtimePay), deductions: Math.round(deductions), net: Math.round(netPayable) },
      watchlist: watchlist.slice(0, 10),
      watchlistTotal: watchlist.length,
      topAbsentees, expenseByCategory,
    });
  } catch (err) {
    console.error('dashboard API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
