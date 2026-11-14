import supabase from './db-client.js';
import { cors, daysLeft, fetchAll } from './_calc.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const employees = await fetchAll(() =>
      supabase.from('employees').select('id, name, emp_no, iqama_expiry, insurance_expiry, worksites(name)').neq('work_status', 'Terminated')
    );
    const items = [];
    let urgent = 0;
    for (const e of employees) {
      const iq = daysLeft(e.iqama_expiry);
      const ins = daysLeft(e.insurance_expiry);
      if (iq !== null && iq <= 30) {
        items.push({ employee: e.name, emp_no: e.emp_no, doc: 'IQAMA', expiry: e.iqama_expiry, daysLeft: iq, worksite: e.worksites?.name || '—' });
        urgent += 1;
      }
      if (ins !== null && ins <= 30) {
        items.push({ employee: e.name, emp_no: e.emp_no, doc: 'Insurance', expiry: e.insurance_expiry, daysLeft: ins, worksite: e.worksites?.name || '—' });
        urgent += 1;
      }
    }
    items.sort((a, b) => a.daysLeft - b.daysLeft);
    return res.status(200).json({ count: urgent, items: items.slice(0, 8) });
  } catch (err) {
    console.error('notifications API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
