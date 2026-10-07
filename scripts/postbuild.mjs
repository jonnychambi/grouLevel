/**
 * Post-build (SEO). Las páginas se construyen con scripts/seoPages.mjs (contenido, metadatos y JSON-LD).
 *  · GitHub Pages: genera un index.html por ruta y sitemap.xml.
 *  · Vercel (VERCEL=1): genera solo las páginas fijas; las del catálogo y el sitemap los sirve api/seo.ts
 *    desde la base, para que Google vea siempre los datos vigentes y los programas nuevos.
 *  · _shell.html (plantilla limpia), 404.html (SPA, noindex), admin, robots.txt y .nojekyll.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { buildRoutes, esc, renderPage, sitemapXml, staticRoutes } from './seoPages.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

const SITE_URL = (process.env.VITE_SITE_URL ?? 'https://www.groulevel.com').replace(/\/$/, '');
/**
 * Fuente del catálogo para el pre-render: el catálogo vigente en la base (Supabase) si el build
 * tiene POSTGRES_URL; si no, los JSON del repositorio.
 */
async function loadCatalog() {
  const url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  if (url) {
    const { connect } = await import('./migrate.mjs');
    const sql = connect(url);
    try {
      const [current] = await sql`select pathname, data from catalog_versions where is_current limit 1`;
      if (current) {
        let data = current.data;
        if (!data) {
          const [courses, institutions, categories] = await Promise.all([
            sql`select raw from courses order by position, id`,
            sql`select raw from institutions order by position, id`,
            sql`select id, slug, name, "group", description, keywords from categories order by position, id`
          ]);
          data = { courses: courses.map((r) => r.raw), institutions: institutions.map((r) => r.raw), categories: categories.map((r) => ({ ...r })) };
        }
        if (data.courses?.length) {
          console.log(`postbuild: catálogo desde la base de datos (${current.pathname})`);
          return data;
        }
      }
    } catch (e) {
      console.warn('postbuild: no se pudo leer el catálogo de la base, se usan los JSON del repo:', e.message);
    } finally {
      await sql.end({ timeout: 5 });
    }
  }
  return { courses: read('src/data/courses.json'), institutions: read('src/data/institutions.json'), categories: read('src/data/categories.json') };
}
const catalog = await loadCatalog();
const template0 = readFileSync(join(dist, 'index.html'), 'utf8');
/** Prefijo de rutas de la app (coincide con BASE_PATH de Vite). */
const BASE = (process.env.BASE_PATH ?? '/').replace(/\/$/, '');
/** Verificación de Google Search Console (opcional): GOOGLE_SITE_VERIFICATION=<código del meta tag>. */
// Acepta el código solo o con el prefijo del registro DNS ("google-site-verification=…").
const verification = process.env.GOOGLE_SITE_VERIFICATION?.trim().replace(/^google-site-verification=/, '');
const template = verification
  ? template0.replace('</head>', `  <meta name="google-site-verification" content="${esc(verification)}" />\n  </head>`)
  : template0;
/** En Vercel las páginas del catálogo y el sitemap los sirve api/seo.ts desde la base (siempre al día). */
const dynamic = !!process.env.VERCEL;

const catalogRoutes = buildRoutes(catalog, { siteUrl: SITE_URL, base: BASE });
const fixed = staticRoutes(BASE);
const routes = [...catalogRoutes, ...fixed];

// Plantilla limpia para el render dinámico.
writeFileSync(join(dist, '_shell.html'), template);

let written = 0;
for (const route of dynamic ? fixed : routes) {
  const file = route.path === '/' ? join(dist, 'index.html') : join(dist, route.path, 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, renderPage(template, route, SITE_URL));
  written++;
}
// En Vercel "/" lo sirve la función (el index.html estático taparía la reescritura).
if (dynamic) rmSync(join(dist, 'index.html'), { force: true });

// 404 → SPA fallback (sin contenido estático, noindex)
writeFileSync(join(dist, '404.html'), template.replace('</head>', '    <meta name="robots" content="noindex" />\n  </head>'));

// Administración: shell propio (200, noindex) para /admin.
mkdirSync(join(dist, 'admin'), { recursive: true });
writeFileSync(
  join(dist, 'admin', 'index.html'),
  template.replace(/<title>[\s\S]*?<\/title>/, '<title>Administración | Groulevel</title>').replace('</head>', '    <meta name="robots" content="noindex, nofollow" />\n  </head>')
);

const indexable = routes.filter((r) => r.index !== false).length;
if (!dynamic) writeFileSync(join(dist, 'sitemap.xml'), sitemapXml(routes, SITE_URL));
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: ${new URL(SITE_URL + '/').pathname}interno/\nDisallow: ${new URL(SITE_URL + '/').pathname}admin\nDisallow: ${new URL(SITE_URL + '/').pathname}mi-ruta/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
writeFileSync(join(dist, '.nojekyll'), '');

console.log(`postbuild: ${written} páginas pre-generadas${dynamic ? ` (las ${catalogRoutes.length} del catálogo y el sitemap se sirven desde /api/seo)` : ''}, ${indexable} URLs indexables, 404.html, robots.txt`);
