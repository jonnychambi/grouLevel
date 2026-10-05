import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { CourseGrid } from '../components/course/CourseGrid';
import { FilterDrawer } from '../components/filters/FilterDrawer';
import { FilterSidebar } from '../components/filters/FilterSidebar';
import { SortSelector } from '../components/filters/SortSelector';
import { SearchBar } from '../components/search/SearchBar';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { EmptyState } from '../components/ui/EmptyState';
import { Icon } from '../components/ui/Icon';
import { Pagination } from '../components/ui/Pagination';
import { SITE } from '../config/site';
import { useCatalog } from '../hooks/useCatalog';
import { useSeo } from '../hooks/useSeo';
import { track } from '../services/analytics';
import { queryPrograms } from '../services/catalogService';
import type { Currency } from '../types';
import { activeFilterCount, EMPTY_FILTERS, FILTER_GROUPS, filtersFromParams, filtersToParams, type FacetKey, type FilterState, type SortKey } from '../utils/filters';
import { LEVEL_LABELS, MODALITY_LABELS, PROGRAM_TYPE_LABELS } from '../utils/labels';
import { describeIntent } from '../utils/search';
import { breadcrumbSchema, itemListSchema } from '../utils/schema';

export default function ProgramsPage() {
  const { categoria } = useParams();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const { catalog, loading, error, retry } = useCatalog();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const category = catalog?.categories.find((c) => c.slug === categoria);
  const invalidCategory = !!catalog && !!categoria && !category;
  const routeCategory = category?.id;

  const state = useMemo(() => filtersFromParams(params, routeCategory), [params, routeCategory]);
  const result = useMemo(() => (catalog && !invalidCategory ? queryPrograms(catalog, state, SITE.pageSize) : null), [catalog, state, invalidCategory]);

  const update = useCallback(
    (next: FilterState, opts: { replace?: boolean } = {}) => setParams(filtersToParams(next, routeCategory), { replace: opts.replace, state: location.state }),
    [setParams, routeCategory, location.state]
  );

  // Analítica: búsqueda realizada (una vez por consulta)
  const lastTracked = useRef<string | null>(null);
  useEffect(() => {
    if (!result || !state.q || lastTracked.current === state.q) return;
    lastTracked.current = state.q;
    const intent = result.search ? describeIntent(result.appliedIntent, { type: PROGRAM_TYPE_LABELS, modality: MODALITY_LABELS, level: LEVEL_LABELS }) : [];
    track('search_performed', { query: state.q, results_count: result.total, source: (location.state as { searchSource?: 'home' | 'header' | 'listado' } | null)?.searchSource ?? 'listado', intent });
  }, [result, state.q, location.state]);

  const toggle = (key: FacetKey, value: string) => {
    const current = state[key] as string[];
    const values = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    const next = { ...state, [key]: values, page: 1 } as FilterState;
    update(next);
    if (result) track('filter_applied', { filter: key, value, active_filters: activeFilterCount(next), results_count: result.total });
  };

  const clearFilters = () => update({ ...EMPTY_FILTERS, q: state.q, sort: state.sort, currency: state.currency, categories: routeCategory ? [routeCategory] : [] });
  const setSort = (sort: SortKey) => update({ ...state, sort, page: 1 }, { replace: true });
  const setCurrency = (currency: Currency) => update({ ...state, currency }, { replace: true });
  const setPage = (page: number) => {
    update({ ...state, page });
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const title = category ? `Programas de ${category.name}` : state.q ? `Resultados para “${state.q}”` : 'Programas de tecnología';
  const path = category ? `/programas/${category.slug}` : '/programas';
  const crumbs = [{ label: 'Inicio', to: '/' }, { label: 'Programas', to: '/programas' }, ...(category ? [{ label: category.name }] : [])];

  useSeo({
    title: category ? `Cursos y programas de ${category.name} en Perú` : state.q ? `Programas de ${state.q}` : 'Explora y compara programas de tecnología',
    description: category
      ? `Compara cursos, bootcamps, diplomados y maestrías de ${category.name}: precios, duración, modalidad y certificación. ${category.description}`
      : 'Explora programas de Data, IA, desarrollo de software, cloud, ciberseguridad y más. Filtra por precio, modalidad, duración y nivel.',
    path,
    noindex: !!state.q || activeFilterCount(state) > (routeCategory ? 1 : 0),
    jsonLd: result ? [breadcrumbSchema(crumbs.map((c) => ({ name: c.label, path: c.to ?? path }))), itemListSchema(result.items)] : undefined
  });

  if (error) {
    return (
      <div className="container-page py-16">
        <EmptyState tone="error" icon="alert" title="No pudimos cargar los programas" description="Revisa tu conexión e inténtalo nuevamente." action={<button className="btn btn-primary" onClick={retry}>Reintentar</button>} />
      </div>
    );
  }

  if (invalidCategory) {
    return (
      <div className="container-page py-16">
        <EmptyState icon="search" title="Esta categoría no existe" description="Puede que el enlace esté desactualizado. Explora todas las áreas disponibles." action={<Link to="/programas" className="btn btn-primary">Ver todos los programas</Link>} />
      </div>
    );
  }

  const total = result?.total ?? 0;
  const filtersActive = activeFilterCount(state) - (routeCategory ? 1 : 0);
  const intentLabels = result?.search ? describeIntent(result.appliedIntent, { type: PROGRAM_TYPE_LABELS, modality: MODALITY_LABELS, level: LEVEL_LABELS }) : [];

  const activeChips = result
    ? FILTER_GROUPS.flatMap((g) =>
        (state[g.key] as string[])
          .filter((v) => !(g.key === 'categories' && v === routeCategory))
          .map((v) => ({ key: g.key, value: v, label: g.options(result.filterContext).find((o) => o.value === v)?.label ?? v }))
      )
    : [];

  const panelProps = result && {
    state,
    context: result.filterContext,
    facets: result.facets,
    onToggle: toggle,
    onCurrency: setCurrency,
    onClear: clearFilters,
    locked: routeCategory ? { categories: [routeCategory] } : undefined
  };

  return (
    <div className="container-page pt-8">
      <Breadcrumbs items={crumbs} />
      <header className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-3xl text-white sm:text-4xl">{title}</h1>
          {category && <p className="mt-2 text-gray">{category.description}</p>}
        </div>
        <SearchBar source="listado" initialValue={state.q} className="w-full lg:max-w-md" />
      </header>

      {(intentLabels.length > 0 || result?.search?.approximate) && (
        <div className="mt-5 flex flex-wrap items-center gap-2 text-sm" role="status">
          {intentLabels.length > 0 && (
            <>
              <span className="flex items-center gap-1.5 text-muted"><Icon name="sparkle" size={15} className="text-cyan" /> Interpretamos tu búsqueda como:</span>
              {intentLabels.map((l) => <span key={l} className="rounded-full border border-cyan/30 bg-cyan/5 px-2.5 py-0.5 text-cyan">{l}</span>)}
            </>
          )}
          {result?.search?.approximate && <span className="text-muted">No hubo coincidencias exactas; mostramos los resultados más cercanos.</span>}
        </div>
      )}

      <div className="mt-8 flex gap-10">
        {panelProps && <FilterSidebar {...panelProps} />}

        <div className="min-w-0 flex-1" ref={resultsRef} style={{ scrollMarginTop: 90 }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-gray" aria-live="polite">
              {loading ? 'Buscando programas…' : <><span className="tnum font-semibold text-white">{total}</span> {total === 1 ? 'programa encontrado' : 'programas encontrados'}</>}
            </p>
            <div className="flex items-center gap-2">
              <button className="btn btn-ghost btn-sm lg:hidden" onClick={() => setDrawerOpen(true)} aria-haspopup="dialog">
                <Icon name="sliders" size={16} /> Filtros {filtersActive > 0 && <span className="tnum text-cyan">({filtersActive})</span>}
              </button>
              {result && <SortSelector value={result.effectiveSort} onChange={setSort} hide={catalog?.courses.some((c) => c.rating != null) ? [] : ['valoracion']} />}
            </div>
          </div>

          {activeChips.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Filtros activos">
              {activeChips.map((c) => (
                <li key={`${c.key}-${c.value}`}>
                  <button className="chip border-cyan/30 text-white" onClick={() => toggle(c.key, c.value)} aria-label={`Quitar filtro ${c.label}`}>
                    {c.label} <Icon name="x" size={13} />
                  </button>
                </li>
              ))}
              <li><button className="chip border-transparent text-blue-soft" onClick={clearFilters}>Limpiar filtros</button></li>
            </ul>
          )}

          <div className="mt-6">
            {loading || !result ? (
              <CourseGrid courses={[]} loading skeletons={6} />
            ) : total === 0 ? (
              <EmptyState
                title="No encontramos programas con esos filtros."
                description={state.q ? `Prueba con otra palabra clave o quita algunos filtros. También puedes buscar por herramienta (ej. “Power BI”).` : 'Prueba quitando algunos filtros para ver más opciones.'}
                action={
                  <>
                    {filtersActive > 0 && <button className="btn btn-primary" onClick={clearFilters}>Limpiar filtros</button>}
                    {state.q && <Link className="btn btn-ghost" to={category ? path : '/programas'}>Ver todos los programas</Link>}
                  </>
                }
              />
            ) : (
              <>
                <CourseGrid courses={result.items} source="listado" />
                <Pagination page={result.page} pageCount={result.pageCount} onChange={setPage} />
              </>
            )}
          </div>
        </div>
      </div>

      {panelProps && <FilterDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} total={total} {...panelProps} />}
    </div>
  );
}
