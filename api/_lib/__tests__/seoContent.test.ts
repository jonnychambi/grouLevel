/** Páginas SEO de contenido (carreras, habilidades, guías, comparaciones y landings del catálogo): calidad e higiene de indexación. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import courses from '../../../src/data/courses.json';
import institutions from '../../../src/data/institutions.json';
import categories from '../../../src/data/categories.json';
import { buildRoutes, isCatalogPath, sitemapXml, staticRoutes } from '../../../scripts/seoPages.mjs';
import { CAREERS, COMPARISONS, GUIDES, MIN, SKILLS, TYPE_PATHS, faqFor, fitTitle, isContentPath, skillLandings, stats, typeAreaLandings } from '../../../src/content/seoModel.mjs';

const catalog = { courses, institutions, categories } as unknown as Parameters<typeof buildRoutes>[0];
const routes = buildRoutes(catalog, { siteUrl: 'https://www.groulevel.com' });
const byPath = new Map(routes.map((r) => [r.path, r]));
const all = [...routes, ...staticRoutes()];
const jsonTypes = (path: string) => (byPath.get(path)?.jsonLd ?? []).map((o) => (o as { '@type': string })['@type']);
const published = (courses as { status?: string; program_type: string; institution_id: string }[]).filter((c) => (c.status ?? 'publicado') === 'publicado');

describe('páginas de contenido SEO', () => {
  it('genera todas las carreras, habilidades, comparaciones, guías y la landing del analizador', () => {
    for (const p of ['/carreras', '/habilidades', '/guias', '/cursos', '/analizar-perfil']) expect(byPath.has(p), p).toBe(true);
    for (const c of CAREERS) expect(byPath.has(`/carreras/${c.slug}`), c.slug).toBe(true);
    for (const s of SKILLS) expect(byPath.has(`/habilidades/${s.slug}`), s.slug).toBe(true);
    for (const c of COMPARISONS) expect(byPath.has(`/comparar/${c.slug}`), c.slug).toBe(true);
    for (const g of GUIDES) expect(byPath.has(`/guias/${g.slug}`), g.slug).toBe(true);
    expect(CAREERS.map((c) => c.slug)).toEqual(expect.arrayContaining(['data-analyst', 'data-engineer', 'data-scientist', 'ai-engineer', 'software-developer', 'cybersecurity-analyst', 'business-analyst']));
  });

  it('las landings del catálogo existen solo con oferta suficiente de varias instituciones', () => {
    for (const l of skillLandings(courses as never)) {
      expect(l.courses.length).toBeGreaterThanOrEqual(MIN.skill);
      expect(new Set(l.courses.map((c: { institution_id: string }) => c.institution_id)).size).toBeGreaterThanOrEqual(MIN.institutions);
      expect(byPath.has(`/cursos/${l.skill.slug}`)).toBe(true);
    }
    const landingSlugs = new Set(skillLandings(courses as never).map((l) => l.skill.slug));
    for (const s of SKILLS) if (!landingSlugs.has(s.slug)) expect(byPath.has(`/cursos/${s.slug}`)).toBe(false);
    for (const l of typeAreaLandings(courses as never, categories as never)) expect(l.courses.length).toBeGreaterThanOrEqual(MIN.typeArea);
    for (const [type, seg] of Object.entries(TYPE_PATHS)) expect(byPath.has(`/${seg}`)).toBe(published.filter((c) => c.program_type === type).length >= 3);
  });

  it('títulos y descripciones únicos; títulos de contenido de ≤ 70 caracteres', () => {
    const titles = all.map((r) => r.title);
    expect(new Set(titles).size).toBe(titles.length);
    const descs = routes.map((r) => r.description);
    expect(new Set(descs).size).toBe(descs.length);
    for (const r of routes.filter((x) => isContentPath(x.path))) expect(r.title.length, r.title).toBeLessThanOrEqual(70);
    expect(byPath.get('/')!.title).toBe('Compara Cursos, Diplomados y Maestrías | Groulevel');
  });

  it('datos estructurados: Article en contenido editorial, ItemList en landings, BreadcrumbList en todas', () => {
    expect(jsonTypes(`/carreras/${CAREERS[0].slug}`)).toEqual(expect.arrayContaining(['BreadcrumbList', 'Article']));
    expect(jsonTypes(`/guias/${GUIDES[0].slug}`)).toEqual(expect.arrayContaining(['BreadcrumbList', 'Article']));
    const landing = routes.find((r) => r.path.startsWith('/cursos/'));
    if (landing) expect(jsonTypes(landing.path)).toEqual(expect.arrayContaining(['BreadcrumbList', 'ItemList']));
    // Nada de valoraciones, precios u ofertas inventadas en páginas de contenido.
    const contentLd = JSON.stringify(routes.filter((r) => isContentPath(r.path)).map((r) => r.jsonLd));
    expect(contentLd).not.toMatch(/aggregateRating|"offers"|"price"/);
  });

  it('enlazado interno: carrera → habilidades → programas e instituciones; CTA al analizador', () => {
    const career = byPath.get('/carreras/data-analyst')!.body;
    expect(career).toContain('href="/habilidades/sql"');
    expect(career).toContain('href="/analizar-perfil?objetivo=');
    expect(career).toContain('Descubre qué te falta para alcanzar este rol');
    expect(byPath.get('/habilidades/sql')!.body).toContain('href="/programa/');
    expect(byPath.get('/')!.body).toContain('href="/carreras"');
    expect(byPath.get('/')!.body).toContain('Encuentra y compara las mejores maestrías, diplomados y cursos.');
  });

  it('la landing del analizador explica funcionamiento, datos, privacidad y limitaciones', () => {
    const body = byPath.get('/analizar-perfil')!.body;
    for (const h of ['Cómo funciona', 'Qué información necesita', 'Qué obtienes', 'Cómo se generan las recomendaciones', 'Cómo protegemos tu información', 'Limitaciones del diagnóstico']) expect(body).toContain(h);
    expect(body).toContain('Analizar mi perfil gratis');
  });

  it('las rutas inexistentes no se publican y el sitemap solo lista páginas indexables', () => {
    expect(isCatalogPath('/carreras/no-existe')).toBe(true); // el servidor la atiende…
    expect(byPath.has('/carreras/no-existe')).toBe(false); // …y responde 404 porque no hay contenido
    expect(isCatalogPath('/otra-cosa')).toBe(false);
    const xml = sitemapXml(all.filter((r) => r.index !== false), 'https://www.groulevel.com');
    expect(xml).toContain('<loc>https://www.groulevel.com/carreras/data-analyst</loc>');
    expect(xml).not.toContain('/mis-creditos');
    expect(xml).not.toContain('/mi-ruta/');
  });

  it('las preguntas frecuentes usan solo datos reales (sin precios si no hay suficientes)', () => {
    expect(faqFor('X', stats([]))).toEqual([]);
    const st = stats([{ currency: 'PEN', price: 1000, discount_price: null, duration_hours: 20, modality: 'en-vivo', institution_id: 'a' }, { currency: 'PEN', price: 2000, discount_price: 1500, duration_hours: 40, modality: 'presencial', institution_id: 'b' }] as never);
    expect(st.pricePEN).toMatchObject({ min: 1000, max: 1500, n: 2 });
    expect(faqFor('SQL', st)[0].a).toContain('S/ 1,000');
  });

  it('fitTitle agrega la marca solo si cabe', () => {
    expect(fitTitle('Corto')).toBe('Corto | Groulevel');
    expect(fitTitle('x'.repeat(60), 'y'.repeat(20))).toBe(`${'y'.repeat(20)} | Groulevel`);
  });

  it('la app registra las mismas rutas por tipo que el servidor', () => {
    const app = readFileSync(new URL('../../../src/App.tsx', import.meta.url), 'utf8');
    for (const [type, seg] of Object.entries(TYPE_PATHS)) expect(app).toContain(`['${type}', '${seg}']`);
    const vercel = JSON.parse(readFileSync(new URL('../../../vercel.json', import.meta.url), 'utf8')) as { rewrites: { source: string }[] };
    const sources = new Set(vercel.rewrites.map((r) => r.source));
    for (const seg of ['carreras', 'habilidades', 'guias', 'cursos', ...Object.values(TYPE_PATHS)]) {
      expect(sources.has(`/${seg}`), seg).toBe(true);
      expect(sources.has(`/${seg}/:slug`), seg).toBe(true);
    }
    expect(sources.has('/comparar/:slug')).toBe(true);
    expect(sources.has('/analizar-perfil')).toBe(true);
  });
});
