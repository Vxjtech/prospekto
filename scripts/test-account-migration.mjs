import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {applyMigrations} from '../db/migrate.js';
import {migrations} from '../db/schema.ts';
const db=new DatabaseSync(':memory:');
try {
  applyMigrations(db,[migrations[0]]);
  db.exec("INSERT INTO users VALUES('old-user','old@example.test','existing-scrypt-hash','2026-01-01'); INSERT INTO profiles VALUES('old-user','Old User','Old workspace','2026-01-01'); INSERT INTO sessions VALUES('token-hash','old-user',9999999999999); INSERT INTO saved_lists VALUES('old-list','old-user','Important contacts','[\"company-01\"]','2026-01-01'); INSERT INTO campaigns VALUES('old-campaign','old-user','Campaign','Purpose','Subject','Body','[]','2026-01-01'); INSERT INTO bot_settings VALUES('old-user','{\"senderName\":\"Old\"}','2026-01-01'); INSERT INTO suppressions VALUES('old-block','old-user','blocked@example.test','Do not send','2026-01-01');");
  applyMigrations(db,migrations);applyMigrations(db,migrations);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version,migrations.at(-1).version);
  assert.equal(db.prepare('SELECT password_hash FROM users').get().password_hash,'existing-scrypt-hash');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n,1);
  const account=db.prepare('SELECT * FROM accounts').get();
  assert.equal(account.id,'legacy-old-user');
  assert.equal(account.type,null);assert.equal(account.completed_at,null);
  assert.equal(db.prepare('SELECT role FROM account_members').get().role,null);
  assert.equal(db.prepare('SELECT active_account_id FROM sessions').get().active_account_id,account.id);
  for(const table of ['saved_lists','campaigns','bot_settings','suppressions']) {
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM '+table).get().n,1);
    assert.equal(db.prepare('SELECT account_id FROM '+table).get().account_id,account.id);
  }
  assert.equal(db.prepare('SELECT company_ids FROM saved_lists').get().company_ids,'["company-01"]');
  assert.equal(db.prepare('SELECT settings FROM bot_settings').get().settings,'{"senderName":"Old"}');
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
  assert.throws(()=>db.prepare("INSERT INTO account_members VALUES('missing','old-user','COMPANY_OWNER','now')").run());
  assert.throws(()=>db.prepare("UPDATE account_members SET role='PLATFORM_ADMIN'").run());
  db.exec("INSERT INTO accounts(id,type,name,created_at) VALUES('second','COMPANY','Second workspace','now'); INSERT INTO account_members VALUES('second','old-user','COMPANY_OWNER','now');");
  db.prepare('INSERT INTO bot_settings VALUES(?,?,?,?)').run('second','old-user','{}','now');
  db.prepare('INSERT INTO suppressions(id,owner_id,email,reason,created_at,account_id) VALUES(?,?,?,?,?,?)').run('second-block','old-user','blocked@example.test','Second','now','second');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM bot_settings').get().n,2);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM suppressions').get().n,2);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM job_postings').get().n,0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM job_applications').get().n,0);
  console.log('PASS: v1 migration preserves users, sessions, lists, campaigns, bot settings and suppressions; idempotency, foreign keys and multiple contexts');
}finally{db.close();}


const previous=new DatabaseSync(':memory:');
try{
  applyMigrations(previous,migrations.filter(m=>m.version<=3));
  previous.exec(`
    INSERT INTO users(id,email,password_hash,created_at) VALUES('customer-user','customer@example.test','hash','2026-01-01'),('provider-user','provider@example.test','hash','2026-01-01');
    INSERT INTO accounts(id,type,name,created_at,completed_at) VALUES('customer','CUSTOMER','Customer','2026-01-01','2026-01-01'),('provider','SELF_EMPLOYED','Provider','2026-01-01','2026-01-01');
    INSERT INTO customer_profiles VALUES('customer'); INSERT INTO provider_profiles(account_id) VALUES('provider');
    INSERT INTO requests(id,customer_account_id,title,description,service_id,city,region,created_at) VALUES('r1','customer','First','Description','stavebnictvi','Praha','praha','2026-01-01'),('r2','customer','Second','Description','auto-moto','Praha','praha','2026-01-02');
    INSERT INTO leads(id,account_id,request_id,title,created_at,updated_at) VALUES('l1','provider','r1','First','2026-01-01','2026-01-01'),('l2','provider','r2','Second','2026-01-02','2026-01-02');
    INSERT INTO messages VALUES('m1','r1','provider','customer-user','customer','Original customer message','2026-01-03'),('m2','r2','provider','provider-user','provider','Original supplier message','2026-01-04');
  `);
  const original=previous.prepare('SELECT * FROM messages ORDER BY id').all();
  applyMigrations(previous,migrations);applyMigrations(previous,migrations);
  assert.equal(previous.prepare('SELECT COUNT(*) AS n FROM conversations').get().n,1);
  assert.deepEqual(previous.prepare('SELECT id,request_id,provider_account_id,sender_user_id,sender_account_id,body,created_at FROM messages ORDER BY id').all(),original);
  assert.equal(previous.prepare('SELECT COUNT(DISTINCT conversation_id) AS n FROM messages').get().n,1);
  assert.equal(previous.prepare('SELECT updated_at FROM conversations').get().updated_at,'2026-01-04');
  assert.equal(previous.prepare('PRAGMA foreign_key_check').all().length,0);
  console.log('PASS: v3-to-v4 messenger migration preserves every message and merges multiple requests into one contact, idempotently');
}finally{previous.close();}
