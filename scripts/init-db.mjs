import {DatabaseSync} from 'node:sqlite';
import {existsSync, mkdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {applyMigrations} from '../db/migrate.js';
import {migrations} from '../db/schema.ts';

for (const envFile of ['.env.production.local', '.env.local', '.env.production', '.env']) {
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}

const filename = resolve(process.env.DATABASE_PATH || 'data/prospekto.sqlite');
mkdirSync(dirname(filename), {recursive: true, mode: 0o700});
const db = new DatabaseSync(filename);
try {
  applyMigrations(db, migrations);
} finally {
  db.close();
}