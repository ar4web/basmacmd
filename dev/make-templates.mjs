// Generate the blank Excel templates that ship in data/templates/.
// Headers and sample rows match the app's own template exporter (src/pages/ImportCenter.tsx).
import * as XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.cwd(), 'data/templates');
fs.mkdirSync(OUT, { recursive: true });

const TEMPLATES = [
  {
    file: 'master-data-template.xlsx',
    sheet: 'Master Data',
    headers: [
      'Employee Name', 'IQAMA Number', 'IQAMA Expiry', 'Birth Date', 'Worksite', 'Sponsor',
      'Transfer Status', 'Work Status', 'Joining Date', 'Mobile', 'Nationality', 'Bank', 'IBAN',
      'Base Salary (SAR)', 'Contract Type', 'Insurance Policy No', 'Insurance Expiry', 'Notes',
    ],
    sample: [
      'Fahad Al Otaybi', '2112345678', '2027-06-14', '1992-04-08', 'Riyadh Logistics Hub',
      'Al Manar HR Solutions', 'Transfer Pending', 'Active', '2024-02-01', '0553000001', 'Saudi',
      'SNB', 'SA0380000000123456789012', 4300, 'Full Time', 'INS-2001', '2027-02-28', 'Night shift',
    ],
  },
  {
    file: 'timesheet-register-template.xlsx',
    sheet: 'Salary Register',
    headers: [
      'Year', 'Month', 'Employee Name', 'IQAMA',
      ...Array.from({ length: 31 }, (_, i) => `Day ${i + 1}`),
      'Deductions (SAR)',
    ],
    sample: [
      2026, 11, 'Ahmed Al Harbi', '1012345678',
      ...Array.from({ length: 31 }, () => 8),
      0,
    ],
  },
  {
    file: 'expenses-template.xlsx',
    sheet: 'Expenses',
    headers: ['Date', 'Category', 'Description', 'Vendor', 'Amount (SAR)', 'Worksite', 'Payment Method', 'Status'],
    sample: [
      '2026-11-05', 'Utilities', 'Electricity bill - site offices', 'Saudi Electricity Co',
      8450, 'Dammam Industrial Site', 'Bank Transfer', 'Paid',
    ],
  },
];

for (const t of TEMPLATES) {
  const ws = XLSX.utils.aoa_to_sheet([t.headers, t.sample]);
  ws['!cols'] = t.headers.map((h) => ({ wch: Math.max(14, String(h).length + 3) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, t.sheet);
  const dest = path.join(OUT, t.file);
  XLSX.writeFile(wb, dest);
  console.log('wrote', path.relative(process.cwd(), dest));
}
