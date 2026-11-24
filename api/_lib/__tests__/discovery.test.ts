/** Descubrimiento autónomo: fuentes, filtro de tema e idioma, publicación automática, MIT e instituciones sugeridas. */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startTestDb } from './testDb';

type Params = { tools?: unknown[]; output_config?: { format?: { schema?: { properties?: Record<string, unknown> } } }; messages: { content: unknown }[] };
const calls: Params[] = [];
let extract: (pageText: string) => Record<string, unknown> = () => ({});
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = {
      create: async (params: Params) => {
        calls.push(params);
        const usage = { input_tokens: 1000, output_tokens: 200 };
        if (params.tools) {
          // Búsqueda web simulada: resultados + informe con cita.
          return {
            stop_reason: 'end_turn', usage: { ...usage, server_tool_use: { web_search_requests: 3 } },
            content: [
              { type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'maestría datos online' } },
              { type: 'web_search_tool_result', tool_use_id: 's1', content: [
                { type: 'web_search_result', url: 'https://www.escuela-nueva.test/posgrado/', title: 'Escuela Nueva' },
                { type: 'web_search_result', url: 'https://educacioncontinua.cibertec.edu.pe/', title: 'Cibertec' }
              ] },
              { type: 'text', text: 'Escuela Nueva ofrece posgrados online en español.', citations: [{ type: 'web_search_result_location', url: 'https://www.escuela-nueva.test/posgrado/', title: 'x', cited_text: 'x' }] }
            ]
          };
        }
        if (params.output_config?.format?.schema?.properties?.institutions) {
          return { stop_reason: 'end_turn', usage, content: [{ type: 'text', text: JSON.stringify({ institutions: [
            { name: 'Escuela Nueva', website: 'https://www.escuela-nueva.test', listing_url: 'https://www.escuela-nueva.test/posgrado/', type: 'Escuela de negocios', country: 'Perú', reason: 'Posgrados online de datos.' },
            { name: 'Inventada', website: 'https://no-aparecio.test', listing_url: '', type: 'Instituto', country: 'Perú', reason: 'x' },
            { name: 'Cibertec', website: 'https://educacioncontinua.cibertec.edu.pe', listing_url: '', type: 'Instituto', country: 'Perú', reason: 'ya existe' }
          ] }) }] };
        }
        const text = String(params.messages[0].content);
        return { stop_reason: 'end_turn', usage, content: [{ type: 'text', text: JSON.stringify(extract(text)) }] };
      }
    };
  }
}));

const pages = new Map<string, string>();
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const html = pages.get(String(input));
  return html === undefined ? new Response('no', { status: 404 }) : new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
}) as typeof fetch;

const db = await startTestDb({ seedCatalog: true });
afterAll(() => db.stop());
const sql = db.sql;
const disc = await import('../programDiscovery');
const { processQueue } = await import('../programImport');
const { getCurrentCatalog } = await import('../catalogRepo');

const MIT = 'https://professionalprograms.mit.edu/es/';
const filler = Array.from({ length: 25 }, (_, i) => `<p>Módulo ${i + 1}: contenidos aplicados con casos reales y proyectos.</p>`).join('');
const program = (title: string) => `<html><body><h1>${title}</h1>${filler}</body></html>`;
const program_ai = (over: Record<string, unknown>) => ({
  found: true, relevant: true, name: 'IA Generativa Aplicada a la Transformación Digital', institution_name: 'MIT Professional Education', program_type: 'programa-ejecutivo',
  published_type: 'Programa online', category: 'ia-generativa', short_description: 'Aplica la IA generativa en tu organización.', description: 'Programa online de 8 semanas.',
  target_audience: '', level: null, modality: 'grabado', language: 'Español', price: null, discount_price: null, currency: 'USD', duration_hours: null, duration_weeks: 8,
  duration_text: '8 semanas', start_date: '', start_text: '', schedule: '', certificate: { type: 'incluye', description: 'Certificado de MIT Professional Education' },
  objectives: [], syllabus: [{ title: 'Fundamentos de IA generativa', hours: null, description: '', topics: ['LLMs'] }], tools: [], skills: [], requirements: [],
  installments: null, installment_amount: null, enrollment_open: null, ...over
});

beforeAll(() => {
  process.env.ANTHROPIC_API_KEY = 'test';
});

