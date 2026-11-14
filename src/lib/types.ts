export interface Worksite {
  id: number;
  name: string;
  city: string;
  monthly_salary: number;
  pay_period_days: number;
  hours_per_day: number;
  timesheet_format: string;
  absent_treatment: string;
  pay_method: string;
  overtime_multiplier: number;
  notes: string | null;
  status: string;
}

export interface Employee {
  id: number;
  emp_no: string;
  name: string;
  iqama: string | null;
  iqama_expiry: string | null;
  birth_date: string | null;
  worksite_id: number | null;
  worksites?: Worksite | null;
  sponsor: string | null;
  transfer_status: string | null;
  work_status: string;
  joining_date: string | null;
  mobile: string | null;
  nationality: string | null;
  bank: string | null;
  iban: string | null;
  base_salary: number;
  contract_type: string | null;
  insurance_policy: string | null;
  insurance_expiry: string | null;
  notes: string | null;
}

export type DayValue = number | string | null;

export interface TimesheetRow {
  id: number;
  employee_id: number;
  year: number;
  month: number;
  days: DayValue[];
  total_hours: number;
  present_days: number;
  absent_days: number;
  paid_days: number;
  gross_pay: number;
  overtime_hours: number;
  overtime_pay: number;
  deductions: number;
  net_pay: number;
  status: string;
  employees?: Employee;
}

export interface Expense {
  id: number;
  expense_date: string;
  category: string;
  description: string | null;
  vendor: string | null;
  amount: number;
  worksite_id: number | null;
  worksites?: { id: number; name: string } | null;
  payment_method: string | null;
  reference: string;
  status: string;
}

export interface TrendPoint {
  m: number; label: string; net: number; gross: number; ot: number; ded: number; headcount: number; expenses: number;
}

export interface WorksiteStat {
  id: number; name: string; city: string;
  format: string; payMethod: string; absentTreatment: string;
  hoursPerDay: number; periodDays: number;
  headcount: number; active: number; salaryPool: number; payroll: number;
  avgCost: number; absences: number; attendance: number; iqamaDue: number;
  overtime: number; costShare: number; monthly: number[];
}

export interface ComplianceBuckets { expired: number; critical: number; warning: number; compliant: number }

export interface WatchItem {
  id: number; emp_no: string; name: string; worksite: string;
  doc: 'IQAMA' | 'Insurance'; ref: string | null; expiry: string; daysLeft: number;
}

export interface DashboardData {
  period: { year: number; month: number; label: string; dim: number };
  kpis: {
    totalEmployees: number; active: number; onLeave: number; suspended: number; terminated: number;
    worksites: number; payrollCost: number; grossPay: number; overtimePay: number;
    deductions: number; netPayable: number; attendanceRate: number; absences: number;
    absenceCost: number; iqamaCritical: number; insuranceCritical: number;
    expenseMonth: number; expenseYtd: number; budget: number; budgetUtil: number;
    pendingExpenses: number; registerCount: number;
  };
  trend: TrendPoint[];
  byWorksite: WorksiteStat[];
  nationalityMix: { name: string; value: number }[];
  compliance: { iqama: ComplianceBuckets; insurance: ComplianceBuckets };
  heatmap: { worksite: string; days: number[] }[];
  waterfall: { gross: number; overtime: number; deductions: number; net: number };
  watchlist: WatchItem[];
  watchlistTotal: number;
  topAbsentees: { id: number; name: string; worksite: string; absences: number; attendance: number }[];
  expenseByCategory: { name: string; value: number }[];
}

export interface Settings {
  company_name?: string;
  company_name_ar?: string;
  currency?: string;
  reporting_year?: number;
  reporting_month?: number;
  monthly_expense_budget?: number;
}
