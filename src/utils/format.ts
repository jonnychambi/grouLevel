import { SITE } from '../config/site';
import type { Course, Currency } from '../types';

const SYMBOL: Record<Currency, string> = { PEN: 'S/', USD: 'US$' };

export function formatMoney(amount: number, currency: Currency): string {
  const n = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(amount));
  return `${SYMBOL[currency]} ${n}`;
}

/** Precio final que paga el usuario (promocional si existe). null = no publicado. */
export function effectivePrice(course: Pick<Course, 'price' | 'discount_price'>): number | null {
  if (course.price == null) return null;
  return course.discount_price ?? course.price;
}

export function isFree(course: Pick<Course, 'price' | 'discount_price'>): boolean {
  return effectivePrice(course) === 0;
}

export function hasPrice(course: Pick<Course, 'price' | 'discount_price'>): boolean {
  return effectivePrice(course) != null;
}

/** Convierte a otra moneda usando el tipo de cambio referencial. */
export function convert(amount: number, from: Currency, to: Currency): number {
  if (from === to) return amount;
  const rate = SITE.exchangeRate.USD_PEN;
  return from === 'USD' ? amount * rate : amount / rate;
}

/** Precio efectivo normalizado a PEN (para ordenar/filtrar de forma homogénea). null = no publicado. */
export function priceInPEN(course: Pick<Course, 'price' | 'discount_price' | 'currency'>): number | null {
  const p = effectivePrice(course);
  return p == null ? null : convert(p, course.currency, 'PEN');
}

export function discountPercent(course: Pick<Course, 'price' | 'discount_price'>): number | null {
  if (course.discount_price == null || course.price == null || course.price <= 0) return null;
  const pct = Math.round((1 - course.discount_price / course.price) * 100);
  return pct > 0 ? pct : null;
}

/** Formatea una fecha ISO. Sin fecha → texto publicado por la institución o "Por confirmar". */
export function formatDate(iso: string | null, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }, fallback = 'Por confirmar'): string {
  if (!iso) return fallback;
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('es-PE', opts).format(new Date(y, m - 1, d));
}

/** Texto de inicio para listados: fecha, "A tu ritmo" (asincrónico) o "Por confirmar". */
export function startLabel(course: Pick<Course, 'start_date' | 'start_text' | 'modality'>, opts?: Intl.DateTimeFormatOptions): string {
  if (course.start_date) return formatDate(course.start_date, opts ?? { day: 'numeric', month: 'short' });
  if (course.modality === 'grabado') return 'A tu ritmo';
  return 'Por confirmar';
}

/** Duración corta: "96 h", "12 semanas" o el texto publicado. */
export function durationLabel(course: Pick<Course, 'duration_hours' | 'duration_weeks' | 'duration_text'>): string {
  if (course.duration_hours != null) return `${course.duration_hours} h`;
  if (course.duration_weeks != null) return `${course.duration_weeks} sem`;
  if (course.duration_text) return course.duration_text.length > 18 ? course.duration_text.slice(0, 17) + '…' : course.duration_text;
  return 'No publicada';
}

export function formatWeeks(weeks: number | null): string {
  if (weeks == null) return '';
  if (weeks >= 52 && weeks % 4 === 0) {
    const months = Math.round(weeks / 4.33);
    return `${months} meses`;
  }
  if (weeks >= 20) return `${weeks} semanas (≈ ${Math.round(weeks / 4.33)} meses)`;
  return `${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`;
}

export function pluralize(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function initials(name: string): string {
  return name
    .replace(/^(Dra?\.|Ing\.|Mg\.)\s*/i, '')
    .split(/\s+/)
    .filter((w) => /^[A-ZÁÉÍÓÚÑ]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
}

export function uid(prefix: string): string {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${rnd}`;
}
