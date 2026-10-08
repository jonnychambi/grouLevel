import { useId, useState } from 'react';

const STAR = 'M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9L12 2.6z';

/** Estrellas de solo lectura con relleno parcial (ej. 4.3). */
export function Stars({ value, size = 16, className = '' }: { value: number; size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} role="img" aria-label={`${value.toFixed(1)} de 5 estrellas`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
            <defs>
              <linearGradient id={`${id}-${i}`}>
                <stop offset={`${fill * 100}%`} stopColor="#FFC65C" />
                <stop offset={`${fill * 100}%`} stopColor="rgb(157 170 189 / .28)" />
              </linearGradient>
            </defs>
            <path d={STAR} fill={`url(#${id}-${i})`} />
          </svg>
        );
      })}
    </span>
  );
}

const LABELS = ['', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente'];

/** Selector de 1 a 5 estrellas (radiogroup accesible con teclado). */
export function StarInput({ value, onChange, invalid, describedBy, label = 'Tu valoración', size = 32 }: { value: number; onChange: (v: number) => void; invalid?: boolean; describedBy?: string; label?: string; size?: number }) {
  const [hover, setHover] = useState(0);
  const name = useId();
  const shown = hover || value;
  return (
    <div className="flex items-center gap-3">
      <div role="radiogroup" aria-label={label} aria-invalid={invalid} aria-describedby={describedBy} className="flex" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer p-0.5" onMouseEnter={() => setHover(n)}>
            <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className="peer sr-only" aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}: ${LABELS[n]}`} />
            <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="rounded-md transition-transform peer-focus-visible:ring-2 peer-focus-visible:ring-cyan hover:scale-110">
              <path d={STAR} fill={n <= shown ? '#FFC65C' : 'rgb(157 170 189 / .22)'} />
            </svg>
          </label>
        ))}
      </div>
      <span className="min-w-20 text-sm text-gray" aria-hidden="true">{LABELS[shown]}</span>
    </div>
  );
}
