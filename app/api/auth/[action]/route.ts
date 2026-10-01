import {z} from 'zod';
import {query, transaction} from '@/db';
import {endSession, limitAuth, passwordHash, startSession, verifyPassword} from '@/lib/auth';
import {HttpError, json, readJson, requireSameOrigin} from '@/lib/http';
import {profileInput} from '@/lib/panel/model';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const credentials = z.object({
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(10, 'Heslo musí mít alespoň 10 znaků.').max(128),
});
const registration = credentials.extend(profileInput.shape).strict();

export async function POST(request: Request, {params}: {params: Promise<{action: string}>}) {
  try {
    requireSameOrigin(request);
    const {action} = await params;
    if (action === 'logout') { await endSession(); return json({ok: true}); }
    if (!['login', 'register'].includes(action)) return json({error: 'Nenalezeno.'}, 404);
    const parsed = (action === 'register' ? registration : credentials.strict()).safeParse(await readJson(request, 8192));
    if (!parsed.success) return json({error: parsed.error.issues[0]?.message ?? 'Zkontrolujte údaje.'}, 400);
    const data = parsed.data;
    limitAuth(action as 'login' | 'register', data.email);
    if (action === 'login') {
      const user = query('SELECT id,password_hash FROM users WHERE email=?', data.email).get<{id: string; password_hash: string}>();
      if (!await verifyPassword(data.password, user?.password_hash) || !user) return json({error: 'Nesprávný e-mail nebo heslo.'}, 401);
      await startSession(user.id, request);
    } else {
      const profile = registration.parse(data);
      const hashed = await passwordHash(data.password);
      const id = crypto.randomUUID(), now = new Date().toISOString();
      transaction(() => {
        if (query('SELECT id FROM users WHERE email=?', data.email).get()) throw new HttpError(409, 'Účet s tímto e-mailem už existuje. Přihlaste se.');
        query('INSERT INTO users(id,email,password_hash,created_at) VALUES(?,?,?,?)', id, data.email, hashed, now).run();
        query('INSERT INTO profiles(id,name,workspace,created_at) VALUES(?,?,?,?)', id, profile.name, profile.workspace, now).run();
      });
      await startSession(id, request);
    }
    return json({ok: true});
  } catch (error) {
    if (error instanceof HttpError) return json({error: error.message}, error.status);
    console.error('Authentication failed', error instanceof Error ? error.name : 'unknown');
    return json({error: 'Přihlášení není momentálně dostupné. Zkuste to znovu.'}, 503);
  }
}
