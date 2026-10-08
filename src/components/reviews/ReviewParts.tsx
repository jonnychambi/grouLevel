import { useMemo, useState } from 'react';
import type { PublicReview, RatingSummary } from '../../types';
import { reportReview, ReviewApiError } from '../../services/reviewsService';
import { filterReviews, INSTITUTION_DIMENSIONS, PROGRAM_DIMENSIONS, RELATIONSHIP_LABELS, reviewAge, STUDENT_STATUS_LABELS, type ReviewFilter } from '../../utils/reviews';
import { formatDate } from '../../utils/format';
import { Icon } from '../ui/Icon';
import { Modal } from '../ui/Modal';
import { Stars } from './Stars';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Promedio grande, estrellas, cantidad y valoración por dimensiones. */
export function RatingSummaryCard({ title, scope, summary, dims, kind, recommendPct, note }: {
  title: string;
  scope?: string;
  summary: RatingSummary | null;
  dims?: Record<string, number>;
  kind: 'institucion' | 'programa';
  recommendPct?: number | null;
  note?: string;
}) {
  const defs = kind === 'institucion' ? INSTITUTION_DIMENSIONS : PROGRAM_DIMENSIONS;
  const has = !!summary?.count;
  return (
    <div className="card p-5">
      <p className="label-mono">{title}</p>
      {scope && <p className="mt-1 text-sm text-gray">{scope}</p>}
      {has ? (
        <div className="mt-3 grid gap-5 sm:grid-cols-[150px_1fr]">
          <div>
            <p className="tnum text-5xl font-semibold tracking-tight text-white">{summary!.avg.toFixed(1)}</p>
            <Stars value={summary!.avg} size={16} className="mt-1" />
            <p className="mt-1 text-sm text-muted">{plural(summary!.count, 'opinión', 'opiniones')}</p>
            {recommendPct != null && <p className="mt-2 text-sm text-gray"><span className="tnum text-white">{recommendPct}%</span> la recomienda</p>}
          </div>
          <dl className="space-y-2">
            {defs.map((d) => {
              const v = dims?.[d.key];
              return (
                <div key={d.key} className="text-sm" title={d.hint}>
                  <div className="flex justify-between gap-3"><dt className="text-gray">{d.label}</dt><dd className="tnum text-white">{v != null ? v.toFixed(1) : '—'}</dd></div>
                  <div className="mt-1 h-1.5 rounded-full bg-raise"><div className="h-full rounded-full bg-warn" style={{ width: v != null ? `${(v / 5) * 100}%` : 0 }} /></div>
                </div>
              );
            })}
          </dl>
        </div>
      ) : (
        <p className="mt-3 text-sm text-gray">Aún no hay opiniones publicadas.</p>
      )}
      {note && <p className="mt-4 rounded-lg border border-line bg-navy/50 px-3 py-2 text-xs text-gray"><Icon name="info" size={13} className="mr-1 inline text-cyan" />{note}</p>}
    </div>
  );
}

const REASONS: [string, string][] = [['falsa', 'Parece falsa o no es una experiencia real'], ['ofensiva', 'Lenguaje ofensivo'], ['publicidad', 'Es publicidad o spam'], ['datos_personales', 'Expone datos personales'], ['conflicto_interes', 'Conflicto de interés (p. ej. trabaja en la institución)'], ['otro', 'Otro motivo']];

function ReportButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');
  const submit = async () => {
    setState('sending');
    setError('');
    try {
      await reportReview(id, reason, details);
      setState('done');
    } catch (e) {
      setError(e instanceof ReviewApiError ? e.message : 'No se pudo enviar.');
      setState('idle');
    }
  };
  return (
    <>
      <button className="text-xs text-muted hover:text-white" onClick={() => setOpen(true)}>Reportar</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Reportar reseña" description="Revisaremos la reseña. Tu reporte es anónimo.">
        {state === 'done' ? (
          <div className="text-sm text-gray"><p className="text-white">Gracias, recibimos tu reporte.</p><button className="btn btn-primary btn-sm mt-4" onClick={() => setOpen(false)}>Cerrar</button></div>
        ) : (
          <div className="space-y-3">
            <fieldset className="space-y-1.5">
              <legend className="sr-only">Motivo</legend>
              {REASONS.map(([v, l]) => (
                <label key={v} className="flex items-center gap-2 text-sm text-gray"><input type="radio" name={`r-${id}`} className="accent-violet" checked={reason === v} onChange={() => setReason(v)} />{l}</label>
              ))}
            </fieldset>
            <textarea className="input py-2 text-sm" rows={3} placeholder="Detalles (opcional)" maxLength={600} value={details} onChange={(e) => setDetails(e.target.value)} />
            {error && <p className="text-sm text-neg">{error}</p>}
            <button className="btn btn-primary btn-sm" disabled={!reason || state === 'sending'} onClick={() => void submit()}>{state === 'sending' ? 'Enviando…' : 'Enviar reporte'}</button>
          </div>
        )}
      </Modal>
    </>
  );
}

