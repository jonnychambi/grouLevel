import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { Icon } from '../components/ui/Icon';
import { StarInput } from '../components/reviews/Stars';
import { useCatalog } from '../hooks/useCatalog';
import { useSeo } from '../hooks/useSeo';
import { courseContext, track } from '../services/analytics';
import {
  clearReviewSession, consumeLinkSession, fetchMyReviews, getReviewSession, redeemCredits, referralLink, rememberReferral, reviewAuthAvailable, ReviewApiError,
  startReviewLogin, submitReviewForm, verifyReviewCode, type MyReview, type ReviewSession, type Wallet
} from '../services/reviewsService';
import type { InstitutionScores, ProgramScores, StudentStatus } from '../types';

type Catalog = ReturnType<typeof useCatalog>['catalog'];
import { CREDITS, displayName, INSTITUTION_DIMENSIONS, PROGRAM_DIMENSIONS, REVIEW_TEXT, validateSubmission, type ReviewSubmission } from '../utils/reviews';

const YEAR = new Date().getFullYear();
const INCENTIVE_STATUS: Record<string, string> = { pendiente: 'por activar', aprobado: 'activo', pagado: 'pagado', rechazado: 'no aplica' };
const REDEMPTION_STATUS: Record<string, string> = { solicitado: 'Por usar', aplicado: 'Aplicado', anulado: 'Anulado' };
const REVIEW_STATUS: Record<string, string> = { pendiente: 'En revisión', aprobada: 'Publicada', rechazada: 'No publicada' };

function Section({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="flex items-center gap-3 text-lg text-white"><span className="grid h-7 w-7 place-items-center rounded-full border border-line-strong font-mono text-xs text-cyan">{n}</span>{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Pills<T extends string>({ value, options, onChange, label }: { value: T | null; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={`rounded-full border px-4 py-2 text-sm ${value === v ? 'border-violet bg-violet/15 text-white' : 'border-line-strong text-gray hover:text-white'}`}>{l}</button>
      ))}
    </div>
  );
}

