/** Páginas para buscadores servidas desde la base: contenido, metadatos, JSON-LD, 404 y sitemap. */
import { afterAll, describe, expect, it } from 'vitest';
import courses from '../../../src/data/courses.json';
import { bundledCatalog, startTestDb } from './testDb';

const SHELL = '<!doctype html><html lang="es-PE"><head><title>Groulevel</title><meta name="description" content="x" /><meta property="og:title" content="x" /><meta property="og:description" content="x" /></head><body><div id="root"></div>\n<noscript>js</noscript><script type="module" src="/a.js"></script></body></html>';
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
  String(input).endsWith('/_shell.html') ? new Response(SHELL) : realFetch(input, init)) as typeof fetch;

const db = await startTestDb({ seedCatalog: true });
afterAll(() => db.stop());
const seo = await import('../../seo');
const get = (q: string) => seo.GET(new Request(`https://www.groulevel.com/api/seo?${q}`));
const published = (courses as { slug: string; status: string; name: string; id: string }[]).filter((c) => c.status === 'publicado');

const jsonLd = (html: string) => [...html.matchAll(/<script type="application\/ld\+json" data-seo-jsonld="true">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

describe('SEO dinámico', () => {
  it('programa: título, canonical, contenido y datos estructurados de curso', async () => {
    const c = published[0];
    await db.sql`insert into reviews (id, course_id, institution_id, course_name, rating, title, comment, author_name, author_email, status, created_at, raw)
      values ('rev_seo', ${c.id}, ${(c as unknown as { institution_id: string }).institution_id}, 'x', 5, 't', 'Comentario suficientemente largo.', 'Ana', 'a@x.com', 'aprobada', now(), '{}')`;
    const res = await get(`path=/programa/${c.slug}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('s-maxage');
    const html = await res.text();
    expect(html).toContain(`<link rel="canonical" href="https://www.groulevel.com/programa/${c.slug}" />`);
    expect(html).toMatch(/<title>[^<]+\| Groulevel<\/title>/);
    expect(html).toContain('<h1>');
    expect(html).toContain('index, follow');
    const course = jsonLd(html).find((o) => o['@type'] === 'Course');
    expect(course).toMatchObject({ name: c.name, provider: { '@type': 'EducationalOrganization' }, aggregateRating: { ratingValue: 5, reviewCount: 1 } });
    expect(course.hasCourseInstance[0].courseWorkload).toMatch(/^PT\d+H$/);
    expect(jsonLd(html).some((o) => o['@type'] === 'BreadcrumbList')).toBe(true);
  });

  it('inicio, área e institución con enlaces internos', async () => {
    const home = await (await get('path=/')).text();
    expect(home).toContain('href="/programas/');
    expect(jsonLd(home).map((o) => o['@type'])).toEqual(['Organization', 'WebSite']);
    const cat = bundledCatalog().categories.find((k: { id: string }) => published.some((c) => (c as unknown as { category: string }).category === k.id));
    const area = await get(`path=/programas/${cat.slug}`);
    expect(area.status).toBe(200);
    expect(await area.text()).toContain('href="/programa/');
  });

  it('un programa nuevo se indexa sin redesplegar; uno inexistente da 404 noindex', async () => {
    const missing = await get('path=/programa/no-existe');
    expect(missing.status).toBe(404);
    expect(await missing.text()).toContain('noindex');
    expect((await get('path=/admin')).status).toBe(404);
  });

  it('páginas de opiniones: indexables solo con reseñas, con datos estructurados de reseñas', async () => {
    const c = published[0] as unknown as { id: string; slug: string; institution_id: string };
    const inst = (bundledCatalog().institutions as { id: string; slug: string }[]).find((i) => i.id === c.institution_id)!;
    const res = await get(`path=/institucion/${inst.slug}/opiniones`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('index, follow');
    expect(html).toContain('<h1>Opiniones de');
    const org = jsonLd(html).find((o) => o['@type'] === 'EducationalOrganization');
    expect(org.aggregateRating).toMatchObject({ ratingValue: 5, reviewCount: 1 });
    expect(org.review[0]).toMatchObject({ '@type': 'Review', author: { name: 'Ana' }, reviewRating: { ratingValue: 5 } });
    expect(html).not.toContain('a@x.com');
    const other = published.find((p) => p.id !== c.id && (p as unknown as { institution_id: string }).institution_id !== c.institution_id)!;
    const empty = await (await get(`path=/programa/${other.slug}/opiniones`)).text();
    expect(empty).toContain('noindex');
    const xml = await (await get('sitemap=1')).text();
    expect(xml).toContain(`/institucion/${inst.slug}/opiniones</loc>`);
    expect(xml).not.toContain(`/programa/${other.slug}/opiniones</loc>`);
  });

  it('sitemap con todas las páginas y su fecha de actualización', async () => {
    const res = await get('sitemap=1');
    expect(res.headers.get('content-type')).toContain('xml');
    const xml = await res.text();
    expect(xml).toContain(`<loc>https://www.groulevel.com/programa/${published[0].slug}</loc><lastmod>`);
    expect(xml).toContain('<loc>https://www.groulevel.com/mi-ruta</loc>');
    expect(xml).not.toContain('/favoritos');
    expect((xml.match(/<url>/g) ?? []).length).toBeGreaterThan(published.length);
  });
});
