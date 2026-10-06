/**
 * Post-build para hosting estático (GitHub Pages):
 *  1. Genera un index.html por cada ruta conocida con title, description, canonical,
 *     Open Graph y contenido HTML básico → URLs semánticas con status 200 y SEO sin SSR.
 *  2. Copia index.html como 404.html → fallback SPA para cualquier otra ruta.
 *  3. Genera sitemap.xml, robots.txt y .nojekyll.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
const courses = catalog.courses.filter((c) => (c.status ?? 'publicado') === 'publicado');
const institutions = catalog.institutions;
const usedCategories = new Set(courses.map((c) => c.category));
const categories = catalog.categories.filter((c) => usedCategories.has(c.id));
const template = readFileSync(join(dist, 'index.html'), 'utf8');
/** Prefijo de rutas de la app (coincide con BASE_PATH de Vite). */
const BASE = (process.env.BASE_PATH ?? '/').replace(/\/$/, '');
const href = (path) => `${BASE}${path}`;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const TYPE = { curso: 'Curso', especializacion: 'Especialización', certificacion: 'Certificación', bootcamp: 'Bootcamp', diplomado: 'Diplomado', 'programa-ejecutivo': 'Programa ejecutivo', maestria: 'Maestría', membresia: 'Membresía' };
const money = (c) => {
  if (c.price == null) return 'precio a consultar';
  const p = c.discount_price ?? c.price;
  return p === 0 ? 'Gratis' : `${c.currency === 'PEN' ? 'S/' : 'US$'} ${p.toLocaleString('en-US')}`;
};
const facts = (c) => [TYPE[c.program_type], c.duration_hours ? `${c.duration_hours} horas` : c.duration_text, money(c)].filter(Boolean).join(', ');
const instById = new Map(institutions.map((i) => [i.id, i]));

/** @type {{path:string,title:string,description:string,body:string,priority:number,index?:boolean}[]} */
const routes = [
  {
    path: '/', priority: 1,
    title: 'Groulevel · Compara programas de tecnología',
    description: 'Compara cursos, bootcamps, diplomados y maestrías en tecnología de las principales instituciones. Precios, duración y modalidad en un solo lugar.',
    body: `<h1>Encuentra la formación que te lleva al siguiente nivel.</h1><p>Compara cursos, bootcamps, diplomados y maestrías en tecnología.</p><ul>${categories.map((c) => `<li><a href="${href(`/programas/${c.slug}`)}">${esc(c.name)}</a></li>`).join('')}</ul>`
  },
  { path: '/programas', priority: 0.9, title: 'Explora y compara programas de tecnología | Groulevel', description: 'Explora programas de Data, IA, desarrollo de software, cloud, ciberseguridad y más. Filtra por precio, modalidad, duración y nivel.', body: `<h1>Programas de tecnología</h1><ul>${courses.map((c) => `<li><a href="${href(`/programa/${c.slug}`)}">${esc(c.name)}</a></li>`).join('')}</ul>` },
  { path: '/comparar', priority: 0.6, title: 'Comparador de programas | Groulevel', description: 'Compara hasta 3 programas de tecnología lado a lado: precio, duración, modalidad, certificación, docentes y financiamiento.', body: '<h1>Comparador</h1>' },
  { path: '/instituciones', priority: 0.7, title: 'Instituciones | Groulevel', description: 'Universidades, escuelas de negocio, academias y bootcamps de tecnología. Conoce sus programas y compáralos.', body: `<h1>Instituciones</h1><ul>${institutions.map((i) => `<li><a href="${href(`/institucion/${i.slug}`)}">${esc(i.name)}</a></li>`).join('')}</ul>` },
  { path: '/instituciones/partners', priority: 0.5, title: 'Para instituciones | Groulevel', description: 'Publica tus programas de tecnología en Groulevel y recibe leads calificados con Signal Score™, visibilidad destacada y métricas de interés.', body: '<h1>Conecta tus programas con profesionales que están buscando dónde estudiar.</h1>' },
  { path: '/nosotros', priority: 0.4, title: 'Nosotros | Groulevel', description: 'Elegir dónde aprender tecnología no debería ser complicado. Groulevel hace más transparente y eficiente la decisión de formación profesional.', body: '<h1>Elegir dónde aprender tecnología no debería ser complicado.</h1>' },
  { path: '/mi-ruta', priority: 0.8, title: 'Mi ruta de formación | Groulevel', description: 'Sube tu CV o describe tu perfil, define tu objetivo y recibe un diagnóstico de tus conocimientos y una ruta de formación con programas reales.', body: '<h1>Tu ruta de formación, a tu medida.</h1><p>Sube tu CV o cuéntanos tu perfil y te sugerimos una ruta con programas reales.</p>' },
  { path: '/favoritos', priority: 0, index: false, title: 'Mis favoritos | Groulevel', description: 'Tus programas guardados.', body: '<h1>Mis favoritos</h1>' },
  ...categories.map((c) => ({
    path: `/programas/${c.slug}`, priority: 0.8,
    title: `Cursos y programas de ${c.name} en Perú | Groulevel`,
    description: `Compara cursos, bootcamps, diplomados y maestrías de ${c.name}: precios, duración, modalidad y certificación. ${c.description}`,
    body: `<h1>Programas de ${esc(c.name)}</h1><p>${esc(c.description)}</p><ul>${courses.filter((x) => x.category === c.id).map((x) => `<li><a href="${href(`/programa/${x.slug}`)}">${esc(x.name)}</a></li>`).join('')}</ul>`
  })),
  ...courses.map((c) => {
    const inst = instById.get(c.institution_id);
    return {
      path: `/programa/${c.slug}`, priority: 0.8,
      title: `${c.name} · ${inst?.short_name ?? ''} | Groulevel`,
      description: `${c.short_description} ${facts(c)}.`.slice(0, 300),
      body: `<h1>${esc(c.name)}</h1><p>${esc(inst?.name ?? '')} · ${esc(facts(c))}</p><p>${esc(c.description)}</p>`
    };
  }),
  ...institutions.filter((i) => courses.some((c) => c.institution_id === i.id)).map((i) => ({
    path: `/institucion/${i.slug}`, priority: 0.6,
    title: `${i.name}: programas y cursos | Groulevel`,
    description: `${i.description.slice(0, 150)}`,
    body: `<h1>${esc(i.name)}</h1><p>${esc(i.description)}</p>`
  }))
];