/** Una reseña: calificación, alcance, insignias, lo mejor / a mejorar, antigüedad y autor abreviado. */
export function ReviewCard({ r, showScope = true }: { r: PublicReview; showScope?: boolean }) {
  const status = r.student_status ? STUDENT_STATUS_LABELS[r.student_status] : RELATIONSHIP_LABELS[r.relationship];
  return (
    <article className="card p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Stars value={r.rating} size={15} />
        <span className="tnum text-sm font-medium text-white">{r.rating.toFixed(1)}</span>
        {showScope && <span className="text-sm text-gray">{r.kind === 'institucion' ? r.institution_name : 'Programa'}{r.course_name ? ` · ${r.course_name}` : ''}</span>}
        <span className="ml-auto flex flex-wrap gap-1.5">
          {r.verified && <span className="inline-flex items-center gap-1 rounded-full border border-pos/40 bg-pos/10 px-2 py-0.5 text-[11px] text-pos" title="Groulevel revisó una constancia o certificado de estudios"><Icon name="check" size={11} strokeWidth={3} />Reseña verificada</span>}
          {r.incentivized && <span className="rounded-full border border-line-strong px-2 py-0.5 text-[11px] text-gray" title="La persona recibe un incentivo por opinar. El incentivo no depende de la calificación.">Incentivada</span>}
        </span>
      </div>
      {r.program_scores && r.program_rating != null && r.kind === 'institucion' && (
        <p className="mt-2 text-xs text-gray">Programa cursado: <span className="tnum text-white">★ {r.program_rating.toFixed(1)}</span> · {PROGRAM_DIMENSIONS.map((d) => `${d.label} ${r.program_scores![d.key]}`).join(' · ')}</p>
      )}
      {r.best || r.improve ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {r.best && <div><p className="text-xs font-medium uppercase tracking-wider text-pos">Lo mejor</p><p className="mt-1 whitespace-pre-line text-sm text-gray">{r.best}</p></div>}
          {r.improve && <div><p className="text-xs font-medium uppercase tracking-wider text-warn">Debería mejorar</p><p className="mt-1 whitespace-pre-line text-sm text-gray">{r.improve}</p></div>}
        </div>
      ) : (
        <>
          {r.title && <h3 className="mt-2 text-base font-medium text-white">{r.title}</h3>}
          <p className="mt-2 whitespace-pre-line text-sm text-gray">{r.comment}</p>
        </>
      )}
      {r.recommend != null && <p className={`mt-3 text-sm ${r.recommend ? 'text-pos' : 'text-neg'}`}>{r.recommend ? '✓ Recomienda la institución' : '✗ No recomienda la institución'}</p>}
      <p className="mt-3 flex flex-wrap items-center gap-x-2 text-xs text-muted">
        <span className="text-white">{r.author_name}</span>·<span>{status}{r.study_year ? ` (${r.study_year})` : ''}</span>·
        <time dateTime={r.created_at} title={formatDate(r.created_at.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' })}>{reviewAge(r.created_at)}</time>
        <span className="ml-auto"><ReportButton id={r.id} /></span>
      </p>
      {r.reply && (
        <div className="mt-3 rounded-xl border border-line bg-navy/60 p-3 text-sm">
          <p className="label-mono mb-1 text-[10px]">Respuesta</p>
          <p className="text-gray">{r.reply}</p>
        </div>
      )}
    </article>
  );
}

const DEFAULT_FILTER: ReviewFilter = { period: 'todas', tone: 'todas', status: 'todas' };

/** Lista de reseñas con filtros por fecha, calificación y tipo de experiencia (recientes primero). */
export function ReviewList({ reviews, pageSize = 6, showScope = true }: { reviews: PublicReview[]; pageSize?: number; showScope?: boolean }) {
  const [f, setF] = useState<ReviewFilter>(DEFAULT_FILTER);
  const [shown, setShown] = useState(pageSize);
  const list = useMemo(() => filterReviews(reviews, f), [reviews, f]);
  const counts = useMemo(() => ({ pos: reviews.filter((r) => r.rating >= 4).length, crit: reviews.filter((r) => r.rating <= 2).length }), [reviews]);
  if (!reviews.length) return null;
  const sel = 'h-9 rounded-full border border-line-strong bg-midnight px-3 text-sm text-white';
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Calificación" className={sel} value={f.tone} onChange={(e) => setF({ ...f, tone: e.target.value as ReviewFilter['tone'] })}>
          <option value="todas">Todas las calificaciones</option>
          <option value="positivas">Positivas (4–5★) · {counts.pos}</option>
          <option value="neutras">Neutras (3★)</option>
          <option value="criticas">Críticas (1–2★) · {counts.crit}</option>
        </select>
        <select aria-label="Fecha" className={sel} value={f.period} onChange={(e) => setF({ ...f, period: e.target.value as ReviewFilter['period'] })}>
          <option value="todas">Cualquier fecha</option>
          <option value="ultimos-6-meses">Últimos 6 meses</option>
          <option value="ultimo-ano">Último año</option>
        </select>
        <select aria-label="Tipo de experiencia" className={sel} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as ReviewFilter['status'] })}>
          <option value="todas">Todas las experiencias</option>
          <option value="egresado">Egresados</option>
          <option value="estudiante">Estudiantes</option>
          <option value="verificadas">Solo verificadas</option>
        </select>
        <span className="text-sm text-muted">{plural(list.length, 'opinión', 'opiniones')} · más recientes primero</span>
      </div>
      {list.length ? (
        <ul className="mt-4 space-y-3">{list.slice(0, shown).map((r) => <li key={r.id}><ReviewCard r={r} showScope={showScope} /></li>)}</ul>
      ) : (
        <p className="mt-4 text-sm text-gray">No hay opiniones con estos filtros.</p>
      )}
      {list.length > shown && <button className="btn btn-ghost btn-sm mt-4" onClick={() => setShown((s) => s + pageSize)}>Ver más ({list.length - shown})</button>}
    </div>
  );
}