describe('links de programas', () => {
  const base = { host: 'inst.test', prefix: '/programas/', listing: 'https://inst.test/programas/' };
  it('acepta solo programas del mismo sitio, bajo la ruta y más profundos', () => {
    expect(disc.isProgramLink('https://www.inst.test/programas/especializacion-datos', '', base)).toBe(true);
    expect(disc.isProgramLink('https://inst.test/programas/x', 'Diplomado en finanzas', base)).toBe(true);
    expect(disc.isProgramLink('https://otra.test/programas/curso-x', '', base)).toBe(false);
    expect(disc.isProgramLink('https://inst.test/programas/', '', base)).toBe(false);
    expect(disc.isProgramLink('https://inst.test/blog/curso-x', '', base)).toBe(false);
    expect(disc.isProgramLink('https://inst.test/programas/blog-curso', '', base)).toBe(false);
    expect(disc.isProgramLink('https://inst.test/programas/brochure-curso.pdf', '', base)).toBe(false);
    expect(disc.isProgramLink('https://inst.test/programas/contacto', 'Contáctanos', base)).toBe(false);
  });
  it('extrae links del listado sin duplicados ni parámetros de campaña', () => {
    const html = `<a href="/programas/curso-python?utm_source=x">Curso Python</a><a class="c" href='https://inst.test/programas/curso-python'>Python</a>
      <a href="/programas/mba-online">MBA</a><a href="/nosotros">x</a><a href="mailto:a@b.c">m</a>`;
    expect(disc.extractProgramLinks(html, 'https://inst.test/programas/', '/programas/').map((c) => c.url)).toEqual(['https://inst.test/programas/curso-python', 'https://inst.test/programas/mba-online']);
  });
  it('deduce la página de programas de una institución y lee sitemaps', () => {
    expect(disc.guessListing(['https://a.pe/cursos/x', 'https://a.pe/cursos/y', 'https://a.pe/maestrias/z'], null)).toEqual({ url: 'https://a.pe/cursos/', prefix: '/cursos/' });
    expect(disc.guessListing([], 'https://b.pe')).toEqual({ url: 'https://b.pe/', prefix: '/' });
    expect(disc.parseSitemap('<sitemapindex><sitemap><loc>https://a.pe/s1.xml</loc></sitemap></sitemapindex>')).toEqual({ locs: [], children: ['https://a.pe/s1.xml'] });
    expect(disc.parseSitemap('<urlset><url><loc> https://a.pe/cursos/x </loc></url></urlset>').locs).toEqual(['https://a.pe/cursos/x']);
  });
  it('publica solo borradores completos', () => {
    const full = { name: 'X', relevant: true, language: 'Español', price: 100, syllabus: [{ title: 'a' }], short_description: 'Algo' } as never;
    expect(disc.autoPublishGaps(full, 'inst-1')).toEqual([]);
    expect(disc.autoPublishGaps(full, null)).toEqual(['institución']);
    expect(disc.autoPublishGaps({ ...(full as object), language: 'Inglés', syllabus: [] } as never, 'i')).toEqual(['tema o idioma', 'temario']);
  });
});

