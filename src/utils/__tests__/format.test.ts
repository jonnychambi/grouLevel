/** Foco en cursos con clases en vivo: por defecto no se listan los grabados; tienen su propia sección. */
import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, filtersFromParams, filtersToParams, matchesFormat } from '../filters';
import { buildIndex } from '../search';
import { queryPrograms, type Catalog } from '../../services/catalogService';
import { CATALOG, CATEGORIES, INSTITUTIONS } from './fixtures';

const published = CATALOG.filter((c) => c.status === 'publicado');
const catalog: Catalog = {
  courses: published, institutions: INSTITUTIONS, categories: CATEGORIES,
  bySlug: new Map(published.map((c) => [c.slug, c])), byId: new Map(published.map((c) => [c.id, c])),
  index: buildIndex(published, CATEGORIES),
  live: published.filter((c) => matchesFormat(c, 'vivo')), recorded: published.filter((c) => matchesFormat(c, 'grabado'))
};

describe('formato de los cursos', () => {
  it('por defecto solo muestra cursos en vivo, híbridos o presenciales', () => {
    const r = queryPrograms(catalog, EMPTY_FILTERS, 1000);
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items.some((c) => c.modality === 'grabado')).toBe(false);
    expect(r.total).toBe(catalog.live.length);
    expect(r.formatCounts).toEqual({ vivo: catalog.live.length, grabado: catalog.recorded.length, todos: published.length });
    expect(r.facets.modalities.grabado ?? 0).toBe(0); // la opción «Grabado» no aparece en los filtros
  });

  it('los grabados tienen su propia sección (?formato=grabados) y «todos» muestra ambos', () => {
    const rec = queryPrograms(catalog, filtersFromParams(new URLSearchParams('formato=grabados')), 1000);
    expect(rec.total).toBe(catalog.recorded.length);
    expect(rec.items.every((c) => c.modality === 'grabado')).toBe(true);
    expect(queryPrograms(catalog, filtersFromParams(new URLSearchParams('formato=todos')), 1000).total).toBe(published.length);
  });

  it('la búsqueda informa cuántos resultados hay en cada formato', () => {
    const r = queryPrograms(catalog, { ...EMPTY_FILTERS, q: 'excel' }, 1000);
    expect(r.formatCounts.todos).toBe(r.formatCounts.vivo + r.formatCounts.grabado);
    expect(r.total).toBe(r.formatCounts.vivo);
  });

  it('el formato se guarda en la URL solo cuando no es el predeterminado', () => {
    expect(filtersToParams({ ...EMPTY_FILTERS }).toString()).toBe('');
    expect(filtersToParams({ ...EMPTY_FILTERS, format: 'grabado' }).toString()).toBe('formato=grabados');
    expect(filtersFromParams(new URLSearchParams('formato=otro')).format).toBe('vivo');
  });
});
