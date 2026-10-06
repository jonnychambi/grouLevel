/**
 * API del módulo de administración (una sola función para no multiplicar endpoints):
 *
 *   POST /api/admin?action=login     { password }                 → { token, expires_at }
 *   GET  /api/admin?action=catalog                                  → { catalog, version, configured }
 *   PUT  /api/admin?action=catalog   { catalog, baseVersion, note } → { version }   (409 si otra persona guardó antes)
 *   GET  /api/admin?action=versions                                 → { versions }
 *   POST /api/admin?action=restore   { pathname }                   → { version }
 *   GET  /api/admin?action=leads     [&limit=500]                    → { leads, total }
 *   POST /api/admin?action=lead      { pathname, status?, notes? }   → { lead }
 *   POST /api/admin?action=lead-delete { pathname }                  → { ok }
 *   GET  /api/admin?action=reviews                                  → { reviews }
 *   POST /api/admin?action=review    { pathname, status?, reply?, rejection_reason? } → { review }
 *   POST /api/admin?action=review-delete { pathname }               → { ok }
 *   GET  /api/admin?action=profiles  [&limit=300]                    → { profiles, total }   (diagnósticos "Mi ruta")
 *   GET  /api/admin?action=profile&id=prf_…                         → { profile }   (completo)
 *   GET  /api/admin?action=profile-file&id=prf_…                    → CV original (descarga)
 *   POST /api/admin?action=profile   { id, status?, notes? }        → { profile }
 *   POST /api/admin?action=profile-delete { id }                    → { ok }   (borra también el CV)
 *   GET  /api/admin?action=db-status                                → estado de Supabase (migraciones, conteos, última sync)
 *   POST /api/admin?action=db-sync                                  → copia completa Blob → base de datos
 *
 * Todas las acciones salvo login requieren Authorization: Bearer <token>.
 */
import { checkPassword, isConfigured, issueToken, verifyRequest } from './_lib/auth.js';
import { json, readJson } from './_lib/http.js';
import { isStoreConfigured, listVersions, readLatest, readVersion, writeVersion } from './_lib/store.js';
import { validateCatalog, type CatalogPayload } from './_lib/validate.js';
import { deleteLead, listLeads, updateLead } from './_lib/leads.js';
import { deleteReview, listAllReviews, moderateReview } from './_lib/reviews.js';
import { deleteProfile, listProfiles, profileFile, readProfile, updateProfile } from './_lib/profiles.js';
import { getSql, isDbConfigured, mirror } from './_lib/db.js';
import { blobSources } from './_lib/dbSources.js';
import { dbStatus, deleteLeadRow, deleteProfileRow, deleteReviewRow, syncAll, upsertCatalog, upsertLead, upsertProfile, upsertReview } from './_lib/dbSync.js';

const action = (request: Request) => new URL(request.url).searchParams.get('action') ?? '';

function guard(request: Request): Response | null {
  if (!isConfigured()) return json(503, { error: 'not_configured', message: 'Falta configurar ADMIN_PASSWORD en Vercel.' });
  if (!isStoreConfigured()) return json(503, { error: 'store_not_configured', message: 'Falta conectar el Blob store (BLOB_READ_WRITE_TOKEN).' });
  if (!verifyRequest(request)) return json(401, { error: 'unauthorized', message: 'Sesión inválida o vencida. Vuelve a ingresar.' });
  return null;
}

