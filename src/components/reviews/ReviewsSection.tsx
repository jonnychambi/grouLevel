import { useEffect, useMemo, useState } from 'react';
import type { CourseWithInstitution, PublicReview } from '../../types';
import { fetchCourseReviews } from '../../services/reviewsService';
import { formatDate } from '../../utils/format';
import { RELATIONSHIP_LABELS, sortReviews, summarize } from '../../utils/reviews';
import { Icon } from '../ui/Icon';
import { ReviewModal } from './ReviewModal';
import { Stars } from './Stars';

const PAGE = 5;

/** Valoraciones del programa: resumen, distribución, reseñas aprobadas y formulario. */
export function ReviewsSection({ course }: { course: CourseWithInstitution }) {
  const [reviews, setReviews] = useState<PublicReview[] | null>(null);
  const [order, setOrder] = useState<'recientes' | 'mejores' | 'peores'>('recientes');
  const [shown, setShown] = useState(PAGE);
  const [writing, setWriting] = useState(false);

  useEffect(() => {
    let alive = true;
    setReviews(null);
    fetchCourseReviews(course.id).then((r) => alive && setReviews(r));
    return () => { alive = false; };
  }, [course.id]);

  const summary = useMemo(() => summarize((reviews ?? []).map((r) => r.rating)), [reviews]);
  const sorted = useMemo(() => sortReviews(reviews ?? [], order), [reviews, order]);
  const inst = course.institution;

  return (
    <section id="resenas" aria-labelledby="resenas-t" className="scroll-mt-32 border-t border-line pt-10">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h2 id="resenas-t" className="text-2xl text-white">Valoraciones</h2>
        <button className="btn btn-ghost btn-sm" onClick={() => setWriting(true)}><Icon name="star" size={15} /> Escribir una reseña</button>
      </div>

      {reviews === null ? (
        <div className="space-y-3" aria-busy="true"><div className="skeleton h-28" /><div className="skeleton h-24" /></div>
      ) : (
        <>
          <div className="card grid gap-6 p-5 sm:grid-cols-[200px_1fr]">
            <div className="text-center sm:border-r sm:border-line sm:pr-6 sm:text-left">
              {summary.count ? (
                <>
                  <p className="tnum text-5xl font-semibold tracking-tight text-white">{summary.avg.toFixed(1)}</p>
                  <Stars value={summary.avg} size={18} className="mt-1" />
                  <p className="mt-1 text-sm text-muted">{summary.count} {summary.count === 1 ? 'reseña' : 'reseñas'} verificadas</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-medium text-white">Aún sin reseñas</p>
                  <p className="mt-1 text-sm text-muted">¿Estudiaste este programa? Ayuda a otros a decidir.</p>
                </>
              )}
            </div>
            <div className="space-y-1.5">
              {[5, 4, 3, 2, 1].map((n) => {
                const c = summary.distribution[n - 1];
                return (
                  <div key={n} className="flex items-center gap-3 text-sm">
                    <span className="tnum w-6 text-gray">{n}★</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-raise"><div className="h-full rounded-full bg-warn" style={{ width: summary.count ? `${(c / summary.count) * 100}%` : 0 }} /></div>
                    <span className="tnum w-8 text-right text-muted">{c}</span>
                  </div>
                );
              })}
              {inst.rating != null && (inst.reviews_count ?? 0) > 0 && (
                <p className="pt-2 text-xs text-muted">
                  {inst.name}: <span className="text-white">★ {inst.rating.toFixed(1)}</span> en {inst.reviews_count} {inst.reviews_count === 1 ? 'reseña' : 'reseñas'} de sus programas.
                </p>
              )}
            </div>
          </div>

          {sorted.length > 0 && (
            <>
              <div className="mt-5 flex items-center justify-between">
                <p className="text-sm text-muted">Reseñas validadas por el equipo de Groulevel.</p>
                <label className="flex items-center gap-2 text-sm text-muted">
                  Ordenar
                  <select className="h-9 rounded-full border border-line-strong bg-midnight px-3 text-sm text-white" value={order} onChange={(e) => setOrder(e.target.value as typeof order)}>
                    <option value="recientes">Más recientes</option>
                    <option value="mejores">Mejor valoradas</option>
                    <option value="peores">Peor valoradas</option>
                  </select>
                </label>
              </div>
              <ul className="mt-3 space-y-3">
                {sorted.slice(0, shown).map((r) => (
                  <li key={r.id} className="card p-5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Stars value={r.rating} size={15} />
                      {r.title && <h3 className="text-base font-medium text-white">{r.title}</h3>}
                    </div>
                    <p className="mt-2 whitespace-pre-line text-gray">{r.comment}</p>
                    <p className="mt-3 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                      <span className="text-white">{r.author_name}</span>·
                      <span className={r.relationship === 'egresado' ? 'text-pos' : ''}>{RELATIONSHIP_LABELS[r.relationship]}</span>·
                      <span>{formatDate(r.created_at.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </p>
                    {r.reply && (
                      <div className="mt-3 rounded-xl border border-line bg-navy/60 p-3 text-sm">
                        <p className="label-mono mb-1 text-[10px]">Respuesta</p>
                        <p className="text-gray">{r.reply}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {sorted.length > shown && <button className="btn btn-ghost btn-sm mt-4" onClick={() => setShown((s) => s + PAGE)}>Ver más reseñas ({sorted.length - shown})</button>}
            </>
          )}
        </>
      )}

      {writing && <ReviewModal course={course} onClose={() => setWriting(false)} />}
    </section>
  );
}
