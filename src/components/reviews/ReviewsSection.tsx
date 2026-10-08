import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CourseWithInstitution, Institution, PublicReview, ReviewsSummary } from '../../types';
import { fetchCourseReviews, fetchInstitutionReviews, fetchReviewsSummary } from '../../services/reviewsService';
import { Icon } from '../ui/Icon';
import { RatingSummaryCard, ReviewList } from './ReviewParts';

export const writeReviewHref = (institutionSlug: string, courseSlug?: string) =>
  `/opinar?institucion=${encodeURIComponent(institutionSlug)}${courseSlug ? `&programa=${encodeURIComponent(courseSlug)}` : ''}`;

function useSummary() {
  const [s, setS] = useState<ReviewsSummary | null>(null);
  useEffect(() => { fetchReviewsSummary().then(setS); }, []);
  return s;
}

/**
 * Valoraciones en la ficha del programa: evaluación del programa (complementaria) y reputación de la
 * institución (principal), por separado. Si el programa no tiene reseñas, se muestra la de la institución.
 */
export function ReviewsSection({ course }: { course: CourseWithInstitution }) {
  const [data, setData] = useState<{ reviews: PublicReview[]; institution_reviews: PublicReview[] } | null>(null);
  const summary = useSummary();
  const inst = course.institution;

  useEffect(() => {
    let alive = true;
    setData(null);
    fetchCourseReviews(course.id).then((r) => alive && setData(r));
    return () => { alive = false; };
  }, [course.id]);

  const cs = summary?.courses[course.id];
  const is = summary?.institutions[inst.id];
  const programReviews = data?.reviews ?? [];
  const instReviews = data?.institution_reviews ?? [];
  const fallback = !programReviews.length;

  return (
    <section id="resenas" aria-labelledby="resenas-t" className="scroll-mt-32 border-t border-line pt-10">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="resenas-t" className="text-2xl text-white">Opiniones</h2>
          <p className="mt-1 text-sm text-muted">Reseñas de estudiantes y egresados, moderadas por Groulevel. Publicamos opiniones positivas y críticas.</p>
        </div>
        <div className="flex gap-2">
          {(programReviews.length > 0 || instReviews.length > 0) && <Link to={`/programa/${course.slug}/opiniones`} className="btn btn-quiet btn-sm">Ver todas</Link>}
          <Link to={writeReviewHref(inst.slug, course.slug)} className="btn btn-ghost btn-sm"><Icon name="star" size={15} /> Escribir una reseña</Link>
        </div>
      </div>

      {data === null ? (
        <div className="space-y-3" aria-busy="true"><div className="skeleton h-40" /><div className="skeleton h-24" /></div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <RatingSummaryCard title="Valoración del programa" scope={course.name} kind="programa" summary={cs ?? null} dims={cs?.dims as Record<string, number> | undefined}
              note={fallback ? 'Este programa aún no tiene reseñas propias. Mira la reputación de la institución.' : undefined} />
            <RatingSummaryCard title="Reputación de la institución" scope={inst.name} kind="institucion" summary={is ?? null} dims={is?.dims as Record<string, number> | undefined} recommendPct={is?.recommend_pct} />
          </div>
          <div className="mt-6">
            {fallback ? (
              instReviews.length > 0 && (
                <>
                  <p className="mb-3 text-sm text-gray">Opiniones sobre <span className="text-white">{inst.name}</span> (de este y otros programas):</p>
                  <ReviewList reviews={instReviews} pageSize={4} />
                </>
              )
            ) : (
              <ReviewList reviews={programReviews} pageSize={4} showScope={false} />
            )}
            {!programReviews.length && !instReviews.length && (
              <p className="card p-5 text-sm text-gray">¿Estudiaste en {inst.name}? Tu experiencia ayuda a otros profesionales a decidir. <Link to={writeReviewHref(inst.slug, course.slug)} className="text-cyan hover:underline">Escribe la primera reseña</Link>.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** Reputación de la institución (principal) y sus reseñas, en la ficha de la institución. */
export function InstitutionReviews({ institution, limit = 4 }: { institution: Institution; limit?: number }) {
  const [reviews, setReviews] = useState<PublicReview[] | null>(null);
  const summary = useSummary();
  useEffect(() => {
    let alive = true;
    fetchInstitutionReviews(institution.id).then((r) => alive && setReviews(r));
    return () => { alive = false; };
  }, [institution.id]);
  const is = summary?.institutions[institution.id];
  return (
    <section id="resenas" aria-labelledby="resenas-i" className="mt-12 scroll-mt-32">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="resenas-i" className="text-2xl text-white">Opiniones de estudiantes</h2>
          <p className="mt-1 text-sm text-muted">Calidad académica, docentes, experiencia, cumplimiento y relación calidad-precio.</p>
        </div>
        <div className="flex gap-2">
          {!!reviews?.length && <Link to={`/institucion/${institution.slug}/opiniones`} className="btn btn-quiet btn-sm">Ver todas</Link>}
          <Link to={writeReviewHref(institution.slug)} className="btn btn-ghost btn-sm"><Icon name="star" size={15} /> Escribir una reseña</Link>
        </div>
      </div>
      <RatingSummaryCard title="Reputación de la institución" scope={institution.name} kind="institucion" summary={is ?? null} dims={is?.dims as Record<string, number> | undefined} recommendPct={is?.recommend_pct} />
      <div className="mt-5">
        {reviews === null ? <div className="skeleton h-24" /> : reviews.length ? <ReviewList reviews={reviews} pageSize={limit} /> : (
          <p className="card p-5 text-sm text-gray">¿Estudiaste aquí? <Link to={writeReviewHref(institution.slug)} className="text-cyan hover:underline">Escribe la primera reseña</Link> y ayuda a otros a decidir.</p>
        )}
      </div>
    </section>
  );
}
