import 'server-only';
import {cookies} from 'next/headers';
import {randomBytes, createHash, scrypt, timingSafeEqual} from 'node:crypto';
import {query, transaction} from '@/db';
import {HttpError, requestProtocol} from './http';

export type User = {userId: string; email: string; fullName: string | null; activeAccountId: string | null; platformRole: 'PLATFORM_ADMIN' | null};
const COOKIE = 'prospekto_session';
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const derive = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => {
  scrypt(password, salt, 64, {N: 16384, r: 8, p: 1}, (error, key) => error ? reject(error) : resolve(key));
});
export async function passwordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${(await derive(password, salt)).toString('hex')}`;
}
export async function verifyPassword(password: string, stored?: string) {
  const [scheme, salt, encoded] = (stored ?? `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
  if (scheme !== 'scrypt' || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(encoded)) return false;
  const actual = await derive(password, salt);
  return timingSafeEqual(actual, Buffer.from(encoded, 'hex')) && !!stored;
}
export async function getUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return query(`SELECT u.id AS userId, u.email, p.name AS fullName, s.active_account_id AS activeAccountId, u.platform_role AS platformRole FROM sessions s
    JOIN users u ON u.id=s.user_id LEFT JOIN profiles p ON p.id=u.id
    WHERE s.token_hash=? AND s.expires_at>?`, hash(token), Date.now()).get<User>() ?? null;
}
export async function startSession(userId: string, request: Request) {
  const jar = await cookies();
  const previous = jar.get(COOKIE)?.value;
  const token = randomBytes(32).toString('hex');
  transaction(() => {
    if (previous) query('DELETE FROM sessions WHERE token_hash=?', hash(previous)).run();
    query('DELETE FROM sessions WHERE expires_at<=?', Date.now()).run();
    const account = query('SELECT m.account_id FROM account_members m JOIN users u ON u.id=m.user_id WHERE m.user_id=? ORDER BY (m.account_id=u.last_account_id) DESC,m.created_at LIMIT 1',userId).get<{account_id:string}>();
    query('INSERT INTO sessions(token_hash,user_id,expires_at,active_account_id) VALUES(?,?,?,?)', hash(token), userId, Date.now() + SESSION_SECONDS * 1000,account?.account_id??null).run();
  });
  jar.set(COOKIE, token, {httpOnly: true, sameSite: 'lax', secure: requestProtocol(request) === 'https', path: '/', maxAge: SESSION_SECONDS});
}
export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) query('DELETE FROM sessions WHERE token_hash=?', hash(token)).run();
  jar.delete(COOKIE);
}
// Persistent limits apply across restarts. Client IP headers are not trusted.
export function limitAuth(action: 'login' | 'register', email: string) {
  const now = Date.now(), window = 15 * 60 * 1000;
  const limits = [[`${action}:global`, action === 'register' ? 50 : 300], [`${action}:${hash(email)}`, 15]] as const;
  transaction(() => {
    query('DELETE FROM auth_attempts WHERE reset_at<=?', now).run();
    for (const [key, maximum] of limits) {
      const row = query('SELECT attempts FROM auth_attempts WHERE key=?', key).get<{attempts: number}>();
      if (row && row.attempts >= maximum) throw new HttpError(429, 'Příliš mnoho pokusů. Zkuste to znovu za 15 minut.');
    }
    for (const [key] of limits) query('INSERT INTO auth_attempts(key,attempts,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1', key, now + window).run();
  });
}

export async function switchAccount(user:User,accountId:string) {
  const token=(await cookies()).get(COOKIE)?.value;
  if(!token) throw new HttpError(401,'Přihlaste se.');
  transaction(()=>{
    if(!query('SELECT 1 FROM account_members WHERE account_id=? AND user_id=?',accountId,user.userId).get()) throw new HttpError(403,'Nejste členem tohoto účtu.');
    const result=query('UPDATE sessions SET active_account_id=? WHERE token_hash=? AND user_id=? AND expires_at>?',accountId,hash(token),user.userId,Date.now()).run();
    if(!result.changes) throw new HttpError(401,'Přihlášení vypršelo.');
    query('UPDATE users SET last_account_id=? WHERE id=?',accountId,user.userId).run();
  });
}
