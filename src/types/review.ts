/** Reseñas de programas (moderadas antes de publicarse). */

export type ReviewStatus = 'pendiente' | 'aprobada' | 'rechazada';

/** Relación declarada de quien escribe con el programa. */
export type ReviewRelationship = 'egresado' | 'estudiante' | 'interesado';

/** Reseña tal como se publica en el sitio (sin datos privados). */
export interface PublicReview {
  id: string;
  course_id: string;
  rating: number;
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
  course_name: string;
  institution_id: string;
  institution_name: string;
  author_email: string;
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
  courses: Record<string, RatingSummary & { institution_id: string }>;
  institutions: Record<string, RatingSummary>;
  updated_at: string;
}
