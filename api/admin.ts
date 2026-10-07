/**
 * API del módulo de administración (una sola función para no multiplicar endpoints).
 * Los datos viven en Supabase (PostgreSQL); los CV en Vercel Blob.
 *
 *   POST /api/admin?action=login     { password }                 → { token, expires_at }
 *   GET  /api/admin?action=catalog                                  → { catalog, version }
 *   PUT  /api/admin?action=catalog   { catalog, baseVersion, note } → { version }   (409 si otra persona guardó antes)
 *   GET  /api/admin?action=versions                                 → { versions }
 *   POST /api/admin?action=restore   { pathname }                   → { version }
 *   GET  /api/admin?action=leads     [&limit=500]                    → { leads, total }
 *   POST /api/admin?action=lead      { pathname, status?, notes? }   → { lead }        (pathname = id del lead)
 *   POST /api/admin?action=lead-delete { pathname }                  → { ok }
 *   GET  /api/admin?action=reviews                                  → { reviews }
 *   POST /api/admin?action=review    { pathname, status?, reply?, rejection_reason? } → { review }   (pathname = id)
 *   POST /api/admin?action=review-delete { pathname }               → { ok }
 *   GET  /api/admin?action=profiles  [&limit=300]                    → { profiles, total }   (diagnósticos "Mi ruta")
 *   GET  /api/admin?action=profile&id=prf_…                         → { profile }   (completo)
 *   GET  /api/admin?action=profile-file&id=prf_…                    → CV original (descarga)
 *   POST /api/admin?action=profile   { id, status?, notes? }        → { profile }
 *   POST /api/admin?action=profile-delete { id }                    → { ok }   (borra también el CV)
 *   GET  /api/admin?action=db-status                                → estado de la base (migraciones, conteos, última importación)
 *   POST /api/admin?action=db-import                                → importa datos antiguos de Blob (no destructivo)
 *   GET  /api/admin?action=refresh                                  → actualización de programas: configuración, propuestas, ejecuciones, consumo
 *   POST /api/admin?action=refresh-settings { frequency, batch_size } → { settings }
 *   POST /api/admin?action=refresh-run                              → revisa un lote ahora → { summary }
 *   POST /api/admin?action=refresh-check { course_id }              → revisa un programa leyendo su link → { result }
 *   POST /api/admin?action=refresh-apply { id, fields? }            → aplica la propuesta (todos o algunos campos) → { version, update }
 *   POST /api/admin?action=refresh-discard { id }                   → { ok }
 *
 * Todas las acciones salvo login requieren Authorization: Bearer <token>.
 */
import { checkPassword, isConfigured, issueToken, verifyRequest } from './_lib/auth.js';
import { json, readJson } from './_lib/http.js';
import { validateCatalog } from './_lib/validate.js';
import { deleteLead, listLeads, updateLead } from './_lib/leads.js';
import { deleteReview, listAllReviews, moderateReview } from './_lib/reviews.js';
import { deleteProfile, listProfiles, profileFile, readProfile, updateProfile } from './_lib/profiles.js';
import { getSql, isDbConfigured } from './_lib/db.js';
import { dbStatus, importFromBlob } from './_lib/dbSync.js';
import { getCurrentCatalog, listVersions, publishCatalog, readVersion, VersionConflictError } from './_lib/catalogRepo.js';
import { legacyBlobSources } from './_lib/legacyBlob.js';
import { applyUpdate, checkOne, discardUpdate, refreshOverview, runRefresh, saveSettings, UpdateNotPendingError, type RefreshSettings } from './_lib/programRefresh.js';

const action = (request: Request) => new URL(request.url).searchParams.get('action') ?? '';

function guard(request: Request): Response | null {
  if (!isConfigured()) return json(503, { error: 'not_configured', message: 'Falta configurar ADMIN_PASSWORD en Vercel.' });
  if (!isDbConfigured()) return json(503, { error: 'db_not_configured', message: 'Falta conectar la base de datos (POSTGRES_URL de Supabase en Vercel).' });
  if (!verifyRequest(request)) return json(401, { error: 'unauthorized', message: 'Sesión inválida o vencida. Vuelve a ingresar.' });
  return null;
}

