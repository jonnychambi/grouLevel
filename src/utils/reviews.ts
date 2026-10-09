/**
 * Lógica pura de reseñas: validación del envío y cálculo de promedios.
 * La usan el servidor (api/) y la interfaz; no depende del DOM ni de la red.
 */
import type { InstitutionScores, ProgramScores, PublicReview, RatingSummary, ReviewRelationship, ReviewsSummary, StudentStatus } from '../types/review';

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

/* ─────────────────────────── Groulevel Reviews (v2) ─────────────────────────── */

export const INSTITUTION_DIMENSIONS: { key: keyof InstitutionScores; label: string; hint: string }[] = [
  { key: 'academic', label: 'Calidad académica', hint: 'Nivel y actualidad de los contenidos' },
  { key: 'teachers', label: 'Docentes', hint: 'Dominio, claridad y acompañamiento' },
  { key: 'experience', label: 'Experiencia educativa', hint: 'Plataforma, atención y organización' },
  { key: 'compliance', label: 'Cumplimiento', hint: 'Lo ofrecido vs. lo recibido (horarios, certificados, temario)' },
  { key: 'value', label: 'Relación calidad-precio', hint: 'Si lo pagado valió la pena' }
];

export const PROGRAM_DIMENSIONS: { key: keyof ProgramScores; label: string; hint: string }[] = [
  { key: 'content', label: 'Contenido', hint: 'Temario útil y aplicable' },
  { key: 'methodology', label: 'Metodología', hint: 'Clases, práctica y proyectos' },
  { key: 'tools', label: 'Herramientas', hint: 'Software y tecnologías vistas' },
  { key: 'teacher', label: 'Docente', hint: 'Quien dictó el programa' }
];

export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = { estudiante: 'Estudiante', egresado: 'Egresado' };

export const REVIEW_TEXT = { min: 30, max: 1500, nameMax: 40 } as const;
/** Evaluación "detallada" del programa. */
export const DETAILED_MIN = 80;
/** Créditos de descuento: por reseña, por referido con reseña y tope de descuento por programa (S/). */
export const CREDITS = { review: 100, referral: 100, maxPerProgram: 300 } as const;

/** Envío de una reseña (formulario /opinar). */
export interface ReviewSubmission {
  institution_id: string;
  course_id: string | null;
  inst_scores: Partial<InstitutionScores>;
  program_scores: Partial<ProgramScores> | null;
  best: string;
  improve: string;
  recommend: boolean | null;
  study_year: number | null;
  student_status: StudentStatus | null;
  author_name: string;
  wants_incentive: boolean;
  consent: boolean;
}

const score = (v: unknown) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 5;
export const average = (o: Record<string, number> | Partial<Record<string, number>> | null | undefined): number | null => {
  const vals = Object.values(o ?? {}).filter((v): v is number => typeof v === 'number');
  return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null;
};

export function validateSubmission(v: Partial<ReviewSubmission>, now = new Date()): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.institution_id) e.institution_id = 'Elige la institución.';
  for (const d of INSTITUTION_DIMENSIONS) if (!score(v.inst_scores?.[d.key])) { e.inst_scores = 'Califica cada aspecto de la institución (1 a 5 estrellas).'; break; }
  if (v.course_id) for (const d of PROGRAM_DIMENSIONS) if (!score(v.program_scores?.[d.key])) { e.program_scores = 'Califica cada aspecto del programa (1 a 5 estrellas).'; break; }
  const best = (v.best ?? '').trim();
  const improve = (v.improve ?? '').trim();
  if (best.length < REVIEW_TEXT.min) e.best = `Cuéntanos qué fue lo mejor (mínimo ${REVIEW_TEXT.min} caracteres).`;
  else if (best.length > REVIEW_TEXT.max) e.best = `Máximo ${REVIEW_TEXT.max} caracteres.`;
  if (improve.length < REVIEW_TEXT.min) e.improve = `Cuéntanos qué debería mejorar (mínimo ${REVIEW_TEXT.min} caracteres).`;
  else if (improve.length > REVIEW_TEXT.max) e.improve = `Máximo ${REVIEW_TEXT.max} caracteres.`;
  if (typeof v.recommend !== 'boolean') e.recommend = 'Indica si recomendarías la institución.';
  const year = now.getFullYear();
  if (!Number.isInteger(v.study_year) || (v.study_year as number) < year - 15 || (v.study_year as number) > year) e.study_year = 'Indica el año en que estudiaste.';
  if (v.student_status !== 'estudiante' && v.student_status !== 'egresado') e.student_status = 'Indica si eres estudiante o egresado.';
  const name = (v.author_name ?? '').trim();
  if (name.length < 2) e.author_name = 'Escribe tu nombre (se publica abreviado).';
  else if (name.length > REVIEW_TEXT.nameMax) e.author_name = `Máximo ${REVIEW_TEXT.nameMax} caracteres.`;
  if (!v.consent) e.consent = 'Necesitamos tu autorización para publicar la reseña.';
  return e;
}

/** ¿La evaluación del programa es detallada? (todas las dimensiones + textos con sustancia). */
export function isDetailedProgramReview(v: Pick<ReviewSubmission, 'course_id' | 'program_scores' | 'best' | 'improve'>): boolean {
  return !!v.course_id && PROGRAM_DIMENSIONS.every((d) => score(v.program_scores?.[d.key])) && v.best.trim().length >= DETAILED_MIN && v.improve.trim().length >= DETAILED_MIN;
}

/** "hace 3 meses" — antigüedad de una reseña. */
export function reviewAge(iso: string, now = new Date()): string {
  const days = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000));
  if (days < 1) return 'hoy';
  if (days < 30) return days === 1 ? 'hace 1 día' : `hace ${days} días`;
  const months = Math.floor(days / 30.4);
  if (months < 12) return months === 1 ? 'hace 1 mes' : `hace ${months} meses`;
  const years = Math.floor(days / 365);
  return years === 1 ? 'hace 1 año' : `hace ${years} años`;
}

export type ReviewFilter = { period: 'todas' | 'ultimo-ano' | 'ultimos-6-meses'; tone: 'todas' | 'positivas' | 'neutras' | 'criticas'; status: 'todas' | StudentStatus | 'verificadas' };

/** Filtra y ordena: recientes primero (las experiencias recientes pesan más). */
export function filterReviews(list: PublicReview[], f: ReviewFilter, now = new Date()): PublicReview[] {
  const limit = f.period === 'ultimo-ano' ? 365 : f.period === 'ultimos-6-meses' ? 183 : Infinity;
  return list
    .filter((r) => (now.getTime() - new Date(r.created_at).getTime()) / 86_400_000 <= limit)
    .filter((r) => f.tone === 'todas' || (f.tone === 'positivas' ? r.rating >= 4 : f.tone === 'criticas' ? r.rating <= 2 : r.rating === 3))
    .filter((r) => f.status === 'todas' || (f.status === 'verificadas' ? r.verified : r.student_status === f.status || (f.status === 'egresado' && r.relationship === 'egresado') || (f.status === 'estudiante' && r.relationship === 'estudiante')))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
