/**
 * Lógica pura de reseñas: validación del envío y cálculo de promedios.
 * La usan el servidor (api/) y la interfaz; no depende del DOM ni de la red.
 */
import type { PublicReview, RatingSummary, ReviewRelationship, ReviewsSummary } from '../types/review';

export const RELATIONSHIP_LABELS: Record<ReviewRelationship, string> = {
  egresado: 'Egresado del programa',
  estudiante: 'Estudiante actual',
  interesado: 'Interesado / en evaluación'
};

export const REVIEW_LIMITS = { titleMax: 90, commentMin: 30, commentMax: 1200, nameMax: 40 } as const;

export interface ReviewInput {
  rating: number;
  title: string;
  comment: string;
  author_name: string;
  author_email: string;
  relationship: ReviewRelationship;
  consent: boolean;
}

export function validateReview(v: Partial<ReviewInput>): Partial<Record<keyof ReviewInput, string>> {
  const e: Partial<Record<keyof ReviewInput, string>> = {};
  if (!Number.isInteger(v.rating) || (v.rating as number) < 1 || (v.rating as number) > 5) e.rating = 'Elige de 1 a 5 estrellas.';
  const comment = (v.comment ?? '').trim();
  if (comment.length < REVIEW_LIMITS.commentMin) e.comment = `Cuéntanos un poco más (mínimo ${REVIEW_LIMITS.commentMin} caracteres).`;
  else if (comment.length > REVIEW_LIMITS.commentMax) e.comment = `Máximo ${REVIEW_LIMITS.commentMax} caracteres.`;
  if ((v.title ?? '').trim().length > REVIEW_LIMITS.titleMax) e.title = `Máximo ${REVIEW_LIMITS.titleMax} caracteres.`;
  const name = (v.author_name ?? '').trim();
  if (name.length < 2) e.author_name = 'Escribe cómo quieres que aparezca tu nombre.';
  else if (name.length > REVIEW_LIMITS.nameMax) e.author_name = `Máximo ${REVIEW_LIMITS.nameMax} caracteres.`;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v.author_email ?? '').trim())) e.author_email = 'Ingresa un email válido (no se publica).';
  if (!v.relationship || !(v.relationship in RELATIONSHIP_LABELS)) e.relationship = 'Indica tu relación con el programa.';
  if (!v.consent) e.consent = 'Necesitamos tu autorización para publicar la reseña.';
  return e;
}

/** "Ana María Torres" → "Ana María T." (protege la identidad). */
export function displayName(name: string): string {
  const parts = name.trim().replace(/\s+/g, ' ').split(' ');
  if (parts.length === 1) return parts[0];
  const last = parts.pop()!;
  return `${parts.join(' ')} ${last[0].toUpperCase()}.`;
}

export function summarize(ratings: number[]): RatingSummary {
  const distribution: RatingSummary['distribution'] = [0, 0, 0, 0, 0];
  for (const r of ratings) if (r >= 1 && r <= 5) distribution[Math.round(r) - 1]++;
  const count = distribution.reduce((a, b) => a + b, 0);
  const avg = count ? Math.round((distribution.reduce((s, n, i) => s + n * (i + 1), 0) / count) * 10) / 10 : 0;
  return { avg, count, distribution };
}

/** Recalcula el resumen de instituciones a partir del de programas. */
export function institutionSummaries(courses: ReviewsSummary['courses']): ReviewsSummary['institutions'] {
  const byInst = new Map<string, RatingSummary['distribution']>();
  for (const c of Object.values(courses)) {
    const d = byInst.get(c.institution_id) ?? [0, 0, 0, 0, 0];
    c.distribution.forEach((n, i) => (d[i] += n));
    byInst.set(c.institution_id, d);
  }
  const out: ReviewsSummary['institutions'] = {};
  for (const [id, d] of byInst) {
    const ratings = d.flatMap((n, i) => Array<number>(n).fill(i + 1));
    out[id] = summarize(ratings);
  }
  return out;
}

export function sortReviews(reviews: PublicReview[], by: 'recientes' | 'mejores' | 'peores'): PublicReview[] {
  const list = [...reviews];
  if (by === 'mejores') return list.sort((a, b) => b.rating - a.rating || b.created_at.localeCompare(a.created_at));
  if (by === 'peores') return list.sort((a, b) => a.rating - b.rating || b.created_at.localeCompare(a.created_at));
  return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
}
