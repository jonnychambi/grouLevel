/**
 * Definición declarativa de filtros, ordenamiento y su serialización en la URL.
 * Agregar un filtro nuevo = agregar una entrada en FILTER_GROUPS.
 */
import type { CertificateType, CourseWithInstitution, Currency, Level, Modality, ProgramType } from '../types';
import { convert, effectivePrice, priceInPEN } from './format';
import { CERTIFICATE_LABELS, LEVEL_LABELS, MODALITY_LABELS, PROGRAM_TYPE_LABELS } from './labels';

export type SortKey = 'relevancia' | 'precio-asc' | 'precio-desc' | 'duracion-asc' | 'duracion-desc' | 'valoracion';

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'relevancia', label: 'Relevancia' },
  { value: 'precio-asc', label: 'Precio menor' },
  { value: 'precio-desc', label: 'Precio mayor' },
  { value: 'duracion-asc', label: 'Menor duración' },
  { value: 'duracion-desc', label: 'Mayor duración' },
  { value: 'valoracion', label: 'Mejor valorado' }
];

export interface FilterState {
  q: string;
  categories: string[];
  types: ProgramType[];
  price: string[];
  modalities: Modality[];
  durations: string[];
  institutions: string[];
  levels: Level[];
  certificates: CertificateType[];
  sort: SortKey | null;
  page: number;
  currency: Currency;
}

export const EMPTY_FILTERS: FilterState = {
  q: '', categories: [], types: [], price: [], modalities: [], durations: [], institutions: [], levels: [], certificates: [],
  sort: null, page: 1, currency: 'PEN'
};

export type FacetKey = 'categories' | 'types' | 'price' | 'modalities' | 'durations' | 'institutions' | 'levels' | 'certificates';

/* --------------------------- Rangos de precio --------------------------- */

interface PriceBucket { id: string; min: number; max: number }
const PRICE_BUCKETS: Record<Currency, PriceBucket[]> = {
  PEN: [
    { id: 'gratis', min: 0, max: 0 },
    { id: 'p1', min: 1, max: 500 },
    { id: 'p2', min: 500, max: 1500 },
    { id: 'p3', min: 1500, max: 4000 },
    { id: 'p4', min: 4000, max: 10000 },
    { id: 'p5', min: 10000, max: Infinity }
  ],
  USD: [
    { id: 'gratis', min: 0, max: 0 },
    { id: 'p1', min: 1, max: 150 },
    { id: 'p2', min: 150, max: 400 },
    { id: 'p3', min: 400, max: 1000 },
    { id: 'p4', min: 1000, max: 2500 },
    { id: 'p5', min: 2500, max: Infinity }
  ]
};

function priceBucketLabel(b: PriceBucket, currency: Currency): string {
  const s = currency === 'PEN' ? 'S/' : 'US$';
  const f = (n: number) => n.toLocaleString('en-US');
  if (b.id === 'gratis') return 'Gratis';
  if (b.max === Infinity) return `Más de ${s} ${f(b.min)}`;
  if (b.min <= 1) return `Hasta ${s} ${f(b.max)}`;
  return `${s} ${f(b.min)} – ${f(b.max)}`;
}

function inPriceBucket(course: CourseWithInstitution, id: string, currency: Currency): boolean {
  const raw = effectivePrice(course);
  if (id === 'consultar') return raw == null;
  const b = PRICE_BUCKETS[currency].find((x) => x.id === id);
  if (!b || raw == null) return false;
  const price = convert(raw, course.currency, currency);
  if (b.id === 'gratis') return price === 0;
  return price > 0 && price >= b.min && price < b.max;
}

/* ------------------------------ Duración ------------------------------- */

const DURATION_BUCKETS = [
  { id: 'lt10', label: 'Menos de 10 horas', min: 0, max: 10 },
  { id: '10-30', label: '10 – 30 horas', min: 10, max: 30 },
  { id: '30-60', label: '30 – 60 horas', min: 30, max: 60 },
  { id: '60-120', label: '60 – 120 horas', min: 60, max: 120 },
  { id: 'gt120', label: 'Más de 120 horas', min: 120, max: Infinity }
];

/* --------------------------- Grupos de filtros -------------------------- */