export async function POST(request: Request): Promise<Response> {
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
  if (act === 'restore') {
    const denied = guard(request);
    if (denied) return denied;
    const body = await readJson<{ pathname?: string }>(request);
    if (!body?.pathname) return json(400, { error: 'bad_request', message: 'Falta la versión a restaurar.' });
    const data = await readVersion<CatalogPayload>(body.pathname);
    if (!data) return json(404, { error: 'not_found', message: 'La versión no existe.' });
    const restored = { ...data, meta: { ...(data.meta ?? {}), restored_from: body.pathname, saved_at: new Date().toISOString() } };
    const version = await writeVersion(restored, 'restaurado');
    await mirror('catalog', (sql) => upsertCatalog(sql, restored, version), 20_000);
    return json(200, { version });
  }
  if (act === 'review' || act === 'review-delete') {
    const denied = guard(request);
    if (denied) return denied;
    const body = await readJson<{ pathname?: string; status?: string; reply?: string; rejection_reason?: string }>(request);
    if (!body?.pathname) return json(400, { error: 'bad_request', message: 'Falta la reseña.' });
    if (act === 'review-delete') {
      if (!(await deleteReview(body.pathname))) return json(404, { error: 'not_found' });
      await mirror('review-delete', (sql) => deleteReviewRow(sql, body.pathname!));
      return json(200, { ok: true });
    }
    const review = await moderateReview(body.pathname, body);
    if (review) await mirror('review', (sql) => upsertReview(sql, review, review.pathname));
    return review ? json(200, { review }) : json(404, { error: 'not_found', message: 'La reseña no existe.' });
  }
  if (act === 'profile' || act === 'profile-delete') {
    const denied = guard(request);
    if (denied) return denied;
    const body = await readJson<{ id?: string; status?: string; notes?: string }>(request);
    if (!body?.id) return json(400, { error: 'bad_request', message: 'Falta el diagnóstico.' });
    if (act === 'profile-delete') {
      if (!(await deleteProfile(body.id))) return json(404, { error: 'not_found' });
      await mirror('profile-delete', (sql) => deleteProfileRow(sql, body.id!));
      return json(200, { ok: true });
    }
    const profile = await updateProfile(body.id, body);
    if (profile) await mirror('profile', (sql) => upsertProfile(sql, profile));
    return profile ? json(200, { profile }) : json(404, { error: 'not_found', message: 'El diagnóstico no existe.' });
  }
  if (act === 'db-sync') {
    const denied = guard(request);
    if (denied) return denied;
    if (!isDbConfigured()) return json(503, { error: 'db_not_configured', message: 'La base de datos no está conectada (faltan POSTGRES_URL en Vercel).' });
    try {
      const stats = await syncAll(getSql(), blobSources, 'admin');
      return json(200, { stats });
    } catch (err) {
      return json(500, { error: 'db_sync_failed', message: `No se pudo sincronizar: ${err instanceof Error ? err.message : 'error desconocido'}` });
    }
  }
  if (act === 'lead' || act === 'lead-delete') {
    const denied = guard(request);
    if (denied) return denied;
    const body = await readJson<{ pathname?: string; status?: string; notes?: string }>(request);
    if (!body?.pathname) return json(400, { error: 'bad_request', message: 'Falta el lead.' });
    if (act === 'lead-delete') {
      if (!(await deleteLead(body.pathname))) return json(404, { error: 'not_found' });
      await mirror('lead-delete', (sql) => deleteLeadRow(sql, body.pathname!));
      return json(200, { ok: true });
    }
    const lead = await updateLead(body.pathname, body);
    if (lead) await mirror('lead', (sql) => upsertLead(sql, lead, lead.pathname));
    return lead ? json(200, { lead }) : json(404, { error: 'not_found', message: 'El lead no existe.' });
  }
  return json(404, { error: 'unknown_action' });
}

export async function GET(request: Request): Promise<Response> {
  const denied = guard(request);
  if (denied) return denied;
  const act = action(request);
  if (act === 'catalog') {
    const latest = await readLatest<CatalogPayload>();
    return json(200, { catalog: latest?.data ?? null, version: latest?.version ?? null });
  }
  if (act === 'versions') return json(200, { versions: await listVersions() });
  if (act === 'db-status') {
    if (!isDbConfigured()) return json(200, { configured: false });
    try {
      return json(200, { configured: true, connected: true, ...(await dbStatus(getSql())) });
    } catch (err) {
      return json(200, { configured: true, connected: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  if (act === 'reviews') return json(200, { reviews: await listAllReviews() });
  if (act === 'profiles') {
    const limit = Math.min(2000, Math.max(1, Number(new URL(request.url).searchParams.get('limit')) || 300));
    return json(200, await listProfiles(limit));
  }
  if (act === 'profile' || act === 'profile-file') {
    const id = new URL(request.url).searchParams.get('id') ?? '';
    if (act === 'profile-file') return (await profileFile(id)) ?? json(404, { error: 'not_found', message: 'Este diagnóstico no tiene CV.' });
    const profile = await readProfile(id);
    return profile ? json(200, { profile }) : json(404, { error: 'not_found' });
  }
  if (act === 'leads') {
    const limit = Math.min(5000, Math.max(1, Number(new URL(request.url).searchParams.get('limit')) || 500));
    return json(200, await listLeads(limit));
  }
  return json(404, { error: 'unknown_action' });
}

export async function PUT(request: Request): Promise<Response> {
  const denied = guard(request);
  if (denied) return denied;
  if (action(request) !== 'catalog') return json(404, { error: 'unknown_action' });
  const body = await readJson<{ catalog?: unknown; baseVersion?: string | null; note?: string }>(request);
  if (!body?.catalog) return json(400, { error: 'bad_request', message: 'Falta el catálogo.' });

  const result = validateCatalog(body.catalog);
  if (!result.ok) return json(422, { error: 'invalid', message: 'Hay datos inválidos.', errors: result.errors });

  // Control de concurrencia optimista: no pisar cambios guardados por otra sesión.
  const [current] = await listVersions();
  if (current && body.baseVersion !== current.pathname) {
    return json(409, { error: 'conflict', message: 'El catálogo cambió desde que lo abriste (otra sesión guardó). Recarga para continuar.', version: current });
  }
  const catalog = { ...result.catalog, meta: { saved_at: new Date().toISOString(), note: body.note ?? '' } };
  const version = await writeVersion(catalog, body.note ?? 'edicion');
  await mirror('catalog', (sql) => upsertCatalog(sql, catalog, version), 20_000);
  return json(200, { version });
}
