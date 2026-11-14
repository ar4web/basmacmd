import supabase from './db-client.js';
import { cors, fetchAll } from './_calc.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const files = await fetchAll(() => supabase.from('sync_files').select('*').order('last_synced_at', { ascending: false }));
      const stats = {
        totalFiles: files.length,
        totalRows: files.reduce((a, f) => a + (f.row_count || 0), 0),
        totalInserted: files.reduce((a, f) => a + (f.inserted || 0), 0),
        totalUpdated: files.reduce((a, f) => a + (f.updated || 0), 0),
        totalErrors: files.reduce((a, f) => a + (f.error_count || 0), 0),
        updatedFiles: files.filter((f) => f.status === 'Updated').length,
        failedFiles: files.filter((f) => f.status === 'Failed').length,
      };
      return res.status(200).json({ files, stats });
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.file_name || !b.dataset) return res.status(400).json({ error: 'file_name and dataset are required' });
      const { data: existing } = await supabase.from('sync_files').select('*').eq('file_name', b.file_name).maybeSingle();

      let status;
      if (existing) {
        status = existing.fingerprint === b.fingerprint ? 'No changes' : 'Updated';
      } else {
        status = (Number(b.error_count) > 0 && Number(b.inserted) === 0 && Number(b.updated) === 0) ? 'Failed' : 'Synced';
      }

      const row = {
        file_name: b.file_name, dataset: b.dataset, fingerprint: b.fingerprint || null,
        row_count: Number(b.row_count) || 0, inserted: Number(b.inserted) || 0,
        updated: Number(b.updated) || 0, skipped: Number(b.skipped) || 0,
        error_count: Number(b.error_count) || 0, duration_ms: Number(b.duration_ms) || 0,
        status, last_synced_at: new Date().toISOString(),
      };

      if (existing) {
        const { data, error } = await supabase.from('sync_files').update(row).eq('id', existing.id).select().single();
        if (error) throw error;
        return res.status(200).json(data);
      }
      const { data, error } = await supabase.from('sync_files').insert(row).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { error } = await supabase.from('sync_files').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('sync-files API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
