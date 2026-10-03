import 'server-only';
import {DatabaseSync, type SQLInputValue} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {migrations} from './schema';
import {applyMigrations} from './migrate.js';

const globalDb = globalThis as typeof globalThis & {prospektoDb?: DatabaseSync};
export function getDb(): DatabaseSync {
  if (globalDb.prospektoDb) return globalDb.prospektoDb;
  const filename = resolve(process.env.DATABASE_PATH || 'data/prospekto.sqlite');
  mkdirSync(dirname(filename), {recursive: true, mode: 0o700});
  const db = new DatabaseSync(filename);
  try {
    applyMigrations(db, migrations);
    db.function('normalize_text', {deterministic:true}, value => String(value??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase());
    globalDb.prospektoDb = db;
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
export function query(sql: string, ...params: SQLInputValue[]) {
  const statement = getDb().prepare(sql);
  return {
    // node:sqlite returns null-prototype rows; React requires plain objects.
    get<T>() { const row = statement.get(...params); return row ? {...row} as T : undefined; },
    all<T>() { return statement.all(...params).map(row => ({...row})) as T[]; },
    run() { return statement.run(...params); },
  };
}
// Callbacks are synchronous so a transaction cannot be interleaved across awaits.
export function transaction<T>(callback: () => T): T {
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try { const result = callback(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}

