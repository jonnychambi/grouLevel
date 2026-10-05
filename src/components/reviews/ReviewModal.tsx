import { useId, useState, type FormEvent } from 'react';
import type { CourseWithInstitution, ReviewRelationship } from '../../types';
import { courseContext, track } from '../../services/analytics';
import { submitReview, ReviewSubmitError } from '../../services/reviewsService';
import { RELATIONSHIP_LABELS, REVIEW_LIMITS, validateReview, type ReviewInput } from '../../utils/reviews';
import { Icon } from '../ui/Icon';
import { Modal } from '../ui/Modal';
import { StarInput } from './Stars';

type Errors = Partial<Record<keyof ReviewInput, string>>;

/** Formulario de reseña. Se publica solo después de la validación del equipo de Groulevel. */
export function ReviewModal({ course, onClose }: { course: CourseWithInstitution; onClose: () => void }) {
  const uid = useId();
  const [v, setV] = useState<Partial<ReviewInput>>({ rating: 0, title: '', comment: '', author_name: '', author_email: '', consent: false });
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState(false);
  const [trap, setTrap] = useState('');
  const [state, setState] = useState<'form' | 'sending' | 'done'>('form');
  const [serverError, setServerError] = useState<string>('');

  const set = <K extends keyof ReviewInput>(k: K, val: ReviewInput[K]) => {
    const next = { ...v, [k]: val };
    setV(next);
    if (touched) setErrors(validateReview(next));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    const errs = validateReview(v);
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.getElementById(`${uid}-${Object.keys(errs)[0]}`)?.focus();
      return;
    }
    setState('sending');
    setServerError('');
    try {
      await submitReview(course.id, v as ReviewInput, trap);
      track('review_submitted', { ...courseContext(course), rating: v.rating!, relationship: v.relationship! });
      setState('done');
    } catch (err) {
      setServerError(err instanceof ReviewSubmitError ? [err.message, ...err.details].join(' ') : 'No pudimos enviar tu reseña.');
      setState('form');
    }
  };

  const err = (k: keyof ReviewInput) => errors[k] && <p id={`${uid}-${k}-error`} className="mt-1.5 flex items-center gap-1.5 text-xs text-neg"><Icon name="alert" size={13} />{errors[k]}</p>;
  const aria = (k: keyof ReviewInput) => ({ id: `${uid}-${k}`, 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `${uid}-${k}-error` : undefined });
  const label = 'mb-1.5 block text-sm font-medium text-white';

  return (
    <Modal open onClose={onClose} title={state === 'done' ? 'Reseña recibida' : 'Escribe una reseña'} description={state === 'done' ? undefined : `${course.name} · ${course.institution.name}`} size="lg">
      {state === 'done' ? (
        <div className="px-6 py-10 text-center" role="status">
          <span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full border border-pos/40 bg-pos/10 text-pos"><Icon name="check" size={30} /></span>
          <h3 className="text-2xl text-white">¡Gracias por tu reseña!</h3>
          <p className="mx-auto mt-3 max-w-md text-gray">Nuestro equipo la revisará para verificar que cumpla las pautas de la comunidad. Una vez validada, se publicará en esta página.</p>
          <button className="btn btn-primary mt-8" onClick={onClose}>Volver al programa</button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-5 px-5 py-5 sm:px-6">
          <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
            <label htmlFor={`${uid}-website`}>Sitio web</label>
            <input id={`${uid}-website`} type="text" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
          </div>

          <div>
            <span className={label} id={`${uid}-rating`} tabIndex={-1}>¿Cómo calificas este programa?</span>
            <StarInput value={v.rating ?? 0} onChange={(n) => set('rating', n)} invalid={!!errors.rating} describedBy={errors.rating ? `${uid}-rating-error` : undefined} />
            {err('rating')}
          </div>

          <fieldset>
            <legend className={label}>¿Cuál es tu relación con el programa?</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {(Object.entries(RELATIONSHIP_LABELS) as [ReviewRelationship, string][]).map(([value, text], i) => {
                const checked = v.relationship === value;
                return (
                  <label key={value} className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm ${checked ? 'border-cyan/70 bg-cyan/5 text-white' : 'border-line-strong text-gray hover:border-gray/40'}`}>
                    <input type="radio" name={`${uid}-rel`} id={i === 0 ? `${uid}-relationship` : undefined} checked={checked} onChange={() => set('relationship', value)} className="peer sr-only" />
                    <span aria-hidden="true" className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border peer-focus-visible:ring-2 peer-focus-visible:ring-cyan ${checked ? 'border-cyan' : 'border-gray/50'}`}>{checked && <span className="h-2 w-2 rounded-full bg-cyan" />}</span>
                    {text}
                  </label>
                );
              })}
            </div>
            {err('relationship')}
          </fieldset>

          <div>
            <label htmlFor={`${uid}-title`} className={label}>Título <span className="font-normal text-muted">(opcional)</span></label>
            <input {...aria('title')} className="input" maxLength={REVIEW_LIMITS.titleMax} placeholder="Ej. Muy práctico y con buenos docentes" value={v.title} onChange={(e) => set('title', e.target.value)} />
            {err('title')}
          </div>

          <div>
            <label htmlFor={`${uid}-comment`} className={label}>Tu experiencia</label>
            <textarea {...aria('comment')} rows={5} className="input py-2" maxLength={REVIEW_LIMITS.commentMax} placeholder="¿Qué te gustó? ¿Qué mejorarías? ¿Lo recomendarías? Contenido, docentes, plataforma, empleabilidad…" value={v.comment} onChange={(e) => set('comment', e.target.value)} />
            <p className="mt-1 text-right text-xs text-muted tnum">{(v.comment ?? '').trim().length}/{REVIEW_LIMITS.commentMax}</p>
            {err('comment')}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${uid}-author_name`} className={label}>Tu nombre</label>
              <input {...aria('author_name')} className="input" autoComplete="name" maxLength={REVIEW_LIMITS.nameMax} value={v.author_name} onChange={(e) => set('author_name', e.target.value)} />
              <p className="mt-1 text-xs text-muted">Se mostrará solo tu nombre e inicial del apellido.</p>
              {err('author_name')}
            </div>
            <div>
              <label htmlFor={`${uid}-author_email`} className={label}>Email</label>
              <input {...aria('author_email')} type="email" inputMode="email" autoComplete="email" className="input" value={v.author_email} onChange={(e) => set('author_email', e.target.value)} />
              <p className="mt-1 text-xs text-muted">No se publica. Lo usamos para validar la reseña.</p>
              {err('author_email')}
            </div>
          </div>

          <div>
            <label className="flex cursor-pointer items-start gap-3 text-sm text-gray">
              <input id={`${uid}-consent`} type="checkbox" checked={!!v.consent} onChange={(e) => set('consent', e.target.checked)} className="peer sr-only" />
              <span aria-hidden="true" className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border peer-focus-visible:ring-2 peer-focus-visible:ring-cyan ${v.consent ? 'border-cyan bg-cyan text-navy' : 'border-gray/50 bg-navy'}`}>{v.consent && <Icon name="check" size={11} strokeWidth={3.5} />}</span>
              <span>Confirmo que mi reseña es honesta, basada en mi experiencia, y autorizo su publicación en Groulevel tras su validación.</span>
            </label>
            {err('consent')}
          </div>

          {serverError && <p role="alert" className="flex items-start gap-2 rounded-xl border border-neg/40 bg-neg/10 p-3 text-sm text-white"><Icon name="alert" className="mt-0.5 shrink-0 text-neg" />{serverError}</p>}

          <button type="submit" className="btn btn-accent btn-lg w-full" disabled={state === 'sending'}>{state === 'sending' ? 'Enviando…' : 'Enviar reseña'}</button>
          <p className="text-center text-xs text-muted">Las reseñas se publican después de una revisión. No publicamos contenido ofensivo, publicitario ni con datos personales.</p>
        </form>
      )}
    </Modal>
  );
}
