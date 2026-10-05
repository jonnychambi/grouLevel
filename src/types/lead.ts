export type StartTimeline = 'inmediato' | '30-dias' | '1-3-meses' | 'comparando';

export type LeadObjective =
  | 'mejorar-trabajo-actual'
  | 'cambiar-trabajo'
  | 'cambiar-carrera'
  | 'primer-empleo-tech'
  | 'emprender'
  | 'actualizar-conocimientos';

/** Tiers del Signal Score™ (brand system). */
export type SignalTier = 'HIGH_INTENT' | 'WARM' | 'NURTURE' | 'LOW';
/** Segmento comercial clásico para CRM. */
export type LeadSegment = 'hot' | 'warm' | 'cold';

/** Seguimiento comercial del lead. */
export type LeadStatus = 'nuevo' | 'contactado' | 'enviado' | 'matriculado' | 'descartado';

/** Origen de la interacción dentro de Groulevel. */
export type LeadSource = 'detalle' | 'comparador' | 'listado' | 'institucion' | 'favoritos' | 'home';

export interface Attribution {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  referrer: string | null;
  landing_page: string | null;
  captured_at: string;
}

/** Lo que el usuario escribe en el formulario. */
export interface LeadFormInput {
  first_name: string;
  last_name: string;
  email: string;
  whatsapp: string;
  country: string;
  start_timeline: StartTimeline;
  objective: LeadObjective;
  consent: boolean;
}

/** Contexto conductual usado por el scoring (señales). */
export interface LeadSignals {
  compared_programs: number;
  viewed_programs: number;
  source: LeadSource;
}

export interface LeadScoreResult {
  score: number;
  tier: SignalTier;
  segment: LeadSegment;
  breakdown: { label: string; points: number }[];
}

/** Registro completo del lead (lo que se envía a la institución / CRM). */
export interface Lead extends LeadFormInput {
  id: string;
  created_at: string;
  course_id: string;
  course_name: string;
  institution_id: string;
  institution_name: string;
  page_url: string;
  source: LeadSource;
  campaign: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  referrer: string | null;
  lead_score: number;
  lead_tier: SignalTier;
  lead_segment: LeadSegment;
  status: LeadStatus;
  /** Notas internas del equipo comercial (solo administrador). */
  notes?: string;
  updated_at?: string;
}
