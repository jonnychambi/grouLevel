import { SITE } from '../config/site';
import type { Course, Currency } from '../types';

const SYMBOL: Record<Currency, string> = { PEN: 'S/', USD: 'US$' };

export function formatMoney(amount: number, currency: Currency): string {
  const n = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(amount));
  return `${SYMBOL[currency]} ${n}`;
}

/** Precio final que paga el usuario (promocional si existe). */
export function effectivePrice(course: Pick<Course, 'price' | 'discount_price'>): number {
  return course.discount_price ?? course.price;
}

export function isFree(course: Pick<Course, 'price' | 'discount_price'>): boolean {
  return effectivePrice(course) === 0;
}

/** Convierte a otra moneda usando el tipo de cambio referencial. */
export function convert(amount: number, from: Currency, to: Currency): number {
  if (from === to) return amount;
  const rate = SITE.exchangeRate.USD_PEN;
  return from === 'USD' ? amount * rate : amount / rate;
}

/** Precio efectivo normalizado a PEN (para ordenar/filtrar de forma homogénea). */
export function priceInPEN(course: Course): number {
  return convert(effectivePrice(course), course.currency, 'PEN');
}

export function discountPercent(course: Course): number | null {
  if (course.discount_price == null || course.price <= 0) return null;
  return Math.round((1 - course.discount_price / course.price) * 100);
}

export function formatDate(iso: string | null, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  if (!iso) return 'Acceso inmediato';
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('es-PE', opts).format(new Date(y, m - 1, d));
}

export function formatDuration(course: Pick<Course, 'duration_hours' | 'duration_weeks'>): string {
  return `${course.duration_hours} h`;
}

export function formatWeeks(weeks: number): string {
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
