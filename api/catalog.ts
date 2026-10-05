/**
 * GET /api/catalog — catálogo público vigente (solo programas publicados).
 * Cacheado en el CDN de Vercel 60 s; los cambios del administrador se ven en ~1 minuto.
 * 404 si aún no se ha publicado nada desde el administrador → el sitio usa el JSON del build.
 */
import { json } from './_lib/http.js';
import { isStoreConfigured, readLatest } from './_lib/store.js';
import type { CatalogPayload } from './_lib/validate.js';

export async function GET(): Promise<Response> {
  if (!isStoreConfigured()) return json(404, { error: 'store_not_configured' });
  try {
    const latest = await readLatest<CatalogPayload>();
    if (!latest) return json(404, { error: 'empty' }, { 'Cache-Control': 'public, s-maxage=60' });
    const { courses, institutions, categories } = latest.data;
    return json(
      200,
      {
        courses: courses.filter((c) => c.status === 'publicado'),
        institutions,
        categories,
        version: latest.version.uploaded_at
      },
      { 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=600' }
    );
  } catch (e) {
    return json(500, { error: 'read_failed', message: e instanceof Error ? e.message : String(e) });
  }
}