async function handlePost(request: Request): Promise<Response> {
  const act = action(request);
  if (act === 'login') {
    if (!isConfigured()) return json(503, { error: 'not_configured', message: 'Falta configurar ADMIN_PASSWORD en Vercel.' });
    const body = await readJson<{ password?: string }>(request);
    if (!checkPassword(body?.password)) {
      await new Promise((r) => setTimeout(r, 600)); // frena ataques de fuerza bruta
      return json(401, { error: 'invalid_password', message: 'Contraseña incorrecta.' });
    }
    return json(200, issueToken());
  }
  const denied = guard(request);
  if (denied) return denied;

  if (act === 'restore') {
    const body = await readJson<{ pathname?: string }>(request);
    if (!body?.pathname) return json(400, { error: 'bad_request', message: 'Falta la versión a restaurar.' });
    const data = await readVersion(body.pathname);
    if (!data) return json(404, { error: 'not_found', message: 'La versión no existe o ya no tiene contenido guardado.' });
    const restored = { ...data, meta: { ...(data.meta ?? {}), restored_from: body.pathname, saved_at: new Date().toISOString() } };
    return json(200, { version: await publishCatalog(restored, 'restaurado', null, { force: true }) });
  }
  if (act === 'review' || act === 'review-delete') {
    const body = await readJson<{ pathname?: string; status?: string; reply?: string; rejection_reason?: string }>(request);
    if (!body?.pathname) return json(400, { error: 'bad_request', message: 'Falta la reseña.' });
    if (act === 'review-delete') return (await deleteReview(body.pathname)) ? json(200, { ok: true }) : json(404, { error: 'not_found' });
    const review = await moderateReview(body.pathname, body);
    return review ? json(200, { review }) : json(404, { error: 'not_found', message: 'La reseña no existe.' });
  }
  if (act === 'profile' || act === 'profile-delete') {
    const body = await readJson<{ id?: string; status?: string; notes?: string }>(request);
    if (!body?.id) return json(400, { error: 'bad_request', message: 'Falta el diagnóstico.' });
    if (act === 'profile-delete') return (await deleteProfile(body.id)) ? json(200, { ok: true }) : json(404, { error: 'not_found' });
    const profile = await updateProfile(body.id, body);
    return profile ? json(200, { profile }) : json(404, { error: 'not_found', message: 'El diagnóstico no existe.' });
  }
  if (act === 'lead' || act === 'lead-delete') {
    const body = await readJson<{ pathname?: string; status?: string; notes?: string }>(request);
    if (!body?.pathname) return json(400, { error: 'bad_request', message: 'Falta el lead.' });
    if (act === 'lead-delete') return (await deleteLead(body.pathname)) ? json(200, { ok: true }) : json(404, { error: 'not_found' });
    const lead = await updateLead(body.pathname, body);
    return lead ? json(200, { lead }) : json(404, { error: 'not_found', message: 'El lead no existe.' });
  }
  if (act === 'refresh-settings') {
    const body = await readJson<Partial<RefreshSettings>>(request);
    return json(200, { settings: await saveSettings(body ?? {}) });
  }
  if (act === 'refresh-run') return json(200, { summary: await runRefresh('admin', { timeBudgetMs: 240_000 }) });
  if (act === 'refresh-check') {
    const body = await readJson<{ course_id?: string }>(request);
    if (!body?.course_id) return json(400, { error: 'bad_request', message: 'Falta el programa.' });
    const result = await checkOne(body.course_id);
    return result ? json(200, { result }) : json(404, { error: 'not_found', message: 'El programa no existe en el catálogo publicado.' });
  }
  if (act === 'refresh-apply' || act === 'refresh-discard') {
    const body = await readJson<{ id?: number; fields?: string[] }>(request);
    const id = Number(body?.id);
    if (!Number.isInteger(id)) return json(400, { error: 'bad_request', message: 'Falta la propuesta.' });
    if (act === 'refresh-discard') return (await discardUpdate(id)) ? json(200, { ok: true }) : json(404, { error: 'not_found', message: 'La propuesta no está pendiente.' });
    try {
      const out = await applyUpdate(id, Array.isArray(body?.fields) ? body.fields.map(String) : null);
      return out ? json(200, out) : json(404, { error: 'not_found', message: 'La propuesta no existe.' });
    } catch (err) {
      if (err instanceof UpdateNotPendingError) return json(409, { error: 'conflict', message: err.message });
      throw err;
    }
  }
  if (act === 'db-import') {
    try {
      return json(200, { stats: await importFromBlob(getSql(), legacyBlobSources, 'admin') });
    } catch (err) {
      return json(500, { error: 'db_import_failed', message: `No se pudo importar: ${err instanceof Error ? err.message : 'error desconocido'}` });
    }
  }
  return json(404, { error: 'unknown_action' });
}

