/**
 * Groulevel Reviews: reseñas de instituciones (reputación principal) con evaluación opcional del programa
 * cursado. Moderadas antes de publicarse. Las reseñas anteriores (solo de programa) son kind = 'programa'.
 */

export type ReviewStatus = 'pendiente' | 'aprobada' | 'rechazada';

/** Relación declarada de quien escribe con el programa. */
export type ReviewRelationship = 'egresado' | 'estudiante' | 'interesado';

export type ReviewKind = 'institucion' | 'programa';
export type StudentStatus = 'estudiante' | 'egresado';
export type EvidenceStatus = 'sin_evidencia' | 'pendiente' | 'aprobada' | 'rechazada';

/** Dimensiones de la institución (1–5). */
export interface InstitutionScores { academic: number; teachers: number; experience: number; compliance: number; value: number }
/** Dimensiones del programa cursado (1–5). */
export interface ProgramScores { content: number; methodology: number; tools: number; teacher: number }

/** Reseña tal como se publica en el sitio (sin datos privados ni evidencias). */
export interface PublicReview {
  id: string;
  kind: ReviewKind;
  institution_id: string;
  institution_name: string;
  course_id: string | null;
  course_name: string | null;
  /** Calificación general de la institución (o del programa en reseñas anteriores). */
  rating: number;
  inst_scores: InstitutionScores | null;
  program_rating: number | null;
  program_scores: ProgramScores | null;
  best: string | null;
  improve: string | null;
  recommend: boolean | null;
  study_year: number | null;
  student_status: StudentStatus | null;
  /** Insignia "Reseña verificada": solo con evidencia aprobada. */
  verified: boolean;
  /** La persona recibió (o recibirá) un incentivo por opinar: se muestra públicamente. */
  incentivized: boolean;
  title: string;
  comment: string;
  author_name: string;
  relationship: ReviewRelationship;
  created_at: string;
  /** Respuesta pública del equipo de Groulevel o de la institución (opcional). */
  reply: string | null;
}

/** Registro completo (solo administrador). */
export interface Review extends PublicReview {
  author_email: string;
  user_id: string | null;
  email_verified: boolean;
  evidence_name: string | null;
  evidence_status: EvidenceStatus;
  reports_count: number;
  flags: string[];
  criteria: string[];
  status: ReviewStatus;
  rejection_reason: string | null;
  moderated_at: string | null;
  page_url: string;
}

export interface RatingSummary {
  avg: number;
  count: number;
  /** Cantidad de reseñas por estrella: índice 0 = 1★ … 4 = 5★. */
  distribution: [number, number, number, number, number];
}

export interface ReviewsSummary {
  courses: Record<string, RatingSummary & { institution_id: string; dims?: Partial<ProgramScores> }>;
  institutions: Record<string, RatingSummary & { dims?: Partial<InstitutionScores>; recommend_pct?: number | null }>;
  updated_at: string;
}