export interface FilterOption { value: string; label: string }

export interface FilterGroup {
  key: FacetKey;
  label: string;
  param: string;
  options: (ctx: FilterContext) => FilterOption[];
  matches: (course: CourseWithInstitution, value: string, state: FilterState) => boolean;
  defaultOpen?: boolean;
}

export interface FilterContext {
  categories: { id: string; name: string }[];
  institutions: { id: string; name: string }[];
  currency: Currency;
}

const fromLabels = (labels: Record<string, string>): FilterOption[] => Object.entries(labels).map(([value, label]) => ({ value, label }));

export const FILTER_GROUPS: FilterGroup[] = [
  { key: 'categories', label: 'Categoría', param: 'cat', defaultOpen: true, options: (ctx) => ctx.categories.map((c) => ({ value: c.id, label: c.name })), matches: (c, v) => c.category === v },
  { key: 'types', label: 'Tipo de programa', param: 'tipo', defaultOpen: true, options: () => fromLabels(PROGRAM_TYPE_LABELS), matches: (c, v) => c.program_type === v },
  { key: 'price', label: 'Precio', param: 'precio', defaultOpen: true, options: (ctx) => [...PRICE_BUCKETS[ctx.currency].map((b) => ({ value: b.id, label: priceBucketLabel(b, ctx.currency) })), { value: 'consultar', label: 'Precio no publicado' }], matches: (c, v, s) => inPriceBucket(c, v, s.currency) },
  { key: 'modalities', label: 'Modalidad', param: 'modalidad', defaultOpen: true, options: () => fromLabels(MODALITY_LABELS), matches: (c, v) => c.modality === v },
  { key: 'durations', label: 'Duración', param: 'duracion', options: () => DURATION_BUCKETS.map(({ id, label }) => ({ value: id, label })), matches: (c, v) => { const b = DURATION_BUCKETS.find((x) => x.id === v); return !!b && c.duration_hours != null && c.duration_hours >= b.min && c.duration_hours < b.max; } },
  { key: 'institutions', label: 'Institución', param: 'inst', options: (ctx) => ctx.institutions.map((i) => ({ value: i.id, label: i.name })), matches: (c, v) => c.institution_id === v },
  { key: 'levels', label: 'Nivel', param: 'nivel', options: () => fromLabels(LEVEL_LABELS), matches: (c, v) => c.level === v },
  { key: 'certificates', label: 'Certificación', param: 'cert', options: () => fromLabels(CERTIFICATE_LABELS), matches: (c, v) => (c.certificate ? (v === 'incluye' ? true : c.certificate.type === v) : false) }
];

/** Aplica todos los filtros (opcionalmente excepto un grupo, para calcular facetas). */
export function applyFilters(courses: CourseWithInstitution[], state: FilterState, except?: FacetKey): CourseWithInstitution[] {
  return courses.filter((course) =>
    FILTER_GROUPS.every((g) => {
      if (g.key === except) return true;
      const values = state[g.key] as string[];
      return values.length === 0 || values.some((v) => g.matches(course, v, state));
    })
  );
}

/** Conteo por opción considerando el resto de filtros activos. */
export function facetCounts(courses: CourseWithInstitution[], state: FilterState, ctx: FilterContext): Record<FacetKey, Record<string, number>> {
  const out = {} as Record<FacetKey, Record<string, number>>;
  for (const g of FILTER_GROUPS) {
    const base = applyFilters(courses, state, g.key);
    out[g.key] = {};
    for (const opt of g.options(ctx)) out[g.key][opt.value] = base.filter((c) => g.matches(c, opt.value, state)).length;
  }
  return out;
}

