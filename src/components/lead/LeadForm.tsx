import { useId, useState, type FormEvent, type ReactNode } from 'react';
import type { LeadFormInput, LeadObjective, StartTimeline } from '../../types';
import { OBJECTIVE_OPTIONS, TIMELINE_OPTIONS } from '../../utils/leadScoring';
import { storage } from '../../services/storage';
import { Icon } from '../ui/Icon';

export const COUNTRIES = ['Perú', 'Argentina', 'Bolivia', 'Chile', 'Colombia', 'Costa Rica', 'Ecuador', 'El Salvador', 'España', 'Estados Unidos', 'Guatemala', 'Honduras', 'México', 'Panamá', 'Paraguay', 'República Dominicana', 'Uruguay', 'Venezuela', 'Otro'];

const PROFILE_KEY = 'lead-profile';
type Profile = Pick<LeadFormInput, 'first_name' | 'last_name' | 'email' | 'whatsapp' | 'country'>;
type Errors = Partial<Record<keyof LeadFormInput, string>>;

export function validateLead(v: Partial<LeadFormInput>): Errors {
  const e: Errors = {};
  if (!v.first_name?.trim()) e.first_name = 'Ingresa tu nombre.';
  if (!v.last_name?.trim()) e.last_name = 'Ingresa tu apellido.';
  if (!v.email?.trim()) e.email = 'Ingresa tu email.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim())) e.email = 'Revisa el formato del email (ej. nombre@correo.com).';
  const digits = (v.whatsapp ?? '').replace(/\D/g, '');
  if (!digits) e.whatsapp = 'Ingresa tu número de WhatsApp.';
  else if (digits.length < 8 || digits.length > 15) e.whatsapp = 'Ingresa un número válido, idealmente con código de país.';
  if (!v.country) e.country = 'Selecciona tu país.';
  if (!v.start_timeline) e.start_timeline = 'Elige una opción.';
  if (!v.objective) e.objective = 'Elige tu objetivo principal.';
  if (!v.consent) e.consent = 'Necesitamos tu autorización para enviar tus datos a la institución.';
  return e;
}

interface Props {
  institutionName: string;
  submitting: boolean;
  onSubmit: (input: LeadFormInput) => void;
}

function Field({ id, label, error, children, hint }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-white">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1.5 flex items-center gap-1.5 text-xs text-neg"><Icon name="alert" size={13} />{error}</p>}
    </div>
  );
}

