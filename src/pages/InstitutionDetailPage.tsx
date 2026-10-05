import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CourseGrid } from '../components/course/CourseGrid';
import { InstitutionLogo } from '../components/institution/InstitutionLogo';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { EmptyState } from '../components/ui/EmptyState';
import { Icon } from '../components/ui/Icon';
import { Stars } from '../components/reviews/Stars';
import { useCatalog } from '../hooks/useCatalog';
import { useSeo } from '../hooks/useSeo';
import { track } from '../services/analytics';
import { coursesByInstitution } from '../services/catalogService';
import { MODALITY_LABELS, PROGRAM_TYPE_LABELS } from '../utils/labels';
import { breadcrumbSchema, organizationSchema } from '../utils/schema';

export default function InstitutionDetailPage() {
  const { slug = '' } = useParams();
  const { catalog, loading } = useCatalog();
  const institution = catalog?.institutions.find((i) => i.slug === slug);
  const programs = useMemo(() => (catalog && institution ? coursesByInstitution(catalog, institution.id) : []), [catalog, institution]);

  useEffect(() => {
    if (institution) track('institution_viewed', { institution_id: institution.id, programs_count: programs.length });
  }, [institution, programs.length]);

  useSeo(
    institution
      ? {
          title: `${institution.name}: programas y cursos`,
          description: `${institution.description.slice(0, 140)} Compara sus ${programs.length} programas en Groulevel.`,
          path: `/institucion/${institution.slug}`,
          jsonLd: [organizationSchema(institution), breadcrumbSchema([{ name: 'Inicio', path: '/' }, { name: 'Instituciones', path: '/instituciones' }, { name: institution.name, path: `/institucion/${institution.slug}` }])]
        }
      : { title: 'Institución', noindex: true }
  );

  if (loading) return <div className="container-page py-10"><div className="skeleton h-40" /><div className="skeleton mt-6 h-96" /></div>;
  if (!institution || !catalog) {
    return <div className="container-page py-16"><EmptyState title="No encontramos esta institución" action={<Link to="/instituciones" className="btn btn-primary">Ver instituciones</Link>} /></div>;
  }

  const categories = [...new Set(programs.map((p) => p.category))].map((id) => catalog.categories.find((c) => c.id === id)!).filter(Boolean);
  const modalities = [...new Set(programs.map((p) => p.modality).filter((m): m is NonNullable<typeof m> => !!m))];
  const types = [...new Set(programs.map((p) => p.program_type))];

  return (
    <div className="container-page pt-8">
      <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Instituciones', to: '/instituciones' }, { label: institution.name }]} />

      <header className="card mt-6 grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="flex items-center gap-4">
            <InstitutionLogo institution={institution} size={72} />
            <div>
              <h1 className="text-3xl text-white sm:text-4xl">{institution.name}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                <span>{institution.type}</span>
                <span className="flex items-center gap-1"><Icon name="map-pin" size={14} />{institution.city && institution.city !== institution.country ? `${institution.city}, ${institution.country}` : institution.country}</span>
                {institution.founded && <span>Desde {institution.founded}</span>}
              </p>
            </div>
          </div>
          {institution.rating != null && (institution.reviews_count ?? 0) > 0 && (
            <p className="mt-5 flex items-center gap-2"><Stars value={institution.rating} size={18} /><span className="tnum text-lg font-semibold text-white">{institution.rating.toFixed(1)}</span><span className="text-sm text-muted">· {institution.reviews_count} {institution.reviews_count === 1 ? 'reseña' : 'reseñas'} de sus programas</span></p>
          )}
          <p className="mt-6 max-w-2xl text-lg text-gray">{institution.description}</p>
          <ul className="mt-5 flex flex-wrap gap-2">{institution.accreditations.map((a) => <li key={a} className="chip"><Icon name="shield" size={14} />{a}</li>)}</ul>
          <a href={institution.website} target="_blank" rel="noopener noreferrer nofollow" className="mt-6 inline-flex items-center gap-1.5 text-sm text-blue-soft hover:text-white">
            <Icon name="globe" size={15} /> Sitio web <Icon name="external" size={13} />
          </a>
        </div>
        <dl className="grid content-start gap-4 rounded-2xl border border-line bg-navy/50 p-5 text-sm">
          <div><dt className="label-mono">Programas</dt><dd className="tnum mt-1 text-3xl font-semibold text-white">{programs.length}</dd></div>
          <div><dt className="label-mono">Categorías</dt><dd className="mt-2 flex flex-wrap gap-1.5">{categories.map((c) => <Link key={c.id} to={`/programas/${c.slug}`} className="chip py-1 text-xs">{c.name}</Link>)}</dd></div>
          <div><dt className="label-mono">Modalidades</dt><dd className="mt-1 text-white">{modalities.map((m) => MODALITY_LABELS[m]).join(' · ')}</dd></div>
          <div><dt className="label-mono">Tipos</dt><dd className="mt-1 text-white">{types.map((t) => PROGRAM_TYPE_LABELS[t]).join(' · ')}</dd></div>
        </dl>
      </header>

      <section className="mt-12" aria-labelledby="progs">
        <h2 id="progs" className="mb-6 text-2xl text-white">Programas disponibles</h2>
        <CourseGrid courses={programs} source="institucion" />
      </section>
    </div>
  );
}
