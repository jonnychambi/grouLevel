import { describe, expect, it } from 'vitest';
import { applyFilters, EMPTY_FILTERS, facetCounts, filtersFromParams, filtersToParams, sortCourses } from '../filters';
import { priceInPEN } from '../format';
import { CATALOG, CATEGORIES, INSTITUTIONS } from './fixtures';

const ctx = { categories: CATEGORIES.map((c) => ({ id: c.id, name: c.name })), institutions: INSTITUTIONS.map((i) => ({ id: i.id, name: i.name })), currency: 'PEN' as const };

describe('filters', () => {
  it('hay al menos 24 programas de prueba', () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(24);
  });
  it('combina filtros (AND entre grupos, OR dentro de un grupo)', () => {
    const r = applyFilters(CATALOG, { ...EMPTY_FILTERS, types: ['bootcamp', 'curso'], modalities: ['en-vivo'] });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((c) => ['bootcamp', 'curso'].includes(c.program_type) && c.modality === 'en-vivo')).toBe(true);
  });
  it('filtra gratis', () => {
    const r = applyFilters(CATALOG, { ...EMPTY_FILTERS, price: ['gratis'] });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((c) => (c.discount_price ?? c.price) === 0)).toBe(true);
  });
  it('filtra duración < 10 horas', () => {
    expect(applyFilters(CATALOG, { ...EMPTY_FILTERS, durations: ['lt10'] }).every((c) => c.duration_hours < 10)).toBe(true);
  });
  it('ordena por precio normalizado a PEN', () => {
    const sorted = sortCourses(CATALOG, 'precio-asc').map(priceInPEN);
    expect(sorted).toEqual([...sorted].sort((a, b) => a - b));
  });
  it('facetas cuentan respetando otros filtros', () => {
    const f = facetCounts(CATALOG, { ...EMPTY_FILTERS, types: ['maestria'] }, ctx);
    expect(f.types.curso).toBeGreaterThan(0); // su propio grupo no se auto-filtra
    expect(f.levels.basico).toBe(0); // las maestrías demo son avanzadas
  });
  it('serializa y deserializa la URL', () => {
    const state = { ...EMPTY_FILTERS, q: 'python', types: ['curso' as const], sort: 'precio-asc' as const, page: 2, currency: 'USD' as const };
    const back = filtersFromParams(filtersToParams(state));
    expect(back).toMatchObject({ q: 'python', types: ['curso'], sort: 'precio-asc', page: 2, currency: 'USD' });
  });
});
