/**
 * Cuenta de Groulevel Reviews: acceso con correo validado, reseñas de la persona y créditos de descuento
 * (saldo, enlace de referido y canje). Se usa en /opinar y en /mis-creditos.
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../../hooks/useCatalog';
import {
  redeemCredits, referralLink, reviewAuthAvailable, ReviewApiError, startReviewLogin, verifyReviewCode, type MyReview, type ReviewSession, type Wallet
} from '../../services/reviewsService';
import { Icon } from '../ui/Icon';

type Catalog = ReturnType<typeof useCatalog>['catalog'];
const INCENTIVE_STATUS: Record<string, string> = { pendiente: 'por activar', aprobado: 'activo', pagado: 'pagado', rechazado: 'no aplica' };
const REDEMPTION_STATUS: Record<string, string> = { solicitado: 'Por usar', aplicado: 'Aplicado', anulado: 'Anulado' };
const REVIEW_STATUS: Record<string, string> = { pendiente: 'En revisión', aprobada: 'Publicada', rechazada: 'No publicada' };

/** Acceso con correo: código o enlace mágico enviado por Supabase Auth. */
export function EmailGate({ onSession }: { onSession: (s: ReviewSession) => void }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { reviewAuthAvailable().then(setAvailable); }, []);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ReviewApiError ? e.message : 'Algo salió mal.');
    } finally {
      setBusy(false);
    }
  };
  if (available === false) return <p className="card p-5 text-sm text-gray">El registro de reseñas no está disponible en este momento. Inténtalo más tarde.</p>;
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-lg text-white">Valida tu correo</h2>
      <p className="mt-1 text-sm text-muted">Solo personas con correo validado pueden opinar. Tu correo no se publica.</p>
      {!sent ? (
        <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={(e: FormEvent) => { e.preventDefault(); void run(async () => { await startReviewLogin(email, `${window.location.pathname}${window.location.search}`); setSent(true); }); }}>
          <label className="sr-only" htmlFor="rv-email">Correo</label>
          <input id="rv-email" type="email" required autoComplete="email" className="input min-h-11 flex-1" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn btn-accent" disabled={busy || !email}>{busy ? 'Enviando…' : 'Enviar código'}</button>
        </form>
      ) : (
        <form className="mt-5" onSubmit={(e: FormEvent) => { e.preventDefault(); void run(async () => onSession(await verifyReviewCode(email, code))); }}>
          <p className="text-sm text-gray">Te enviamos un correo a <span className="text-white">{email}</span>. Haz clic en el enlace del correo o escribe aquí el código.</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="rv-code">Código</label>
            <input id="rv-code" inputMode="numeric" autoComplete="one-time-code" className="input min-h-11 flex-1 tracking-[0.3em]" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="btn btn-accent" disabled={busy || code.replace(/\s/g, '').length < 6}>{busy ? 'Validando…' : 'Validar'}</button>
          </div>
          <button type="button" className="mt-3 text-sm text-blue-soft hover:text-white" onClick={() => { setSent(false); setCode(''); }}>Usar otro correo</button>
        </form>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-neg">{error}</p>}
    </section>
  );
}

