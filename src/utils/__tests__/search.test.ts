import { describe, expect, it } from 'vitest';
import { buildIndex, parseQuery, search, suggest } from '../search';
import { CATALOG, CATEGORIES } from './fixtures';

const index = buildIndex(CATALOG, CATEGORIES);

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

describe('search (catálogo real)', () => {
  const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  it('"curso de Power BI" devuelve solo cursos y el primero es de Power BI', () => {
    const r = search(index, 'curso de Power BI');
    expect(r.hits.length).toBeGreaterThan(0);
    expect(r.hits.every((h) => h.course.program_type === 'curso')).toBe(true);
    expect(norm(r.hits[0].course.name + ' ' + r.hits[0].course.tools.join(' '))).toContain('power bi');
  });
  it('"maestría de inteligencia artificial" devuelve solo maestrías relacionadas con IA', () => {
    const r = search(index, 'maestría de inteligencia artificial');
    expect(r.hits.length).toBeGreaterThan(0);
    expect(r.hits.every((h) => h.course.program_type === 'maestria')).toBe(true);
    expect(norm(r.hits[0].course.name)).toMatch(/inteligencia artificial|ia\b|ai\b|data science|ciencia de datos/);
  });
  it('"data analytics online" prioriza Data Analytics', () => {
    expect(search(index, 'data analytics online').hits.slice(0, 3).every((h) => h.course.category === 'data-analytics')).toBe(true);
  });
  it('"bootcamp de programación" devuelve bootcamps', () => {
    const r = search(index, 'bootcamp de programación');
    expect(r.hits.length).toBeGreaterThan(0);
    expect(r.hits.every((h) => h.course.program_type === 'bootcamp')).toBe(true);
  });
  it('"curso de Python barato" activa orden por precio y filtra cursos de Python', () => {
    const r = search(index, 'curso de Python barato');
    expect(r.appliedIntent.cheap).toBe(true);
    expect(r.hits.every((h) => h.course.program_type === 'curso')).toBe(true);
    expect(r.hits.some((h) => norm(h.course.name).includes('python'))).toBe(true);
  });
  it('"programa de data science" prioriza Data Science', () => {
    const top = search(index, 'programa de data science').hits.slice(0, 3);
    expect(top.every((h) => h.course.category === 'data-science' || norm(h.course.name).includes('data science'))).toBe(true);
  });
  it('busca por institución', () => {
    const r = search(index, 'Datapath');
    expect(r.hits.length).toBeGreaterThan(0);
    expect(r.hits.every((h) => h.course.institution_id === 'inst-datapath')).toBe(true);
  });
  it('tolera errores de tipeo', () => {
    expect(search(index, 'ciberseguirdad').hits.length).toBeGreaterThan(0);
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
