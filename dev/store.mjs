// Tiny JSON-file backed row store used by the local Supabase emulator.
// Tables are schemaless: a table is created on first use.
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function empty() {
  return { tables: {}, seq: {} };
}

function load() {
  try {
    return { ...empty(), ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
  } catch {
    return empty();
  }
}

export const store = load();
export const state = { paused: false };

let timer = null;
function scheduleFlush() {
  if (state.paused) return;
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    flush();
  }, 100);
}

export function flush() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(store));
  } catch (e) {
    console.error('[store] could not persist:', e.message);
  }
}

export function table(name) {
  if (!store.tables[name]) store.tables[name] = [];
  return store.tables[name];
}

export function nextId(name) {
  store.seq[name] = (store.seq[name] || 0) + 1;
  scheduleFlush();
  return store.seq[name];
}

export function reset() {
  store.tables = {};
  store.seq = {};
  flush();
}

export const DB_PATH = DB_FILE;
