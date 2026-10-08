/**
 * Páginas del catálogo para buscadores, servidas desde la base (vercel.json las reescribe aquí):
 *   /, /programas, /programas/:area, /programa/:slug, /instituciones, /institucion/:slug  → GET /api/seo?path=…
 *   /sitemap.xml                                                                          → GET /api/seo?sitemap=1
 * Así Google ve siempre el contenido vigente (precios, inicios, programas nuevos) con título, descripción,
 * canonical y datos estructurados, sin esperar un nuevo despliegue. Respuestas cacheadas en el CDN.
 */
import { getSql, isDbConfigured } from './_lib/db.js';
import { getCurrentCatalog } from './_lib/catalogRepo.js';
import { buildRoutes, isCatalogPath, renderPage, sitemapXml, staticRoutes, type ReviewsData, type SeoRoute } from '../scripts/seoPages.mjs';
import { publicSummary, toPublic } from './_lib/reviews.js';

const SITE_URL = (process.env.VITE_SITE_URL ?? 'https://www.groulevel.com').replace(/\/$/, '');
const CACHE = 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400';
const TTL = 60_000;

let shell: { html: string; at: number } | null = null;
type Routes = { list: SeoRoute[]; byPath: Map<string, SeoRoute>; at: number };
let routes: Routes | null = null;

async function getShell(origin: string): Promise<string> {
  if (shell && Date.now() - shell.at < 10 * TTL) return shell.html;
  // En vistas previas (protegidas) se usa la plantilla pública de producción.
  const base = process.env.VERCEL_ENV === 'preview' ? SITE_URL : origin;
  const res = await withTimeout(fetch(`${base}/_shell.html`, { signal: AbortSignal.timeout(5000) }), 6000, 'shell');
  if (!res.ok) throw new Error(`shell_${res.status}`);
  shell = { html: await res.text(), at: Date.now() };
  return shell.html;
}

/** Etapas con medición: si algo tarda, queda en el registro (y nunca bloquea la página). */
async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const t = Date.now();
  try {
    return await fn();
  } finally {
    const ms = Date.now() - t;
    if (ms > 2000) console.warn(`seo: ${name} tardó ${ms} ms`);
  }
}

const withTimeout = <T>(p: Promise<T>, ms: number, label: string) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timeout_${label}`)), ms))]);

let building: Promise<Routes> | null = null;

async function buildAll(): Promise<Routes> {
  const current = await step('catalogo', () => getCurrentCatalog());
  if (!current) throw new Error('catalog_empty');
  const sql = getSql();
  const ratings = new Map(
    (await step('ratings', () => sql`select course_id, avg_rating::float as avg, reviews_count::int as count from course_ratings where reviews_count > 0`)).map((r) => [String(r.course_id), { avg: Number(r.avg), count: Number(r.count) }])
  );
  // Reseñas aprobadas (las más recientes primero) para las páginas de opiniones.
  const summary = await step('resumen', () => publicSummary(sql));
  const items = new Map<string, Record<string, unknown>[]>();
  for (const r of await step('resenas', () => sql`select * from reviews where status = 'aprobada' order by created_at desc limit 5000`)) {
    const pub = toPublic(r) as unknown as Record<string, unknown>;
    const push = (k: string) => { const l = items.get(k) ?? []; if (l.length < 30) l.push(pub); items.set(k, l); };
    if (pub.institution_id) push(`i:${pub.institution_id}`);
    if (pub.course_id && pub.program_rating != null) push(`c:${pub.course_id}`);
  }
  const reviews: ReviewsData = {
    institutions: new Map(Object.entries(summary.institutions)) as ReviewsData['institutions'],
    courses: new Map(Object.entries(summary.courses)) as ReviewsData['courses'],
    items
  };
  const t = Date.now();
  const list = buildRoutes(current.data, { siteUrl: SITE_URL, ratings, reviews });
  if (Date.now() - t > 1000) console.warn(`seo: buildRoutes tardó ${Date.now() - t} ms`);
  return { list, byPath: new Map(list.map((r) => [r.path, r])), at: Date.now() };
}

async function getRoutes() {
  if (routes && Date.now() - routes.at < TTL) return routes;
  // Una sola construcción a la vez; máximo 20 s (si no, la página sale con la app sin contenido previo).
  const pending = (building ??= buildAll().finally(() => { building = null; }));
  routes = await withTimeout(pending, 20_000, 'rutas');
  return routes;
}

const html = (status: number, body: string, cache = CACHE) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': cache } });

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const origin = `${url.protocol}//${url.host}`;

  if (url.searchParams.has('sitemap')) {
    try {
      const { list } = await getRoutes();
      return new Response(sitemapXml([...list, ...staticRoutes()], SITE_URL), { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': CACHE } });
    } catch (err) {
      console.error('seo: sitemap', err instanceof Error ? err.message : err);
      // Respaldo: el sitemap generado en el build (nunca dejar a Google sin sitemap).
      const backup = await fetch(`${origin}/sitemap-build.xml`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
      if (backup?.ok) return new Response(await backup.text(), { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=300' } });
      return new Response('error', { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '300' } });
    }
  }

  const raw = url.searchParams.get('path') ?? '/';
  const path = raw.length > 1 ? raw.replace(/\/+$/, '') : '/';
  let template: string;
  try {
    template = await getShell(origin);
  } catch (err) {
    console.error('seo: shell', err instanceof Error ? err.message : err);
    return new Response('Servicio no disponible', { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } });
  }
  if (!isCatalogPath(path)) return html(404, template.replace('</head>', '<meta name="robots" content="noindex" /></head>'));

  try {
    if (!isDbConfigured()) throw new Error('db_not_configured');
    const route = (await getRoutes()).byPath.get(path);
    // Ruta desconocida (programa eliminado o mal escrito): 404 real con la app, para que Google no la indexe.
    if (!route) return html(404, template.replace('</head>', '<meta name="robots" content="noindex" /></head>'), 'public, max-age=0, s-maxage=300');
    return html(200, renderPage(template, route, SITE_URL));
  } catch (err) {
    // Sin base: la app funciona igual (carga el catálogo por su cuenta); no se cachea.
    console.error('seo: render', path, err instanceof Error ? err.message : err);
    return html(200, template, 'no-store');
  }
}
