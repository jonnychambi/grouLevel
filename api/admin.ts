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
 *
 * Todas las acciones salvo login requieren Authorization: Bearer <token>.
 */
import { checkPassword, isConfigured, issueToken, verifyRequest } from './_lib/auth.js';
import { json, readJson } from './_lib/http.js';
import { isStoreConfigured, listVersions, readLatest, readVersion, writeVersion } from './_lib/store.js';
import { validateCatalog, type CatalogPayload } from './_lib/validate.js';
import { deleteLead, listLeads, updateLead } from './_lib/leads.js';

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
    const version = await writeVersion({ ...data, meta: { ...(data.meta ?? {}), restored_from: body.pathname, saved_at: new Date().toISOString() } }, 'restaurado');
    return json(200, { version });
  }
  if (act === 'lead' || act === 'lead-delete') {
    const denied = guard(request);
    if (denied) return denied;
    const body = await readJson<{ pathname?: string; status?: string; notes?: string }>(request);
    if (!body?.pathname) return json(400, { error: 'bad_request', message: 'Falta el lead.' });
    if (act === 'lead-delete') return (await deleteLead(body.pathname)) ? json(200, { ok: true }) : json(404, { error: 'not_found' });
    const lead = await updateLead(body.pathname, body);
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
  return json(200, { version });
}
