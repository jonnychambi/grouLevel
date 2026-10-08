import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { RatingSummaryCard, ReviewList } from '../components/reviews/ReviewParts';
import { writeReviewHref } from '../components/reviews/ReviewsSection';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { EmptyState } from '../components/ui/EmptyState';
import { Icon } from '../components/ui/Icon';
import { useCatalog } from '../hooks/useCatalog';
import { useSeo } from '../hooks/useSeo';
import { fetchCourseReviews, fetchInstitutionReviews, fetchReviewsSummary } from '../services/reviewsService';
import type { PublicReview, ReviewsSummary } from '../types';
import { breadcrumbSchema, courseSchema, organizationSchema } from '../utils/schema';

/** Página de opiniones de una institución (/institucion/:slug/opiniones) o de un programa (/programa/:slug/opiniones). */
export default function ReviewsPage({ scope }: { scope: 'institucion' | 'programa' }) {
  const { slug } = useParams();
  const { catalog, loading } = useCatalog();
  const course = scope === 'programa' ? catalog?.bySlug.get(slug ?? '') : undefined;
  const institution = scope === 'institucion' ? catalog?.institutions.find((i) => i.slug === slug) : course?.institution;
  const [reviews, setReviews] = useState<{ program: PublicReview[]; institution: PublicReview[] } | null>(null);
  const [summary, setSummary] = useState<ReviewsSummary | null>(null);

  useEffect(() => { fetchReviewsSummary().then(setSummary); }, []);
  useEffect(() => {
    let alive = true;
    if (course) fetchCourseReviews(course.id).then((r) => alive && setReviews({ program: r.reviews, institution: r.institution_reviews }));
    else if (institution) fetchInstitutionReviews(institution.id).then((r) => alive && setReviews({ program: [], institution: r }));
    return () => { alive = false; };
  }, [course, institution]);

  const is = institution ? summary?.institutions[institution.id] : undefined;
  const cs = course ? summary?.courses[course.id] : undefined;
  const name = course ? course.name : institution?.name ?? '';
  const path = course ? `/programa/${course.slug}/opiniones` : `/institucion/${institution?.slug}/opiniones`;
  const count = (course ? cs?.count : is?.count) ?? 0;
  const crumbs = course
    ? [{ label: 'Inicio', to: '/' }, { label: 'Programas', to: '/programas' }, { label: course.name, to: `/programa/${course.slug}` }, { label: 'Opiniones' }]
    : [{ label: 'Inicio', to: '/' }, { label: 'Instituciones', to: '/instituciones' }, { label: institution?.name ?? '', to: `/institucion/${institution?.slug}` }, { label: 'Opiniones' }];

  useSeo(
    institution
      ? {
          title: `Opiniones de ${name}${course ? ` (${institution.short_name ?? institution.name})` : ''}`,
          description: count
            ? `${count} opiniones de estudiantes y egresados sobre ${name}: calidad académica, docentes, cumplimiento y relación calidad-precio. Reseñas moderadas y verificadas.`
            : `Opiniones de estudiantes y egresados sobre ${name}. Comparte tu experiencia en Groulevel.`,
          path,
          noindex: count === 0,
          jsonLd: [
            breadcrumbSchema(crumbs.map((c) => ({ name: c.label, path: c.to ?? path }))),
            course ? courseSchema(course, reviews?.program ?? []) : organizationSchema(institution, reviews?.institution ?? [])
          ]
        }
      : { title: 'Opiniones', noindex: true }
  );

  if (loading) return <div className="container-page py-10"><div className="skeleton h-40" /></div>;
  if (!institution) return <div className="container-page py-16"><EmptyState title="No encontramos esta página" action={<Link to="/programas" className="btn btn-primary">Ver programas</Link>} /></div>;

  const list = course ? (reviews?.program.length ? reviews.program : reviews?.institution ?? []) : reviews?.institution ?? [];
  return (
    <div className="container-page max-w-5xl pt-8 pb-16">
      <Breadcrumbs items={crumbs} />
      <header className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <h1 className="text-3xl text-white sm:text-4xl">Opiniones de {name}</h1>
          <p className="mt-2 text-gray">Experiencias de estudiantes y egresados, moderadas por Groulevel. Publicamos opiniones positivas y críticas; las verificadas presentaron constancia de estudios.</p>
        </div>
        <Link to={writeReviewHref(institution.slug, course?.slug)} className="btn btn-accent btn-sm"><Icon name="star" size={15} /> Escribir una reseña</Link>
      </header>
      <div className={`mt-6 grid gap-4 ${course ? 'lg:grid-cols-2' : ''}`}>
        {course && <RatingSummaryCard title="Valoración del programa" scope={course.name} kind="programa" summary={cs ?? null} dims={cs?.dims as Record<string, number> | undefined}
          note={!cs?.count ? 'Este programa aún no tiene reseñas propias: abajo, opiniones sobre la institución.' : undefined} />}
        <RatingSummaryCard title="Reputación de la institución" scope={institution.name} kind="institucion" summary={is ?? null} dims={is?.dims as Record<string, number> | undefined} recommendPct={is?.recommend_pct} />
      </div>
      <div className="mt-8">
        {reviews === null ? <div className="skeleton h-32" /> : list.length ? <ReviewList reviews={list} pageSize={10} showScope={!course || !reviews.program.length} /> : (
          <p className="card p-5 text-sm text-gray">Aún no hay opiniones publicadas. <Link to={writeReviewHref(institution.slug, course?.slug)} className="text-cyan hover:underline">Sé la primera persona en opinar</Link>.</p>
        )}
      </div>
      <p className="mt-8 text-sm text-muted">
        {course ? <Link to={`/programa/${course.slug}`} className="text-blue-soft hover:text-white">← Volver al programa</Link> : <Link to={`/institucion/${institution.slug}`} className="text-blue-soft hover:text-white">← Ver programas de {institution.name}</Link>}
      </p>
    </div>
  );
}
