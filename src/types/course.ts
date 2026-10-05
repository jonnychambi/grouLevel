/** Modelo de dominio de programas de formación. Independiente de la fuente de datos. */

export type Currency = 'PEN' | 'USD';

export type ProgramType =
  | 'curso'
  | 'especializacion'
  | 'certificacion'
  | 'bootcamp'
  | 'diplomado'
  | 'programa-ejecutivo'
  | 'maestria'
  | 'membresia';

export type Modality = 'en-vivo' | 'grabado' | 'hibrido' | 'presencial';

export type Level = 'basico' | 'intermedio' | 'avanzado';

export type CertificateType = 'incluye' | 'internacional' | 'preparacion';

export interface Certificate {
  type: CertificateType;
  description: string;
}

export interface Teacher {
  name: string;
  /** Perfil / cargo tal como lo publica la institución. */
  profile: string;
  linkedin: string | null;
  photo?: string | null;
}

export interface SyllabusModule {
  title: string;
  hours: number | null;
  description: string;
  topics: string[];
}

export interface Financing {
  installments: number | null;
  installment_amount: number | null;
  methods: string[];
  notes: string;
}

/** Atributos sí/no publicados por la institución (null = no especificado). */
export interface CourseFeatures {
  live_classes: boolean | null;
  recorded_classes: boolean | null;
  final_project: boolean | null;
  mentoring: boolean | null;
  lifetime_access: boolean | null;
  job_board: boolean | null;
  community: boolean | null;
  enrollment_open: boolean | null;
}

/** publicado = visible en el sitio · borrador/oculto = solo en el administrador. */
export type CourseStatus = 'publicado' | 'borrador' | 'oculto';

export interface Course {
  id: string;
  slug: string;
  name: string;
  institution_id: string;
  /** id de categoría (ver categories.json) */
  category: string;
  subcategory: string | null;
  program_type: ProgramType;
  /** Denominación usada por la institución (ej. "Carrera", "Taller"). */
  published_type: string | null;
  description: string;
  short_description: string;
  /** Resultados de aprendizaje ("Lo que aprenderás"). */
  objectives: string[];
  target_audience: string | null;
  /** Precio regular. 0 = gratis. null = no publicado. */
  price: number | null;
  currency: Currency;
  /** Precio promocional, si existe. */
  discount_price: number | null;
  duration_hours: number | null;
  duration_weeks: number | null;
  /** Duración tal como la publica la institución (ej. "4 meses"). */
  duration_text: string | null;
  modality: Modality | null;
  schedule: string | null;
  level: Level | null;
  /** ISO date (YYYY-MM-DD). null = no publicada. */
  start_date: string | null;
  /** Texto original de inicio (ej. "Inicios todos los meses"). */
  start_text: string | null;
  certificate: Certificate | null;
  teachers: Teacher[];
  tools: string[];
  skills: string[];
  syllabus: SyllabusModule[];
  requirements: string[];
  features: CourseFeatures;
  platform: string | null;
  language: string;
  country: string;
  image: string | null;
  /** URL oficial del programa en la web de la institución. */
  url: string;
  /** Listing patrocinado (Featured Listing). */
  featured: boolean;
  rating: number | null;
  reviews_count: number | null;
  financing: Financing;
  keywords: string[];
  status: CourseStatus;
  /** 0–1: proporción de campos clave disponibles. */
  completeness: number;
  /** Fecha (ISO) de la última verificación/actualización de la información. */
  updated_at: string;
  /** true = contenido de demostración, no es un programa real. */
  is_demo: boolean;
}

export interface Institution {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  type: string;
  country: string;
  city: string;
  founded: number | null;
  brand_color: string;
  description: string;
  website: string;
  accreditations: string[];
  programs_url?: string | null;
  logo?: string | null;
  is_demo: boolean;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  group: string;
  description: string;
  keywords: string[];
}

/** Curso con su institución resuelta, útil para la UI. */
export interface CourseWithInstitution extends Course {
  institution: Institution;
}
