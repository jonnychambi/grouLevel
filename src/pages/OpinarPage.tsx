import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { Icon } from '../components/ui/Icon';
import { StarInput } from '../components/reviews/Stars';
import { useCatalog } from '../hooks/useCatalog';
import { useSeo } from '../hooks/useSeo';
import { courseContext, track } from '../services/analytics';
import {
  clearReviewSession, consumeLinkSession, fetchMyReviews, getReviewSession, reviewAuthAvailable, ReviewApiError, startReviewLogin, submitReviewForm, verifyReviewCode,
  type MyReview, type ReviewSession
} from '../services/reviewsService';
import type { InstitutionScores, ProgramScores, StudentStatus } from '../types';
import {
  DETAILED_MIN, displayName, INSTITUTION_DIMENSIONS, isDetailedProgramReview, PROGRAM_DIMENSIONS, REVIEW_TEXT, validateSubmission, type ReviewSubmission
} from '../utils/reviews';

const YEAR = new Date().getFullYear();
const INCENTIVE_STATUS: Record<string, string> = { pendiente: 'en revisión', aprobado: 'aprobado', pagado: 'pagado', rechazado: 'no aplica' };
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
            {r.incentives.map((i) => <p key={i.kind} className="text-xs text-gray">Incentivo {i.kind === 'programa' ? 'programa' : 'institucional'}: S/ {Number(i.amount).toFixed(0)} · {INCENTIVE_STATUS[i.status] ?? i.status}</p>)}
          </li>
        ))}
      </ul>
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
  const [payoutMethod, setPayoutMethod] = useState<'yape' | 'plin' | 'transferencia' | null>(null);
  const [payoutAccount, setPayoutAccount] = useState('');
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
  useEffect(() => { if (session) fetchMyReviews().then((r) => { if (r) setMine(r); else if (!getReviewSession()) setSession(null); }); }, [session, done]);

  const institutions = useMemo(() => [...(catalog?.institutions ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'es')), [catalog]);
  const programs = useMemo(() => (catalog?.courses ?? []).filter((c) => c.institution_id === instId).sort((a, b) => a.name.localeCompare(b.name, 'es')), [catalog, instId]);
  const course = catalog?.byId.get(courseId);

  const submission: ReviewSubmission = {
    institution_id: instId, course_id: courseId || null, inst_scores: inst, program_scores: courseId ? prog : null, best, improve,
    recommend: recommend == null ? null : recommend === 'si', study_year: year, student_status: status, author_name: name,
    wants_incentive: wantsIncentive, payout_method: payoutMethod, payout_account: payoutAccount, consent
  };
  const detailed = isDetailedProgramReview(submission);
  const incentiveTotal = wantsIncentive ? 50 + (detailed ? 50 : 0) : 0;

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
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          {done ? (
            <section className="card p-6">
              <p className="flex items-center gap-2 text-lg text-white"><Icon name="check" className="text-pos" /> ¡Gracias! Recibimos tu reseña.</p>
              <p className="mt-2 text-sm text-gray">La revisaremos antes de publicarla (normalmente en 48 horas).{evidence ? ' Si tu constancia es válida, llevará la insignia de reseña verificada.' : ''}</p>
              {done.incentive > 0 && <p className="mt-2 text-sm text-gray">Incentivo solicitado: <span className="text-white">S/ {done.incentive}</span>. Se paga cuando la reseña se publica y la constancia se verifica.</p>}
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

              <Section n={courseId ? 6 : 5} title="Incentivo por tu tiempo (opcional)">
                <label className="flex items-start gap-3 text-sm text-gray">
                  <input type="checkbox" className="mt-1 accent-violet" checked={wantsIncentive} onChange={(e) => setWantsIncentive(e.target.checked)} />
                  <span>Quiero recibir el incentivo: <span className="text-white">S/ 50</span> por la reseña institucional verificada y <span className="text-white">S/ 50 adicionales</span> por la evaluación detallada del programa cursado.</span>
                </label>
                <ul className="mt-3 space-y-1 text-xs text-muted">
                  <li>· El incentivo no depende de tu calificación: valoramos igual opiniones positivas y críticas.</li>
                  <li>· Requiere constancia verificada y la reseña publicada. Máximo un incentivo por persona e institución/programa.</li>
                  <li>· Las reseñas con incentivo se identifican públicamente como “Incentivada”.</li>
                  <li>· Evaluación detallada: todas las dimensiones del programa y al menos {DETAILED_MIN} caracteres en “lo mejor” y “a mejorar”.</li>
                </ul>
                {wantsIncentive && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted">Recibir por</p>
                      <Pills label="Medio de pago" value={payoutMethod} onChange={setPayoutMethod} options={[['yape', 'Yape'], ['plin', 'Plin'], ['transferencia', 'Transferencia']]} />
                    </div>
                    <label className="block text-sm">
                      <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted">{payoutMethod === 'transferencia' ? 'Banco y número de cuenta' : 'Número de celular'}</span>
                      <input className="input min-h-11" maxLength={60} value={payoutAccount} onChange={(e) => setPayoutAccount(e.target.value)} />
                    </label>
                    <p className="text-sm text-gray sm:col-span-2">
                      Incentivo estimado: <span className="text-white">S/ {incentiveTotal}</span>
                      {!evidence && <span className="text-warn"> · adjunta una constancia: sin verificación no hay incentivo</span>}
                      {courseId && !detailed && <span className="text-muted"> · completa la evaluación detallada del programa para sumar S/ 50</span>}
                    </p>
                  </div>
                )}
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
          {session && <MyReviews list={mine} />}
          <div className="card p-5 text-sm text-gray">
            <h2 className="label-mono">Cómo funcionan las reseñas</h2>
            <ul className="mt-3 space-y-2">
              <li><span className="text-white">Correo validado:</span> una reseña por persona, institución y programa.</li>
              <li><span className="text-white">Moderación objetiva:</span> se publican opiniones positivas y críticas; se rechaza solo lo falso, ofensivo, publicitario o con datos personales.</li>
              <li><span className="text-white">Verificación:</span> tu constancia es privada y solo sirve para otorgar la insignia.</li>
              <li><span className="text-white">Privacidad:</span> publicamos tu nombre abreviado; nunca tu correo.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
