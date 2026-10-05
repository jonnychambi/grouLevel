import { useCallback, useEffect, useMemo, useState } from 'react';
import { deleteReviewRecord, fetchReviews, moderateReview, type StoredReview } from '../../services/adminApi';
import type { ReviewStatus } from '../../types';
import { RELATIONSHIP_LABELS } from '../../utils/reviews';
import { normalize } from '../../utils/text';
import { Stars } from '../reviews/Stars';
import { Icon } from '../ui/Icon';

const STATUS_LABELS: Record<ReviewStatus, string> = { pendiente: 'Pendientes', aprobada: 'Aprobadas', rechazada: 'Rechazadas' };
const when = (iso: string) => new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Moderación de reseñas: solo las aprobadas se publican y cuentan en los promedios. */
export function ReviewsPanel({ onError, onNotice }: { onError: (e: unknown) => void; onNotice: (text: string) => void }) {
  const [reviews, setReviews] = useState<StoredReview[] | null>(null);
  const [tab, setTab] = useState<ReviewStatus>('pendiente');
  const [q, setQ] = useState('');
  const [stars, setStars] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [replying, setReplying] = useState<string | null>(null);
  const [reply, setReply] = useState('');

  const load = useCallback(async () => {
    try {
      setReviews((await fetchReviews()).reviews);
    } catch (e) {
      onError(e);
      setReviews([]);
    }
  }, [onError]);
  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => {
    const c: Record<ReviewStatus, number> = { pendiente: 0, aprobada: 0, rechazada: 0 };
    (reviews ?? []).forEach((r) => c[r.status]++);
    return c;
  }, [reviews]);

  const rows = useMemo(() => {
    const nq = normalize(q);
    return (reviews ?? [])
      .filter((r) => r.status === tab && (!stars || r.rating === Number(stars)) && (!nq || normalize(`${r.course_name} ${r.institution_name} ${r.author_name} ${r.author_email} ${r.comment} ${r.title}`).includes(nq)))
      .sort((a, b) => (tab === 'pendiente' ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at)));
  }, [reviews, tab, q, stars]);

  const act = async (r: StoredReview, patch: Parameters<typeof moderateReview>[1], message: string) => {
    setBusy(r.pathname);
    try {
      const { review } = await moderateReview(r.pathname, patch);
      setReviews((list) => (list ?? []).map((x) => (x.pathname === review.pathname ? review : x)));
      onNotice(message);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(null);
    }
  };

  const reject = (r: StoredReview) => {
    const reason = window.prompt('Motivo del rechazo (interno, opcional): ej. lenguaje ofensivo, spam, no es sobre el programa…', r.rejection_reason ?? '');
    if (reason === null) return;
    void act(r, { status: 'rechazada', rejection_reason: reason }, 'Reseña rechazada. No se mostrará en el sitio.');
  };

  const remove = async (r: StoredReview) => {
    if (!window.confirm('¿Eliminar definitivamente esta reseña?')) return;
    setBusy(r.pathname);
    try {
      await deleteReviewRecord(r.pathname);
      setReviews((list) => (list ?? []).filter((x) => x.pathname !== r.pathname));
      onNotice('Reseña eliminada.');
    } catch (e) {
      onError(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-white">Reseñas</h1>
          <p className="mt-1 text-sm text-gray">Valida las reseñas antes de publicarlas. Solo las aprobadas se muestran y cuentan en la valoración del programa y de la institución (el sitio se actualiza en ~1 minuto).</p>
        </div>
        <button className="btn btn-quiet btn-sm" onClick={() => { setReviews(null); void load(); }}><Icon name="history" size={15} /> Actualizar</button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-full border border-line-strong p-1" role="tablist" aria-label="Estado">
          {(Object.keys(STATUS_LABELS) as ReviewStatus[]).map((s) => (
            <button key={s} role="tab" aria-selected={tab === s} onClick={() => setTab(s)} className={`rounded-full px-3 py-1.5 text-sm ${tab === s ? 'bg-white text-navy' : 'text-gray hover:text-white'}`}>
              {STATUS_LABELS[s]} <span className="tnum opacity-70">({counts[s]})</span>
            </button>
          ))}
        </div>
        <div className="relative min-w-60 flex-1">
          <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input aria-label="Buscar reseñas" className="input min-h-10 py-2 pl-9 text-sm" placeholder="Programa, institución, autor, texto…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select aria-label="Estrellas" className="input min-h-10 w-40 cursor-pointer py-2 text-sm" value={stars} onChange={(e) => setStars(e.target.value)}>
          <option value="">Todas las estrellas</option>
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}
        </select>
      </div>

      <ul className="mt-5 space-y-3">
        {reviews === null && [0, 1].map((i) => <li key={i} className="skeleton h-36" />)}
        {rows.map((r) => (
          <li key={r.pathname} className="card p-5" aria-busy={busy === r.pathname}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-white">{r.course_name}</p>
                <p className="text-xs text-muted">{r.institution_name} · {when(r.created_at)}</p>
              </div>
              <Stars value={r.rating} size={16} />
            </div>
            {r.title && <h3 className="mt-3 text-base font-medium text-white">{r.title}</h3>}
            <p className="mt-1 whitespace-pre-line text-sm text-gray">{r.comment}</p>
            <p className="mt-3 text-xs text-muted">
              <span className="text-white">{r.author_name}</span> · {r.author_email} · {RELATIONSHIP_LABELS[r.relationship]}
              {r.moderated_at && <> · moderada {when(r.moderated_at)}</>}
              {r.rejection_reason && <> · motivo: <span className="text-warn">{r.rejection_reason}</span></>}
            </p>
            {r.reply && replying !== r.pathname && <p className="mt-2 rounded-lg border border-line bg-navy/60 p-2 text-xs text-gray"><span className="text-white">Respuesta publicada:</span> {r.reply}</p>}

            {replying === r.pathname && (
              <div className="mt-3">
                <label htmlFor={`reply-${r.id}`} className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted">Respuesta pública</label>
                <textarea id={`reply-${r.id}`} rows={3} className="input py-2 text-sm" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Ej. ¡Gracias por tu reseña! Compartimos tu comentario con la institución." />
                <div className="mt-2 flex gap-2">
                  <button className="btn btn-primary btn-sm" disabled={busy === r.pathname} onClick={() => { void act(r, { reply }, 'Respuesta guardada.'); setReplying(null); }}>Guardar respuesta</button>
                  <button className="btn btn-quiet btn-sm" onClick={() => setReplying(null)}>Cancelar</button>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
              {r.status !== 'aprobada' && <button className="btn btn-accent btn-sm" disabled={busy === r.pathname} onClick={() => void act(r, { status: 'aprobada' }, 'Reseña aprobada y publicada.')}><Icon name="check" size={15} /> Aprobar</button>}
              {r.status !== 'rechazada' && <button className="btn btn-ghost btn-sm" disabled={busy === r.pathname} onClick={() => reject(r)}>Rechazar</button>}
              <button className="btn btn-quiet btn-sm" disabled={busy === r.pathname} onClick={() => { setReplying(r.pathname); setReply(r.reply ?? ''); }}>{r.reply ? 'Editar respuesta' : 'Responder'}</button>
              <a className="btn btn-quiet btn-sm" href={r.page_url || '#'} target="_blank" rel="noreferrer">Ver programa <Icon name="external" size={13} /></a>
              <button className="btn btn-quiet btn-sm ml-auto text-neg" disabled={busy === r.pathname} onClick={() => void remove(r)}><Icon name="trash" size={15} /> Eliminar</button>
            </div>
          </li>
        ))}
        {reviews && rows.length === 0 && (
          <li className="card p-8 text-center text-gray">{tab === 'pendiente' ? 'No hay reseñas pendientes de validación. 🎉' : 'No hay reseñas en este estado.'}</li>
        )}
      </ul>
    </div>
  );
}
