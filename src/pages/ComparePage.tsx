import { useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ComparisonTable, LETTERS } from '../components/compare/ComparisonTable';
import { CompareButton } from '../components/course/CompareButton';
import { InstitutionLogo } from '../components/institution/InstitutionLogo';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { EmptyState } from '../components/ui/EmptyState';
import { Icon } from '../components/ui/Icon';
import { PriceDisplay } from '../components/ui/PriceDisplay';
import { useToast } from '../context/ToastContext';
import { useCatalog } from '../hooks/useCatalog';
import { useCompare } from '../hooks/useCompare';
import { useSeo } from '../hooks/useSeo';
import { track } from '../services/analytics';
import { featuredCourses, getRelated } from '../services/catalogService';
import { keyInsights } from '../utils/compare';
import type { CourseWithInstitution } from '../types';

function Suggestions({ title, courses }: { title: string; courses: CourseWithInstitution[] }) {
  return (
    <section className="mt-10" aria-labelledby="sug-title">
      <h2 id="sug-title" className="mb-4 text-xl text-white">{title}</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((c) => (
          <li key={c.id} className="card flex flex-col gap-3 p-4">
            <div className="flex items-center gap-3">
              <InstitutionLogo institution={c.institution} size={36} />
              <div className="min-w-0">
                <Link to={`/programa/${c.slug}`} className="line-clamp-1 font-medium text-white hover:text-cyan">{c.name}</Link>
                <p className="truncate text-xs text-muted">{c.institution.short_name} · {c.duration_hours} h</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <PriceDisplay course={c} size="sm" showFrom={false} />
              <CompareButton course={c} source="comparador_sugerencia" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ComparePage() {
  const { catalog, loading } = useCatalog();
  const { ids, remove, replace, clear } = useCompare();
  const [params, setParams] = useSearchParams();
  const notify = useToast();

  // Enlace compartible: /comparar?p=slug-a,slug-b
  useEffect(() => {
    const shared = params.get('p');
    if (!catalog || !shared) return;
    const sharedIds = shared.split(',').map((s) => catalog.bySlug.get(s)?.id).filter((x): x is string => !!x);
    if (sharedIds.length) replace(sharedIds);
    setParams({}, { replace: true });
  }, [catalog, params, replace, setParams]);

  const courses = useMemo(() => (catalog ? ids.map((id) => catalog.byId.get(id)).filter((c): c is CourseWithInstitution => !!c) : []), [catalog, ids]);

  const trackedKey = useRef('');
  useEffect(() => {
    const key = courses.map((c) => c.id).join(',');
    if (courses.length >= 2 && trackedKey.current !== key) {
      trackedKey.current = key;
      track('comparison_viewed', { course_ids: courses.map((c) => c.id), institution_ids: courses.map((c) => c.institution_id), count: courses.length });
    }
  }, [courses]);

  useSeo({
    title: courses.length >= 2 ? `Comparar: ${courses.map((c) => c.name).join(' vs ')}` : 'Comparador de programas',
    description: 'Compara hasta 3 programas de tecnología lado a lado: precio, duración, modalidad, certificación, docentes y financiamiento.',
    path: '/comparar',
    noindex: courses.length > 0
  });

  const share = async () => {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}comparar?p=${courses.map((c) => c.slug).join(',')}`;
    try {
      await navigator.clipboard.writeText(url);
      notify('Enlace de la comparación copiado', { tone: 'success' });
    } catch {
      notify('No pudimos copiar el enlace', { tone: 'warning' });
    }
  };

  const header = (
    <>
      <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Comparar' }]} />
      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl text-white sm:text-4xl">Comparador</h1>
          <p className="mt-2 text-gray">Hasta 3 programas lado a lado, con criterios homogéneos.</p>
        </div>
        {courses.length >= 2 && (
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={share}><Icon name="link" size={15} /> Copiar enlace</button>
            <button className="btn btn-quiet btn-sm" onClick={clear}><Icon name="trash" size={15} /> Vaciar</button>
          </div>
        )}
      </div>
    </>
  );

  if (loading || !catalog) {
    return <div className="container-page pt-8">{header}<div className="skeleton mt-8 h-96" /></div>;
  }

  if (courses.length === 0) {
    return (
      <div className="container-page pt-8">
        {header}
        <EmptyState
          className="mt-8"
          icon="compare"
          title="Aún no has seleccionado programas"
          description="Usa el botón “Comparar” en cualquier programa para agregarlo. No necesitas registrarte."
          action={<Link to="/programas" className="btn btn-primary">Explorar programas</Link>}
        />
        <Suggestions title="Empieza con alguno de estos" courses={featuredCourses(catalog, 6)} />
      </div>
    );
  }

  if (courses.length === 1) {
    const only = courses[0];
    return (
      <div className="container-page pt-8">
        {header}
        <div className="card mt-8 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <span className="grid h-8 w-8 place-items-center rounded-full border border-line-strong font-mono text-sm text-cyan">A</span>
          <InstitutionLogo institution={only.institution} size={44} />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-white">{only.name}</p>
            <p className="text-sm text-muted">{only.institution.name}</p>
          </div>
          <button className="btn btn-quiet btn-sm" onClick={() => remove(only.id)}>Quitar</button>
        </div>
        <p className="mt-6 flex items-center gap-2 text-gray" role="status">
          <Icon name="info" size={16} className="text-cyan" /> 1 de 3 programas seleccionados. Agrega otro programa para comparar.
        </p>
        <Suggestions title="Programas similares para comparar" courses={getRelated(catalog, only, 6)} />
      </div>
    );
  }

  const insights = keyInsights(courses, (i) => `${LETTERS[i]} (${courses[i].name})`);

  return (
    <div className="container-page pt-8">
      {header}
      {insights.length > 0 && (
        <section aria-labelledby="ins-title" className="mt-8 rounded-[var(--radius-card)] border border-violet/30 bg-violet/[0.06] p-5">
          <h2 id="ins-title" className="flex items-center gap-2 text-base text-white"><Icon name="sparkle" size={16} className="text-violet-soft" /> Diferencias clave</h2>
          <ul className="mt-3 grid gap-2 text-sm text-gray md:grid-cols-2">
            {insights.map((t) => <li key={t} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-violet-soft" />{t}</li>)}
          </ul>
        </section>
      )}
      <div className="mt-8">
        <ComparisonTable courses={courses} onRemove={remove} />
      </div>
      {courses.length < 3 && (
        <Suggestions title="¿Quieres sumar una tercera opción?" courses={getRelated(catalog, courses[0], 6).filter((c) => !ids.includes(c.id)).slice(0, 3)} />
      )}
      <p className="mt-6 text-xs text-muted">Los montos en USD se convierten a soles con un tipo de cambio referencial para facilitar la comparación.</p>
    </div>
  );
}