describe('descubrimiento con MIT', () => {
  it('la migración deja a MIT como fuente inicial, con sus programas en español', async () => {
    const [src] = await sql`select * from discovery_sources where url = ${MIT}`;
    expect(src).toMatchObject({ origin: 'semilla', status: 'activa', institution_id: null, path_prefix: '/es/' });
    expect((src.institution as { type: string; country: string }).type).toBe('Universidad');
    expect((src.seed_links as string[]).length).toBe(5);
  });

  it('encuentra programas nuevos, crea la institución MIT y descarta lo que no es de tecnología/negocios o no está en español', async () => {
    pages.set(MIT, `<a href="/es/programa-online-ia-generativa">IA generativa</a><a href="/es/programa-online-in-english">Program</a><a href="/es/blog/diseno">Blog</a>
      <a href="/es/programa-online-arte">Programa de arte</a>`);
    pages.set('https://professionalprograms.mit.edu/es/programa-online-ia-generativa', program('IA Generativa'));
    pages.set('https://professionalprograms.mit.edu/es/programa-online-in-english', program('Program in English'));
    pages.set('https://professionalprograms.mit.edu/es/programa-online-arte', program('Arte'));
    const [src] = await sql`select id from discovery_sources where url = ${MIT}`;
    const summary = await disc.runDiscovery({ sql, ids: [Number(src.id)], force: true });
    expect(summary).toMatchObject({ sources: 1, added: 7 }); // 5 conocidos + 2 nuevos del listado (el blog no)
    const cat = (await getCurrentCatalog(sql))!;
    const mit = cat.data.institutions.find((i) => i.id === 'inst-mit-professional-education')!;
    expect(mit).toMatchObject({ name: 'MIT Professional Education', type: 'Universidad', country: 'Estados Unidos' });
    const drafts = await sql`select url, auto, institution_id, source_id from program_drafts where source_id = ${src.id}`;
    expect(drafts.every((d) => d.auto && d.institution_id === 'inst-mit-professional-education')).toBe(true);

    // Una segunda ejecución no repite links.
    expect((await disc.runDiscovery({ sql, ids: [Number(src.id)], force: true })).added).toBe(0);

    extract = (text) => text.includes('Program in English') ? program_ai({ language: 'Inglés', name: 'AI Program' })
      : text.includes('Arte') ? program_ai({ relevant: false, name: 'Arte' })
      : text.includes('IA Generativa') ? program_ai({}) : { found: false };
    await processQueue({ sql, timeBudgetMs: 60_000 });
    const byUrl = Object.fromEntries((await sql`select url, status, error from program_drafts where source_id = ${src.id}`).map((r) => [String(r.url).split('/es/')[1], r]));
    expect(byUrl['programa-online-ia-generativa'].status).toBe('listo');
    expect(byUrl['programa-online-in-english']).toMatchObject({ status: 'descartado', error: 'Descartado automáticamente: se dicta en inglés.' });
    expect(byUrl['programa-online-arte']).toMatchObject({ status: 'descartado', error: 'Descartado automáticamente: no es de Tecnología ni de Negocios.' });
    expect(byUrl['programa-online-transformacion-digital'].status).toBe('error'); // la página no se pudo leer
  });

  it('publica solo los completos, con el país de la institución', async () => {
    const out = await disc.autoPublish(sql);
    expect(out).toMatchObject({ published: 1, error: null });
    const cat = (await getCurrentCatalog(sql))!;
    const course = cat.data.courses.find((c) => String(c.url).endsWith('programa-online-ia-generativa'))!;
    expect(course).toMatchObject({ institution_id: 'inst-mit-professional-education', country: 'Estados Unidos', status: 'publicado', currency: 'USD' });
    expect(course).not.toHaveProperty('relevant');
  });
});

describe('fuentes automáticas e instituciones sugeridas', () => {
  it('crea una fuente por institución del catálogo a partir de sus links', async () => {
    const cat = (await getCurrentCatalog(sql))!;
    await disc.ensureAutoSources(cat.data, sql);
    const auto = await sql`select institution_id from discovery_sources where origin = 'auto'`;
    const withCourses = new Set(cat.data.courses.map((c) => String(c.institution_id)));
    expect(auto.length).toBeGreaterThan(0);
    expect(auto.map((r) => r.institution_id)).not.toContain('inst-mit-professional-education'); // ya tiene su fuente
    expect(auto.every((r) => withCourses.has(String(r.institution_id)) || cat.data.institutions.some((i) => i.id === r.institution_id))).toBe(true);
  });

  it('sugiere solo instituciones que aparecieron en la búsqueda y no están en el catálogo', async () => {
    calls.length = 0;
    const r = await disc.searchInstitutions({ sql });
    expect(r).toMatchObject({ suggested: 1, approved: 0, searches: 3, error: null });
    const search = calls[0] as { tools: Record<string, unknown>[] };
    expect(search.tools[0]).toEqual({ type: 'web_search_20250305', name: 'web_search', max_uses: 6 });
    const [s] = await sql`select * from discovery_sources where origin = 'sugerida'`;
    expect(s).toMatchObject({ url: 'https://www.escuela-nueva.test/posgrado/', status: 'sugerida', path_prefix: '/posgrado/' });
    expect(await disc.searchDue(sql)).toBe(false);
    const overview = await disc.discoveryOverview(sql);
    expect(overview.sources.find((x) => x.origin === 'semilla')?.institution_name).toBe('MIT Professional Education');
    expect(overview.drafts.publicado).toBe(1);
  });
});
