/**
 * GET /api/catalog            — catálogo público vigente (solo publicados) en versión liviana para el listado.
 * GET /api/catalog?ids=a,b,c  — detalle completo de hasta 4 programas (ficha y comparador).
 *
 * Contra la extracción masiva (scraping):
 *  · Solo responde a la propia web: el navegador envía Sec-Fetch-Site: same-origin (o un Origin/Referer de
 *    groulevel.com). Una descarga directa (curl, scripts) recibe 403. La respuesta varía según ese
 *    encabezado (Vary), así el CDN sigue cacheando lo legítimo.
 *  · El listado no incluye el detalle (temario completo, docentes, objetivos, requisitos…): ese se pide por
 *    programa, con límite por IP.
 * Cacheado en el CDN de Vercel 60 s; los cambios del administrador se ven en ~1 minuto.
 * 404 si aún no se ha publicado nada → el sitio usa el JSON incluido en el build.
 */
import { json } from './_lib/http.js';
import { isDbConfigured } from './_lib/db.js';
import { getCurrentCatalog } from './_lib/catalogRepo.js';
import { rateLimited } from './_lib/guard.js';
import { toLiteCourse } from '../scripts/catalogLite.mjs';

const SITE_HOSTS = /(^|\.)groulevel\.com$|\.vercel\.app$|^localhost(:\d+)?$|^127\.0\.0\.1(:\d+)?$/;
const CACHE = 'public, max-age=0, s-maxage=60, stale-while-revalidate=600';
const VARY = 'Sec-Fetch-Site';
const MAX_IDS = 4;

/** ¿La pide la propia web? (encabezados que el navegador pone y que una página de otro sitio no puede fijar). */
export function isOwnSite(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin';
  const from = request.headers.get('origin') ?? request.headers.get('referer');
  if (!from) return false;
  try {
    return SITE_HOSTS.test(new URL(from).host);
  } catch {
    return false;
  }
}

export async function GET(request: Request): Promise<Response> {
  if (!isOwnSite(request)) {
    return json(403, { error: 'forbidden', message: 'El catálogo se consulta desde www.groulevel.com.' }, { 'Cache-Control': 'no-store', Vary: VARY });
  }
  if (!isDbConfigured()) return json(404, { error: 'db_not_configured' });
  const params = new URL(request.url).searchParams;
  try {
    const current = await getCurrentCatalog();
    if (!current) return json(404, { error: 'empty' }, { 'Cache-Control': 'public, s-maxage=60', Vary: VARY });
    const { courses, institutions, categories } = current.data;
    const published = courses.filter((c) => c.status === 'publicado');

    const ids = params.get('ids');
    if (ids !== null) {
      if (rateLimited(request, 'catalog-detail', 120)) return json(429, { error: 'rate_limited', message: 'Demasiadas consultas. Inténtalo en unos minutos.' }, { 'Cache-Control': 'no-store' });
      const wanted = [...new Set(ids.split(',').map((s) => s.trim()).filter(Boolean))].slice(0, MAX_IDS);
      const byId = new Map(published.map((c) => [String(c.id), c]));
      return json(200, { courses: wanted.map((id) => byId.get(id)).filter(Boolean) }, { 'Cache-Control': CACHE, Vary: VARY });
    }

    return json(
      200,
      { courses: published.map((c) => toLiteCourse(c)), institutions, categories, version: current.version.uploaded_at },
      { 'Cache-Control': CACHE, Vary: VARY }
    );
  } catch (e) {
    console.error('catalog_read_failed', e instanceof Error ? e.message : e);
    return json(500, { error: 'read_failed' });
  }
}
