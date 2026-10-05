import type { Course } from '../../types';
import { convert, discountPercent, effectivePrice, formatMoney } from '../../utils/format';

interface Props {
  course: Pick<Course, 'price' | 'discount_price' | 'currency'>;
  size?: 'sm' | 'md' | 'lg';
  showFrom?: boolean;
  showConversion?: boolean;
  className?: string;
}

/** Precio con alta visibilidad: final, regular tachado, % de descuento y equivalencia en PEN. */
export function PriceDisplay({ course, size = 'md', showFrom = true, showConversion = false, className = '' }: Props) {
  const final = effectivePrice(course);
  const pct = discountPercent(course);
  const sizes = { sm: 'text-lg', md: 'text-2xl', lg: 'text-3xl sm:text-4xl' };

  if (final == null) {
    return (
      <div className={className}>
        <span className={`${size === 'sm' ? 'text-sm' : 'text-base'} font-medium text-gray`} title="La institución no publica el precio en su web">
          Precio a consultar
        </span>
      </div>
    );
  }

  if (final === 0) {
    return (
      <div className={className}>
        <span className={`${sizes[size]} font-semibold tracking-tight text-pos`}>Gratis</span>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {showFrom && <span className="text-xs text-muted">Desde</span>}
        <span className={`${sizes[size]} tnum font-semibold tracking-tight text-white`}>{formatMoney(final, course.currency)}</span>
        {course.discount_price != null && course.price != null && (
          <span className="tnum text-sm text-dim line-through" aria-label={`Precio regular ${formatMoney(course.price, course.currency)}`}>
            {formatMoney(course.price, course.currency)}
          </span>
        )}
        {pct ? <span className="rounded-full bg-pos/10 px-1.5 py-0.5 font-mono text-[11px] text-pos">−{pct}%</span> : null}
      </div>
      {showConversion && course.currency === 'USD' && (
        <p className="tnum mt-0.5 text-xs text-muted">≈ {formatMoney(convert(final, 'USD', 'PEN'), 'PEN')} (referencial)</p>
      )}
    </div>
  );
}