/** Acceso con correo: código o enlace mágico enviado por Supabase Auth. */
function EmailGate({ onSession }: { onSession: (s: ReviewSession) => void }) {
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
        <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={(e: FormEvent) => { e.preventDefault(); void run(async () => { await startReviewLogin(email, `/opinar${window.location.search}`); setSent(true); }); }}>
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

function MyReviews({ list }: { list: MyReview[] }) {
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
function Credits({ wallet, catalog, onChange }: { wallet: Wallet; catalog: Catalog | null; onChange: () => void }) {
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
      <p className="tnum mt-3 text-3xl text-white">S/ {wallet.available}</p>
      <p className="text-xs text-gray">disponibles{wallet.pending > 0 ? ` · S/ ${wallet.pending} por activar` : ''}{wallet.redeemed > 0 ? ` · S/ ${wallet.redeemed} usados` : ''}</p>
      <p className="mt-2 text-xs text-muted">Se activan cuando la reseña se publica y su constancia se verifica.</p>

      <div className="mt-4 border-t border-line pt-4">
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

const emptyInst = (): Partial<InstitutionScores> => ({});

/** Formulario de Groulevel Reviews: institución (principal) + programa cursado (opcional). */
export default function OpinarPage() {
  useSeo({ title: 'Opina sobre tu institución', description: 'Comparte tu experiencia como estudiante o egresado: calidad académica, docentes, cumplimiento y relación calidad-precio. Reseñas verificadas en Groulevel.', path: '/opinar' });
  const { catalog } = useCatalog();
  const [params] = useSearchParams();
  const [session, setSession] = useState<ReviewSession | null>(() => consumeLinkSession() ?? getReviewSession());
  const [mine, setMine] = useState<MyReview[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [walletTick, setWalletTick] = useState(0);
  const [instId, setInstId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [inst, setInst] = useState<Partial<InstitutionScores>>(emptyInst);
  const [prog, setProg] = useState<Partial<ProgramScores>>({});
  const [best, setBest] = useState('');
  const [improve, setImprove] = useState('');
  const [recommend, setRecommend] = useState<'si' | 'no' | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [status, setStatus] = useState<StudentStatus | null>(null);
  const [name, setName] = useState('');
  const [evidence, setEvidence] = useState<File | null>(null);
  const [wantsIncentive, setWantsIncentive] = useState(false);
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ incentive: number } | null>(null);

  // Preselección desde la ficha (?institucion=slug&programa=slug).
  useEffect(() => {
    if (!catalog) return;
    const i = catalog.institutions.find((x) => x.slug === params.get('institucion'));
    const c = catalog.courses.find((x) => x.slug === params.get('programa'));
    if (c) { setInstId(c.institution_id); setCourseId(c.id); } else if (i) setInstId(i.id);
  }, [catalog, params]);
  const referred = !!params.get('ref');
  useEffect(() => { rememberReferral(params.get('ref')); }, [params]);
  useEffect(() => {
    if (session) fetchMyReviews().then((r) => { if (r) { setMine(r.reviews); setWallet(r.wallet); } else if (!getReviewSession()) setSession(null); });
  }, [session, done, walletTick]);

  const institutions = useMemo(() => [...(catalog?.institutions ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'es')), [catalog]);
  const programs = useMemo(() => (catalog?.courses ?? []).filter((c) => c.institution_id === instId).sort((a, b) => a.name.localeCompare(b.name, 'es')), [catalog, instId]);
  const course = catalog?.byId.get(courseId);

  const submission: ReviewSubmission = {
    institution_id: instId, course_id: courseId || null, inst_scores: inst, program_scores: courseId ? prog : null, best, improve,
    recommend: recommend == null ? null : recommend === 'si', study_year: year, student_status: status, author_name: name,
    wants_incentive: wantsIncentive, consent
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = Object.values(validateSubmission(submission));
    if (evidence && evidence.size > 8 * 1024 * 1024) errs.push('La constancia no puede superar 8 MB.');
    setErrors(errs);
    if (errs.length) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    setBusy(true);
    try {
      const res = await submitReviewForm(submission, evidence, honeypot);
      if (course) track('review_submitted', { ...courseContext(course), rating: Math.round(Object.values(inst).reduce((a, b) => a + (b ?? 0), 0) / 5), relationship: status ?? '' });
      setDone(res);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      if (err instanceof ReviewApiError && err.status === 401) setSession(null);
      setErrors(err instanceof ReviewApiError ? [err.message, ...err.details] : ['No pudimos enviar tu reseña.']);
    } finally {
      setBusy(false);
    }
  };

  const chars = (s: string) => <span className={`text-xs ${s.trim().length < REVIEW_TEXT.min ? 'text-muted' : 'text-pos'}`}>{s.trim().length}/{REVIEW_TEXT.max}</span>;

  return (
    <div className="container-page max-w-5xl pt-8 pb-16">
      <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Opinar' }]} />
      <header className="mt-5 max-w-3xl">
        <h1 className="text-3xl text-white sm:text-4xl">Opina sobre tu institución</h1>
        <p className="mt-3 text-gray">Tu experiencia ayuda a otros profesionales a elegir dónde estudiar tecnología. Publicamos opiniones positivas y críticas por igual, sin sesgos.</p>
        {referred && <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-violet/40 bg-violet/10 px-3 py-1 text-sm text-white"><Icon name="check" size={14} className="text-pos" />Te invitaron a opinar: tu reseña también suma créditos de descuento.</p>}
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          {done ? (
            <section className="card p-6">
              <p className="flex items-center gap-2 text-lg text-white"><Icon name="check" className="text-pos" /> ¡Gracias! Recibimos tu reseña.</p>
              <p className="mt-2 text-sm text-gray">La revisaremos antes de publicarla (normalmente en 48 horas).{evidence ? ' Si tu constancia es válida, llevará la insignia de reseña verificada.' : ''}</p>
              {done.incentive > 0 && <p className="mt-2 text-sm text-gray">Crédito solicitado: <span className="text-white">S/ {done.incentive}</span> de descuento. Se activa cuando la reseña se publica y la constancia se verifica.</p>}
              <div className="mt-5 flex flex-wrap gap-2">
                <button className="btn btn-primary btn-sm" onClick={() => { setDone(null); setCourseId(''); setInst({}); setProg({}); setBest(''); setImprove(''); setRecommend(null); setEvidence(null); setWantsIncentive(false); setConsent(false); }}>Opinar sobre otro programa o institución</button>
                <Link to="/programas" className="btn btn-quiet btn-sm">Explorar programas</Link>
              </div>
            </section>
          ) : !session ? (
            <EmailGate onSession={setSession} />
          ) : (
            <form onSubmit={submit} noValidate className="space-y-5">
              <p className="flex flex-wrap items-center gap-2 text-sm text-gray">
                <Icon name="check" size={15} className="text-pos" /> Correo validado{session.email ? `: ${session.email}` : ''}
                <button type="button" className="text-blue-soft hover:text-white" onClick={() => { clearReviewSession(); setSession(null); }}>Salir</button>
              </p>
              {errors.length > 0 && (
                <div role="alert" className="rounded-xl border border-neg/40 bg-neg/10 p-3 text-sm text-white">
                  <p>Revisa lo siguiente:</p>
                  <ul className="mt-1 list-disc pl-5 text-gray">{errors.map((er) => <li key={er}>{er}</li>)}</ul>
                </div>
              )}

              <Section n={1} title="¿Dónde estudiaste?" hint="La reseña principal es sobre la institución. Si quieres, evalúa también el programa que cursaste.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted">Institución *</span>
                    <select className="input min-h-11 cursor-pointer py-2" value={instId} onChange={(e) => { setInstId(e.target.value); setCourseId(''); }}>
                      <option value="">Elige la institución</option>
                      {institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted">Programa cursado (opcional)</span>
                    <select className="input min-h-11 cursor-pointer py-2" value={courseId} disabled={!instId} onChange={(e) => setCourseId(e.target.value)}>
                      <option value="">Solo opinar sobre la institución</option>
                      {programs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted">Tu situación *</p>
                    <Pills label="Situación" value={status} onChange={setStatus} options={[['egresado', 'Egresado'], ['estudiante', 'Estudiante']]} />
                  </div>
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted">Año en que estudiaste *</span>
                    <select className="input min-h-11 cursor-pointer py-2" value={year ?? ''} onChange={(e) => setYear(e.target.value ? Number(e.target.value) : null)}>
                      <option value="">Elige el año</option>
                      {Array.from({ length: 16 }, (_, k) => YEAR - k).map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </label>
                </div>
              </Section>

              <Section n={2} title="Califica a la institución" hint="De 1 (muy malo) a 5 (excelente).">
                <ul className="space-y-3">
                  {INSTITUTION_DIMENSIONS.map((d) => (
                    <li key={d.key} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div><p className="text-sm text-white">{d.label}</p><p className="text-xs text-muted">{d.hint}</p></div>
                      <StarInput label={d.label} size={26} value={inst[d.key] ?? 0} onChange={(v) => setInst((s) => ({ ...s, [d.key]: v }))} />
                    </li>
                  ))}
                </ul>
              </Section>

              {courseId && (
                <Section n={3} title={`Evalúa el programa: ${course?.name ?? ''}`} hint="Contenido, metodología, herramientas y docente.">
                  <ul className="space-y-3">
                    {PROGRAM_DIMENSIONS.map((d) => (
                      <li key={d.key} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div><p className="text-sm text-white">{d.label}</p><p className="text-xs text-muted">{d.hint}</p></div>
                        <StarInput label={d.label} size={26} value={prog[d.key] ?? 0} onChange={(v) => setProg((s) => ({ ...s, [d.key]: v }))} />
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              <Section n={courseId ? 4 : 3} title="Tu experiencia">
                <div className="space-y-4">
                  <label className="block">
                    <span className="flex justify-between text-sm text-white">¿Qué fue lo mejor? * {chars(best)}</span>
                    <textarea rows={4} maxLength={REVIEW_TEXT.max} className="input mt-1 py-2 text-sm" value={best} onChange={(e) => setBest(e.target.value)} placeholder="Docentes, proyectos, contenidos, comunidad…" />
                  </label>
                  <label className="block">
                    <span className="flex justify-between text-sm text-white">¿Qué debería mejorar? * {chars(improve)}</span>
                    <textarea rows={4} maxLength={REVIEW_TEXT.max} className="input mt-1 py-2 text-sm" value={improve} onChange={(e) => setImprove(e.target.value)} placeholder="Sé concreto: ayuda a otros y a la institución." />
                  </label>
                  <div>
                    <p className="mb-2 text-sm text-white">¿Recomendarías la institución? *</p>
                    <Pills label="Recomendación" value={recommend} onChange={setRecommend} options={[['si', 'Sí, la recomiendo'], ['no', 'No la recomiendo']]} />
                  </div>
                  <label className="block max-w-sm">
                    <span className="text-sm text-white">Tu nombre *</span>
                    <input className="input mt-1 min-h-11" maxLength={REVIEW_TEXT.nameMax} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                    {name.trim().length > 1 && <span className="mt-1 block text-xs text-muted">Se publicará como: <span className="text-white">{displayName(name)}</span></span>}
                  </label>
                </div>
              </Section>

              <Section n={courseId ? 5 : 4} title="Verifica tu experiencia (opcional)" hint="Sube tu certificado, constancia de matrícula o boleta. Solo la ve el equipo de Groulevel; nunca se publica.">
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line-strong p-4 text-sm text-gray hover:border-cyan/50">
                  <Icon name="upload" className="text-cyan" />
                  <span className="flex-1">{evidence ? <span className="text-white">{evidence.name}</span> : 'PDF, JPG, PNG o WEBP · máx. 8 MB'}</span>
                  <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setEvidence(e.target.files?.[0] ?? null)} />
                  {evidence && <button type="button" className="text-xs text-muted hover:text-white" onClick={(e) => { e.preventDefault(); setEvidence(null); }}>Quitar</button>}
                </label>
                <p className="mt-2 text-xs text-muted">Con una constancia válida tu reseña lleva la insignia <span className="text-pos">Reseña verificada</span>.</p>
              </Section>

              <Section n={courseId ? 6 : 5} title="Crédito de descuento por tu tiempo (opcional)">
                <label className="flex items-start gap-3 text-sm text-gray">
                  <input type="checkbox" className="mt-1 accent-violet" checked={wantsIncentive} onChange={(e) => setWantsIncentive(e.target.checked)} />
                  <span>Quiero recibir <span className="text-white">S/ {CREDITS.review} de crédito</span> para usarlo como descuento adicional en el programa que elija.</span>
                </label>
                <ul className="mt-3 space-y-1 text-xs text-muted">
                  <li>· Se acumula por cada reseña y por cada persona que invites y opine (S/ {CREDITS.referral}). Hasta S/ {CREDITS.maxPerProgram} de descuento por programa.</li>
                  <li>· No depende de tu calificación: valoramos igual opiniones positivas y críticas.</li>
                  <li>· Se activa con la reseña publicada y la constancia verificada.</li>
                  <li>· Las reseñas con crédito se identifican públicamente como “Incentivada”.</li>
                </ul>
                {wantsIncentive && !evidence && <p className="mt-3 text-sm text-warn">Adjunta una constancia en el paso anterior: sin verificación el crédito no se activa.</p>}
              </Section>

              <label className="flex items-start gap-3 text-sm text-gray">
                <input type="checkbox" className="mt-1 accent-violet" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                Declaro que es mi experiencia real y autorizo a Groulevel a publicarla con mi nombre abreviado. Acepto que sea moderada según criterios objetivos.
              </label>
              <input type="text" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} name="website" />
              <button className="btn btn-accent w-full sm:w-auto" disabled={busy}>{busy ? 'Enviando…' : 'Enviar reseña'}</button>
            </form>
          )}
        </div>

        <aside className="space-y-4">
          {session && wallet && <Credits wallet={wallet} catalog={catalog} onChange={() => setWalletTick((t) => t + 1)} />}
          {session && <MyReviews list={mine} />}
          <div className="card p-5 text-sm text-gray">
            <h2 className="label-mono">Cómo funcionan las reseñas</h2>
            <ul className="mt-3 space-y-2">
              <li><span className="text-white">Correo validado:</span> una reseña por persona, institución y programa.</li>
              <li><span className="text-white">Moderación objetiva:</span> se publican opiniones positivas y críticas; se rechaza solo lo falso, ofensivo, publicitario o con datos personales.</li>
              <li><span className="text-white">Verificación:</span> tu constancia es privada y solo sirve para otorgar la insignia.</li>
              <li><span className="text-white">Privacidad:</span> publicamos tu nombre abreviado; nunca tu correo.</li>
              <li><span className="text-white">Créditos:</span> S/ {CREDITS.review} por reseña y S/ {CREDITS.referral} por referido, como descuento adicional (hasta S/ {CREDITS.maxPerProgram} por programa).</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
