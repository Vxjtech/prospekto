export function applyMigrations(db, migrations) {
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  db.exec('BEGIN IMMEDIATE');
  try {
    const version = Number(db.prepare('PRAGMA user_version').get()?.user_version ?? 0);
    if (version > migrations.at(-1).version) throw new Error('Database schema is newer than this application.');
    for (const migration of migrations) {
      if (migration.version <= version) continue;
      db.exec(migration.sql);
      db.exec(`PRAGMA user_version=${migration.version}`);
    }
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }
}