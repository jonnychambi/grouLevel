/** Registro de auditoría del administrador (tabla admin_audit). Nunca interrumpe la operación si falla. */
import { createHash } from 'node:crypto';
import { getSql, isDbConfigured } from './db.js';

/** IP anonimizada: permite ver si los intentos vienen del mismo origen sin guardar la IP. */
const ipHash = (request: Request) => {
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
  return ip ? createHash('sha256').update(`${process.env.ADMIN_SESSION_SECRET ?? ''}|${ip}`).digest('hex').slice(0, 16) : null;
};

export async function audit(request: Request, action: string, target: string | null, ok: boolean, detail?: string | null, status?: number) {
  if (!isDbConfigured()) return;
  try {
    await getSql()`insert into admin_audit (method, action, target, ok, status, detail, ip_hash)
      values (${request.method}, ${action.slice(0, 60)}, ${target?.slice(0, 200) ?? null}, ${ok}, ${status ?? null}, ${detail?.slice(0, 300) ?? null}, ${ipHash(request)})`;
  } catch (err) {
    console.error('audit_failed', err instanceof Error ? err.message : err);
  }
}

/** Identificador del registro afectado (sin copiar el contenido): id, pathname, user_id… del cuerpo o la URL. */
export async function auditTarget(request: Request): Promise<string | null> {
  const params = new URL(request.url).searchParams;
  const fromUrl = params.get('id') ?? params.get('pathname');
  if (fromUrl) return fromUrl;
  try {
    if (!(request.headers.get('content-type') ?? '').includes('json')) return null;
    const body = (await request.json()) as Record<string, unknown>;
    for (const k of ['id', 'pathname', 'user_id', 'course_id', 'ids', 'note']) {
      const v = body?.[k];
      if (typeof v === 'string' || typeof v === 'number') return String(v);
      if (Array.isArray(v)) return v.slice(0, 10).join(',');
    }
  } catch {
    /* sin cuerpo JSON */
  }
  return null;
}

export async function listAudit(limit = 300) {
  return getSql()`select id, at, method, action, target, ok, status, detail, ip_hash from admin_audit order by at desc limit ${limit}`;
}