export function sortCourses(courses: CourseWithInstitution[], sort: SortKey, relevance?: Map<string, number>): CourseWithInstitution[] {
  const list = [...courses];
  const byRelevance = (a: CourseWithInstitution, b: CourseWithInstitution) => {
    if (relevance && relevance.size) return (relevance.get(b.id) ?? 0) - (relevance.get(a.id) ?? 0);
    // Sin consulta: destacados primero, luego calidad de la información y próximos inicios.
    const q = (c: CourseWithInstitution) => listingQuality(c);
    return q(b) - q(a);
  };
  /** Compara valores numéricos dejando siempre al final los no publicados. */
  const nullsLast = (get: (c: CourseWithInstitution) => number | null, dir: 1 | -1) => (a: CourseWithInstitution, b: CourseWithInstitution) => {
    const x = get(a);
    const y = get(b);
    if (x == null && y == null) return byRelevance(a, b);
    if (x == null) return 1;
    if (y == null) return -1;
    return (x - y) * dir || byRelevance(a, b);
  };
  const cmp: Record<SortKey, (a: CourseWithInstitution, b: CourseWithInstitution) => number> = {
    relevancia: byRelevance,
    'precio-asc': nullsLast(priceInPEN, 1),
    'precio-desc': nullsLast(priceInPEN, -1),
    'duracion-asc': nullsLast((c) => c.duration_hours, 1),
    'duracion-desc': nullsLast((c) => c.duration_hours, -1),
    valoracion: nullsLast((c) => c.rating, -1)
  };
  const sorted = list.sort(cmp[sort]);
  return sort === 'relevancia' && !(relevance && relevance.size) ? diversify(sorted) : sorted;
}

/**
 * Evita que una sola institución acapare las primeras posiciones del listado por defecto:
 * mantiene el orden por calidad pero no repite institución en posiciones consecutivas
 * mientras haya alternativas (los destacados conservan su lugar).
 */
export function diversify(courses: CourseWithInstitution[], window = 2): CourseWithInstitution[] {
  const pending = [...courses];
  const out: CourseWithInstitution[] = [];
  while (pending.length) {
    const recent = new Set(out.slice(-window).map((c) => c.institution_id));
    let idx = pending.findIndex((c) => c.featured || !recent.has(c.institution_id));
    if (idx === -1) idx = 0;
    out.push(pending.splice(idx, 1)[0]);
  }
  return out;
}

export function activeFilterCount(state: FilterState): number {
  return FILTER_GROUPS.reduce((n, g) => n + (state[g.key] as string[]).length, 0);
}

/**
 * Puntaje de "calidad del listing" para ordenar sin consulta: destacados, valoración (si existe),
 * información completa (precio, duración, inicio) y fecha de inicio cercana.
 */
export function listingQuality(c: CourseWithInstitution): number {
  let q = c.featured ? 100 : 0;
  if (c.rating != null) q += c.rating * Math.log10(10 + (c.reviews_count ?? 0));
  q += c.completeness * 10;
  if (c.price != null) q += 3;
  if (c.duration_hours != null) q += 1;
  if (c.start_date) {
    const days = (new Date(c.start_date).getTime() - Date.now()) / 86_400_000;
    if (days >= 0 && days <= 60) q += 3;
  }
  return q;
}

/* ---------------------------- URL <-> estado ---------------------------- */

const SORT_VALUES = new Set(SORT_OPTIONS.map((o) => o.value));

export function filtersFromParams(params: URLSearchParams, routeCategory?: string): FilterState {
  const list = (k: string) => (params.get(k) ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const state: FilterState = { ...EMPTY_FILTERS, q: params.get('q') ?? '' };
  for (const g of FILTER_GROUPS) (state[g.key] as string[]) = list(g.param);
  if (routeCategory && !state.categories.includes(routeCategory)) state.categories = [routeCategory, ...state.categories];
  const sort = params.get('orden') as SortKey | null;
  state.sort = sort && SORT_VALUES.has(sort) ? sort : null;
  state.page = Math.max(1, Number(params.get('pag')) || 1);
  state.currency = params.get('moneda') === 'USD' ? 'USD' : 'PEN';
  return state;
}

export function filtersToParams(state: FilterState, routeCategory?: string): URLSearchParams {
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  for (const g of FILTER_GROUPS) {
    let values = state[g.key] as string[];
    if (g.key === 'categories' && routeCategory) values = values.filter((v) => v !== routeCategory);
    if (values.length) p.set(g.param, values.join(','));
  }
  if (state.sort) p.set('orden', state.sort);
  if (state.page > 1) p.set('pag', String(state.page));
  if (state.currency !== 'PEN') p.set('moneda', state.currency);
  return p;
}
