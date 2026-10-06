/**
 * GET /api/catalog — catálogo público vigente (solo programas publicados), leído de la base.
 * Cacheado en el CDN de Vercel 60 s; los cambios del administrador se ven en ~1 minuto.
 * 404 si aún no se ha publicado nada → el sitio usa el JSON incluido en el build.
 */
import { json } from './_lib/http.js';
import { isDbConfigured } from './_lib/db.js';
import { getCurrentCatalog } from './_lib/catalogRepo.js';

export async function GET(): Promise<Response> {
  if (!isDbConfigured()) return json(404, { error: 'db_not_configured' });
  try {
    const current = await getCurrentCatalog();
    if (!current) return json(404, { error: 'empty' }, { 'Cache-Control': 'public, s-maxage=60' });
    const { courses, institutions, categories } = current.data;
    return json(
      200,
      { courses: courses.filter((c) => c.status === 'publicado'), institutions, categories, version: current.version.uploaded_at },
      { 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=600' }
    );
  } catch (e) {
    console.error('catalog_read_failed', e instanceof Error ? e.message : e);
    return json(500, { error: 'read_failed' });
  }
}
