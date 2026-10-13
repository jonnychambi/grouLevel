import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnalyzerCta, LinkCards, PageHeader, ProgramsBlock, Sections, Updated } from '../components/content/ContentBlocks';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { Icon } from '../components/ui/Icon';
import { useCatalog } from '../hooks/useCatalog';
import { useSeo } from '../hooks/useSeo';
import { track } from '../services/analytics';
import { CAREERS, COMPARISONS, CONTENT_UPDATED, GUIDES, HUB_META, careerBySlug, careerPath, comparisonPath, coursesForCareer, fitTitle, guidePath, skillBySlug, skillPath } from '../content/seoModel.mjs';
import NotFoundPage from './NotFoundPage';
import { articleSchema, breadcrumbSchema, itemListSchema } from '../utils/schema';

export default function CareersPage() {
  const { slug } = useParams();
  if (!slug) return <CareersHub />;
  const career = careerBySlug.get(slug);
  return career ? <CareerDetail key={slug} slug={slug} /> : <NotFoundPage />;
}

function CareersHub() {
  useSeo({ ...HUB_META.carreras, path: '/carreras', jsonLd: breadcrumbSchema([{ name: 'Inicio', path: '/' }, { name: 'Carreras', path: '/carreras' }]) });
  return (
    <div className="container-page pb-16 pt-8">
      <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Carreras' }]} />
      <PageHeader eyebrow="Tu carrera primero. El curso después." title="Carreras tecnológicas" intro="Conoce qué hace cada rol, qué habilidades pide y una ruta de aprendizaje para llegar. Después, analiza tu perfil para descubrir qué te falta." />
      <ul className="mt-10 grid gap-4 md:grid-cols-2">
        {CAREERS.map((c) => (
          <li key={c.slug}>
            <Link to={careerPath(c.slug)} className="card group flex h-full flex-col gap-3 p-6 transition-colors hover:border-cyan/40">
              <span className="flex items-center justify-between gap-3 text-xl font-medium text-white group-hover:text-cyan">{c.name}<Icon name="arrow-right" size={18} className="text-dim group-hover:text-cyan" /></span>
              <span className="text-gray">{c.description}</span>
              <span className="mt-auto flex flex-wrap gap-1.5 pt-2">
                {(c.skills ?? []).slice(0, 5).map((s) => <span key={s} className="chip pointer-events-none">{skillBySlug.get(s)?.name ?? s}</span>)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <AnalyzerCta />
    </div>
  );
}

function CareerDetail({ slug }: { slug: string }) {
  const career = careerBySlug.get(slug)!;
  const { catalog, loading } = useCatalog();
  const related = useMemo(() => (catalog ? coursesForCareer(career, catalog.courses).slice(0, 12) : []), [catalog, career]);
  const path = careerPath(slug);
  useSeo({
    title: fitTitle(career.title), description: career.description, path, type: 'article',
    jsonLd: [breadcrumbSchema([{ name: 'Inicio', path: '/' }, { name: 'Carreras', path: '/carreras' }, { name: career.name, path }]), articleSchema(path, career.title, career.description, CONTENT_UPDATED), ...(related.length ? [itemListSchema(related)] : [])]
  });
  useEffect(() => {
    if (catalog) track('career_viewed', { career: slug, programs_count: related.length });
  }, [catalog, slug, related.length]);

  const comps = COMPARISONS.filter((x) => x.careers?.includes(slug));
  const guides = GUIDES.filter((x) => x.careers?.includes(slug));
  return (
    <div className="container-page pb-16 pt-8">
      <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Carreras', to: '/carreras' }, { label: career.name }]} />
      <PageHeader eyebrow="Carrera tecnológica" title={career.h1} intro={career.intro}>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to={`/analizar-perfil?objetivo=${encodeURIComponent(`Quiero ser ${career.name}`)}`} className="btn btn-accent h-auto max-w-full whitespace-normal py-3 text-left"><Icon name="sparkle" size={16} className="shrink-0" />Descubre qué te falta para alcanzar este rol</Link>
        </div>
      </PageHeader>
      <div className="mt-12"><Sections sections={career.sections} /></div>
      <LinkCards title="Habilidades clave" items={(career.skills ?? []).map((s) => skillBySlug.get(s)).filter((s) => !!s).map((s) => ({ to: skillPath(s!.slug), label: s!.name, hint: s!.description }))} />
      <section className="mt-14">
        <h2 className="text-2xl text-white sm:text-3xl">Programas relacionados</h2>
        <p className="mt-2 text-sm text-muted">Programas del catálogo que enseñan las habilidades de este rol. Revisa en cada ficha el temario y las condiciones.</p>
        {loading ? <div className="skeleton mt-5 h-40" /> : <ProgramsBlock courses={related} source="listado" moreTo="/programas" moreLabel="Explorar todos los programas" />}
      </section>
      <LinkCards title="Sigue leyendo" items={[...comps.map((x) => ({ to: comparisonPath(x.slug), label: x.h1 })), ...guides.map((x) => ({ to: guidePath(x.slug), label: x.h1 }))]} />
      <AnalyzerCta title="Descubre qué te falta para alcanzar este rol" objective={`Quiero ser ${career.name}`} />
      <Updated date={CONTENT_UPDATED} />
    </div>
  );
}