export function LeadForm({ institutionName, submitting, onSubmit }: Props) {
  const uid = useId();
  const saved = storage.get<Profile | null>(PROFILE_KEY, null);
  const [values, setValues] = useState<Partial<LeadFormInput>>({ country: 'Perú', consent: false, ...saved });
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState(false);

  const set = <K extends keyof LeadFormInput>(k: K, v: LeadFormInput[K]) => {
    const next = { ...values, [k]: v };
    setValues(next);
    if (touched) setErrors(validateLead(next));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    const errs = validateLead(values);
    setErrors(errs);
    if (Object.keys(errs).length) {
      const first = Object.keys(errs)[0];
      document.getElementById(`${uid}-${first}`)?.focus();
      return;
    }
    const input = values as LeadFormInput;
    storage.set<Profile>(PROFILE_KEY, { first_name: input.first_name, last_name: input.last_name, email: input.email, whatsapp: input.whatsapp, country: input.country });
    onSubmit(input);
  };

  const fid = (k: keyof LeadFormInput) => `${uid}-${k}`;
  const aria = (k: keyof LeadFormInput) => ({ id: fid(k), 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `${fid(k)}-error` : undefined });

  return (
    <form onSubmit={submit} noValidate className="space-y-5 px-5 py-5 sm:px-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={fid('first_name')} label="Nombre" error={errors.first_name}>
          <input {...aria('first_name')} className="input" autoComplete="given-name" value={values.first_name ?? ''} onChange={(e) => set('first_name', e.target.value)} data-autofocus />
        </Field>
        <Field id={fid('last_name')} label="Apellido" error={errors.last_name}>
          <input {...aria('last_name')} className="input" autoComplete="family-name" value={values.last_name ?? ''} onChange={(e) => set('last_name', e.target.value)} />
        </Field>
        <Field id={fid('email')} label="Email" error={errors.email}>
          <input {...aria('email')} className="input" type="email" inputMode="email" autoComplete="email" placeholder="nombre@correo.com" value={values.email ?? ''} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field id={fid('whatsapp')} label="WhatsApp" error={errors.whatsapp} hint="Incluye el código de país.">
          <input {...aria('whatsapp')} className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="+51 999 999 999" value={values.whatsapp ?? ''} onChange={(e) => set('whatsapp', e.target.value)} />
        </Field>
        <Field id={fid('country')} label="País" error={errors.country}>
          <select {...aria('country')} className="input cursor-pointer" autoComplete="country-name" value={values.country ?? ''} onChange={(e) => set('country', e.target.value)}>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-white">¿Cuándo te gustaría empezar a estudiar?</legend>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-describedby={errors.start_timeline ? `${fid('start_timeline')}-error` : undefined}>
          {TIMELINE_OPTIONS.map((o, i) => {
            const checked = values.start_timeline === o.value;
            return (
              <label key={o.value} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition-colors ${checked ? 'border-cyan/70 bg-cyan/5 text-white' : 'border-line-strong text-gray hover:border-gray/40'}`}>
                <input
                  type="radio"
                  name={fid('start_timeline')}
                  id={i === 0 ? fid('start_timeline') : undefined}
                  value={o.value}
                  checked={checked}
                  onChange={() => set('start_timeline', o.value as StartTimeline)}
                  className="peer sr-only"
                />
                <span aria-hidden="true" className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border peer-focus-visible:ring-2 peer-focus-visible:ring-cyan ${checked ? 'border-cyan' : 'border-gray/50'}`}>
                  {checked && <span className="h-2 w-2 rounded-full bg-cyan" />}
                </span>
                {o.label}
              </label>
            );
          })}
        </div>
        {errors.start_timeline && <p id={`${fid('start_timeline')}-error`} className="mt-1.5 flex items-center gap-1.5 text-xs text-neg"><Icon name="alert" size={13} />{errors.start_timeline}</p>}
      </fieldset>

      <Field id={fid('objective')} label="¿Cuál es tu principal objetivo?" error={errors.objective}>
        <select {...aria('objective')} className="input cursor-pointer" value={values.objective ?? ''} onChange={(e) => set('objective', e.target.value as LeadObjective)}>
          <option value="" disabled>Selecciona una opción</option>
          {OBJECTIVE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>

      <div>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-gray">
          <input
            id={fid('consent')}
            type="checkbox"
            checked={!!values.consent}
            onChange={(e) => set('consent', e.target.checked)}
            aria-invalid={!!errors.consent}
            aria-describedby={errors.consent ? `${fid('consent')}-error` : undefined}
            className="peer sr-only"
          />
          <span aria-hidden="true" className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border peer-focus-visible:ring-2 peer-focus-visible:ring-cyan ${values.consent ? 'border-cyan bg-cyan text-navy' : 'border-gray/50 bg-navy'}`}>
            {values.consent && <Icon name="check" size={11} strokeWidth={3.5} />}
          </span>
          <span>Autorizo a Groulevel a compartir mis datos con <strong className="font-medium text-white">{institutionName}</strong> para que me contacte sobre este programa.</span>
        </label>
        {errors.consent && <p id={`${fid('consent')}-error`} className="mt-1.5 flex items-center gap-1.5 text-xs text-neg"><Icon name="alert" size={13} />{errors.consent}</p>}
      </div>

      <button type="submit" className="btn btn-accent btn-lg w-full" disabled={submitting} aria-busy={submitting}>
        {submitting ? (
          <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" /> Enviando…</>
        ) : (
          'Enviar solicitud'
        )}
      </button>
      <p className="text-center text-xs text-muted">Sin costo y sin compromiso. Solo compartimos tus datos con la institución que elegiste.</p>
    </form>
  );
}
