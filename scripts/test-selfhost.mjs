import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {DatabaseSync} from 'node:sqlite';
import {cp, mkdir, mkdtemp, rm, stat} from 'node:fs/promises';
import {resolve} from 'node:path';

const root = process.cwd();
const standalone = resolve(root, '.next/standalone');
await stat(resolve(standalone, 'server.js')).catch(() => { throw new Error('Run pnpm build before pnpm test.'); });
await cp(resolve(root, 'public'), resolve(standalone, 'public'), {recursive: true});
await cp(resolve(root, '.next/static'), resolve(standalone, '.next/static'), {recursive: true});
await mkdir('.test-runtime', {recursive: true});
const directory = await mkdtemp(resolve('.test-runtime/server-'));
const filename = resolve(directory, 'private/prospekto.sqlite');
const companyFilename = resolve(directory, 'companies.sqlite3');
const companyDatabase = new DatabaseSync(companyFilename);
companyDatabase.exec(`CREATE TABLE companies (source_key TEXT PRIMARY KEY, name TEXT NOT NULL, phones TEXT NOT NULL, emails TEXT NOT NULL, websites TEXT NOT NULL, ico TEXT NOT NULL, detail_url TEXT NOT NULL, fetched_at TEXT NOT NULL, first_seen_at TEXT NOT NULL);
CREATE TABLE company_categories (source_key TEXT REFERENCES companies(source_key), url TEXT NOT NULL, name TEXT NOT NULL, PRIMARY KEY(source_key, url));`);
const insertCompany = companyDatabase.prepare('INSERT INTO companies(source_key,name,phones,emails,websites,ico,detail_url,fetched_at,first_seen_at) VALUES(?,?,?,?,?,?,?,?,?)');
const insertCategory = companyDatabase.prepare('INSERT INTO company_categories(source_key,url,name) VALUES(?,?,?)');
for (let index = 1; index <= 520; index++) {
  const id = `company-${String(index).padStart(2, '0')}`;
  const category = index <= 2 ? 'Stavebnictví' : index === 3 ? 'Auto, moto' : index === 4 ? 'Reality' : 'Služby, obchod, prodej';
  insertCompany.run(id, index === 1 ? 'Álpha Stavební s.r.o.' : `Firma ${index}`, JSON.stringify([`+420 555 000 ${String(index).padStart(3, '0')}`]), JSON.stringify([`kontakt-${index}@example.test`]), JSON.stringify([`https://firma-${index}.example`]), String(index).padStart(8, '0'), '', '', '');
  insertCategory.run(id, `https://example.test/categories/${index}`, category);
}
companyDatabase.close();
const socket = createServer();
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const origin = `http://127.0.0.1:${port}`;
let server, logs = '', checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; console.log('PASS', message); }
async function start() {
  server = spawn(process.execPath, ['server.js'], {cwd: standalone, env: {...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', HOSTNAME: '127.0.0.1', PORT: String(port), APP_URL: 'https://configured.example', DATABASE_PATH: filename, COMPANIES_DATABASE_PATH: companyFilename}, stdio: ['ignore', 'pipe', 'pipe']});
  for (const stream of [server.stdout, server.stderr]) stream.on('data', value => { logs = (logs + value).slice(-10000); });
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error('Server exited: ' + logs);
    try { const response = await fetch(origin + '/api/public-companies/'); if (response.ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Server startup timed out: ' + logs);
}
async function stop() { if (server && server.exitCode === null) { const closed = once(server, 'exit'); server.kill('SIGTERM'); await closed; } }
async function request(path, {cookie = '', body, method = body === undefined ? 'GET' : 'POST', extra = {}} = {}) {
  return fetch(origin + path, {method, redirect: 'manual', headers: {origin, ...(cookie ? {cookie} : {}), ...(body === undefined ? {} : {'Content-Type': 'application/json'}), ...extra}, body: body === undefined ? undefined : JSON.stringify(body)});
}
async function register(email, name) {
  const response = await request('/api/auth/register/', {body: {email, password: 'test-only-password-123', firstName:name,lastName:'Test',phone:'+420777123456',accountType:'SELF_EMPLOYED'}});
  assert.equal(response.status, 200, await response.clone().text());
  const setCookie = response.headers.get('set-cookie');
  check(setCookie.includes('HttpOnly') && /SameSite=lax/i.test(setCookie), 'session cookie uses HttpOnly and SameSite');
  check(!/\bSecure\b/i.test(setCookie), 'session cookie security follows the HTTP request protocol');
  const cookie=setCookie.split(';')[0];
  check((await response.json()).redirectTo==='/onboarding/','provider starts in onboarding');
  check((await request('/api/panel/',{cookie})).status===403,'incomplete onboarding blocks provider tools');
  const unified=(await (await request('/api/accounts/',{cookie})).json()).account;
  check(unified.type==='COMPANY'&&unified.role==='COMPANY_OWNER','legacy registration alias creates the unified IČO account');
  check((await request('/api/accounts/',{cookie,body:{action:'step',step:2,data:{ico:'',businessName:'Test',address:'Test',billingAddress:'Test'}}})).status===400,'business onboarding requires IČO');
  await completeOnboarding(cookie);
  return cookie;
}

async function completeOnboarding(cookie) {
  for(const [step,data] of [
    [2,{ico:'12345678',businessName:'Test business',address:'Ostrava 1',billingAddress:'Ostrava 1'}],
    [3,{primaryServiceId:'stavebnictvi',serviceIds:['rekonstrukce','zednicke-prace'],specializations:['Koupelny']}],
    [4,{city:'Ostrava',postalCode:'70030',regions:['moravskoslezsky'],cities:[],nationwide:false,maxDistanceKm:40}],
    [5,{}],
  ]) {
    const response=await request('/api/accounts/',{cookie,body:{action:'step',step,data}});
    assert.equal(response.status,200,await response.clone().text());
  }
}
async function market(cookie,body) {
  const response=await request('/api/marketplace/',{cookie,body});
  assert.equal(response.status,200,await response.clone().text());return (await response.json()).state;
}
async function createPerson(email,accountType='CUSTOMER') {
  const response=await request('/api/auth/register/',{body:{email,password:'test-only-password-123',firstName:'Jan',lastName:'Novák',phone:accountType==='CUSTOMER'?'':'+420777123456',accountType}});
  assert.equal(response.status,200,await response.clone().text());
  return {cookie:response.headers.get('set-cookie').split(';')[0],...(await response.json())};
}

async function action(cookie, body) {
  const response = await request('/api/panel/', {cookie, body});
  assert.equal(response.status, 200, await response.clone().text());
  return (await response.json()).state;
}
try {
  await start();
  check(!await stat(filename).then(() => true, () => false), 'public catalog loads without creating the accounts database');
  const publicData = await (await request('/api/public-companies/')).json();
  check(publicData.total === 520 && publicData.ready && !publicData.regionsAvailable, 'company catalog loads from SQLite without region data');
  check(publicData.items.every(item => Object.keys(item).sort().join() === 'category,id,name,region'), 'public API excludes contacts and IČO');
  for (const [category, expected] of [['stavebnictvi',2], ['auto-moto',1], ['reality',1]]) {
    const data = await (await request(`/api/public-companies/?kategorie=${category}`)).json();
    check(data.total === expected, 'company category filter: ' + category);
  }
  const search = await (await request('/api/public-companies/?q=alpha')).json();
  check(search.total === 1 && search.items[0].id === 'company-01', 'company search is accent-insensitive');
  const page2 = await (await request('/api/public-companies/?strana=2')).json();
  check(page2.page === 2 && page2.items.length === 20, 'server pagination remains bounded');
  const html = await (await request('/databaze/')).text();
  check(!html.includes('@example.test') && !html.includes('+420 555') && html.includes('Zpět na úvod'), 'public page keeps contacts locked and home navigation available');
  check((await request('/api/companies/')).status === 401, 'anonymous contacts are rejected');
  check((await request('/api/companies/', {extra: {'oai-authenticated-user-id':'fake-user','oai-authenticated-user-email':'fake@example.test'}})).status === 401, 'forged legacy identity headers do not authenticate');
  check((await request('/api/catalog-import/')).status === 404, 'real-database import endpoint is removed');
  check((await request('/api/auth/register/', {body: {email: 'bad@example.test', password: 'short', name: 'Test', workspace: 'Test'}})).status === 400, 'short passwords are rejected');
  check((await request('/api/auth/register/', {body: {}, extra: {origin: 'https://other.example'}})).status === 403, 'cross-origin registration is rejected');
  const alice = await register('alice@example.test', 'Alice');
  const bob = await register('bob@example.test', 'Bob');
  const filteredSelection = await request('/api/companies/?selectAll=1&kategorie=stavebnictvi', {cookie: alice});
  const filteredIds = await filteredSelection.json();
  check(filteredSelection.status === 200 && filteredIds.ids.length === 2 && filteredIds.ids.includes('company-01') && filteredIds.ids.includes('company-02'), 'select-all returns every ID matching active filters');
  const largeSelection = await request('/api/companies/?selectAll=1', {cookie: alice});
  const allCompanyIds = (await largeSelection.json()).ids;
  check(allCompanyIds.length === 520, 'select-all supports result sets over 500 companies');
  check(await stat(filename).then(() => true), 'SQLite database and schema initialize automatically');
  check((await request('/api/auth/register/', {body: {email: 'ALICE@example.test', password: 'test-only-password-123', firstName:'Alice',lastName:'Test',accountType:'CUSTOMER'}})).status === 409, 'duplicate accounts are rejected case-insensitively');
  let state = await action(alice, {action: 'save-list', data: {name: 'All filtered companies', companyIds: allCompanyIds}});
  const listId = state.lists[0].id;
  check(state.lists.length === 1 && state.lists[0].companyIds.length === 520, 'large selections persist in SQLite lists');
  const bobState = await (await request('/api/panel/', {cookie: bob})).json();
  check(bobState.state.lists.length === 0, 'accounts have separate data');
  check((await request('/api/companies/?list=' + listId, {cookie: bob})).status === 404, 'another account cannot read a saved list');
  await action(bob, {action: 'delete-list', id: listId});
  state = (await (await request('/api/panel/', {cookie: alice})).json()).state;
  check(state.lists.length === 1, 'another account cannot delete a saved list');
  const unknownCompany = await request('/api/companies/?ids=missing-company', {cookie: alice});
  check(unknownCompany.status === 200 && (await unknownCompany.json()).items.length === 0, 'unknown source IDs do not return company data');
  check((await request('/api/panel/', {cookie: alice, body:{action:'profile',data:{name:'Alice',workspace:'Changed'}},extra:{origin:'https://other.example'}})).status === 403, 'panel changes enforce same-origin requests');
  state = await action(alice, {action:'save-campaign',data:{name:'Draft campaign',purpose:'Demo preview',subject:'Dobrý den',body:'Nabídka pro {{nazev_firmy}}',companyIds:['company-13']}});
  check(state.campaigns.length === 1, 'campaign drafts remain functional');
  state = await action(alice, {action:'settings',data:{...state.settings,senderName:'Alice'}});
  check(state.settings.senderName === 'Alice', 'bot settings remain persistent');
  state = await action(alice, {action:'suppress',data:{email:'BLOCKED@example.test',reason:'Demo block'}});
  check(state.suppressions[0].email === 'blocked@example.test', 'suppression list remains functional');
  const privateResponse = await request('/api/companies/', {cookie: alice});
  const privateData = await privateResponse.json();
  check(privateResponse.headers.get('cache-control').includes('no-store') && privateData.items.every(item => item.email && item.phone), 'authenticated contacts are complete and not publicly cached');
  check((await request('/panel/',{cookie:alice})).headers.get('location')==='/dodavatel/','legacy panel entry resolves to provider dashboard');
  const panelResponse = await request('/nastroje/', {cookie: alice});
  const panelHtml = await panelResponse.text();
  check(panelResponse.status === 200, 'registered panel renders on the Node.js server');
  const selectionHeader = panelHtml.indexOf('p-selection-header');
  check(panelHtml.includes('company-filter-search') && panelHtml.includes('Hledat') && selectionHeader >= 0 && panelHtml.indexOf('Vybrat vše', selectionHeader) < panelHtml.indexOf('Celou stranu', selectionHeader), 'signed-in company panel places both selection actions together');
  const sqlite = new DatabaseSync(filename);
  const hashes = sqlite.prepare('SELECT password_hash FROM users').all();
  check(hashes.length === 2 && hashes.every(row => row.password_hash.startsWith('scrypt:') && !row.password_hash.includes('test-only-password')), 'passwords are stored as salted hashes');
  check(sqlite.prepare('SELECT token_hash FROM sessions').all().every(row => !alice.includes(row.token_hash) && !bob.includes(row.token_hash)), 'raw session tokens are not stored');
  sqlite.close();


  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlS8AAAAASUVORK5CYII=','base64');
  const upload=await fetch(origin+'/api/media/',{method:'POST',headers:{origin,cookie:alice,'Content-Type':'image/png'},body:png});
  check(upload.status===200,'provider can upload a profile photograph');
  const {url:imageUrl}=await upload.json();
  check((await request(imageUrl)).status===404,'unpublished uploads are not public');
  check((await request('/api/accounts/',{cookie:bob,body:{action:'step',step:5,data:{avatarUrl:imageUrl}}})).status===400,'another provider cannot claim an uploaded photograph');
  check((await request('/api/accounts/',{cookie:alice,body:{action:'step',step:5,data:{avatarUrl:imageUrl}}})).status===200,'profile accepts an owned internal media URL');
  check((await request(imageUrl)).status===200,'published profile photograph becomes readable');
  check((await request('/api/accounts/',{cookie:alice,body:{action:'step',step:5,data:{website:'invalid-url'}}})).status===400,'invalid external URL produces validation error instead of server failure');

  const customer=await createPerson('customer@example.test'),stranger=await createPerson('stranger@example.test');
  check(customer.redirectTo==='/zakaznik/','customer registration completes directly into customer dashboard');
  for(const path of ['/api/panel/','/api/companies/'])check((await request(path,{cookie:customer.cookie})).status===403,'customer cannot access '+path);
  check((await request('/dodavatel/crm/',{cookie:customer.cookie})).headers.get('location')==='/zakaznik/','customer cannot enter supplier routes');
  check((await request('/zakaznik/',{cookie:alice})).headers.get('location')==='/dodavatel/','provider cannot enter customer routes');
  const customerHtml=await (await request('/zakaznik/',{cookie:customer.cookie})).text();
  check(customerHtml.includes('Vytvořit poptávku')&&!customerHtml.includes('href="/nastroje/"')&&!customerHtml.includes('href="/zakaznik/crm/"'),'customer dashboard has customer navigation');
  check((await request('/api/accounts/',{cookie:customer.cookie,body:{action:'switch',accountId:'unknown'}})).status===403,'switching to an unowned account fails');
  check((await request('/api/auth/register/',{body:{email:'bad-role@example.test',password:'test-only-password-123',firstName:'Test',lastName:'Test',accountType:'PLATFORM_ADMIN'}})).status===400,'registration cannot grant platform admin');
  check((await request('/api/marketplace/',{cookie:customer.cookie,body:{action:'lead',title:'Forged',contactName:'',valueCzk:0}})).status===403,'customer cannot create a lead');
  const rstate=await market(customer.cookie,{action:'request',title:'Rekonstrukce koupelny',description:'Potřebuji rekonstruovat koupelnu v bytě.',serviceId:'rekonstrukce',city:'Ostrava',region:'moravskoslezsky',budgetCzk:100000});
  const requestId=rstate.requests[0].id;
  check((await (await request('/api/marketplace/',{cookie:stranger.cookie})).json()).state.requests.length===0,'customer requests are account-scoped');
  check((await request('/api/marketplace/',{cookie:stranger.cookie,body:{action:'close-request',id:requestId}})).status===404,'another customer cannot close a request');
  const aliceId=(await (await request('/api/accounts/',{cookie:alice})).json()).account.id;
  const balance=async cookie=>(await (await request('/api/marketplace/',{cookie})).json()).state.credits;
  check(await balance(alice)===100000,'new self-employed account receives exactly 100000 demo credits');
  check(await balance(customer.cookie)===0,'customer receives no business credit grant');
  check((await request('/api/marketplace/',{cookie:alice,body:{action:'interest',requestId}})).status===410,'legacy lead creation is retired');
  let mstate=await market(alice,{action:'offer',requestId,body:'Kompletní rekonstrukce koupelny včetně materiálu.',amountCzk:95000});
  const offerId=mstate.offers[0].id;
  check(mstate.credits===100000,'sending an offer is free');
  check((await request('/api/marketplace/',{cookie:alice,body:{action:'unlock-chat',id:offerId}})).status===409,'unaccepted offer cannot unlock chat');
  check((await request('/api/marketplace/',{cookie:alice,body:{action:'message',requestId,providerId:aliceId,body:'Blocked'}})).status===403,'legacy message API cannot bypass acceptance');
  check((await request('/api/messenger/',{cookie:customer.cookie,body:{action:'start',contactId:aliceId}})).status===403,'direct profile chat cannot bypass acceptance');
  check((await request('/api/marketplace/',{cookie:stranger.cookie,body:{action:'accept-offer',id:offerId}})).status===404,'another customer cannot accept an offer');
  await market(customer.cookie,{action:'accept-offer',id:offerId});
  check((await request('/api/marketplace/',{cookie:customer.cookie,body:{action:'accept-offer',id:offerId}})).status===409,'offer cannot be accepted twice');
  check((await (await request('/api/marketplace/',{cookie:alice})).json()).state.summary.won===1,'accepted offer becomes a won job');
  check((await request('/api/marketplace/',{cookie:alice,body:{action:'message',requestId,providerId:aliceId,body:'Blocked'}})).status===402,'acceptance alone does not allow sending');
  const lockedStart=await (await request('/api/messenger/',{cookie:customer.cookie,body:{action:'start',contactId:aliceId}})).json();
  check((await request('/api/messenger/',{cookie:customer.cookie,body:{action:'send',conversationId:lockedStart.conversationId,body:'Blocked customer message',clientId:crypto.randomUUID()}})).status===402,'customer cannot bypass payment through messenger');
  check((await request('/api/marketplace/',{cookie:bob,body:{action:'unlock-chat',id:offerId}})).status===404,'another supplier cannot pay for an unrelated offer');
  check((await request('/api/marketplace/',{cookie:customer.cookie,body:{action:'unlock-chat',id:offerId}})).status===403,'customer cannot debit supplier credits');
  const paid=await Promise.all([market(alice,{action:'unlock-chat',id:offerId}),market(alice,{action:'unlock-chat',id:offerId})]);
  check(paid.every(s=>s.credits===99951)&&await balance(alice)===99951,'concurrent repeated unlock debits exactly 49 credits once');
  await market(alice,{action:'message',requestId,providerId:aliceId,body:'Rádi připravíme nabídku.'});
  check((await request('/api/marketplace/',{cookie:bob,body:{action:'message',requestId,providerId:aliceId,body:'Forged'}})).status===404,'another provider cannot write to an existing thread');
  await market(customer.cookie,{action:'message',requestId,providerId:aliceId,body:'Děkuji, pošlete mi prosím cenu.'});
  check(await balance(alice)===99951,'subsequent messages are free');
  const navHtml=await (await request('/dodavatel/',{cookie:alice})).text();
  check(!navHtml.includes('Moje leady')&&navHtml.includes('kreditů'),'dashboard removes lead navigation and displays credits');
  check((await request('/dodavatel/leady/',{cookie:alice})).headers.get('location')==='/dodavatel/nabidky/','old leads URL redirects to offers');

  await market(customer.cookie,{action:'close-request',id:requestId});
  await market(customer.cookie,{action:'review',requestId,rating:5,body:'Skvěle odvedená práce.'});
  check((await request('/api/marketplace/',{cookie:customer.cookie,body:{action:'review',requestId,rating:5,body:'Again'}})).status===409,'duplicate reviews are rejected');
  await market(customer.cookie,{action:'favorite',providerId:aliceId,enabled:true});
  check((await (await request('/api/marketplace/',{cookie:customer.cookie})).json()).state.providers.some(p=>p.id===aliceId&&p.favorite),'favorite supplier persists');
  // All requests must be discoverable independently of the supplier profile.
  const outside=await market(customer.cookie,{action:'request',title:'Výměna pneumatik v Praze',description:'Potřebuji přezout vůz a vyvážit kola.',serviceId:'pneuservis',city:'Praha',region:'praha',budgetCzk:3000});
  const outsideId=outside.requests.find(r=>r.title==='Výměna pneumatik v Praze').id;
  const feed=async query=>(await (await request('/api/marketplace/?'+query,{cookie:alice})).json());
  check((await feed('scope=all')).items.some(r=>r.id===outsideId),'all requests include other services and regions');
  check(!(await feed('scope=recommended')).items.some(r=>r.id===outsideId),'recommended requests remain matched to the profile');
  const combined=await feed('scope=all&service=auto-moto&region=praha&q=vymena');
  check(combined.total===1&&combined.items[0].id===outsideId,'category includes subcategories and combines with region and accent-insensitive search');
  check((await request('/api/marketplace/?scope=all',{cookie:customer.cookie})).status===403,'customers cannot browse other customer requests');
  const pagingDb=new DatabaseSync(filename),customerId=(await (await request('/api/accounts/',{cookie:customer.cookie})).json()).account.id;
  const insertRequest=pagingDb.prepare('INSERT INTO requests(id,customer_account_id,title,description,service_id,city,region,created_at) VALUES(?,?,?,?,?,?,?,?)');
  for(let i=0;i<205;i++)insertRequest.run('feed-test-'+i,customerId,'Newer construction '+i,'Test request','stavebnictvi','Ostrava','moravskoslezsky','2099-01-01');
  check((await feed('scope=all&service=auto-moto&region=praha')).items[0].id===outsideId,'filters run before limiting results, even beyond the first 200 requests');
  const pageTwo=await feed('scope=all&page=2');check(pageTwo.page===2&&pageTwo.items.length===20&&pageTwo.total>200,'request browsing paginates on the server');
  pagingDb.exec("DELETE FROM requests WHERE id LIKE 'feed-test-%'");pagingDb.close();
  const directOffer=await market(alice,{action:'offer',requestId:outsideId,body:'Přezutí a vyvážení všech čtyř kol.',amountCzk:2800});
  check(directOffer.leads.some(l=>l.requestId===outsideId&&l.stage==='OFFER'),'self-employed provider can send an offer directly without prior interest');
  check((await (await request('/api/marketplace/',{cookie:customer.cookie})).json()).state.offers.some(o=>o.requestId===outsideId&&o.amountCzk===2800),'customer receives the directly submitted offer');
  await market(customer.cookie,{action:'accept-offer',id:directOffer.offers.find(o=>o.requestId===outsideId).id});
  await market(alice,{action:'unlock-chat',id:directOffer.offers.find(o=>o.requestId===outsideId).id});
  check(await balance(alice)===99951,'second accepted request with same customer does not charge again');
  check((await request('/api/marketplace/',{cookie:alice,body:{action:'offer',requestId,body:'Cannot reopen closed request',amountCzk:1}})).status===409,'closed requests still reject offers');

  // Messenger supports direct contacts, preserves request conversations and enforces account isolation.
  const chat=async(cookie,body)=>{const response=await request('/api/messenger/',{cookie,body});assert.equal(response.status,200,await response.clone().text());return response.json();};
  const chats=async cookie=>(await (await request('/api/messenger/',{cookie})).json()).conversations;
  const aliceChats=await chats(alice),conversationId=aliceChats[0].conversationId;
  check(aliceChats.length===1&&aliceChats[0].id===customerId,'multiple requests share one messenger contact with the customer name');
  const oldMessages=await (await request('/api/messenger/?conversationId='+conversationId,{cookie:alice})).json();
  check(oldMessages.items.length===2&&oldMessages.items[0].body==='Rádi připravíme nabídku.','request messages appear chronologically in the messenger');
  check((await request('/api/messenger/')).status===401,'anonymous messenger access is rejected');
  for(const body of [{action:'send',conversationId,body:'Forged message',clientId:crypto.randomUUID()},{action:'read',conversationId,messageId:oldMessages.items[0].id}])check((await request('/api/messenger/',{cookie:bob,body})).status===404,'unrelated accounts cannot write or mark another conversation read');
  check((await request('/api/messenger/?conversationId='+conversationId,{cookie:bob})).status===404,'unrelated accounts cannot read another conversation');
  const strangerId=(await (await request('/api/accounts/',{cookie:stranger.cookie})).json()).account.id;
  check((await request('/api/messenger/',{cookie:alice,body:{action:'start',contactId:strangerId}})).status===404,'private customers cannot be contacted without a relationship');
  const candidates=(await (await request('/api/messenger/?scope=contacts',{cookie:alice})).json()).contacts;
  check(candidates.some(c=>c.id===customerId)&&!candidates.some(c=>c.id===strangerId),'contact search includes related customers and excludes unrelated private accounts');
  const bobId=(await (await request('/api/accounts/',{cookie:bob})).json()).account.id;
  check((await request('/api/messenger/',{cookie:customer.cookie,body:{action:'start',contactId:bobId}})).status===403,'new customer-provider contact requires an accepted offer');
  const bobRequest=await market(customer.cookie,{action:'request',title:'Druhá koupelna',description:'Další rekonstrukce koupelny v bytě.',serviceId:'rekonstrukce',city:'Ostrava',region:'moravskoslezsky',budgetCzk:50000});
  const bobRequestId=bobRequest.requests.find(r=>r.title==='Druhá koupelna').id;
  const bobOffer=(await market(bob,{action:'offer',requestId:bobRequestId,body:'Rekonstrukce včetně materiálu.',amountCzk:49000})).offers[0];
  await market(customer.cookie,{action:'accept-offer',id:bobOffer.id});
  const creditDb=new DatabaseSync(filename);
  creditDb.prepare('INSERT INTO credit_entries VALUES(?,?,?,?,?,?)').run('test-spend',bobId,-99952,'TEST','test-spend',new Date().toISOString());
  check((await request('/api/marketplace/',{cookie:bob,body:{action:'unlock-chat',id:bobOffer.id}})).status===402,'48 credits cannot unlock chat');
  check(await balance(bob)===48&&creditDb.prepare('SELECT COUNT(*) AS n FROM chat_unlocks WHERE provider_account_id=?').get(bobId).n===0,'insufficient balance rolls back without creating access');
  creditDb.prepare('INSERT INTO credit_entries VALUES(?,?,?,?,?,?)').run('test-topup',bobId,1,'TEST','test-topup',new Date().toISOString());creditDb.close();
  await market(bob,{action:'unlock-chat',id:bobOffer.id});
  check(await balance(bob)===0,'exactly 49 credits unlocks chat without negative balance');
  const direct=(await chat(customer.cookie,{action:'start',contactId:bobId})).conversationId;
  check((await chat(customer.cookie,{action:'start',contactId:bobId})).conversationId===direct,'opening unlocked conversation is idempotent');
  const message={action:'send',conversationId:direct,body:'Dobrý den, máte příští týden čas?',clientId:crypto.randomUUID()};
  await chat(customer.cookie,message);await chat(customer.cookie,message);
  check((await (await request('/api/messenger/?conversationId='+direct,{cookie:bob})).json()).items.length===1,'retrying a message does not send it twice');
  check((await chats(bob)).find(c=>c.conversationId===direct).unread===1,'recipient sees unread message count');
  await chat(bob,{action:'read',conversationId:direct,messageId:message.clientId});
  check((await chats(bob)).find(c=>c.conversationId===direct).unread===0,'opening a message clears the recipient unread count');
  check((await request('/api/messenger/',{cookie:customer.cookie,body:{...message,clientId:crypto.randomUUID()},extra:{origin:'https://other.example'}})).status===403,'messenger writes enforce same-origin');
  const historyDb=new DatabaseSync(filename),sender=historyDb.prepare('SELECT id FROM users WHERE email=?').get('customer@example.test').id;
  const insertMessage=historyDb.prepare('INSERT INTO messages(id,conversation_id,sender_user_id,sender_account_id,body,created_at) VALUES(?,?,?,?,?,?)');
  for(let i=0;i<55;i++)insertMessage.run('history-'+String(i).padStart(3,'0'),direct,sender,customerId,'Older message '+i,'2020-01-01T00:00:00.000Z');
  historyDb.close();
  const latest=await (await request('/api/messenger/?conversationId='+direct,{cookie:bob})).json();
  const olderMessages=await (await request('/api/messenger/?conversationId='+direct+'&before='+latest.nextCursor,{cookie:bob})).json();
  check(latest.items.length===50&&olderMessages.items.length===6&&new Set([...latest.items,...olderMessages.items].map(m=>m.id)).size===56,'message pagination preserves older history without duplicates, including equal timestamps');
  const company=await createPerson('company@example.test','COMPANY');
  const unfinished=(await (await request('/api/accounts/',{cookie:company.cookie})).json()).account;
  check((await request('/api/messenger/',{cookie:company.cookie})).status===403,'incomplete onboarding cannot access messenger');
  check(unfinished.role==='COMPANY_OWNER'&&unfinished.step===2,'company user becomes owner and resumes at business step');
  check((await request('/api/accounts/',{cookie:company.cookie,body:{action:'step',step:5,data:{}}})).status===409,'onboarding steps cannot be skipped');
  const relog=await request('/api/auth/login/',{body:{email:'company@example.test',password:'test-only-password-123'}});
  check((await relog.json()).redirectTo==='/onboarding/','unfinished onboarding resumes after a new login');
  await completeOnboarding(company.cookie);
  const companyId=(await (await request('/api/accounts/',{cookie:company.cookie})).json()).account.id;
  check((await request('/firma/zpravy/?conversation=test',{cookie:company.cookie})).headers.get('location')==='/dodavatel/zpravy/?conversation=test','old company URL preserves section and chat query');
  const companyLogin=await request('/api/auth/login/',{body:{email:'company@example.test',password:'test-only-password-123'}});
  check((await companyLogin.json()).redirectTo==='/dodavatel/','finished company login reaches company dashboard');

  // Recruitment is separate from supplier requests and scoped to the employer account.
  const vacancy={title:'Stavbyvedoucí',category:'construction',city:'Ostrava',region:'moravskoslezsky',address:'Hlavní 1',
    employmentTypes:['FULL_TIME'],workMode:'ONSITE',salaryMin:50000,salaryMax:70000,salaryPeriod:'MONTH',
    description:'Hledáme kolegu pro vedení staveb a koordinaci týmu.',responsibilities:'Vedení stavby a koordinace dodavatelů.',
    requirements:'Praxe ve stavebnictví a řidičský průkaz.',benefits:'Služební automobil a pět týdnů dovolené.',
    education:'SECONDARY',experience:'EXPERIENCED',languages:'Čeština',suitableGraduates:false,suitableDisability:false,
    contactName:'Personalista',contactEmail:'hr@example.test',contactPhone:'+420777222333',applyUrl:'',startDate:'',
    expiresAt:new Date(Date.now()+30*86400000).toISOString().slice(0,10),status:'DRAFT'};
  check((await request('/api/jobs/',{body:{action:'save',data:vacancy}})).status===401,'anonymous users cannot post vacancies');
  check((await request('/api/jobs/',{cookie:customer.cookie,body:{action:'save',data:vacancy}})).status===403,'customers cannot post vacancies');
  const draft=await request('/api/jobs/',{cookie:company.cookie,body:{action:'save',data:vacancy}});
  assert.equal(draft.status,200,await draft.clone().text());const jobId=(await draft.json()).id;
  check((await (await request('/api/jobs/')).json()).total===0,'draft jobs are hidden from public searches');
  check((await request('/prace/'+jobId+'/')).status===404,'draft job detail is not public');
  check((await request('/api/jobs/',{cookie:bob,body:{action:'save',id:jobId,data:vacancy}})).status===404,'another employer cannot edit a vacancy');
  check((await request('/api/jobs/',{cookie:company.cookie,body:{action:'save',id:jobId,data:{...vacancy,salaryMax:1}}})).status===400,'invalid salary ranges are rejected');
  check((await request('/api/jobs/',{cookie:company.cookie,body:{action:'save',id:jobId,data:{...vacancy,companyName:'DEK'}}})).status===400,'employer name cannot be spoofed in vacancy payload');
  check((await request('/api/jobs/',{cookie:company.cookie,body:{action:'save',id:jobId,data:{...vacancy,status:'PUBLISHED'}}})).status===200,'employer can publish a draft');
  const jobData=await (await request('/api/jobs/?category=construction&region=moravskoslezsky&type=FULL_TIME&salary=60000')).json();
  check(jobData.total===1&&jobData.items[0].companyName==='Test business','combined job filters and authoritative employer name work');
  check((await (await request('/api/jobs/?salary=80000')).json()).total===0,'monthly salary filter excludes lower offers');
  check((await (await request('/api/jobs/?mode=REMOTE')).json()).total===0,'work mode filter works');
  check((await (await request('/api/jobs/?graduates=1')).json()).total===0,'graduate filter works');
  const jobHtml=await (await request('/prace/'+jobId+'/')).text();
  check(jobHtml.includes('JobPosting')&&jobHtml.includes('Stavbyvedoucí')&&jobHtml.includes('hr@example.test'),'public job detail includes structured job data and employer contact');
  const reaction={jobId,name:'Jan Uchazeč',phone:'+420777555666',message:'Mám zájem o tuto pracovní pozici a zkušenosti s vedením staveb.',resumeUrl:''};
  check((await request('/api/jobs/',{cookie:customer.cookie,body:{action:'apply',data:reaction}})).status===200,'customer can respond to a job');
  check((await request('/api/jobs/',{cookie:customer.cookie,body:{action:'apply',data:reaction}})).status===409,'duplicate job applications are rejected');
  check((await (await request('/api/jobs/?scope=applications',{cookie:company.cookie})).json()).items.length===1,'employer sees their applicants');
  check((await (await request('/api/jobs/?scope=applications',{cookie:bob})).json()).items.length===0,'other employers cannot read applicants');
  check((await (await request('/api/jobs/?scope=applications',{cookie:customer.cookie})).json()).items.length===1,'customer sees own job applications');
  check((await (await request('/api/jobs/?scope=applications',{cookie:stranger.cookie})).json()).items.length===0,'another customer cannot read job applications');
  check((await request('/api/jobs/',{cookie:company.cookie,body:{action:'close',id:jobId},extra:{origin:'https://other.example'}})).status===403,'job changes enforce same-origin');
  check((await request('/api/jobs/',{cookie:bob,body:{action:'close',id:jobId}})).status===404,'another employer cannot close a vacancy');
  check((await request('/api/jobs/',{cookie:company.cookie,body:{action:'close',id:jobId}})).status===200,'employer can close a vacancy');
  check((await request('/prace/'+jobId+'/')).status===404,'closed vacancy disappears from public detail');
  check((await request('/api/jobs/',{cookie:stranger.cookie,body:{action:'apply',data:reaction}})).status===404,'closed vacancy rejects new applications');
  await request('/api/jobs/',{cookie:company.cookie,body:{action:'save',id:jobId,data:{...vacancy,status:'PUBLISHED'}}});
  const jobDb=new DatabaseSync(filename);
  jobDb.prepare("UPDATE job_postings SET expires_at='2000-01-01' WHERE id=?").run(jobId);jobDb.close();
  check((await (await request('/api/jobs/')).json()).total===0,'expired jobs disappear without a scheduled job');

  const testDb=new DatabaseSync(filename);
  const memberId=testDb.prepare('SELECT id FROM users WHERE email=?').get('stranger@example.test').id;
  testDb.prepare('INSERT INTO account_members VALUES(?,?,?,?)').run(companyId,memberId,'COMPANY_MEMBER',new Date().toISOString());
  testDb.close();
  check((await request('/api/accounts/',{cookie:stranger.cookie,body:{action:'switch',accountId:companyId}})).status===200,'company member can switch without logging out');
  check((await request('/api/accounts/',{cookie:stranger.cookie,body:{action:'step',step:2,data:{ico:'12345678',businessName:'Hijack',address:'X',billingAddress:'X'}}})).status===403,'company member cannot edit company settings');
  check((await request('/api/jobs/',{cookie:stranger.cookie,body:{action:'save',data:vacancy}})).status===403,'company member cannot publish jobs');
  check((await request('/api/jobs/?scope=applications',{cookie:stranger.cookie})).status===403,'company member cannot read recruitment personal data');
  await action(company.cookie,{action:'save-list',data:{name:'Shared company list',companyIds:['company-01']}});
  const shared=(await (await request('/api/panel/',{cookie:stranger.cookie})).json()).state;
  check(shared.lists.length===1&&shared.lists[0].name==='Shared company list','members share company data');
  check(await balance(company.cookie)===100000,'new company receives 100000 credits shared by its members');
  const teamRequest=(await market(customer.cookie,{action:'request',title:'Firemní zakázka',description:'Poptávka pro firemní dodavatele.',serviceId:'rekonstrukce',city:'Ostrava',region:'moravskoslezsky',budgetCzk:20000})).requests.find(r=>r.title==='Firemní zakázka');
  const teamOffer=(await market(stranger.cookie,{action:'offer',requestId:teamRequest.id,body:'Realizaci zajistí náš tým.',amountCzk:18000})).offers[0];
  await market(customer.cookie,{action:'accept-offer',id:teamOffer.id});
  await Promise.all([market(stranger.cookie,{action:'unlock-chat',id:teamOffer.id}),market(company.cookie,{action:'unlock-chat',id:teamOffer.id})]);
  check(await balance(company.cookie)===99951&&await balance(stranger.cookie)===99951,'company members share one unlock and a single 49-credit debit');

  check((await request('/api/panel/',{cookie:stranger.cookie,body:{action:'settings',data:shared.settings}})).status===403,'company member cannot change bot configuration');
  const addContext=await request('/api/accounts/',{cookie:alice,body:{action:'choose',type:'CUSTOMER',newContext:true}});
  check(addContext.status===200&&(await addContext.json()).redirectTo==='/zakaznik/','one person can add a customer context');
  check((await request('/api/panel/',{cookie:alice})).status===403,'switching contexts immediately changes permissions');
  await request('/api/accounts/',{cookie:alice,body:{action:'switch',accountId:aliceId}});
  check((await (await request('/api/panel/',{cookie:alice})).json()).state.lists[0].id===listId,'switching back preserves the original provider records');
  check((await request('/api/accounts/',{cookie:alice,body:{action:'switch',accountId:aliceId},extra:{origin:'https://other.example'}})).status===403,'account switching enforces same-origin');
  check((await request('/administrace/',{cookie:customer.cookie})).headers.get('location')==='/zakaznik/','ordinary users cannot access platform administration');
  const dbAdmin=new DatabaseSync(filename);
  dbAdmin.prepare("UPDATE users SET platform_role='PLATFORM_ADMIN' WHERE email=?").run('stranger@example.test');
  dbAdmin.close();
  const adminLogin=await request('/api/auth/login/',{body:{email:'stranger@example.test',password:'test-only-password-123'}});
  check((await adminLogin.json()).redirectTo==='/administrace/','platform admin is routed to administration');

  await stop(); await start();
  state = (await (await request('/api/panel/', {cookie: alice})).json()).state;
  check(state.lists[0].id === listId && state.campaigns.length === 1 && state.settings.senderName === 'Alice', 'accounts, sessions and saved data survive a server restart');
  check((await request('/api/auth/logout/', {cookie: alice})).status === 405, 'logout requires POST');
  check((await request('/api/auth/logout/', {cookie: alice, method:'POST', extra:{origin:'https://other.example'}})).status === 403, 'logout rejects cross-origin requests');
  check((await request('/api/auth/logout/', {cookie: alice, method:'POST'})).status === 200 && (await request('/api/companies/', {cookie:alice})).status === 401, 'logout revokes the server-side session');
  check((await request('/api/auth/login/', {body:{email:'alice@example.test',password:'wrong-password-123'}})).status === 401, 'wrong passwords are rejected');
  const login = await request('/api/auth/login/', {body:{email:'ALICE@example.test',password:'test-only-password-123'}});
  check(login.status === 200 && !!login.headers.get('set-cookie') && (await login.json()).redirectTo==='/dodavatel/', 'existing users can sign in with email and password');
  for(let i=0;i<15;i++) assert.equal((await request('/api/auth/login/', {body:{email:'missing@example.test',password:'wrong-password-123'}})).status,401);
  check((await request('/api/auth/login/', {body:{email:'missing@example.test',password:'wrong-password-123'}})).status === 429, 'login attempts are rate-limited');
  console.log(`\n${checks} self-hosted integration checks passed.`);
} catch (error) { console.error(logs); throw error; }
finally { await stop(); await rm(directory, {recursive:true,force:true}); }

