/** Posicionamiento como comparador: títulos, descripciones, H1 y sección de comparación (servidor y app comparten meta.mjs). */
import { describe, expect, it } from 'vitest';
import courses from '../../../src/data/courses.json';
import institutions from '../../../src/data/institutions.json';
import categories from '../../../src/data/categories.json';
import { buildRoutes } from '../../../scripts/seoPages.mjs';
import { categoryMeta, comparablePrograms, institutionMeta, programCompareCopy, programDescription, programTitle, typeAreaMeta, typeHubMeta, typesLabel } from '../../../src/content/meta.mjs';

type C = (typeof courses)[number];
const catalog = { courses, institutions, categories } as unknown as Parameters<typeof buildRoutes>[0];
const routes = buildRoutes(catalog, { siteUrl: 'https://www.groulevel.com' });
const byPath = new Map(routes.map((r) => [r.path, r]));
const instOf = (c: C) => (institutions as { id: string; name: string; short_name: string }[]).find((i) => i.id === c.institution_id)!;
const ld = (path: string) => (byPath.get(path)!.jsonLd ?? []) as Record<string, unknown>[];

describe('Groulevel como comparador educativo', () => {
  const utp = (courses as C[]).find((c) => c.slug === 'maestria-en-ciencia-de-datos-e-inteligencia-artificial')!;
  const path = `/programa/${utp.slug}`;

  it('Maestría en Ciencia de Datos e IA - UTP: title, description, H1, institución y canonical', () => {
    const r = byPath.get(path)!;
    expect(r.title).toBe('Maestría en Ciencia de Datos e Inteligencia Artificial - UTP | Groulevel');
    expect(r.description).toMatch(/^Conoce la Maestría en Ciencia de Datos e Inteligencia Artificial de Escuela de Postgrado UTP\. Revisa .+ Compara alternativas en Groulevel\.$/);
    expect(r.body).toContain('<h1>Maestría en Ciencia de Datos e Inteligencia Artificial - UTP</h1>');
    expect(r.body).toContain('Escuela de Postgrado UTP');
    expect(r.index).not.toBe(false);
    const course = ld(path).find((o) => o['@type'] === 'Course') as { provider: { name: string; '@type': string }; url: string };
    expect(course.provider).toMatchObject({ '@type': 'EducationalOrganization', name: 'Escuela de Postgrado UTP' });
    expect(course.url).toBe(`https://www.groulevel.com${path}`);
  });

  it('la ficha invita a comparar con programas similares y enlaza a ellos', () => {
    const r = byPath.get(path)!;
    expect(r.body).toContain('<h2>¿Es esta la mejor maestría para ti?</h2>');
    expect(r.body).toContain('Comparar con otras maestrías');
    const similar = comparablePrograms(utp as never, courses as never);
    expect(similar.length).toBeGreaterThan(0);
    for (const s of similar as C[]) {
      expect(s.id).not.toBe(utp.id);
      expect(r.body).toContain(`href="/programa/${s.slug}"`);
    }
    expect((similar as C[]).every((s) => s.program_type === 'maestria' && s.category === utp.category)).toBe(true);
  });

  it('la descripción solo menciona datos publicados (sin precio si no hay precio)', () => {
    const base = { ...utp, price: null, discount_price: null, duration_text: null, duration_hours: null, modality: null };
    const d = programDescription(base as never, instOf(utp));
    expect(d).not.toMatch(/precio|duración|modalidad/);
    expect(programDescription(utp as never, instOf(utp))).toMatch(/precio \(S\/ [\d,]+\)/);
    expect(programCompareCopy('curso').question).toBe('¿Es este el mejor curso para ti?');
    expect(programCompareCopy('especializacion').cta).toBe('Comparar con otras especializaciones');
  });

  it('plantillas de inicio, listados por tipo, tipo × área, área e institución', () => {
    expect(byPath.get('/')!.title).toBe('Compara Cursos, Diplomados y Maestrías | Groulevel');
    expect(byPath.get('/')!.body).toContain('Groulevel no es una institución educativa');
    if (byPath.has('/maestrias')) {
      expect(byPath.get('/maestrias')!.title).toBe('Encuentra y Compara las Mejores Maestrías | Groulevel');
      expect(byPath.get('/maestrias')!.body).toContain('<h1>Encuentra y compara las mejores maestrías</h1>');
      expect(byPath.get('/maestrias')!.body).toContain('no publica un ranking');
    }
    expect(typeHubMeta('diplomado', { count: 5, institutions: 3, pricePEN: null }).title).toBe('Encuentra y Compara los Mejores Diplomados | Groulevel');
    expect(typeAreaMeta('maestria', { name: 'Data Science' }, { count: 6, institutions: 5, pricePEN: null }).title).toBe('Maestrías en Data Science: Compara Programas | Groulevel');
    // La descripción no promete precios si no hay ninguno publicado.
    expect(typeAreaMeta('maestria', { name: 'X' }, { count: 3, institutions: 2, pricePEN: null }).description).not.toContain('precios');
    expect(typesLabel([{ program_type: 'curso' }, { program_type: 'maestria' }])).toBe('Maestrías y Cursos');
    expect(institutionMeta({ name: 'Universidad X' }, [{ program_type: 'curso', institution_id: 'x', price: 10, discount_price: null }, { program_type: 'maestria', institution_id: 'x', price: null, discount_price: null }]).title).toBe('Maestrías y Cursos de Universidad X | Groulevel');
    expect(institutionMeta({ name: 'Academia Y' }, [{ program_type: 'bootcamp', institution_id: 'y', price: null, discount_price: null }]).title).toBe('Bootcamps de Academia Y | Groulevel');
    expect(categoryMeta({ name: 'Data Science' }, [{ program_type: 'maestria', institution_id: 'a', price: null, discount_price: null }]).title).toBe('Data Science: Compara Maestrías | Groulevel');
  });

  it('identidad: Organization y WebSite con nombre Groulevel; las instituciones son el proveedor del curso', () => {
    const home = ld('/');
    expect(home.find((o) => o['@type'] === 'Organization')).toMatchObject({ name: 'Groulevel', description: expect.stringContaining('Comparador') });
    expect(home.find((o) => o['@type'] === 'WebSite')).toMatchObject({ name: 'Groulevel', url: 'https://www.groulevel.com/' });
    expect(JSON.stringify(home)).not.toContain('EducationalOrganization');
  });

  it('todas las fichas de programa tienen título con institución y marca, y títulos únicos', () => {
    const programs = routes.filter((r) => r.path.startsWith('/programa/') && !r.path.endsWith('/opiniones'));
    for (const r of programs) expect(r.title).toMatch(/ - .+ \| Groulevel$/);
    expect(new Set(routes.map((r) => r.title)).size).toBe(routes.length);
    for (const c of (courses as C[]).filter((x) => x.status === 'publicado').slice(0, 50)) expect(programTitle(c as never, instOf(c)).length).toBeLessThanOrEqual(90);
  });
});
