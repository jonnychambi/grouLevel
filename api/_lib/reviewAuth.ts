/**
 * Usuarios de Groulevel Reviews: correo validado con Supabase Auth (código o enlace mágico por email).
 * El servidor hace de intermediario (no expone claves ni agrega dependencias al sitio):
 *   startEmailLogin(email)      → Supabase envía el correo con el código/enlace.
 *   verifyEmailCode(email, code) → sesión (access_token) si el código es válido.
 *   userFromRequest(request)     → usuario validado a partir de "Authorization: Bearer <access_token>".
 * Requiere SUPABASE_URL y SUPABASE_ANON_KEY (las crea la integración de Supabase en Vercel).
 */
import { randomBytes } from 'node:crypto';
import type { Sql } from './db.js';
import { getSql } from './db.js';

const SITE = (process.env.VITE_SITE_URL ?? 'https://www.groulevel.com').replace(/\/$/, '');
const base = () => (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const anonKey = () => process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
export const isAuthConfigured = () => !!(base() && anonKey());

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function supabase(path: string, init: RequestInit & { token?: string } = {}) {
  const res = await fetch(`${base()}/auth/v1${path}`, {
    ...init,
    headers: { apikey: anonKey(), 'Content-Type': 'application/json', ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}), ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(10_000)
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, body };
}

export class AuthError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export async function startEmailLogin(email: string, next = '/opinar'): Promise<void> {
  if (!isAuthConfigured()) throw new AuthError('El registro de usuarios no está configurado.', 503);
  const clean = email.trim().toLowerCase();
  if (!EMAIL.test(clean)) throw new AuthError('Ingresa un correo válido.');
  const redirect = `${SITE}${next.startsWith('/') ? next : '/opinar'}`;
  const r = await supabase(`/otp?redirect_to=${encodeURIComponent(redirect)}`, { method: 'POST', body: JSON.stringify({ email: clean, create_user: true }) });
  if (!r.ok) {
    const msg = String(r.body.msg ?? r.body.error_description ?? r.body.message ?? '');
    if (r.status === 429 || /rate limit|seconds/i.test(msg)) throw new AuthError('Ya te enviamos un correo hace poco. Espera un minuto y vuelve a intentarlo.', 429);
    console.error('auth_otp_failed', r.status, msg);
    throw new AuthError('No pudimos enviar el correo. Inténtalo nuevamente en unos minutos.', 502);
  }
}

export interface Session { access_token: string; refresh_token: string | null; expires_at: number; email: string }

export async function verifyEmailCode(email: string, code: string): Promise<Session> {
  if (!isAuthConfigured()) throw new AuthError('El registro de usuarios no está configurado.', 503);
  const clean = email.trim().toLowerCase();
  const token = code.replace(/\s+/g, '');
  if (!EMAIL.test(clean) || !/^\d{6,10}$/.test(token)) throw new AuthError('Revisa el correo y el código.');
  for (const type of ['email', 'magiclink', 'signup']) {
    const r = await supabase('/verify', { method: 'POST', body: JSON.stringify({ type, email: clean, token }) });
    if (r.ok && r.body.access_token) {
      return { access_token: String(r.body.access_token), refresh_token: (r.body.refresh_token as string) ?? null, expires_at: Number(r.body.expires_at) || Math.floor(Date.now() / 1000) + 3600, email: clean };
    }
  }
  throw new AuthError('El código no es válido o ya venció. Pide uno nuevo.', 401);
}

export interface ReviewUser { id: string; email: string; email_verified: boolean }

const cache = new Map<string, { user: ReviewUser; at: number }>();

/** Usuario a partir del token de Supabase (validado contra Supabase; caché de 5 minutos). */
export async function userFromRequest(request: Request): Promise<ReviewUser | null> {
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token || token.length > 4000 || !isAuthConfigured()) return null;
  const hit = cache.get(token);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.user;
  const r = await supabase('/user', { token });
  if (!r.ok || !r.body.id || !r.body.email) return null;
  const user: ReviewUser = { id: String(r.body.id), email: String(r.body.email).toLowerCase(), email_verified: !!(r.body.email_confirmed_at || r.body.confirmed_at) };
  if (cache.size > 2000) cache.clear();
  cache.set(token, { user, at: Date.now() });
  return user;
}

/** Código de referido: 8 caracteres sin ambigüedades (sin 0/O ni 1/I). */
export const newRefCode = () => Array.from(randomBytes(8), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');

/** Registra/actualiza a la persona en `reviewers` (con su código de referido). */
export async function touchReviewer(user: ReviewUser, extra: { display_name?: string | null } = {}, sql: Sql = getSql()) {
  const [row] = await sql`
    insert into reviewers (user_id, email, display_name, ref_code)
    values (${user.id}, ${user.email}, ${extra.display_name ?? null}, ${newRefCode()})
    on conflict (user_id) do update set email = excluded.email, last_seen_at = now(),
      display_name = coalesce(excluded.display_name, reviewers.display_name),
      ref_code = coalesce(reviewers.ref_code, excluded.ref_code)
    returning blocked, ref_code, referred_by`;
  return { blocked: !!row?.blocked, ref_code: String(row.ref_code), referred_by: (row.referred_by as string | null) ?? null };
}
