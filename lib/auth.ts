import 'server-only';
import {cookies} from 'next/headers';
import {randomBytes, createHash, scrypt, timingSafeEqual} from 'node:crypto';
import {query, transaction} from '@/db';
import {HttpError, appOrigin} from './http';

export type User = {userId: string; email: string; fullName: string | null};
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
  return query(`SELECT u.id AS userId, u.email, p.name AS fullName FROM sessions s
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
    query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)', hash(token), userId, Date.now() + SESSION_SECONDS * 1000).run();
  });
  jar.set(COOKIE, token, {httpOnly: true, sameSite: 'lax', secure: appOrigin(request).startsWith('https://'), path: '/', maxAge: SESSION_SECONDS});
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
