import supabase from './db-client.js';
import { cors, fetchAll } from './_calc.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { month, category, status, worksite_id } = req.query; // month = 'YYYY-MM'
      let q = supabase.from('expenses').select('*, worksites(id, name)').order('expense_date', { ascending: false });
      if (month) q = q.gte('expense_date', `${month}-01`).lte('expense_date', `${month}-31`);
      if (category && category !== 'All') q = q.eq('category', category);
      if (status && status !== 'All') q = q.eq('status', status);
      if (worksite_id) q = q.eq('worksite_id', Number(worksite_id));
      const data = await fetchAll(() => q);
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.category) return res.status(400).json({ error: 'Category is required' });
      if (!b.expense_date) return res.status(400).json({ error: 'Date is required' });
      const amount = Number(b.amount);
      if (!amount || amount <= 0) return res.status(400).json({ error: 'Amount must be greater than zero' });
      const { data: maxRef } = await supabase.from('expenses').select('reference').order('id', { ascending: false }).limit(1);
      let seq = 1;
      if (maxRef?.[0]?.reference) {
        const m = /(\d+)$/.exec(maxRef[0].reference);
        if (m) seq = Number(m[1]) + 1;
      }
      const ym = String(b.expense_date).slice(0, 7).replace('-', '');
      const { data, error } = await supabase.from('expenses').insert({
        expense_date: b.expense_date, category: b.category, description: b.description || null,
        vendor: b.vendor || null, amount,
        worksite_id: b.worksite_id ? Number(b.worksite_id) : null,
        payment_method: b.payment_method || 'Bank Transfer',
        reference: `EXP-${ym}-${String(seq).padStart(4, '0')}`,
        status: b.status || 'Pending',
      }).select('*, worksites(id, name)').single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const b = req.body || {};
      if (!b.id) return res.status(400).json({ error: 'id is required' });
      const allowed = ['expense_date','category','description','vendor','amount','worksite_id','payment_method','status'];
      const patch = {};
      for (const k of allowed) if (k in b) patch[k] = b[k] === '' ? null : b[k];
      if ('amount' in patch) {
        patch.amount = Number(patch.amount);
        if (!patch.amount || patch.amount <= 0) return res.status(400).json({ error: 'Amount must be greater than zero' });
      }
      if ('worksite_id' in patch && patch.worksite_id) patch.worksite_id = Number(patch.worksite_id);
      const { data, error } = await supabase.from('expenses').update(patch).eq('id', b.id).select('*, worksites(id, name)').single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('expenses API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