export function MyReviews({ list }: { list: MyReview[] }) {
  if (!list.length) return null;
  return (
    <section className="card p-5">
      <h2 className="label-mono">Tus reseñas</h2>
      <ul className="mt-3 space-y-3 text-sm">
        {list.map((r) => (
          <li key={r.id} className="border-t border-line pt-3 first:border-0 first:pt-0">
            <p className="text-white">{r.institution_name}{r.course_name ? ` · ${r.course_name}` : ''}</p>
            <p className="text-xs text-gray">{REVIEW_STATUS[r.status] ?? r.status}{r.verified ? ' · verificada' : r.evidence_status === 'pendiente' ? ' · constancia en revisión' : ''}</p>
            {r.incentives.map((i) => <p key={i.kind} className="text-xs text-gray">Crédito: S/ {Number(i.amount).toFixed(0)} · {INCENTIVE_STATUS[i.status] ?? i.status}</p>)}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Créditos de descuento: saldo, enlace de referido y canje en un programa (máximo S/ 300 por programa). */
export function CreditsPanel({ wallet, catalog, onChange, showBalance = true }: { wallet: Wallet; catalog: Catalog | null; onChange: () => void; showBalance?: boolean }) {
  const [instId, setInstId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const link = referralLink(wallet.ref_code);
  const institutions = useMemo(() => [...(catalog?.institutions ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'es')), [catalog]);
  const programs = useMemo(() => (catalog?.courses ?? []).filter((c) => c.institution_id === instId).sort((a, b) => a.name.localeCompare(b.name, 'es')), [catalog, instId]);
  const used = wallet.redemptions.filter((r) => r.course_id === courseId && r.status !== 'anulado').reduce((a, r) => a + r.amount, 0);
  const room = Math.min(wallet.available, wallet.max_per_program - used);
  const steps = [100, 200, 300].filter((v) => v <= wallet.max_per_program);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copia tu enlace:', link);
    }
  };
  const redeem = async () => {
    if (!courseId || !amount) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await redeemCredits(courseId, amount);
      setMsg({ ok: true, text: `Listo: S/ ${r.amount} de descuento en ${r.course_name}. Tu código es ${r.code}.` });
      setAmount(null);
      onChange();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ReviewApiError ? e.message : 'No pudimos aplicar el descuento.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-5">
      <h2 className="label-mono">Tus créditos de descuento</h2>
      {showBalance && (
        <>
          <p className="tnum mt-3 text-3xl text-white">S/ {wallet.earned + wallet.pending} <span className="text-sm text-gray">acumulados</span></p>
          <p className="text-xs text-gray"><span className="text-pos">S/ {wallet.available} disponibles</span>{wallet.pending > 0 ? ` · S/ ${wallet.pending} por activar` : ''}{wallet.redeemed > 0 ? ` · S/ ${wallet.redeemed} usados` : ''}</p>
          <p className="mt-2 text-xs text-muted">Se activan cuando la reseña se publica y su constancia se verifica. <Link to="/mis-creditos" className="text-blue-soft hover:text-white">Ver movimientos</Link></p>
        </>
      )}

      <div className={showBalance ? 'mt-4 border-t border-line pt-4' : 'mt-3'}>
        <p className="text-sm text-white">Invita y gana S/ {wallet.referral_credit}</p>
        <p className="mt-1 text-xs text-gray">Por cada persona que opine con tu enlace (su primera reseña, publicada y verificada).</p>
        <div className="mt-2 flex gap-2">
          <input readOnly aria-label="Tu enlace de referido" className="input min-h-9 flex-1 py-1.5 font-mono text-xs" value={link} onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => void copy()}>{copied ? 'Copiado' : 'Copiar'}</button>
        </div>
        {wallet.referrals.length > 0 && <p className="mt-2 text-xs text-gray">{wallet.referrals.length} referido{wallet.referrals.length === 1 ? '' : 's'} · {wallet.referrals.filter((r) => r.status === 'aprobado').length} activo{wallet.referrals.filter((r) => r.status === 'aprobado').length === 1 ? '' : 's'}</p>}
      </div>

      {(wallet.available > 0 || wallet.redemptions.length > 0) && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-sm text-white">Usar como descuento</p>
          <p className="mt-1 text-xs text-gray">Descuento adicional en el programa que elijas: hasta S/ {wallet.max_per_program} por programa.</p>
          {wallet.available > 0 && (
            <div className="mt-3 space-y-2">
              <select aria-label="Institución" className="input min-h-10 cursor-pointer py-1.5 text-sm" value={instId} onChange={(e) => { setInstId(e.target.value); setCourseId(''); setAmount(null); }}>
                <option value="">Institución</option>
                {institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              <select aria-label="Programa" className="input min-h-10 cursor-pointer py-1.5 text-sm" value={courseId} disabled={!instId} onChange={(e) => { setCourseId(e.target.value); setAmount(null); }}>
                <option value="">Programa</option>
                {programs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {courseId && (room > 0 ? (
                <div role="radiogroup" aria-label="Monto" className="flex flex-wrap gap-2">
                  {steps.filter((v) => v <= room).map((v) => (
                    <button key={v} type="button" role="radio" aria-checked={amount === v} onClick={() => setAmount(v)}
                      className={`rounded-full border px-3 py-1.5 text-sm ${amount === v ? 'border-violet bg-violet/15 text-white' : 'border-line-strong text-gray hover:text-white'}`}>S/ {v}</button>
                  ))}
                </div>
              ) : <p className="text-xs text-warn">Ya aplicaste el máximo de S/ {wallet.max_per_program} en este programa.</p>)}
              <button type="button" className="btn btn-accent btn-sm w-full" disabled={busy || !courseId || !amount} onClick={() => void redeem()}>{busy ? 'Aplicando…' : 'Aplicar descuento'}</button>
            </div>
          )}
          {msg && <p role="status" className={`mt-2 text-xs ${msg.ok ? 'text-pos' : 'text-neg'}`}>{msg.text}</p>}
          {wallet.redemptions.length > 0 && (
            <ul className="mt-3 space-y-2 text-xs">
              {wallet.redemptions.map((r) => (
                <li key={r.code} className="rounded-lg border border-line p-2">
                  <p className="text-white">S/ {r.amount} · {r.course_name}</p>
                  <p className="text-gray">{r.institution_name} · <span className="font-mono text-cyan">{r.code}</span> · {REDEMPTION_STATUS[r.status] ?? r.status}</p>
                </li>
              ))}
            </ul>
          )}
          {wallet.redemptions.some((r) => r.status === 'solicitado') && <p className="mt-2 text-xs text-muted">Al matricularte, indica tu código a la institución o escríbenos y coordinamos el descuento.</p>}
        </div>
      )}
    </section>
  );
}

const KIND: Record<string, string> = { resena: 'Por tu reseña', referido: 'Por referido', institucion: 'Por tu reseña', programa: 'Por tu evaluación del programa' };
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });

/** Soles acumulados: total ganado, disponible, por activar y usado, con el detalle de cada movimiento. */
export function CreditsSummary({ wallet }: { wallet: Wallet }) {
  const total = wallet.earned + wallet.pending;
  const tiles: [string, number, string][] = [
    ['Disponible', wallet.available, 'Para usar como descuento'],
    ['Por activar', wallet.pending, 'Reseñas en revisión'],
    ['Usado', wallet.redeemed, 'En descuentos aplicados']
  ];
  const moves = [
    ...wallet.credits.filter((c) => c.status !== 'rechazado').map((c) => ({
      at: c.created_at, sign: 1, amount: c.amount, title: KIND[c.kind] ?? 'Crédito',
      detail: c.kind === 'referido' ? `${c.author_name ?? 'Una persona'} opinó sobre ${c.institution_name}` : `${c.institution_name}${c.course_name ? ` · ${c.course_name}` : ''}`,
      state: c.status === 'aprobado' || c.status === 'pagado' ? 'Activo' : 'Por activar'
    })),
    ...wallet.redemptions.filter((r) => r.status !== 'anulado').map((r) => ({
      at: r.created_at, sign: -1, amount: r.amount, title: 'Descuento', detail: `${r.course_name} · ${r.institution_name} · ${r.code}`, state: r.status === 'aplicado' ? 'Aplicado' : 'Por usar'
    }))
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <section className="card p-5 sm:p-6">
      <p className="label-mono">Soles acumulados</p>
      <p className="tnum mt-2 text-4xl text-white sm:text-5xl">S/ {total}</p>
      <p className="mt-1 text-sm text-gray">Ganados con tus reseñas y referidos. Hasta S/ {wallet.max_per_program} de descuento por programa.</p>
      <dl className="mt-5 grid grid-cols-3 gap-3">
        {tiles.map(([label, value, hint]) => (
          <div key={label} className="rounded-xl border border-line p-3">
            <dt className="text-xs text-gray">{label}</dt>
            <dd className={`tnum mt-1 text-xl ${label === 'Disponible' ? 'text-pos' : 'text-white'}`}>S/ {value}</dd>
            <dd className="mt-0.5 hidden text-[11px] text-muted sm:block">{hint}</dd>
          </div>
        ))}
      </dl>
      <h2 className="mt-6 text-sm text-white">Movimientos</h2>
      {moves.length ? (
        <ul className="mt-2 divide-y divide-line text-sm">
          {moves.map((m, k) => (
            <li key={k} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-white">{m.title} <span className="text-xs text-muted">· {m.state}</span></p>
                <p className="truncate text-xs text-gray">{m.detail}</p>
                <p className="text-[11px] text-muted">{fmtDate(m.at)}</p>
              </div>
              <span className={`tnum shrink-0 ${m.sign > 0 ? 'text-pos' : 'text-gray'}`}>{m.sign > 0 ? '+' : '−'} S/ {m.amount}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 flex items-center gap-2 text-sm text-gray"><Icon name="info" size={14} className="text-cyan" />Aún no tienes créditos. Opina sobre tu institución o invita a alguien para empezar a acumular.</p>
      )}
    </section>
  );
}