async function handleGet(request: Request): Promise<Response> {
  const act = action(request);
  if (act === 'db-status') {
    const denied = verifyRequest(request) ? null : json(401, { error: 'unauthorized', message: 'Sesión inválida o vencida. Vuelve a ingresar.' });
    if (denied) return denied;
    if (!isDbConfigured()) return json(200, { configured: false });
    try {
      return json(200, { configured: true, connected: true, ...(await dbStatus(getSql())) });
    } catch (err) {
      return json(200, { configured: true, connected: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  const denied = guard(request);
  if (denied) return denied;
  const params = new URL(request.url).searchParams;
  if (act === 'catalog') {
    const current = await getCurrentCatalog();
    return json(200, { catalog: current?.data ?? null, version: current?.version ?? null });
  }
  if (act === 'versions') return json(200, { versions: await listVersions() });
  if (act === 'refresh') return json(200, await refreshOverview());
  if (act === 'reviews') return json(200, { reviews: await listAllReviews() });
  if (act === 'profiles') return json(200, await listProfiles(Math.min(2000, Math.max(1, Number(params.get('limit')) || 300))));
  if (act === 'profile' || act === 'profile-file') {
    const id = params.get('id') ?? '';
    if (act === 'profile-file') return (await profileFile(id)) ?? json(404, { error: 'not_found', message: 'Este diagnóstico no tiene CV.' });
    const profile = await readProfile(id);
    return profile ? json(200, { profile }) : json(404, { error: 'not_found' });
  }
  if (act === 'leads') return json(200, await listLeads(Math.min(5000, Math.max(1, Number(params.get('limit')) || 500))));
  return json(404, { error: 'unknown_action' });
}

async function handlePut(request: Request): Promise<Response> {
  const denied = guard(request);
  if (denied) return denied;
  if (action(request) !== 'catalog') return json(404, { error: 'unknown_action' });
  const body = await readJson<{ catalog?: unknown; baseVersion?: string | null; note?: string }>(request);
  if (!body?.catalog) return json(400, { error: 'bad_request', message: 'Falta el catálogo.' });

  const result = validateCatalog(body.catalog);
  if (!result.ok) return json(422, { error: 'invalid', message: 'Hay datos inválidos.', errors: result.errors });

  const catalog = { ...result.catalog, meta: { saved_at: new Date().toISOString(), note: body.note ?? '' } };
  try {
    // Control de concurrencia optimista: no pisar cambios guardados por otra sesión.
    return json(200, { version: await publishCatalog(catalog, body.note ?? 'edicion', body.baseVersion ?? null) });
  } catch (err) {
    if (err instanceof VersionConflictError) {
      return json(409, { error: 'conflict', message: 'El catálogo cambió desde que lo abriste (otra sesión guardó). Recarga para continuar.', version: err.current });
    }
    throw err;
  }
}

/** Acciones que pueden tardar varios minutos (leen muchas páginas). */
const LONG = new Set(['refresh-run', 'db-import', 'refresh-check']);

/**
 * Límite por acción: si algo se queda colgado (p. ej. una conexión a la base) se responde un error claro
 * en lugar de esperar los 5 minutos del límite de la función.
 */
function withTimeout(handler: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    const act = action(request);
    const ms = LONG.has(act) ? 285_000 : 45_000;
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<Response>((resolve) => {
      timer = setTimeout(() => {
        console.error(`admin: ${request.method} ${act} sin respuesta tras ${ms / 1000}s`);
        resolve(json(504, { error: 'timeout', message: 'El servidor tardó demasiado en responder. Intenta de nuevo.' }));
      }, ms);
    });
    try {
      const res = await Promise.race([handler(request), timeout]);
      const took = Date.now() - started;
      if (took > 10_000) console.log(`admin: ${request.method} ${act} ${res.status} en ${took} ms`);
      return res;
    } catch (err) {
      console.error(`admin: ${request.method} ${act} falló`, err);
      return json(500, { error: 'server_error', message: `Error del servidor: ${err instanceof Error ? err.message : 'desconocido'}` });
    } finally {
      clearTimeout(timer);
    }
  };
}

export const GET = withTimeout(handleGet);
export const POST = withTimeout(handlePost);
export const PUT = withTimeout(handlePut);