function render(route) {
  const url = `${SITE_URL}${route.path === '/' ? '/' : route.path}`;
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(route.title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(route.description)}" />`)
    .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(route.title)}" />`)
    .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(route.description)}" />`);
  const extra = [
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${SITE_URL}/og-image.png" />`,
    route.index === false ? '<meta name="robots" content="noindex, follow" />' : '<meta name="robots" content="index, follow" />'
  ].join('\n    ');
  html = html.replace('</head>', `    ${extra}\n  </head>`);
  // Contenido estático para crawlers; React lo reemplaza al montar.
  html = html.replace('<div id="root"></div>', `<div id="root"><div style="max-width:960px;margin:0 auto;padding:48px 16px;font-family:system-ui;color:#9DAABD">${route.body}</div></div>`);
  return html;
}

for (const route of routes) {
  const file = route.path === '/' ? join(dist, 'index.html') : join(dist, route.path, 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, render(route));
}

// 404 → SPA fallback (sin contenido estático, noindex)
writeFileSync(
  join(dist, '404.html'),
  template.replace('</head>', '    <meta name="robots" content="noindex" />\n  </head>')
);

// Administración: shell propio (200, noindex) para /admin.
mkdirSync(join(dist, 'admin'), { recursive: true });
writeFileSync(
  join(dist, 'admin', 'index.html'),
  template.replace(/<title>[\s\S]*?<\/title>/, '<title>Administración | Groulevel</title>').replace('</head>', '    <meta name="robots" content="noindex, nofollow" />\n  </head>')
);

const today = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .filter((r) => r.index !== false)
  .map((r) => `  <url><loc>${SITE_URL}${r.path === '/' ? '/' : r.path}</loc><lastmod>${today}</lastmod><priority>${r.priority.toFixed(1)}</priority></url>`)
  .join('\n')}
</urlset>
`;
writeFileSync(join(dist, 'sitemap.xml'), sitemap);
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: ${new URL(SITE_URL + '/').pathname}interno/\nDisallow: ${new URL(SITE_URL + '/').pathname}admin\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
writeFileSync(join(dist, '.nojekyll'), '');

console.log(`postbuild: ${routes.length} rutas pre-generadas, 404.html, sitemap.xml (${routes.filter((r) => r.index !== false).length} URLs), robots.txt`);
