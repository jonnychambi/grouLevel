/** Controles de formulario compactos para el administrador. */
import { useId, type ReactNode } from 'react';

const label = 'mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted';

export function Field({ title, hint, children, className = '' }: { title: string; hint?: string; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className={label}>{title}</label>
      {children(id)}
      {hint && <p className="mt-1 text-xs text-dim">{hint}</p>}
    </div>
  );
}

export function TextInput({ title, value, onChange, hint, placeholder, className, required, type = 'text' }: { title: string; value: string | null | undefined; onChange: (v: string) => void; hint?: string; placeholder?: string; className?: string; required?: boolean; type?: string }) {
  return (
    <Field title={title + (required ? ' *' : '')} hint={hint} className={className}>
      {(id) => <input id={id} type={type} className="input min-h-10 py-2 text-sm" value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} required={required} />}
    </Field>
  );
}

export function NullableText({ title, value, onChange, ...rest }: { title: string; value: string | null; onChange: (v: string | null) => void; hint?: string; placeholder?: string; className?: string }) {
  return <TextInput title={title} value={value} onChange={(v) => onChange(v.trim() ? v : null)} {...rest} />;
}

export function NumberInput({ title, value, onChange, hint, className, step = 'any' }: { title: string; value: number | null; onChange: (v: number | null) => void; hint?: string; className?: string; step?: string }) {
  return (
    <Field title={title} hint={hint} className={className}>
      {(id) => (
        <input
          id={id}
          type="number"
          min={0}
          step={step}
          inputMode="decimal"
          className="input min-h-10 py-2 text-sm tnum"
          value={value ?? ''}
          placeholder="No publicado"
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      )}
    </Field>
  );
}

export function TextArea({ title, value, onChange, hint, rows = 3, className }: { title: string; value: string; onChange: (v: string) => void; hint?: string; rows?: number; className?: string }) {
  return (
    <Field title={title} hint={hint} className={className}>
      {(id) => <textarea id={id} rows={rows} className="input py-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)} />}
    </Field>
  );
}

/** Lista editada como texto: un elemento por línea. */
export function LinesInput({ title, value, onChange, hint, rows = 4, className }: { title: string; value: string[]; onChange: (v: string[]) => void; hint?: string; rows?: number; className?: string }) {
  return (
    <TextArea
      title={title}
      hint={hint ?? 'Un elemento por línea.'}
      rows={rows}
      className={className}
      value={value.join('\n')}
      onChange={(v) => onChange(v.split('\n').map((x) => x.trimStart()).filter((x, i, arr) => x !== '' || i === arr.length - 1))}
    />
  );
}

export function Select<T extends string>({ title, value, options, onChange, className, allowEmpty, emptyLabel = 'No publicado' }: { title: string; value: T | null; options: { value: T; label: string }[]; onChange: (v: T | null) => void; className?: string; allowEmpty?: boolean; emptyLabel?: string }) {
  return (
    <Field title={title} className={className}>
      {(id) => (
        <select id={id} className="input min-h-10 cursor-pointer py-2 text-sm" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : (e.target.value as T))}>
          {allowEmpty && <option value="">{emptyLabel}</option>}
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
    </Field>
  );
}

/** Sí / No / No especificado. */
export function TriState({ title, value, onChange }: { title: string; value: boolean | null; onChange: (v: boolean | null) => void }) {
  const opts: [boolean | null, string][] = [[true, 'Sí'], [false, 'No'], [null, '—']];
  return (
    <div>
      <span className={label}>{title}</span>
      <div className="inline-flex rounded-lg border border-line-strong p-0.5" role="radiogroup" aria-label={title}>
        {opts.map(([v, l]) => (
          <button key={l} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={`rounded-md px-2.5 py-1 text-xs ${value === v ? 'bg-white text-navy' : 'text-gray hover:text-white'}`}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Fieldset({ title, children, description }: { title: string; description?: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-line bg-navy/40 p-4 sm:p-5">
      <legend className="px-1 text-sm font-semibold text-white">{title}</legend>
      {description && <p className="-mt-1 mb-3 text-xs text-muted">{description}</p>}
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
