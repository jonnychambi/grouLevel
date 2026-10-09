import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  blockReviewer, deleteReviewRecord, downloadReviewEvidence, fetchCreditRedemptions, fetchReviewIncentives, fetchReviewReports, fetchReviews, moderateReview, resolveReviewReport,
  updateCreditRedemption, updateReviewIncentive, type CreditRedemption, type ReviewIncentive, type ReviewReport, type StoredReview
} from '../../services/adminApi';
import type { ReviewStatus } from '../../types';
import { INSTITUTION_DIMENSIONS, PROGRAM_DIMENSIONS, RELATIONSHIP_LABELS, STUDENT_STATUS_LABELS } from '../../utils/reviews';
import { normalize } from '../../utils/text';
import { Stars } from '../reviews/Stars';
import { Icon } from '../ui/Icon';

type Tab = ReviewStatus | 'reportes' | 'incentivos';
const TABS: [Tab, string][] = [['pendiente', 'Pendientes'], ['aprobada', 'Publicadas'], ['rechazada', 'Rechazadas'], ['reportes', 'Reportes'], ['incentivos', 'Créditos']];
const when = (iso: string) => new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Criterios objetivos de publicación (no dependen de si la opinión es positiva o negativa). */
const CRITERIA: [string, string][] = [
  ['experiencia_real', 'Describe una experiencia real y concreta'],
  ['relevante', 'Es relevante para la institución/programa'],
  ['sin_lenguaje_ofensivo', 'Sin insultos ni lenguaje ofensivo'],
  ['sin_datos_personales', 'Sin datos personales de terceros'],
  ['no_publicitaria', 'No es publicidad ni conflicto de interés']
];
const REJECT_REASONS = ['No describe una experiencia real', 'Lenguaje ofensivo', 'Publicidad o conflicto de interés', 'Expone datos personales', 'Duplicada', 'No corresponde a la institución/programa'];
const FLAG_LABELS: Record<string, string> = {
  evidencia_repetida: 'Constancia usada por otra persona',
  texto_duplicado: 'Texto idéntico a otra reseña',
  muchas_resenas_24h: 'Muchas reseñas en 24 h',
  cuenta_de_pago_compartida: 'Cuenta de pago usada por otra persona',
  incentivo_institucion_ya_otorgado: 'Ya recibió incentivo por esta institución',
  incentivo_programa_ya_otorgado: 'Ya recibió incentivo por este programa',
  referida: 'Llegó con enlace de referido',
  referido_mismo_dominio: 'Referido con el mismo dominio de correo que quien invitó'
};
const EVIDENCE_LABELS: Record<string, string> = { sin_evidencia: 'Sin constancia', pendiente: 'Constancia por revisar', aprobada: 'Constancia verificada', rechazada: 'Constancia rechazada' };
const INCENTIVE_LABELS: Record<string, string> = { pendiente: 'Por aprobar', aprobado: 'Activo', pagado: 'Pagado', rechazado: 'Rechazado' };
const KIND_LABELS: Record<string, string> = { resena: 'Reseña', referido: 'Referido', institucion: 'Institucional (anterior)', programa: 'Programa (anterior)' };
const REDEMPTION_LABELS: Record<string, string> = { solicitado: 'Por aplicar', aplicado: 'Aplicado', anulado: 'Anulado' };

/**
 * Moderación de Groulevel Reviews: reseñas pendientes con criterios objetivos, verificación de constancias,
 * señales de duplicados/fraude, reportes de usuarios, créditos de descuento (reseñas y referidos) y sus canjes.
 */
