/**
 * Servicio de catálogo: une cursos + instituciones + categorías, cachea y expone
 * consultas de alto nivel (búsqueda, filtros, facetas, relacionados).
 * Los componentes nunca leen JSON directamente: siempre pasan por aquí.
 */
import type { Category, CourseWithInstitution, Institution } from '../types';
import { getDataSource } from './dataSource';
import { buildIndex, search, suggest, type QueryIntent, type SearchResult, type Suggestion } from '../utils/search';
import { applyFilters, facetCounts, sortCourses, type FacetKey, type FilterContext, type FilterState, type SortKey } from '../utils/filters';
import { relatedCourses } from '../utils/related';

export interface Catalog {
  courses: CourseWithInstitution[];
  institutions: Institution[];
  categories: Category[];
  bySlug: Map<string, CourseWithInstitution>;
  byId: Map<string, CourseWithInstitution>;
  index: ReturnType<typeof buildIndex>;
}

let catalogPromise: Promise<Catalog> | null = null;

export function loadCatalog(): Promise<Catalog> {
  if (!catalogPromise) {
    const ds = getDataSource();
    catalogPromise = Promise.all([ds.getCourses(), ds.getInstitutions(), ds.getCategories()])
      .then(([courses, institutions, categories]) => {
        const instById = new Map(institutions.map((i) => [i.id, i]));
        const joined: CourseWithInstitution[] = courses
          .filter((c) => instById.has(c.institution_id) && (c.status ?? 'publicado') === 'publicado')
          .map((c) => ({ ...c, institution: instById.get(c.institution_id)! }));
        return {
          courses: joined,
          institutions,
          categories,
          bySlug: new Map(joined.map((c) => [c.slug, c])),
          byId: new Map(joined.map((c) => [c.id, c])),
          index: buildIndex(joined, categories)
        };
      })
      .catch((err) => {
        catalogPromise = null; // permite reintentar
        throw err;
      });
  }
  return catalogPromise;
}

export interface ProgramQueryResult {
  items: CourseWithInstitution[];
  total: number;
  page: number;
  pageCount: number;
  facets: Record<FacetKey, Record<string, number>>;
  filterContext: FilterContext;
  search: SearchResult | null;
  effectiveSort: SortKey;
  appliedIntent: QueryIntent;
}

export function queryPrograms(catalog: Catalog, state: FilterState, pageSize: number): ProgramQueryResult {
  let pool = catalog.courses;
  let relevance: Map<string, number> | undefined;
  let result: SearchResult | null = null;

  if (state.q.trim()) {
    result = search(catalog.index, state.q);
    pool = result.hits.map((h) => h.course);
    relevance = new Map(result.hits.map((h) => [h.course.id, h.score]));
  }

  const filterContext: FilterContext = {
    categories: catalog.categories.map((c) => ({ id: c.id, name: c.name })),
    institutions: catalog.institutions.map((i) => ({ id: i.id, name: i.name })),
    currency: state.currency
  };

  const filtered = applyFilters(pool, state);
  const effectiveSort: SortKey = state.sort ?? (result?.appliedIntent.cheap ? 'precio-asc' : 'relevancia');
  const sorted = sortCourses(filtered, effectiveSort, relevance);
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(state.page, pageCount);

  return {
    items: sorted.slice((page - 1) * pageSize, page * pageSize),
    total: sorted.length,
    page,
    pageCount,
    facets: facetCounts(pool, state, filterContext),
    filterContext,
    search: result,
    effectiveSort,
    appliedIntent: result?.appliedIntent ?? {}
  };
}

export function getSuggestions(catalog: Catalog, q: string): Suggestion[] {
  return suggest(q, { courses: catalog.courses, categories: catalog.categories });
}

export function getRelated(catalog: Catalog, course: CourseWithInstitution, limit = 4) {
  return relatedCourses(course, catalog.courses, limit);
}

export function coursesByInstitution(catalog: Catalog, institutionId: string) {
  return catalog.courses.filter((c) => c.institution_id === institutionId);
}

export function featuredCourses(catalog: Catalog, limit = 6) {
  return sortCourses(catalog.courses, 'relevancia').slice(0, limit);
}
