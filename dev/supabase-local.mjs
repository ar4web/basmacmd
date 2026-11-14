// Local Supabase emulator: implements the subset of the supabase-js query
// builder used by the /api handlers, backed by a JSON file. Development only.
import { store, table, nextId, flush } from './store.mjs';

const now = () => new Date().toISOString();

// Embedded-resource map: relation name -> { fk, table }.
const RELATIONS = {
  employees: { worksites: { fk: 'worksite_id', table: 'worksites' } },
  timesheets: { employees: { fk: 'employee_id', table: 'employees' } },
  expenses: { worksites: { fk: 'worksite_id', table: 'worksites' } },
};

function compare(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined || b === null || b === undefined) return NaN;
  if (typeof a === 'number' || typeof b === 'number') {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na < nb ? -1 : 1;
  }
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : 1;
}

function eq(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  if (typeof a === typeof b) return a === b;
  return String(a) === String(b);
}

function pathGet(row, path) {
  return String(path).split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), row);
}

// Parse a PostgREST select string, e.g. "*, employees!inner(id, name, worksites(id, name))".
function parseSelect(sel) {
  const s = String(sel);
  const embeds = [];
  let out = '';
  let i = 0;
  while (i < s.length) {
    const m = /^(\w+)(!inner)?\(/.exec(s.slice(i));
    if (!m) {
      out += s[i];
      i += 1;
      continue;
    }
    let depth = 1;
    let j = i + m[0].length;
    while (j < s.length && depth > 0) {
      if (s[j] === '(') depth += 1;
      else if (s[j] === ')') depth -= 1;
      j += 1;
    }
    embeds.push({ name: m[1], inner: Boolean(m[2]), cols: s.slice(i + m[0].length, j - 1).trim() });
    i = j;
  }
  const parts = out.split(',').map((x) => x.trim()).filter(Boolean);
  const all = parts.includes('*') || parts.length === 0;
  const scalars = parts.filter((p) => p !== '*');
  return { all, scalars, embeds };
}

function pickScalars(row, scalars) {
  const out = {};
  for (const k of scalars) if (k in row) out[k] = row[k];
  return out;
}

// Attach full related rows (used before filtering, so dotted filters work).
function applyEmbeds(rows, tbl, embeds) {
  let out = rows;
  for (const e of embeds) {
    const rel = RELATIONS[tbl]?.[e.name];
    if (!rel) continue;
    const ids = [...new Set(out.map((r) => r[rel.fk]).filter((v) => v !== null && v !== undefined))];
    const related = ids.length
      ? table(rel.table).filter((r) => ids.some((id) => eq(r.id, id)))
      : [];
    for (const r of out) {
      const match = related.find((x) => eq(x.id, r[rel.fk]));
      if (match) r[e.name] = match;
      else if (e.inner) r.__drop = true;
      else r[e.name] = null;
    }
    out = out.filter((r) => !r.__drop).map((r) => {
      const { __drop, ...rest } = r;
      return rest;
    });
  }
  return out;
}

// Final shaping: project scalars and attach nested embeds.
function shapeRow(row, tbl, parsed) {
  const out = parsed.all ? { ...row } : pickScalars(row, parsed.scalars);
  for (const e of parsed.embeds) {
    const rel = RELATIONS[tbl]?.[e.name];
    if (!rel) continue;
    const nested = parseSelect(e.cols);
    if (out[e.name] === undefined || out[e.name] === null) {
      const match = table(rel.table).find((x) => eq(x.id, row[rel.fk]));
      out[e.name] = match ? shapeRow(match, rel.table, nested) : null;
    } else {
      out[e.name] = shapeRow(out[e.name], rel.table, nested);
    }
  }
  return out;
}

function parseOr(str) {
  return String(str)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((clause) => {
      const m = /^(\w+(?:\.\w+)*)\.(\w+)\.(.+)$/.exec(clause);
      if (!m) return null;
      return { c: m[1], op: m[2], v: m[3] };
    })
    .filter(Boolean);
}

function matchOp(row, op) {
  const val = pathGet(row, op.c);
  switch (op.op) {
    case 'eq':
      return eq(val, op.v);
    case 'neq':
      return !eq(val, op.v);
    case 'gt':
      return compare(val, op.v) > 0;
    case 'gte':
      return compare(val, op.v) >= 0;
    case 'lt':
      return compare(val, op.v) < 0;
    case 'lte':
      return compare(val, op.v) <= 0;
    case 'like':
      return String(val ?? '').includes(String(op.v).replace(/%/g, ''));
    case 'ilike':
      return String(val ?? '')
        .toLowerCase()
        .includes(String(op.v).replace(/%/g, '').toLowerCase());
    case 'in':
      return Array.isArray(op.v) && op.v.some((x) => eq(val, x));
    case 'not':
      return op.mode === 'is' ? val === null || val === undefined : !eq(val, op.v);
    case 'or':
      return parseOr(op.v).some((c) => matchOp(row, c));
    default:
      return true;
  }
}

class Builder {
  constructor(tbl) {
    this.tbl = tbl;
    this._ops = [];
    this._sel = '*';
    this._selOpts = null;
    this._orders = [];
    this._limit = null;
    this._range = null;
    this._mode = 'select';
    this._payload = null;
    this._single = false;
    this._maybe = false;
  }

  select(cols, opts) {
    this._sel = cols;
    this._selOpts = opts ?? null;
    return this;
  }
  eq(c, v) { this._ops.push({ op: 'eq', c, v }); return this; }
  neq(c, v) { this._ops.push({ op: 'neq', c, v }); return this; }
  gt(c, v) { this._ops.push({ op: 'gt', c, v }); return this; }
  gte(c, v) { this._ops.push({ op: 'gte', c, v }); return this; }
  lt(c, v) { this._ops.push({ op: 'lt', c, v }); return this; }
  lte(c, v) { this._ops.push({ op: 'lte', c, v }); return this; }
  like(c, v) { this._ops.push({ op: 'like', c, v }); return this; }
  ilike(c, v) { this._ops.push({ op: 'ilike', c, v }); return this; }
  in(c, v) { this._ops.push({ op: 'in', c, v }); return this; }
  not(c, mode, v) { this._ops.push({ op: 'not', c, mode, v }); return this; }
  or(v) { this._ops.push({ op: 'or', v }); return this; }
  order(c, opts) { this._orders.push({ c, asc: opts?.ascending !== false }); return this; }
  limit(n) { this._limit = Number(n); return this; }
  range(a, b) { this._range = [Number(a), Number(b)]; return this; }
  single() { this._single = true; return this; }
  maybeSingle() { this._maybe = true; return this; }
  insert(rows) { this._mode = 'insert'; this._payload = Array.isArray(rows) ? rows : [rows]; return this; }
  update(patch) { this._mode = 'update'; this._payload = patch; return this; }
  upsert(rows) { this._mode = 'upsert'; this._payload = Array.isArray(rows) ? rows : [rows]; return this; }
  delete() { this._mode = 'delete'; return this; }

  then(resolve, reject) {
    return this._exec().then(resolve, reject);
  }

  _finish(rows) {
    if (this._single) {
      if (!rows.length) return { data: null, error: { message: 'No rows found' } };
      return { data: rows[0], error: null };
    }
    if (this._maybe) return { data: rows[0] ?? null, error: null };
    return { data: rows, error: null };
  }

  async _exec() {
    const tbl = this.tbl;
    const parsed = parseSelect(this._sel);

    if (this._mode === 'insert') {
      const inserted = [];
      for (const row of this._payload) {
        const rec = { ...row };
        if (rec.id === undefined) rec.id = nextId(tbl);
        if (rec.created_at === undefined) rec.created_at = now();
        table(tbl).push(rec);
        inserted.push(rec);
      }
      flush();
      return this._finish(inserted.map((r) => shapeRow(r, tbl, parsed)));
    }

    if (this._mode === 'update') {
      const rows = table(tbl).filter((r) => this._ops.every((op) => matchOp(r, op)));
      for (const r of rows) Object.assign(r, this._payload);
      flush();
      return this._finish(rows.map((r) => shapeRow(r, tbl, parsed)));
    }

    if (this._mode === 'upsert') {
      const rows = table(tbl);
      for (const row of this._payload) {
        const rec = { ...row };
        const idx = rec.id !== undefined
          ? rows.findIndex((r) => eq(r.id, rec.id))
          : rows.findIndex((r) => eq(r.key, rec.key));
        if (idx >= 0) Object.assign(rows[idx], rec);
        else {
          if (rec.id === undefined) rec.id = nextId(tbl);
          if (rec.created_at === undefined) rec.created_at = now();
          rows.push(rec);
        }
      }
      flush();
      return { data: null, error: null };
    }

    if (this._mode === 'delete') {
      const doomed = table(tbl).filter((r) => this._ops.every((op) => matchOp(r, op)));
      const ids = new Set(doomed.map((r) => r.id));
      store.tables[tbl] = table(tbl).filter((r) => !ids.has(r.id));
      flush();
      return { data: null, error: null };
    }

    // select
    let rows = table(tbl).map((r) => ({ ...r }));
    rows = applyEmbeds(rows, tbl, parsed.embeds);
    rows = rows.filter((r) => this._ops.every((op) => matchOp(r, op)));
    if (this._orders.length) {
      rows.sort((a, b) => {
        for (const o of this._orders) {
          const c = compare(pathGet(a, o.c), pathGet(b, o.c));
          if (Number.isNaN(c) || c === 0) continue;
          return o.asc ? c : -c;
        }
        return 0;
      });
    }
    if (this._limit !== null) rows = rows.slice(0, this._limit);
    if (this._range) rows = rows.slice(this._range[0], this._range[1] + 1);
    if (this._selOpts?.head) return { count: rows.length, error: null };
    return this._finish(rows.map((r) => shapeRow(r, tbl, parsed)));
  }
}

export function createClient() {
  return {
    from(tbl) {
      return new Builder(tbl);
    },
  };
}

export default { createClient };
