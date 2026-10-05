import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { InstitutionCard } from '../components/institution/InstitutionCard';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { EmptyState } from '../components/ui/EmptyState';
import { useCatalog } from '../hooks/useCatalog';
import { useSeo } from '../hooks/useSeo';

export default function InstitutionsPage() {
  const { catalog, loading, error, retry } = useCatalog();
  useSeo({ title: 'Instituciones', description: 'Universidades, escuelas de negocio, academias y bootcamps de tecnología. Conoce sus programas y compáralos.', path: '/instituciones' });

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    catalog?.courses.forEach((c) => m.set(c.institution_id, (m.get(c.institution_id) ?? 0) + 1));
    return m;
  }, [catalog]);

  return (
    <div className="container-page pt-8">
      <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Instituciones' }]} />
      <header className="mt-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-3xl text-white sm:text-4xl">Instituciones</h1>
          <p className="mt-2 text-gray">Universidades, escuelas de negocio, academias especializadas y bootcamps. Compara sus programas con la misma información.</p>
        </div>
        <Link to="/instituciones/partners" className="btn btn-ghost btn-sm self-start md:self-auto">¿Eres una institución?</Link>
      </header>

      {error ? (
        <EmptyState className="mt-8" tone="error" icon="alert" title="No pudimos cargar las instituciones" action={<button className="btn btn-primary" onClick={retry}>Reintentar</button>} />
      ) : (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading || !catalog
            ? Array.from({ length: 6 }, (_, i) => <li key={i}><div className="skeleton h-56" /></li>)
            : [...catalog.institutions]
                .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
                .map((i) => <li key={i.id}><InstitutionCard institution={i} programs={counts.get(i.id) ?? 0} /></li>)}
        </ul>
      )}
    </div>
  );
}
