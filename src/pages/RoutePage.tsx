import { useEffect, useId, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { Icon, type IconName } from '../components/ui/Icon';
import { useSeo } from '../hooks/useSeo';
import { track } from '../services/analytics';
import { profileHistory, ProfileSubmitError, submitProfile } from '../services/profileService';
import { formatDate } from '../utils/format';
import { PROFILE_LIMITS, ROLE_LADDER } from '../utils/profileAnalysis';
import type { ProfilePreferences } from '../types';

const ACCEPT = '.pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';
const OBJECTIVE_EXAMPLES = [
  'Pasar de analista de datos a científico de datos y trabajar con machine learning',
  'Especializarme en ciberseguridad para trabajar en un SOC',
  'Liderar proyectos de transformación digital con metodologías ágiles',
  'Usar IA generativa para automatizar procesos en mi trabajo',
  'Convertirme en desarrollador full stack'
];
const STEPS = ['Leyendo tu información', 'Identificando formación y experiencia', 'Evaluando habilidades con criterio exigente', 'Midiendo la brecha con tu rol objetivo', 'Eligiendo estudios del catálogo'];
const ROLE_SUGGESTIONS = [...new Set(Object.values(ROLE_LADDER).flat())].sort((a, b) => a.localeCompare(b, 'es'));

type Mode = 'cv' | 'texto';
type Errors = Partial<Record<'file' | 'description' | 'objective' | 'consent', string>>;

export default function RoutePage() {
  useSeo({ title: 'Analiza tu perfil', description: 'Sube tu CV o describe tu perfil, indica el rol al que quieres llegar y recibe un diagnóstico exigente: habilidades, puestos sugeridos, brecha con tu objetivo, salario referencial y estudios recomendados.', path: '/mi-ruta' });
  const uid = useId();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>('cv');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [description, setDescription] = useState('');
  const [objective, setObjective] = useState('');
  const [prefs, setPrefs] = useState<ProfilePreferences>({ modality: 'cualquiera', budget_pen: null, hours_per_week: 6, target_role: '', expected_salary: null, salary_currency: 'PEN' });
  const [consent, setConsent] = useState(false);
  const [contactOk, setContactOk] = useState(false);
  const [trap, setTrap] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<{ message: string; details: string[] } | null>(null);
  const [sending, setSending] = useState(false);
  const [touched, setTouched] = useState(false);
  const [step, setStep] = useState(0);
  const history = profileHistory();

  useEffect(() => {
    if (!sending) return;
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 9000);
    return () => clearInterval(t);
  }, [sending]);

  const pickFile = (f: File | undefined | null) => {
    if (!f) return;
    if (!/\.(pdf|docx|txt)$/i.test(f.name)) return setErrors((e) => ({ ...e, file: 'Formato no admitido. Usa PDF, Word (.docx) o TXT.' }));
    if (f.size > PROFILE_LIMITS.fileMaxBytes) return setErrors((e) => ({ ...e, file: 'El archivo supera los 4 MB.' }));
    setErrors((e) => ({ ...e, file: undefined }));
    setFile(f);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files[0]);
  };

  const validate = (): Errors => {
    const errs: Errors = {};
    if (mode === 'cv' && !file) errs.file = 'Sube tu CV o cambia a "Describir mi perfil".';
    if (mode === 'texto' && description.trim().length < PROFILE_LIMITS.descriptionMin) errs.description = `Cuéntanos un poco más (mínimo ${PROFILE_LIMITS.descriptionMin} caracteres): cargo, empresa, años de experiencia, formación y herramientas.`;
    if (objective.trim().length < PROFILE_LIMITS.objectiveMin) errs.objective = 'Describe tu objetivo con un poco más de detalle.';
    if (!consent) errs.consent = 'Necesitamos tu autorización para analizar tu información.';
    return errs;
  };

  // Tras el primer intento, los errores se actualizan mientras la persona corrige.
  useEffect(() => {
    if (touched) setErrors(validate());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touched, mode, file, description, objective, consent]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.getElementById(`${uid}-${Object.keys(errs)[0]}`)?.focus();
      return;
    }
    const fd = new FormData();
    if (mode === 'cv' && file) fd.set('cv', file);
    fd.set('description', description.trim());
    fd.set('objective', objective.trim());
    fd.set('modality', prefs.modality);
    if (prefs.budget_pen) fd.set('budget_pen', String(prefs.budget_pen));
    if (prefs.hours_per_week) fd.set('hours_per_week', String(prefs.hours_per_week));
    if (prefs.target_role?.trim()) fd.set('target_role', prefs.target_role.trim());
    if (prefs.expected_salary) fd.set('expected_salary', String(prefs.expected_salary));
    fd.set('salary_currency', prefs.salary_currency ?? 'PEN');
    fd.set('consent', String(consent));
    fd.set('contact_ok', String(contactOk));
    fd.set('website', trap);
    setSending(true);
    setServerError(null);
    try {
      const profile = await submitProfile(fd);
      track('profile_submitted', { source: profile.source, engine: profile.engine, stages: profile.route.stages.length, target_areas: profile.route.target_areas });
      navigate(`/mi-ruta/${profile.id}`, { state: { profile } });
    } catch (err) {
      setServerError(err instanceof ProfileSubmitError ? { message: err.message, details: err.details } : { message: 'No pudimos analizar tu perfil.', details: [] });
      setSending(false);
    }
  };

  const err = (k: keyof Errors) => errors[k] && <p id={`${uid}-${k}-error`} className="mt-1.5 flex items-center gap-1.5 text-xs text-neg"><Icon name="alert" size={13} />{errors[k]}</p>;
  const aria = (k: keyof Errors) => ({ id: `${uid}-${k}`, 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `${uid}-${k}-error` : undefined });
  const label = 'mb-1.5 block text-sm font-medium text-white';

  return (
    <div className="container-page pt-8 pb-16">
      <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Analiza tu perfil' }]} />
      <header className="mt-6 grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-end">
        <div>
          <p className="eyebrow">Diagnóstico de perfil</p>
          <h1 className="mt-3 text-4xl text-white sm:text-5xl">Analiza tu perfil, <span className="grad-text">descubre tu brecha.</span></h1>
          <p className="mt-4 max-w-xl text-lg text-gray">Sube tu CV o cuéntanos tu perfil y el rol al que quieres llegar. Te mostramos un diagnóstico exigente de tus habilidades, los puestos a los que puedes postular hoy, la brecha con tu objetivo, el salario referencial y qué estudiar.</p>
        </div>
        <ol className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          {([['upload', 'Tu perfil', 'CV o descripción'], ['target', 'Tu objetivo', 'A dónde quieres llegar'], ['route', 'Tu ruta', 'Programas por etapas']] as [IconName, string, string][]).map(([icon, t, d], i) => (
            <li key={t} className="card flex items-center gap-3 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line-strong text-cyan"><Icon name={icon} size={18} /></span>
              <div><p className="font-mono text-[11px] text-dim">0{i + 1}</p><p className="text-sm font-medium text-white">{t}</p><p className="text-xs text-gray">{d}</p></div>
            </li>
          ))}
        </ol>
      </header>

      <form onSubmit={submit} noValidate className="mt-10 grid gap-6 lg:grid-cols-[1fr_340px]" aria-busy={sending}>
        <div className="space-y-6">
          {/* 1. PERFIL */}
          <fieldset className="card p-5 sm:p-6" disabled={sending}>
            <legend className="sr-only">Tu perfil</legend>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl text-white"><span className="mr-2 font-mono text-sm text-cyan">01</span>Tu perfil</h2>
              <div role="tablist" aria-label="Cómo compartir tu perfil" className="inline-flex rounded-full border border-line-strong p-1">
                {([['cv', 'Subir CV'], ['texto', 'Describir mi perfil']] as [Mode, string][]).map(([m, t]) => (
                  <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`rounded-full px-4 py-1.5 text-sm ${mode === m ? 'bg-white text-navy' : 'text-gray hover:text-white'}`}>{t}</button>
                ))}
              </div>
            </div>

            {mode === 'cv' ? (
              <div className="mt-5">
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={`rounded-2xl border border-dashed p-6 text-center transition-colors ${dragging ? 'border-cyan bg-cyan/5' : errors.file ? 'border-neg/60' : 'border-line-strong'}`}
                >
                  {file ? (
                    <div className="flex items-center justify-between gap-3 text-left">
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue/15 text-blue-soft"><Icon name="file" size={20} /></span>
                        <span className="min-w-0"><span className="block truncate text-white">{file.name}</span><span className="text-xs text-gray">{(file.size / 1024).toFixed(0)} KB</span></span>
                      </span>
                      <button type="button" className="btn btn-quiet btn-sm" onClick={() => { setFile(null); if (fileInput.current) fileInput.current.value = ''; }}>Quitar</button>
                    </div>
                  ) : (
                    <>
                      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-line-strong text-cyan"><Icon name="upload" size={20} /></span>
                      <p className="mt-3 text-white">Arrastra tu CV aquí o <button type="button" className="text-cyan underline underline-offset-4" onClick={() => fileInput.current?.click()} {...aria('file')}>elige un archivo</button></p>
                      <p className="mt-1 text-xs text-gray">PDF, Word (.docx) o TXT · máximo 4 MB</p>
                    </>
                  )}
                  <input ref={fileInput} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => pickFile(e.target.files?.[0])} />
                </div>
                {err('file')}
                <label htmlFor={`${uid}-extra`} className={`${label} mt-5`}>¿Algo que tu CV no diga? <span className="font-normal text-muted">(opcional)</span></label>
                <textarea id={`${uid}-extra`} rows={3} className="input py-2" maxLength={2000} placeholder="Ej. Estoy cursando una maestría, tengo experiencia freelance en…" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            ) : (
              <div className="mt-5">
                <label htmlFor={`${uid}-description`} className={label}>Describe tu posición y formación actual</label>
                <textarea {...aria('description')} rows={7} className="input py-2" maxLength={6000}
                  placeholder="Ej. Soy analista contable en una empresa de retail desde 2019. Estudié Contabilidad en la Universidad de Lima y estoy llevando un diplomado de finanzas. Manejo Excel avanzado, Power BI y SAP. Lidero a un equipo de 2 personas."
                  value={description} onChange={(e) => setDescription(e.target.value)} />
                <p className="mt-1 text-right font-mono text-[11px] text-dim">{description.trim().length} / {PROFILE_LIMITS.descriptionMin} mín.</p>
                {err('description')}
              </div>
            )}
          </fieldset>

          {/* 2. OBJETIVO */}
          <fieldset className="card p-5 sm:p-6" disabled={sending}>
            <legend className="sr-only">Tu objetivo</legend>
            <h2 className="text-xl text-white"><span className="mr-2 font-mono text-sm text-cyan">02</span>Tu objetivo de formación</h2>
            <label htmlFor={`${uid}-objective`} className="mt-1 block text-sm text-gray">¿Qué quieres aprender o a qué rol quieres llegar?</label>
            <textarea {...aria('objective')} rows={3} className="input mt-4 py-2" maxLength={PROFILE_LIMITS.objectiveMax} placeholder="Ej. Quiero pasar de analista de datos a científico de datos en los próximos 12 meses." value={objective} onChange={(e) => setObjective(e.target.value)} />
            {err('objective')}
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Ejemplos de objetivos">
              {OBJECTIVE_EXAMPLES.map((ex) => (
                <button key={ex} type="button" className="chip text-left" onClick={() => setObjective(ex)}>{ex}</button>
              ))}
            </div>
            <div className="mt-6 grid gap-4 border-t border-line pt-5 sm:grid-cols-[1.4fr_1fr]">
              <div>
                <label htmlFor={`${uid}-target-role`} className={label}>Rol objetivo <span className="font-normal text-muted">(recomendado)</span></label>
                <input id={`${uid}-target-role`} list={`${uid}-roles`} className="input" maxLength={100} placeholder="Ej. Científico de Datos Senior" value={prefs.target_role ?? ''} onChange={(e) => setPrefs({ ...prefs, target_role: e.target.value })} />
                <datalist id={`${uid}-roles`}>{ROLE_SUGGESTIONS.map((r) => <option key={r} value={r} />)}</datalist>
              </div>
              <div>
                <label htmlFor={`${uid}-salary`} className={label}>¿Qué salario mensual esperas en ese rol?</label>
                <div className="flex gap-2">
                  <select aria-label="Moneda" className="input w-24 shrink-0" value={prefs.salary_currency ?? 'PEN'} onChange={(e) => setPrefs({ ...prefs, salary_currency: e.target.value as 'PEN' | 'USD' })}>
                    <option value="PEN">S/</option>
                    <option value="USD">US$</option>
                  </select>
                  <input id={`${uid}-salary`} type="number" inputMode="numeric" min={0} step={100} className="input" placeholder="Ej. 9000" value={prefs.expected_salary ?? ''} onChange={(e) => setPrefs({ ...prefs, expected_salary: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <p className="mt-1 text-xs text-muted">Bruto mensual. Lo comparamos con el rango referencial del rol.</p>
              </div>
            </div>
          </fieldset>

          {/* 3. PREFERENCIAS */}
          <fieldset className="card p-5 sm:p-6" disabled={sending}>
            <legend className="sr-only">Preferencias</legend>
            <h2 className="text-xl text-white"><span className="mr-2 font-mono text-sm text-cyan">03</span>Preferencias <span className="text-sm font-normal text-muted">(opcional)</span></h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor={`${uid}-modality`} className={label}>Modalidad</label>
                <select id={`${uid}-modality`} className="input" value={prefs.modality} onChange={(e) => setPrefs({ ...prefs, modality: e.target.value as ProfilePreferences['modality'] })}>
                  <option value="cualquiera">Cualquiera</option>
                  <option value="en-vivo">En vivo (online)</option>
                  <option value="grabado">Grabado / a mi ritmo</option>
                  <option value="hibrido">Híbrido</option>
                  <option value="presencial">Presencial</option>
                </select>
              </div>
              <div>
                <label htmlFor={`${uid}-budget`} className={label}>Presupuesto máx. por programa</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray">S/</span>
                  <input id={`${uid}-budget`} type="number" inputMode="numeric" min={0} step={100} className="input pl-9" placeholder="Sin límite" value={prefs.budget_pen ?? ''} onChange={(e) => setPrefs({ ...prefs, budget_pen: e.target.value ? Number(e.target.value) : null })} />
                </div>
              </div>
              <div>
                <label htmlFor={`${uid}-hours`} className={label}>Tiempo disponible</label>
                <select id={`${uid}-hours`} className="input" value={prefs.hours_per_week ?? ''} onChange={(e) => setPrefs({ ...prefs, hours_per_week: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">No lo sé</option>
                  {[3, 6, 10, 15, 20].map((h) => <option key={h} value={h}>{h} h por semana</option>)}
                </select>
              </div>
            </div>
          </fieldset>
        </div>

        {/* RESUMEN Y ENVÍO */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5 sm:p-6">
            <h2 className="text-lg text-white">Qué recibirás</h2>
            <ul className="mt-4 space-y-3 text-sm text-gray">
              {[
                ['chart', 'Un diagnóstico exigente de tus habilidades técnicas y blandas'],
                ['user', 'Los puestos a los que puedes postular hoy, con salario referencial'],
                ['target', 'La brecha entre tu perfil y el rol objetivo, y cuánto tiempo tomaría cerrarla'],
                ['book', 'Estudios sugeridos: corto plazo (cursos, diplomados, bootcamps) y largo plazo (maestrías)']
              ].map(([icon, t]) => (
                <li key={t} className="flex gap-3"><Icon name={icon as IconName} size={17} className="mt-0.5 shrink-0 text-cyan" />{t}</li>
              ))}
            </ul>

            <div className="mt-6 space-y-3 border-t border-line pt-5">
              <label className="flex cursor-pointer items-start gap-3 text-sm text-gray">
                <input {...aria('consent')} type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-cyan)]" disabled={sending} />
                <span>Autorizo a Groulevel a guardar mi CV y los datos que contiene para generar mi diagnóstico (Ley N.º 29733 de Protección de Datos Personales).</span>
              </label>
              {err('consent')}
              <label className="flex cursor-pointer items-start gap-3 text-sm text-gray">
                <input type="checkbox" checked={contactOk} onChange={(e) => setContactOk(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-cyan)]" disabled={sending} />
                <span>Quiero que un asesor me contacte con opciones de formación. <span className="text-muted">(opcional)</span></span>
              </label>
            </div>
            <div className="sr-only" aria-hidden="true">
              <label htmlFor={`${uid}-website`}>Sitio web</label>
              <input id={`${uid}-website`} tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
            </div>

            {serverError && (
              <div role="alert" className="mt-5 rounded-xl border border-neg/40 bg-neg/10 p-3 text-sm text-white">
                <p>{serverError.message}</p>
                {serverError.details.length > 0 && <ul className="mt-1 list-disc pl-5 text-gray">{serverError.details.map((d) => <li key={d}>{d}</li>)}</ul>}
              </div>
            )}

            <button type="submit" className="btn btn-accent btn-lg mt-6 w-full" disabled={sending}>
              {sending ? 'Analizando…' : <>Analiza mi perfil <Icon name="arrow-right" size={17} /></>}
            </button>
            {sending && (
              <ol className="mt-5 space-y-2.5" role="status" aria-live="polite">
                {STEPS.map((s, i) => (
                  <li key={s} className={`flex items-center gap-2.5 text-sm ${i < step ? 'text-pos' : i === step ? 'text-white' : 'text-dim'}`}>
                    {i < step ? <Icon name="check" size={15} /> : <span className={`h-2 w-2 rounded-full ${i === step ? 'animate-pulse bg-cyan' : 'bg-line-strong'}`} />}
                    {s}
                  </li>
                ))}
                <li className="pt-1 text-xs text-muted">Puede tardar hasta un par de minutos.</li>
              </ol>
            )}
          </div>

          {history.length > 0 && !sending && (
            <div className="card mt-4 p-5">
              <h2 className="label-mono">Tus diagnósticos anteriores</h2>
              <ul className="mt-3 space-y-2">
                {history.map((h) => (
                  <li key={h.id}>
                    <Link to={`/mi-ruta/${h.id}`} className="block rounded-lg px-2 py-1.5 text-sm text-gray hover:bg-raise hover:text-white">
                      <span className="line-clamp-1">{h.objective}</span>
                      <span className="font-mono text-[11px] text-dim">{formatDate(h.created_at.slice(0, 10))}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </form>
    </div>
  );
}
