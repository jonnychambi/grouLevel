import type { CourseWithInstitution } from '../types';
import { priceInPEN } from './format';

export type Highlight = 'best' | 'worst' | null;

/** Determina el "mejor" valor por fila numérica para resaltarlo en el comparador. */
export function numericHighlights(courses: CourseWithInstitution[], value: (c: CourseWithInstitution) => number | null, prefer: 'low' | 'high'): Highlight[] {
  const vals = courses.map(value);
  const nums = vals.filter((v): v is number => v != null);
  if (nums.length < 2 || new Set(nums).size === 1) return vals.map(() => null);
  const best = prefer === 'low' ? Math.min(...nums) : Math.max(...nums);
  const worst = prefer === 'low' ? Math.max(...nums) : Math.min(...nums);
  return vals.map((v) => (v === best ? 'best' : v === worst && courses.length > 2 ? 'worst' : null));
}

export const priceHighlights = (cs: CourseWithInstitution[]) => numericHighlights(cs, priceInPEN, 'low');
export const ratingHighlights = (cs: CourseWithInstitution[]) => numericHighlights(cs, (c) => c.rating, 'high');
export const durationHighlights = (cs: CourseWithInstitution[]) => numericHighlights(cs, (c) => c.duration_hours, 'high');
export const startHighlights = (cs: CourseWithInstitution[]) =>
  numericHighlights(cs, (c) => (c.start_date ? new Date(c.start_date).getTime() : null), 'low');

/** true si los valores difieren entre programas (para marcar la fila como diferencia). */
export function differs(courses: CourseWithInstitution[], value: (c: CourseWithInstitution) => unknown): boolean {
  return new Set(courses.map((c) => JSON.stringify(value(c)))).size > 1;
}

/** Diferencias clave en lenguaje natural ("en segundos"). */
export function keyInsights(courses: CourseWithInstitution[], letter: (i: number) => string): string[] {
  if (courses.length < 2) return [];
  const out: string[] = [];
  const prices = courses.map(priceInPEN);
  const known = prices.filter((p): p is number => p != null);
  if (known.length >= 2) {
    const minP = Math.min(...known);
    const maxP = Math.max(...known);
    const cheapest = prices.indexOf(minP);
    if (maxP > 0 && minP !== maxP) {
      out.push(minP === 0
        ? `${letter(cheapest)} es gratuito; el resto tiene costo.`
        : `${letter(cheapest)} es el más económico: ${Math.round((1 - minP / maxP) * 100)}% menos que la opción más cara.`);
    }
  }
  const missingPrice = prices.map((p, i) => (p == null ? letter(i) : null)).filter(Boolean);
  if (missingPrice.length) out.push(`${missingPrice.join(' y ')} no ${missingPrice.length === 1 ? 'publica' : 'publican'} precio: solicita información para conocerlo.`);
  const hours = courses.map((c) => c.duration_hours);
  const knownH = hours.filter((h): h is number => h != null);
  if (knownH.length >= 2) {
    const maxH = Math.max(...knownH);
    const minH = Math.min(...knownH);
    if (maxH !== minH) out.push(`${letter(hours.indexOf(maxH))} es el más extenso: ${maxH} h frente a ${minH} h del más corto.`);
  }
  const perHour = courses.map((c, i) => (prices[i] != null && prices[i]! > 0 && c.duration_hours ? prices[i]! / c.duration_hours : null));
  const valid = perHour.filter((v): v is number => v != null);
  if (valid.length >= 2) {
    const best = Math.min(...valid);
    out.push(`${letter(perHour.indexOf(best))} tiene el menor costo por hora (≈ S/ ${Math.round(best)} por hora).`);
  }
  const modalities = new Set(courses.map((c) => c.modality).filter(Boolean));
  if (modalities.size > 1) out.push('Las modalidades son distintas: revisa si necesitas horario fijo o avanzar a tu ritmo.');
  const intl = courses.findIndex((c) => c.certificate?.type === 'internacional');
  if (intl >= 0) out.push(`${letter(intl)} incluye certificación internacional.`);
  return out.slice(0, 5);
}
