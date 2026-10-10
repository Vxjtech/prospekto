// Versioned schema for the self-hosted application's private SQLite database.
export const migrations = [{version: 1, sql: `
CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE auth_attempts (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL);
CREATE TABLE profiles (id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, workspace TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE saved_lists (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, name TEXT NOT NULL, company_ids TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX lists_owner ON saved_lists(owner_id);
CREATE TABLE campaigns (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, name TEXT NOT NULL, purpose TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, company_ids TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX campaigns_owner ON campaigns(owner_id);
CREATE TABLE bot_settings (owner_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE, settings TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE suppressions (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, email TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE UNIQUE INDEX suppressions_owner_email ON suppressions(owner_id,email);
`}, {version: 2, sql: `
-- Additive account migration: original user IDs, hashes and business records survive.
CREATE TABLE accounts (
 id TEXT PRIMARY KEY, type TEXT CHECK(type IN ('CUSTOMER','SELF_EMPLOYED','COMPANY')),
 name TEXT NOT NULL, onboarding_step INTEGER NOT NULL DEFAULT 0 CHECK(onboarding_step BETWEEN 0 AND 5),
 completed_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE account_members (
 account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role TEXT CHECK(role IN ('CUSTOMER','SELF_EMPLOYED','COMPANY_OWNER','COMPANY_ADMIN','COMPANY_MEMBER')),
 created_at TEXT NOT NULL, PRIMARY KEY(account_id,user_id)
);
CREATE INDEX members_user ON account_members(user_id);
ALTER TABLE users ADD COLUMN first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN last_name TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN phone TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN platform_role TEXT CHECK(platform_role = 'PLATFORM_ADMIN');
ALTER TABLE users ADD COLUMN last_account_id TEXT REFERENCES accounts(id);
ALTER TABLE sessions ADD COLUMN active_account_id TEXT REFERENCES accounts(id);
INSERT INTO accounts(id,name,created_at)
 SELECT 'legacy-' || u.id, COALESCE(p.workspace,u.email),u.created_at FROM users u LEFT JOIN profiles p ON p.id=u.id;
INSERT INTO account_members(account_id,user_id,created_at) SELECT 'legacy-' || id,id,created_at FROM users;
UPDATE users SET last_account_id='legacy-' || id;
UPDATE sessions SET active_account_id='legacy-' || user_id;
ALTER TABLE saved_lists ADD COLUMN account_id TEXT REFERENCES accounts(id);
ALTER TABLE campaigns ADD COLUMN account_id TEXT REFERENCES accounts(id);
ALTER TABLE suppressions ADD COLUMN account_id TEXT REFERENCES accounts(id);
UPDATE saved_lists SET account_id='legacy-' || owner_id;
UPDATE campaigns SET account_id='legacy-' || owner_id;
UPDATE suppressions SET account_id='legacy-' || owner_id;
CREATE INDEX lists_account ON saved_lists(account_id);
CREATE INDEX campaigns_account ON campaigns(account_id);
DROP INDEX suppressions_owner_email;
CREATE UNIQUE INDEX suppressions_account_email ON suppressions(account_id,email);
ALTER TABLE bot_settings RENAME TO legacy_bot_settings;
CREATE TABLE bot_settings(account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
 owner_id TEXT NOT NULL REFERENCES profiles(id), settings TEXT NOT NULL, updated_at TEXT NOT NULL);
INSERT INTO bot_settings SELECT 'legacy-' || owner_id,owner_id,settings,updated_at FROM legacy_bot_settings;
DROP TABLE legacy_bot_settings;
CREATE TABLE customer_profiles(account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE);
CREATE TABLE provider_profiles(
 account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
 ico TEXT NOT NULL DEFAULT '', business_name TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '',
 billing_address TEXT NOT NULL DEFAULT '', dic TEXT NOT NULL DEFAULT '', website TEXT NOT NULL DEFAULT '',
 description TEXT NOT NULL DEFAULT '', avatar_url TEXT NOT NULL DEFAULT '', cover_url TEXT NOT NULL DEFAULT '',
 experience TEXT NOT NULL DEFAULT '', social_links TEXT NOT NULL DEFAULT '[]',
 primary_service_id TEXT REFERENCES services(id),
 verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED' CHECK(verification_status IN ('UNVERIFIED','PENDING','VERIFIED','REJECTED')),
 verification_source TEXT, verified_at TEXT
);
CREATE TABLE company_profiles(account_id TEXT PRIMARY KEY REFERENCES provider_profiles(account_id) ON DELETE CASCADE,
 founded_year INTEGER CHECK(founded_year BETWEEN 1000 AND 2200), references_text TEXT NOT NULL DEFAULT '');
CREATE TABLE services(id TEXT PRIMARY KEY, parent_id TEXT REFERENCES services(id), name TEXT NOT NULL);
CREATE TABLE provider_services(account_id TEXT NOT NULL REFERENCES provider_profiles(account_id) ON DELETE CASCADE,
 service_id TEXT NOT NULL REFERENCES services(id), PRIMARY KEY(account_id,service_id));
CREATE TABLE provider_specializations(account_id TEXT NOT NULL REFERENCES provider_profiles(account_id) ON DELETE CASCADE,
 name TEXT NOT NULL, PRIMARY KEY(account_id,name));
CREATE TABLE service_areas(account_id TEXT PRIMARY KEY REFERENCES provider_profiles(account_id) ON DELETE CASCADE,
 city TEXT NOT NULL, postal_code TEXT NOT NULL DEFAULT '', regions TEXT NOT NULL DEFAULT '[]',
 cities TEXT NOT NULL DEFAULT '[]', nationwide INTEGER NOT NULL DEFAULT 0 CHECK(nationwide IN (0,1)),
 max_distance_km INTEGER NOT NULL CHECK(max_distance_km BETWEEN 0 AND 1000),
 latitude REAL, longitude REAL);
CREATE TABLE portfolio_items(id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES provider_profiles(account_id) ON DELETE CASCADE,
 image_url TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', position INTEGER NOT NULL DEFAULT 0);
CREATE INDEX portfolio_account ON portfolio_items(account_id);
CREATE TABLE media_assets(id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 mime_type TEXT NOT NULL, contents BLOB NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX media_account ON media_assets(account_id);
CREATE TABLE requests(id TEXT PRIMARY KEY, customer_account_id TEXT NOT NULL REFERENCES customer_profiles(account_id),
 title TEXT NOT NULL, description TEXT NOT NULL, service_id TEXT NOT NULL REFERENCES services(id),
 city TEXT NOT NULL, region TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','ASSIGNED','CLOSED')),
 budget_czk INTEGER CHECK(budget_czk>=0), created_at TEXT NOT NULL);
CREATE INDEX requests_customer ON requests(customer_account_id);
CREATE INDEX requests_matching ON requests(status,service_id,region);
CREATE TABLE leads(id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES provider_profiles(account_id),
 request_id TEXT REFERENCES requests(id), title TEXT NOT NULL, contact_name TEXT NOT NULL DEFAULT '',
 stage TEXT NOT NULL DEFAULT 'NEW' CHECK(stage IN ('NEW','CONTACTED','MEETING','OFFER','WON','LOST')),
 value_czk INTEGER NOT NULL DEFAULT 0 CHECK(value_czk>=0), created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(account_id,request_id));
CREATE INDEX leads_account ON leads(account_id,stage);
CREATE TABLE tasks(id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES provider_profiles(account_id),
 lead_id TEXT REFERENCES leads(id), title TEXT NOT NULL, due_at TEXT, done INTEGER NOT NULL DEFAULT 0 CHECK(done IN (0,1)), created_at TEXT NOT NULL);
CREATE INDEX tasks_account ON tasks(account_id,done);
CREATE TABLE offers(id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES requests(id), provider_account_id TEXT NOT NULL REFERENCES provider_profiles(account_id),
 body TEXT NOT NULL, amount_czk INTEGER NOT NULL CHECK(amount_czk>=0),
 status TEXT NOT NULL DEFAULT 'SENT' CHECK(status IN ('SENT','ACCEPTED','REJECTED')), created_at TEXT NOT NULL);
CREATE INDEX offers_request ON offers(request_id);
CREATE TABLE messages(id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES requests(id),
 provider_account_id TEXT NOT NULL REFERENCES provider_profiles(account_id), sender_user_id TEXT NOT NULL REFERENCES users(id),
 sender_account_id TEXT NOT NULL REFERENCES accounts(id), body TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX messages_thread ON messages(request_id,provider_account_id,created_at);
CREATE TABLE reviews(id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES requests(id),
 customer_account_id TEXT NOT NULL REFERENCES customer_profiles(account_id),
 provider_account_id TEXT NOT NULL REFERENCES provider_profiles(account_id), rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
 body TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(request_id,customer_account_id));
CREATE TABLE favorites(customer_account_id TEXT NOT NULL REFERENCES customer_profiles(account_id),
 provider_account_id TEXT NOT NULL REFERENCES provider_profiles(account_id), PRIMARY KEY(customer_account_id,provider_account_id));
CREATE TABLE subscriptions(id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), plan TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('TRIAL','ACTIVE','PAST_DUE','CANCELED')), external_id TEXT UNIQUE, current_period_end TEXT);
CREATE INDEX subscriptions_account ON subscriptions(account_id);
CREATE TABLE credit_entries(id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), amount INTEGER NOT NULL,
 reason TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);
INSERT INTO services(id,name) VALUES('auto-moto','Auto, moto');
INSERT INTO services(id,name) VALUES('reality','Reality');
INSERT INTO services(id,name) VALUES('sluzby-obchod-prodej','Služby, obchod, prodej');
INSERT INTO services(id,name) VALUES('urady-sprava','Úřady, správa');
INSERT INTO services(id,name) VALUES('vzdelani-jazyky','Vzdělání, jazyky');
INSERT INTO services(id,name) VALUES('zahrada-zemedelstvi-zvirata','Zahrada, zemědělství, zvířata');
INSERT INTO services(id,name) VALUES('finance-ekonomika-pravo','Finance, ekonomika, právo');
INSERT INTO services(id,name) VALUES('restaurace-ubytovani','Restaurace, ubytování');
INSERT INTO services(id,name) VALUES('stavebnictvi','Stavebnictví');
INSERT INTO services(id,name) VALUES('vypocetni-technika-internet','Výpočetní technika, internet');
INSERT INTO services(id,name) VALUES('zabava-kultura','Zábava, kultura');
INSERT INTO services(id,name) VALUES('zdravotnictvi','Zdravotnictví, zdravotní služby a technika');
INSERT INTO services(id,parent_id,name) VALUES('rekonstrukce','stavebnictvi','Rekonstrukce');
INSERT INTO services(id,parent_id,name) VALUES('zednicke-prace','stavebnictvi','Zednické práce');
INSERT INTO services(id,parent_id,name) VALUES('elektroinstalace','stavebnictvi','Elektroinstalace');
INSERT INTO services(id,parent_id,name) VALUES('instalaterstvi','stavebnictvi','Instalatérství');
INSERT INTO services(id,parent_id,name) VALUES('strechy','stavebnictvi','Střechy');
INSERT INTO services(id,parent_id,name) VALUES('malovani','stavebnictvi','Malování');
INSERT INTO services(id,parent_id,name) VALUES('autoservis','auto-moto','Autoservis');
INSERT INTO services(id,parent_id,name) VALUES('pneuservis','auto-moto','Pneuservis');
INSERT INTO services(id,parent_id,name) VALUES('realitni-sluzby','reality','Realitní služby');
INSERT INTO services(id,parent_id,name) VALUES('sprava-nemovitosti','reality','Správa nemovitostí');
INSERT INTO services(id,parent_id,name) VALUES('uklid','sluzby-obchod-prodej','Úklid');
INSERT INTO services(id,parent_id,name) VALUES('stehovani','sluzby-obchod-prodej','Stěhování');
INSERT INTO services(id,parent_id,name) VALUES('zahradnictvi','zahrada-zemedelstvi-zvirata','Zahradnictví');
INSERT INTO services(id,parent_id,name) VALUES('udrzba-zahrad','zahrada-zemedelstvi-zvirata','Údržba zahrad');
INSERT INTO services(id,parent_id,name) VALUES('weby','vypocetni-technika-internet','Tvorba webů');
INSERT INTO services(id,parent_id,name) VALUES('it-sprava','vypocetni-technika-internet','Správa IT');
INSERT INTO services(id,parent_id,name) VALUES('ucetnictvi','finance-ekonomika-pravo','Účetnictví');
INSERT INTO services(id,parent_id,name) VALUES('poradenstvi','finance-ekonomika-pravo','Poradenství');
INSERT INTO services(id,parent_id,name) VALUES('doučovani','vzdelani-jazyky','Doučování');
INSERT INTO services(id,parent_id,name) VALUES('jazykove-kurzy','vzdelani-jazyky','Jazykové kurzy');
INSERT INTO services(id,parent_id,name) VALUES('catering','restaurace-ubytovani','Catering');
INSERT INTO services(id,parent_id,name) VALUES('ubytovani','restaurace-ubytovani','Ubytování');
INSERT INTO services(id,parent_id,name) VALUES('fotografie','zabava-kultura','Fotografie');
INSERT INTO services(id,parent_id,name) VALUES('akce','zabava-kultura','Organizace akcí');
INSERT INTO services(id,parent_id,name) VALUES('fyzioterapie','zdravotnictvi','Fyzioterapie');
INSERT INTO services(id,parent_id,name) VALUES('zdravotni-pece','zdravotnictvi','Zdravotní péče');
INSERT INTO services(id,parent_id,name) VALUES('administrativa','urady-sprava','Administrativní služby');
`}, {version:3, sql: `
CREATE TABLE job_postings (
 id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES provider_profiles(account_id),
 created_by TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL,
 category TEXT NOT NULL, city TEXT NOT NULL, region TEXT NOT NULL, address TEXT NOT NULL DEFAULT '',
 employment_types TEXT NOT NULL, work_mode TEXT NOT NULL CHECK(work_mode IN ('ONSITE','HYBRID','REMOTE')),
 salary_min INTEGER, salary_max INTEGER, salary_period TEXT NOT NULL CHECK(salary_period IN ('MONTH','HOUR','YEAR')),
 currency TEXT NOT NULL DEFAULT 'CZK' CHECK(currency='CZK'),
 description TEXT NOT NULL, responsibilities TEXT NOT NULL, requirements TEXT NOT NULL, benefits TEXT NOT NULL DEFAULT '',
 education TEXT NOT NULL, experience TEXT NOT NULL, languages TEXT NOT NULL DEFAULT '',
 suitable_graduates INTEGER NOT NULL DEFAULT 0 CHECK(suitable_graduates IN (0,1)),
 suitable_disability INTEGER NOT NULL DEFAULT 0 CHECK(suitable_disability IN (0,1)),
 contact_name TEXT NOT NULL, contact_email TEXT NOT NULL DEFAULT '', contact_phone TEXT NOT NULL DEFAULT '',
 apply_url TEXT NOT NULL DEFAULT '', start_date TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PUBLISHED','CLOSED')),
 published_at TEXT, expires_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 CHECK(salary_min IS NULL OR salary_min>=0), CHECK(salary_max IS NULL OR salary_max>=0),
 CHECK(salary_min IS NULL OR salary_max IS NULL OR salary_max>=salary_min)
);
CREATE INDEX jobs_account ON job_postings(account_id,updated_at);
CREATE INDEX jobs_public ON job_postings(status,expires_at,region,category,published_at);
CREATE TABLE job_applications (
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES job_postings(id),
 customer_account_id TEXT NOT NULL REFERENCES customer_profiles(account_id),
 user_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, email TEXT NOT NULL,
 phone TEXT NOT NULL DEFAULT '', message TEXT NOT NULL, resume_url TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL, UNIQUE(job_id,customer_account_id)
);
CREATE INDEX job_applications_job ON job_applications(job_id,created_at);
CREATE INDEX job_applications_customer ON job_applications(customer_account_id,created_at);
`}, {version: 4, sql: `
CREATE TABLE conversations(
 id TEXT PRIMARY KEY, account_low TEXT NOT NULL REFERENCES accounts(id),
 account_high TEXT NOT NULL REFERENCES accounts(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 CHECK(account_low<account_high), UNIQUE(account_low,account_high)
);
CREATE INDEX conversations_low ON conversations(account_low,updated_at);
CREATE INDEX conversations_high ON conversations(account_high,updated_at);
-- Merge request-specific threads into one conversation per pair of accounts.
INSERT INTO conversations(id,account_low,account_high,created_at,updated_at)
 SELECT lower(hex(randomblob(16))),min(l.account_id,r.customer_account_id),max(l.account_id,r.customer_account_id),min(l.created_at),max(l.updated_at)
 FROM leads l JOIN requests r ON r.id=l.request_id
 WHERE l.account_id<>r.customer_account_id GROUP BY min(l.account_id,r.customer_account_id),max(l.account_id,r.customer_account_id);
INSERT OR IGNORE INTO conversations(id,account_low,account_high,created_at,updated_at)
 SELECT lower(hex(randomblob(16))),min(m.provider_account_id,r.customer_account_id),max(m.provider_account_id,r.customer_account_id),min(m.created_at),max(m.created_at)
 FROM messages m JOIN requests r ON r.id=m.request_id
 GROUP BY min(m.provider_account_id,r.customer_account_id),max(m.provider_account_id,r.customer_account_id);
CREATE TABLE messages_v4(
 id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id),
 request_id TEXT REFERENCES requests(id), provider_account_id TEXT REFERENCES provider_profiles(account_id),
 sender_user_id TEXT NOT NULL REFERENCES users(id), sender_account_id TEXT NOT NULL REFERENCES accounts(id),
 body TEXT NOT NULL, created_at TEXT NOT NULL
);
INSERT INTO messages_v4(id,conversation_id,request_id,provider_account_id,sender_user_id,sender_account_id,body,created_at)
 SELECT m.id,c.id,m.request_id,m.provider_account_id,m.sender_user_id,m.sender_account_id,m.body,m.created_at
 FROM messages m JOIN requests r ON r.id=m.request_id JOIN conversations c
 ON c.account_low=min(m.provider_account_id,r.customer_account_id) AND c.account_high=max(m.provider_account_id,r.customer_account_id);
DROP TABLE messages;
ALTER TABLE messages_v4 RENAME TO messages;
CREATE INDEX messages_thread ON messages(request_id,provider_account_id,created_at);
CREATE INDEX messages_conversation ON messages(conversation_id,created_at,id);
CREATE INDEX messages_sender ON messages(sender_account_id,created_at);
UPDATE conversations SET updated_at=max(updated_at,COALESCE((SELECT max(created_at) FROM messages WHERE conversation_id=conversations.id),updated_at));
CREATE TABLE conversation_reads(
 conversation_id TEXT NOT NULL REFERENCES conversations(id),account_id TEXT NOT NULL REFERENCES accounts(id),
 last_read_at TEXT NOT NULL, PRIMARY KEY(conversation_id,account_id)
);
`}, {version: 5, sql: `
CREATE INDEX credit_entries_account ON credit_entries(account_id);
CREATE TABLE chat_unlocks(
 provider_account_id TEXT NOT NULL REFERENCES accounts(id),
 customer_account_id TEXT NOT NULL REFERENCES accounts(id),
 offer_id TEXT NOT NULL REFERENCES offers(id),
 credit_entry_id TEXT NOT NULL UNIQUE REFERENCES credit_entries(id),
 created_at TEXT NOT NULL,
 PRIMARY KEY(provider_account_id,customer_account_id)
);
-- One demo grant per business account, including existing demo accounts.
INSERT INTO credit_entries(id,account_id,amount,reason,idempotency_key,created_at)
 SELECT 'demo-grant:'||id,id,100000,'DEMO_GRANT','demo-grant:'||id,strftime('%Y-%m-%dT%H:%M:%fZ','now')
 FROM accounts WHERE type IN ('SELF_EMPLOYED','COMPANY')
 ON CONFLICT(idempotency_key) DO NOTHING;
`}, {version: 6, sql: `
-- Unify business accounts in place; IDs, profiles, sessions and credits remain unchanged.
UPDATE account_members SET role='COMPANY_OWNER' WHERE role='SELF_EMPLOYED'
 AND account_id IN (SELECT id FROM accounts WHERE type='SELF_EMPLOYED');
UPDATE accounts SET type='COMPANY' WHERE type='SELF_EMPLOYED';
INSERT INTO company_profiles(account_id) SELECT id FROM accounts WHERE type='COMPANY'
 ON CONFLICT(account_id) DO NOTHING;
`}, {version: 7, sql: `
CREATE TABLE calendar_subscriptions(
 account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
 token TEXT NOT NULL UNIQUE,
 created_at TEXT NOT NULL
);
`}, {version: 8, sql: `
-- Requester capability is shared by private and business accounts. Existing foreign keys remain intact.
INSERT INTO customer_profiles(account_id) SELECT id FROM accounts WHERE type='COMPANY'
 ON CONFLICT(account_id) DO NOTHING;
ALTER TABLE requests ADD COLUMN cooperation_type TEXT NOT NULL DEFAULT 'ONE_OFF'
 CHECK(cooperation_type IN ('ONE_OFF','LONG_TERM'));
`}, {version: 9, sql: `
CREATE TABLE request_images(
 request_id TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
 media_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
 position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 4),
 PRIMARY KEY(request_id,media_id),
 UNIQUE(request_id,position)
);
CREATE INDEX request_images_media ON request_images(media_id);
`}, {version: 10, sql: `
-- Conversations and paid access are scoped to one request and one provider.
CREATE TABLE conversations_v10(
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES requests(id),
 provider_account_id TEXT NOT NULL REFERENCES accounts(id),
 account_low TEXT NOT NULL REFERENCES accounts(id), account_high TEXT NOT NULL REFERENCES accounts(id),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 CHECK(account_low<account_high), UNIQUE(request_id,provider_account_id)
);
CREATE TABLE message_routes_v10 AS
 SELECT m.id,
  COALESCE(m.request_id,o.request_id) AS request_id,
  COALESCE(m.provider_account_id,o.provider_account_id) AS provider_account_id
 FROM messages m
 JOIN conversations oldc ON oldc.id=m.conversation_id
 LEFT JOIN chat_unlocks u ON (u.provider_account_id=oldc.account_low AND u.customer_account_id=oldc.account_high)
   OR (u.provider_account_id=oldc.account_high AND u.customer_account_id=oldc.account_low)
 LEFT JOIN offers o ON o.id=u.offer_id;
INSERT OR IGNORE INTO conversations_v10(id,request_id,provider_account_id,account_low,account_high,created_at,updated_at)
 SELECT lower(hex(randomblob(16))),r.id,route.provider_account_id,
  min(route.provider_account_id,r.customer_account_id),max(route.provider_account_id,r.customer_account_id),
  min(m.created_at),max(m.created_at)
 FROM message_routes_v10 route
 JOIN messages m ON m.id=route.id
 JOIN requests r ON r.id=route.request_id
 WHERE route.provider_account_id IS NOT NULL
 GROUP BY r.id,route.provider_account_id;
INSERT OR IGNORE INTO conversations_v10(id,request_id,provider_account_id,account_low,account_high,created_at,updated_at)
 SELECT lower(hex(randomblob(16))),r.id,o.provider_account_id,
  min(o.provider_account_id,r.customer_account_id),max(o.provider_account_id,r.customer_account_id),
  u.created_at,u.created_at
 FROM chat_unlocks u
 JOIN offers o ON o.id=u.offer_id
 JOIN requests r ON r.id=o.request_id;
CREATE TABLE messages_v10(
 id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations_v10(id),
 request_id TEXT REFERENCES requests(id), provider_account_id TEXT REFERENCES provider_profiles(account_id),
 sender_user_id TEXT NOT NULL REFERENCES users(id), sender_account_id TEXT NOT NULL REFERENCES accounts(id),
 body TEXT NOT NULL, created_at TEXT NOT NULL
);
INSERT INTO messages_v10(id,conversation_id,request_id,provider_account_id,sender_user_id,sender_account_id,body,created_at)
 SELECT m.id,c.id,route.request_id,route.provider_account_id,m.sender_user_id,m.sender_account_id,m.body,m.created_at
 FROM messages m
 JOIN message_routes_v10 route ON route.id=m.id
 JOIN conversations_v10 c ON c.request_id=route.request_id AND c.provider_account_id=route.provider_account_id
 WHERE route.request_id IS NOT NULL AND route.provider_account_id IS NOT NULL;
CREATE TABLE conversation_reads_v10(
 conversation_id TEXT NOT NULL REFERENCES conversations_v10(id),account_id TEXT NOT NULL REFERENCES accounts(id),
 last_read_at TEXT NOT NULL, PRIMARY KEY(conversation_id,account_id)
);
INSERT OR IGNORE INTO conversation_reads_v10(conversation_id,account_id,last_read_at)
 SELECT newc.id,reads.account_id,reads.last_read_at
 FROM conversation_reads reads
 JOIN conversations oldc ON oldc.id=reads.conversation_id
 JOIN conversations_v10 newc ON newc.account_low=oldc.account_low AND newc.account_high=oldc.account_high;
CREATE TABLE chat_unlocks_v10(
 provider_account_id TEXT NOT NULL REFERENCES accounts(id),
 customer_account_id TEXT NOT NULL REFERENCES accounts(id),
 request_id TEXT NOT NULL REFERENCES requests(id),
 offer_id TEXT NOT NULL UNIQUE REFERENCES offers(id),
 credit_entry_id TEXT NOT NULL UNIQUE REFERENCES credit_entries(id),
 created_at TEXT NOT NULL,
 PRIMARY KEY(provider_account_id,request_id)
);
INSERT OR IGNORE INTO chat_unlocks_v10(provider_account_id,customer_account_id,request_id,offer_id,credit_entry_id,created_at)
 SELECT u.provider_account_id,u.customer_account_id,o.request_id,u.offer_id,u.credit_entry_id,u.created_at
 FROM chat_unlocks u JOIN offers o ON o.id=u.offer_id;
DROP TABLE conversation_reads;
DROP TABLE messages;
DROP TABLE conversations;
DROP TABLE chat_unlocks;
DROP TABLE message_routes_v10;
ALTER TABLE conversations_v10 RENAME TO conversations;
ALTER TABLE messages_v10 RENAME TO messages;
ALTER TABLE conversation_reads_v10 RENAME TO conversation_reads;
ALTER TABLE chat_unlocks_v10 RENAME TO chat_unlocks;
CREATE INDEX conversations_request ON conversations(request_id,provider_account_id);
CREATE INDEX conversations_low ON conversations(account_low,updated_at);
CREATE INDEX conversations_high ON conversations(account_high,updated_at);
CREATE INDEX messages_thread ON messages(request_id,provider_account_id,created_at);
CREATE INDEX messages_conversation ON messages(conversation_id,created_at,id);
CREATE INDEX messages_sender ON messages(sender_account_id,created_at);
`}, {version: 11, sql: `
CREATE TABLE customer_reviews(
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE REFERENCES requests(id),
 customer_account_id TEXT NOT NULL REFERENCES customer_profiles(account_id),
 provider_account_id TEXT NOT NULL REFERENCES provider_profiles(account_id),
 rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
 body TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX customer_reviews_customer ON customer_reviews(customer_account_id,created_at);
`}];
