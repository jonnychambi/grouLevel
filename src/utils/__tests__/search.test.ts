import { describe, expect, it } from 'vitest';
import { buildIndex, parseQuery, search, suggest } from '../search';
import { CATALOG, CATEGORIES } from './fixtures';

const index = buildIndex(CATALOG, CATEGORIES);
const top = (q: string, n = 3) => search(index, q).hits.slice(0, n).map((h) => h.course.slug);

describe('parseQuery', () => {
  it('detecta tipo de programa y concepto con sinónimos', () => {
    const p = parseQuery('maestría de inteligencia artificial');
    expect(p.intent.programType).toBe('maestria');
    expect(p.concepts[0]).toContain('ia');
  });
  it('detecta intención de precio bajo', () => {
    const p = parseQuery('curso de Python barato');
    expect(p.intent).toMatchObject({ programType: 'curso', cheap: true });
    expect(p.concepts).toEqual([['python']]);
  });
  it('trata "power bi" como una sola frase', () => {
    expect(parseQuery('curso de power bi').concepts).toHaveLength(1);
  });
  it('ignora "online" como stopword', () => {
    expect(parseQuery('data analytics online').concepts).toHaveLength(1);
  });
});

describe('search', () => {
  it('"curso de Power BI" prioriza el curso de Power BI', () => {
    expect(top('curso de Power BI', 1)).toEqual(['power-bi-para-negocios']);
  });
  it('"maestría de inteligencia artificial" devuelve solo maestrías, IA primero', () => {
    const r = search(index, 'maestría de inteligencia artificial');
    expect(r.hits.every((h) => h.course.program_type === 'maestria')).toBe(true);
    expect(r.hits[0].course.slug).toBe('maestria-en-inteligencia-artificial-aplicada');
  });
  it('"data analytics online" encuentra Data Analytics Professional', () => {
    expect(top('data analytics online')).toContain('data-analytics-professional');
  });
  it('"bootcamp de programación" devuelve bootcamps de software', () => {
    const r = search(index, 'bootcamp de programación');
    expect(r.hits.length).toBeGreaterThan(0);
    expect(r.hits.every((h) => h.course.program_type === 'bootcamp')).toBe(true);
    expect(r.hits[0].course.slug).toBe('desarrollo-web-full-stack-bootcamp');
  });
  it('"curso de Python barato" activa orden por precio y filtra cursos', () => {
    const r = search(index, 'curso de Python barato');
    expect(r.appliedIntent.cheap).toBe(true);
    expect(r.hits.every((h) => h.course.program_type === 'curso')).toBe(true);
    expect(r.hits.map((h) => h.course.slug)).toContain('fundamentos-de-python');
  });
  it('"programa de data science" prioriza Data Science', () => {
    expect(search(index, 'programa de data science').hits.slice(0, 3).every((h) => h.course.category === 'data-science')).toBe(true);
  });
  it('busca por institución', () => {
    expect(search(index, 'CodeRumbo').hits.every((h) => h.course.institution_id === 'inst-coderumbo')).toBe(true);
  });
  it('tolera errores de tipeo', () => {
    expect(top('ciberseguirdad').length).toBeGreaterThan(0);
  });
  it('sin coincidencias devuelve vacío', () => {
    expect(search(index, 'astrofísica cuántica').hits).toHaveLength(0);
  });
});

describe('suggest', () => {
  it('sugiere categorías, herramientas y programas', () => {
    const s = suggest('pow', { courses: CATALOG, categories: CATEGORIES });
    expect(s.some((x) => x.kind === 'herramienta' && x.label === 'Power BI')).toBe(true);
    expect(s.some((x) => x.kind === 'programa')).toBe(true);
  });
});
