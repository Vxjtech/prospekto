export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function appOrigin(request: Request): string {
  const value = process.env.APP_URL || new URL(request.url).origin;
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('APP_URL must use http or https.');
  return url.origin;
}
export function requireSameOrigin(request: Request) {
  if (request.headers.get('origin') !== appOrigin(request)) throw new HttpError(403, 'Požadavek musí pocházet z Prospekta.');
}
export async function readJson(request: Request, limit = 65536): Promise<unknown> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new HttpError(415, 'Očekáváme JSON.');
  if (Number(request.headers.get('content-length') ?? 0) > limit) throw new HttpError(413, 'Požadavek je příliš velký.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Chybí data.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) { await reader.cancel(); throw new HttpError(413, 'Požadavek je příliš velký.'); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new HttpError(400, 'Neplatná data.'); }
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {status, headers: {'Cache-Control': 'private, no-store', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff'}});
}
