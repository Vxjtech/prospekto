import 'server-only';
import {DatabaseSync, type SQLInputValue} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {migrations} from './schema';

const globalDb = globalThis as typeof globalThis & {prospektoDb?: DatabaseSync};
export function getDb(): DatabaseSync {
  if (globalDb.prospektoDb) return globalDb.prospektoDb;
  const filename = resolve(process.env.DATABASE_PATH || 'data/prospekto.sqlite');
  mkdirSync(dirname(filename), {recursive: true, mode: 0o700});
  const db = new DatabaseSync(filename);
  try {
    db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    db.exec('BEGIN IMMEDIATE');
    const version = Number(db.prepare('PRAGMA user_version').get()?.user_version ?? 0);
    if (version > migrations.at(-1)!.version) throw new Error('Database schema is newer than this application.');
    for (const migration of migrations) {
      if (migration.version <= version) continue;
      db.exec(migration.sql);
      db.exec(`PRAGMA user_version=${migration.version}`);
    }
    db.exec('COMMIT');
    globalDb.prospektoDb = db;
    return db;
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
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
