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
const socket = createServer();
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const origin = `http://127.0.0.1:${port}`;
let server, logs = '', checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; console.log('PASS', message); }
async function start() {
  server = spawn(process.execPath, ['server.js'], {cwd: standalone, env: {...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', HOSTNAME: '127.0.0.1', PORT: String(port), APP_URL: origin, DATABASE_PATH: filename}, stdio: ['ignore', 'pipe', 'pipe']});
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
  const response = await request('/api/auth/register/', {body: {email, password: 'test-only-password-123', name, workspace: name + ' workspace'}});
  assert.equal(response.status, 200, await response.clone().text());
  const setCookie = response.headers.get('set-cookie');
  check(setCookie.includes('HttpOnly') && /SameSite=lax/i.test(setCookie), 'session cookie uses HttpOnly and SameSite');
  return setCookie.split(';')[0];
}
async function action(cookie, body) {
  const response = await request('/api/panel/', {cookie, body});
  assert.equal(response.status, 200, await response.clone().text());
  return (await response.json()).state;
}
try {
  await start();
  check(!await stat(filename).then(() => true, () => false), 'public demo starts without a pre-created database');
  const publicData = await (await request('/api/public-companies/')).json();
  check(publicData.total === 32 && !publicData.ready && publicData.regionsAvailable, 'only 32 demo companies, with regions, are served');
  check(publicData.items.every(item => Object.keys(item).sort().join() === 'category,id,name,region'), 'public API excludes contacts and IČO');
  for (const [category, region, expected] of [['stavebnictvi','ustecky',2], ['auto-moto','karlovarsky',2], ['reality','',3]]) {
    const data = await (await request(`/api/public-companies/?kategorie=${category}&kraj=${region}`)).json();
    check(data.total === expected, 'category + region: ' + category + ' / ' + (region || 'all'));
  }
  const page2 = await (await request('/api/public-companies/?strana=2')).json();
  check(page2.page === 2 && page2.items.length === 12, 'server pagination remains bounded');
  const html = await (await request('/databaze/')).text();
  check(!html.includes('@firma-') && !html.includes('+420 000') && html.includes('Zpět na úvod'), 'public page keeps contacts locked and home navigation available');
  check((await request('/api/companies/')).status === 401, 'anonymous contacts are rejected');
  check((await request('/api/companies/', {extra: {'oai-authenticated-user-id':'fake-user','oai-authenticated-user-email':'fake@example.test'}})).status === 401, 'forged legacy identity headers do not authenticate');
  check((await request('/api/catalog-import/')).status === 404, 'real-database import endpoint is removed');
  check((await request('/api/auth/register/', {body: {email: 'bad@example.test', password: 'short', name: 'Test', workspace: 'Test'}})).status === 400, 'short passwords are rejected');
  check((await request('/api/auth/register/', {body: {}, extra: {origin: 'https://other.example'}})).status === 403, 'cross-origin registration is rejected');
  const alice = await register('alice@example.test', 'Alice');
  const bob = await register('bob@example.test', 'Bob');
  check(await stat(filename).then(() => true), 'SQLite database and schema initialize automatically');
  check((await request('/api/auth/register/', {body: {email: 'ALICE@example.test', password: 'test-only-password-123', name: 'Alice', workspace: 'Another'}})).status === 409, 'duplicate accounts are rejected case-insensitively');
  let state = await action(alice, {action: 'save-list', data: {name: 'Stavebnictví', companyIds: ['demo-13','demo-14']}});
  const listId = state.lists[0].id;
  check(state.lists.length === 1 && state.lists[0].companyIds.length === 2, 'saved lists persist in SQLite');
  const bobState = await (await request('/api/panel/', {cookie: bob})).json();
  check(bobState.state.lists.length === 0, 'accounts have separate data');
  check((await request('/api/companies/?list=' + listId, {cookie: bob})).status === 404, 'another account cannot read a saved list');
  await action(bob, {action: 'delete-list', id: listId});
  state = (await (await request('/api/panel/', {cookie: alice})).json()).state;
  check(state.lists.length === 1, 'another account cannot delete a saved list');
  check((await request('/api/panel/', {cookie: alice, body: {action:'save-list', data:{name:'Invalid', companyIds:['zf:123']}}})).status === 400, 'real-company IDs cannot enter demo lists');
  check((await request('/api/panel/', {cookie: alice, body:{action:'profile',data:{name:'Alice',workspace:'Changed'}},extra:{origin:'https://other.example'}})).status === 403, 'panel changes enforce same-origin requests');
  state = await action(alice, {action:'save-campaign',data:{name:'Draft campaign',purpose:'Demo preview',subject:'Dobrý den',body:'Nabídka pro {{nazev_firmy}}',companyIds:['demo-13']}});
  check(state.campaigns.length === 1, 'campaign drafts remain functional');
  state = await action(alice, {action:'settings',data:{...state.settings,senderName:'Alice'}});
  check(state.settings.senderName === 'Alice', 'bot settings remain persistent');
  state = await action(alice, {action:'suppress',data:{email:'BLOCKED@example.test',reason:'Demo block'}});
  check(state.suppressions[0].email === 'blocked@example.test', 'suppression list remains functional');
  const privateResponse = await request('/api/companies/', {cookie: alice});
  const privateData = await privateResponse.json();
  check(privateResponse.headers.get('cache-control').includes('no-store') && privateData.items.every(item => item.email && item.phone), 'authenticated contacts are complete and not publicly cached');
  check((await request('/panel/', {cookie: alice})).status === 200, 'registered panel renders on the Node.js server');
  const sqlite = new DatabaseSync(filename);
  const hashes = sqlite.prepare('SELECT password_hash FROM users').all();
  check(hashes.length === 2 && hashes.every(row => row.password_hash.startsWith('scrypt:') && !row.password_hash.includes('test-only-password')), 'passwords are stored as salted hashes');
  check(sqlite.prepare('SELECT token_hash FROM sessions').all().every(row => !alice.includes(row.token_hash) && !bob.includes(row.token_hash)), 'raw session tokens are not stored');
  sqlite.close();
  await stop(); await start();
  state = (await (await request('/api/panel/', {cookie: alice})).json()).state;
  check(state.lists[0].id === listId && state.campaigns.length === 1 && state.settings.senderName === 'Alice', 'accounts, sessions and saved data survive a server restart');
  check((await request('/api/auth/logout/', {cookie: alice})).status === 405, 'logout requires POST');
  check((await request('/api/auth/logout/', {cookie: alice, method:'POST', extra:{origin:'https://other.example'}})).status === 403, 'logout rejects cross-origin requests');
  check((await request('/api/auth/logout/', {cookie: alice, method:'POST'})).status === 200 && (await request('/api/companies/', {cookie:alice})).status === 401, 'logout revokes the server-side session');
  check((await request('/api/auth/login/', {body:{email:'alice@example.test',password:'wrong-password-123'}})).status === 401, 'wrong passwords are rejected');
  const login = await request('/api/auth/login/', {body:{email:'ALICE@example.test',password:'test-only-password-123'}});
  check(login.status === 200 && !!login.headers.get('set-cookie'), 'existing users can sign in with email and password');
  for(let i=0;i<15;i++) assert.equal((await request('/api/auth/login/', {body:{email:'missing@example.test',password:'wrong-password-123'}})).status,401);
  check((await request('/api/auth/login/', {body:{email:'missing@example.test',password:'wrong-password-123'}})).status === 429, 'login attempts are rate-limited');
  console.log(`\n${checks} self-hosted integration checks passed.`);
} catch (error) { console.error(logs); throw error; }
finally { await stop(); await rm(directory, {recursive:true,force:true}); }
