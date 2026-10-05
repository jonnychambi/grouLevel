/**
 * Autenticación del administrador.
 * - ADMIN_PASSWORD: contraseña única del panel (variable de entorno sensible en Vercel).
 * - ADMIN_SESSION_SECRET: clave HMAC para firmar sesiones (si falta, se deriva de la contraseña).
 * Token = base64url(payload).base64url(hmac) · expira en 12 horas · sin estado en servidor.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const SESSION_HOURS = 12;

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!s) throw new Error('ADMIN_PASSWORD no está configurada');
  return s;
}

const b64url = (buf: Buffer | string) => Buffer.from(buf).toString('base64url');
const sign = (data: string) => createHmac('sha256', secret()).update(data).digest('base64url');

export function isConfigured(): boolean {
  return !!process.env.ADMIN_PASSWORD;
}

export function checkPassword(input: unknown): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof input !== 'string') return false;
  const a = createHash('sha256').update(input).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export function issueToken(): { token: string; expires_at: string } {
  const exp = Date.now() + SESSION_HOURS * 3600_000;
  const payload = b64url(JSON.stringify({ sub: 'admin', exp }));
  return { token: `${payload}.${sign(payload)}`, expires_at: new Date(exp).toISOString() };
}

export function verifyRequest(request: Request): boolean {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp: number };
    return typeof exp === 'number' && exp > Date.now();
  } catch {
    return false;
  }
}
