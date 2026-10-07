/**
 * Páginas del catálogo para buscadores, servidas desde la base (vercel.json las reescribe aquí):
 *   /, /programas, /programas/:area, /programa/:slug, /instituciones, /institucion/:slug  → GET /api/seo?path=…
 *   /sitemap.xml                                                                          → GET /api/seo?sitemap=1
 * Así Google ve siempre el contenido vigente (precios, inicios, programas nuevos) con título, descripción,
 * canonical y datos estructurados, sin esperar un nuevo despliegue. Respuestas cacheadas en el CDN.
 */
import { getSql, isDbConfigured } from './_lib/db.js';
import { getCurrentCatalog } from './_lib/catalogRepo.js';
import { buildRoutes, isCatalogPath, renderPage, sitemapXml, staticRoutes, type SeoRoute } from '../scripts/seoPages.mjs';

const SITE_URL = (process.env.VITE_SITE_URL ?? 'https://www.groulevel.com').replace(/\/$/, '');
const CACHE = 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400';
const TTL = 60_000;

let shell: { html: string; at: number } | null = null;
let routes: { list: SeoRoute[]; byPath: Map<string, SeoRoute>; at: number } | null = null;

async function getShell(origin: string): Promise<string> {
  if (shell && Date.now() - shell.at < 10 * TTL) return shell.html;
  const res = await fetch(`${origin}/_shell.html`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`shell_${res.status}`);
  shell = { html: await res.text(), at: Date.now() };
  return shell.html;
}

async function getRoutes() {
  if (routes && Date.now() - routes.at < TTL) return routes;
  const current = await getCurrentCatalog();
  if (!current) throw new Error('catalog_empty');
  const sql = getSql();
  const ratings = new Map(
    (await sql`select course_id, avg_rating::float as avg, reviews_count::int as count from course_ratings where reviews_count > 0`).map((r) => [String(r.course_id), { avg: Number(r.avg), count: Number(r.count) }])
  );
  const list = buildRoutes(current.data, { siteUrl: SITE_URL, ratings });
  routes = { list, byPath: new Map(list.map((r) => [r.path, r])), at: Date.now() };
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