export function ReviewsPanel({ onError, onNotice }: { onError: (e: unknown) => void; onNotice: (text: string) => void }) {
  const [reviews, setReviews] = useState<StoredReview[] | null>(null);
  const [reports, setReports] = useState<ReviewReport[]>([]);
  const [incentives, setIncentives] = useState<ReviewIncentive[]>([]);
  const [redemptions, setRedemptions] = useState<CreditRedemption[]>([]);
  const [tab, setTab] = useState<Tab>('pendiente');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, rep, inc, red] = await Promise.all([fetchReviews(), fetchReviewReports(), fetchReviewIncentives(), fetchCreditRedemptions()]);
      setReviews(r.reviews);
      setReports(rep.reports);
      setIncentives(inc.incentives);
      setRedemptions(red.redemptions);
    } catch (e) {
      onError(e);
      setReviews([]);
    }
  }, [onError]);
  useEffect(() => { void load(); }, [load]);

  const act = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    try {
      await fn();
      if (ok) onNotice(ok);
      await load();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(null);
    }
  };

  const counts = useMemo(() => ({
    pendiente: reviews?.filter((r) => r.status === 'pendiente').length ?? 0,
    aprobada: reviews?.filter((r) => r.status === 'aprobada').length ?? 0,
    rechazada: reviews?.filter((r) => r.status === 'rechazada').length ?? 0,
    reportes: reports.filter((r) => r.status === 'abierto').length,
    incentivos: incentives.filter((i) => i.status === 'pendiente').length + redemptions.filter((c) => c.status === 'solicitado').length
  }), [reviews, reports, incentives, redemptions]);

  const list = useMemo(() => {
    const nq = normalize(q.trim());
    return (reviews ?? [])
      .filter((r) => r.status === tab && (!nq || normalize(`${r.course_name ?? ''} ${r.institution_name} ${r.author_name} ${r.author_email} ${r.best ?? ''} ${r.improve ?? ''} ${r.comment}`).includes(nq)))
      .sort((a, b) => (tab === 'pendiente' ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at)));
  }, [reviews, tab, q]);
  const incentiveTotals = useMemo(() => {
    const sum = (st: string) => incentives.filter((i) => i.status === st).reduce((a, i) => a + Number(i.amount), 0);
    const red = (st: string) => redemptions.filter((c) => c.status === st).reduce((a, c) => a + Number(c.amount), 0);
    return { pendiente: sum('pendiente'), aprobado: sum('aprobado'), solicitado: red('solicitado'), aplicado: red('aplicado') };
  }, [incentives, redemptions]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-white">Reseñas</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray">Aprueba según criterios objetivos: se publican opiniones positivas y críticas. La insignia de verificada solo se otorga con constancia válida. Las constancias nunca se publican.</p>
        </div>
        <button className="btn btn-quiet btn-sm" onClick={() => void load()}>Actualizar</button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {TABS.map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} aria-pressed={tab === t} className={`rounded-full px-3 py-1.5 text-sm ${tab === t ? 'bg-raise text-white' : 'text-gray hover:text-white'}`}>
            {label} <span className={`tnum ${counts[t] && (t === 'pendiente' || t === 'reportes' || t === 'incentivos') ? 'text-cyan' : 'text-muted'}`}>({counts[t]})</span>
          </button>
        ))}
        {tab !== 'reportes' && tab !== 'incentivos' && <input className="input ml-auto min-h-9 w-64 py-1.5 text-sm" placeholder="Buscar institución, programa, autor o texto" value={q} onChange={(e) => setQ(e.target.value)} />}
      </div>

      {reviews === null ? <div className="skeleton mt-5 h-40" /> : tab === 'reportes' ? (
        <ul className="mt-5 space-y-2">
          {!reports.length && <li className="text-sm text-gray">Sin reportes.</li>}
          {reports.map((p) => (
            <li key={p.id} className="card flex flex-wrap items-center gap-3 p-4 text-sm">
              <div className="min-w-0 flex-1">
                <p className="text-white">{p.reason.replace(/_/g, ' ')} · <span className="text-gray">{p.institution_name}{p.course_name ? ` · ${p.course_name}` : ''} — {p.author_name}</span></p>
                {p.details && <p className="mt-0.5 text-gray">“{p.details}”</p>}
                <p className="mt-0.5 text-xs text-muted">{when(p.created_at)} · reseña {p.review_status} · reporte {p.status}</p>
              </div>
              <button className="btn btn-quiet btn-sm" onClick={() => { setTab(p.review_status as Tab); setQ(p.author_name); }}>Ver reseña</button>
              {p.status === 'abierto' && (
                <>
                  <button className="btn btn-quiet btn-sm" disabled={!!busy} onClick={() => void act(`rep:${p.id}`, () => resolveReviewReport(p.id, 'resuelto'))}>Resuelto</button>
                  <button className="btn btn-quiet btn-sm text-gray" disabled={!!busy} onClick={() => void act(`rep:${p.id}`, () => resolveReviewReport(p.id, 'descartado'))}>Descartar</button>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : tab === 'incentivos' ? (
        <div className="mt-5">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([['pendiente', 'Créditos por aprobar'], ['aprobado', 'Créditos activos'], ['solicitado', 'Descuentos por aplicar'], ['aplicado', 'Descuentos aplicados']] as const).map(([k, label]) => (
              <div key={k} className="card p-4"><dt className="text-xs text-gray">{label}</dt><dd className="tnum mt-1 text-2xl text-white">S/ {incentiveTotals[k].toFixed(0)}</dd></div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">S/ 100 por reseña y S/ 100 por referido (su primera reseña). Se aprueba solo con la reseña publicada y la constancia verificada; no depende de la calificación. El saldo se usa como descuento adicional: máximo S/ 300 por programa.</p>

          <h2 className="mt-6 text-lg text-white">Canjes de descuento</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-midnight text-xs text-gray"><tr><th className="px-3 py-2">Código</th><th className="px-3 py-2">Persona</th><th className="px-3 py-2">Programa</th><th className="px-3 py-2 text-right">Descuento</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2 text-right">Acciones</th></tr></thead>
              <tbody>
                {redemptions.map((c) => (
                  <tr key={c.id} className="border-t border-line align-top">
                    <td className="px-3 py-2 font-mono text-cyan">{c.code}<p className="font-sans text-xs text-muted">{when(c.created_at)}</p></td>
                    <td className="px-3 py-2"><p className="text-white">{c.display_name ?? '—'}</p><p className="text-xs text-gray">{c.email}</p>{c.blocked && <p className="text-xs text-neg">Bloqueado</p>}</td>
                    <td className="px-3 py-2 text-gray">{c.course_name}<p className="text-xs">{c.institution_name}</p></td>
                    <td className="tnum px-3 py-2 text-right text-white">S/ {Number(c.amount).toFixed(0)}</td>
                    <td className="px-3 py-2"><span className={c.status === 'aplicado' ? 'text-pos' : c.status === 'anulado' ? 'text-neg' : 'text-white'}>{REDEMPTION_LABELS[c.status]}</span>{c.note && <p className="text-xs text-muted">{c.note}</p>}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {c.status === 'solicitado' && <button className="btn btn-accent btn-sm" disabled={!!busy} onClick={() => void act(`red:${c.id}`, () => updateCreditRedemption(c.id, 'aplicado'), 'Descuento marcado como aplicado.')}>Marcar aplicado</button>}
                      {c.status !== 'anulado' && <button className="btn btn-quiet btn-sm text-gray" disabled={!!busy} onClick={() => { const note = window.prompt('Motivo de la anulación (el saldo vuelve a la persona):') ?? undefined; if (note !== undefined) void act(`red:${c.id}`, () => updateCreditRedemption(c.id, 'anulado', note), 'Canje anulado.'); }}>Anular</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!redemptions.length && <p className="px-3 py-4 text-sm text-gray">Aún no hay canjes.</p>}
          </div>

          <h2 className="mt-6 text-lg text-white">Créditos ganados</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-midnight text-xs text-gray"><tr><th className="px-3 py-2">Beneficiario</th><th className="px-3 py-2">Reseña</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2 text-right">Monto</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2 text-right">Acciones</th></tr></thead>
              <tbody>
                {incentives.map((i) => (
                  <tr key={i.id} className="border-t border-line align-top">
                    <td className="px-3 py-2"><p className="text-white">{i.kind === 'referido' ? (i.display_name ?? '—') : i.author_name}</p><p className="text-xs text-gray">{i.email}</p>{i.blocked && <p className="text-xs text-neg">Bloqueado</p>}</td>
                    <td className="px-3 py-2 text-gray">{i.institution_name}{i.course_name ? ` · ${i.course_name}` : ''}{i.kind === 'referido' && <p className="text-xs">Escrita por {i.author_name}{i.referred_email ? ` (${i.referred_email})` : ''}</p>}<p className="text-xs">{i.review_status} · {i.verified ? <span className="text-pos">verificada</span> : 'sin verificar'}</p>{i.flags?.length > 0 && <p className="text-xs text-warn">{i.flags.map((f) => FLAG_LABELS[f] ?? f).join(' · ')}</p>}</td>
                    <td className="px-3 py-2 text-gray">{KIND_LABELS[i.kind] ?? i.kind}</td>
                    <td className="tnum px-3 py-2 text-right text-white">S/ {Number(i.amount).toFixed(0)}</td>
                    <td className="px-3 py-2"><span className={i.status === 'aprobado' || i.status === 'pagado' ? 'text-pos' : i.status === 'rechazado' ? 'text-neg' : 'text-white'}>{INCENTIVE_LABELS[i.status]}</span>{i.note && <p className="text-xs text-muted">{i.note}</p>}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {i.status === 'pendiente' && <button className="btn btn-accent btn-sm" disabled={!!busy} onClick={() => void act(`inc:${i.id}`, () => updateReviewIncentive(i.id, 'aprobado'), 'Crédito activado.')}>Aprobar</button>}
                      {(i.status === 'pendiente' || i.status === 'aprobado') && <button className="btn btn-quiet btn-sm text-gray" disabled={!!busy} onClick={() => { const note = window.prompt('Motivo del rechazo (se guarda internamente):') ?? undefined; if (note !== undefined) void act(`inc:${i.id}`, () => updateReviewIncentive(i.id, 'rechazado', note)); }}>Rechazar</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!incentives.length && <p className="px-3 py-4 text-sm text-gray">Aún no hay créditos solicitados.</p>}
          </div>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {!list.length && <li className="text-sm text-gray">No hay reseñas en esta sección.</li>}
          {list.map((r) => <ReviewItem key={r.pathname} r={r} busy={busy} act={act} onError={onError} />)}
        </ul>
      )}
    </div>
  );
}

function ReviewItem({ r, busy, act, onError }: { r: StoredReview; busy: string | null; act: (key: string, fn: () => Promise<unknown>, ok?: string) => Promise<void>; onError: (e: unknown) => void }) {
  const [criteria, setCriteria] = useState<Set<string>>(() => new Set(r.criteria));
  const [reply, setReply] = useState(r.reply ?? '');
  const [reason, setReason] = useState('');
  const key = r.pathname;
  const allCriteria = CRITERIA.every(([c]) => criteria.has(c));
  const toggle = (c: string) => setCriteria((s) => { const n = new Set(s); if (n.has(c)) n.delete(c); else n.add(c); return n; });
  const legacy = r.kind === 'programa';

  return (
    <li className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-white">{r.institution_name}{r.course_name ? <span className="text-gray"> · {r.course_name}</span> : ''}</p>
          <p className="mt-0.5 text-xs text-gray">
            <span className="text-white">{r.author_name}</span> · {r.author_email || '—'} · {r.student_status ? STUDENT_STATUS_LABELS[r.student_status] : RELATIONSHIP_LABELS[r.relationship]}{r.study_year ? ` (${r.study_year})` : ''} · {when(r.created_at)}
            {r.email_verified ? <span className="text-pos"> · correo validado</span> : <span className="text-warn"> · correo sin validar</span>}
            {legacy && <span className="text-muted"> · formato anterior</span>}
          </p>
        </div>
        <div className="flex items-center gap-2"><Stars value={r.rating} size={15} /><span className="tnum text-white">{r.rating.toFixed(1)}</span></div>
      </div>

      {(r.flags.length > 0 || r.reports_count > 0) && (
        <p className="mt-3 flex flex-wrap gap-1.5">
          {r.flags.map((f) => <span key={f} className="rounded-full border border-warn/40 bg-warn/10 px-2 py-0.5 text-xs text-warn">{FLAG_LABELS[f] ?? f}</span>)}
          {r.reports_count > 0 && <span className="rounded-full border border-neg/40 bg-neg/10 px-2 py-0.5 text-xs text-neg">{r.reports_count} {r.reports_count === 1 ? 'reporte' : 'reportes'}</span>}
        </p>
      )}

      {r.inst_scores && (
        <p className="mt-3 text-xs text-gray">{INSTITUTION_DIMENSIONS.map((d) => `${d.label}: ${r.inst_scores![d.key]}`).join(' · ')}</p>
      )}
      {r.program_scores && <p className="mt-1 text-xs text-gray">Programa ★ {r.program_rating?.toFixed(1)} — {PROGRAM_DIMENSIONS.map((d) => `${d.label}: ${r.program_scores![d.key]}`).join(' · ')}</p>}
      {r.best || r.improve ? (
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div><p className="text-xs uppercase tracking-wider text-pos">Lo mejor</p><p className="mt-1 whitespace-pre-line text-gray">{r.best}</p></div>
          <div><p className="text-xs uppercase tracking-wider text-warn">Debería mejorar</p><p className="mt-1 whitespace-pre-line text-gray">{r.improve}</p></div>
        </div>
      ) : <p className="mt-3 whitespace-pre-line text-sm text-gray">{r.title && <span className="text-white">{r.title}. </span>}{r.comment}</p>}
      {r.recommend != null && <p className={`mt-2 text-sm ${r.recommend ? 'text-pos' : 'text-neg'}`}>{r.recommend ? 'Recomienda la institución' : 'No recomienda la institución'}</p>}
      {r.incentivized && <p className="mt-1 text-xs text-gray">Solicitó crédito de descuento (se muestra como “Incentivada”).</p>}

      <div className="mt-4 grid gap-4 border-t border-line pt-4 lg:grid-cols-3">
        <div>
          <p className="label-mono">Constancia</p>
          <p className={`mt-1 text-sm ${r.evidence_status === 'aprobada' ? 'text-pos' : r.evidence_status === 'rechazada' ? 'text-neg' : 'text-gray'}`}>{EVIDENCE_LABELS[r.evidence_status]}</p>
          {r.evidence_name && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn btn-quiet btn-sm" onClick={() => void downloadReviewEvidence(r.pathname, r.evidence_name!).catch(onError)}><Icon name="file" size={14} /> Ver constancia</button>
              {r.evidence_status !== 'aprobada' && <button className="btn btn-quiet btn-sm text-pos" disabled={!!busy} onClick={() => void act(`ev:${key}`, () => moderateReview(key, { evidence_status: 'aprobada' }), 'Constancia verificada: la reseña lleva la insignia.')}>Verificar</button>}
              {r.evidence_status !== 'rechazada' && <button className="btn btn-quiet btn-sm text-gray" disabled={!!busy} onClick={() => void act(`ev:${key}`, () => moderateReview(key, { evidence_status: 'rechazada' }))}>No válida</button>}
            </div>
          )}
        </div>
        <div>
          <p className="label-mono">Criterios de publicación</p>
          <ul className="mt-2 space-y-1">
            {CRITERIA.map(([c, label]) => <li key={c}><label className="flex items-center gap-2 text-xs text-gray"><input type="checkbox" className="accent-violet" checked={criteria.has(c)} onChange={() => toggle(c)} />{label}</label></li>)}
          </ul>
        </div>
        <div className="space-y-2">
          <p className="label-mono">Decisión</p>
          {r.status !== 'aprobada' && (
            <button className="btn btn-accent btn-sm w-full" disabled={!!busy || !allCriteria} title={allCriteria ? undefined : 'Marca los criterios para publicar'}
              onClick={() => void act(`ok:${key}`, () => moderateReview(key, { status: 'aprobada', criteria: [...criteria], reply }), 'Reseña publicada.')}>Publicar</button>
          )}
          {r.status !== 'rechazada' && (
            <div className="flex gap-2">
              <select className="input min-h-9 flex-1 py-1 text-xs" value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="">Motivo de rechazo…</option>
                {REJECT_REASONS.map((x) => <option key={x}>{x}</option>)}
              </select>
              <button className="btn btn-quiet btn-sm" disabled={!!busy || !reason} onClick={() => void act(`no:${key}`, () => moderateReview(key, { status: 'rechazada', rejection_reason: reason }), 'Reseña rechazada.')}>Rechazar</button>
            </div>
          )}
          {r.rejection_reason && <p className="text-xs text-neg">Rechazo: {r.rejection_reason}</p>}
          <textarea rows={2} className="input py-1.5 text-xs" placeholder="Respuesta pública (opcional)" value={reply} onChange={(e) => setReply(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {reply !== (r.reply ?? '') && <button className="btn btn-quiet btn-sm" disabled={!!busy} onClick={() => void act(`rp:${key}`, () => moderateReview(key, { reply }), 'Respuesta guardada.')}>Guardar respuesta</button>}
            {r.user_id && <button className="btn btn-quiet btn-sm text-gray" disabled={!!busy} onClick={() => { if (window.confirm(`¿Bloquear a ${r.author_email}? No podrá publicar más reseñas.`)) void act(`bl:${key}`, () => blockReviewer(r.user_id!, true), 'Persona bloqueada.'); }}>Bloquear persona</button>}
            <button className="btn btn-quiet btn-sm text-neg" disabled={!!busy} onClick={() => { if (window.confirm('¿Eliminar la reseña definitivamente? También se borra la constancia.')) void act(`del:${key}`, () => deleteReviewRecord(key), 'Reseña eliminada.'); }}>Eliminar</button>
          </div>
        </div>
      </div>
    </li>
  );
}
