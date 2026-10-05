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

export type Modality = 'en-vivo' | 'grabado' | 'hibrido';

export type Level = 'basico' | 'intermedio' | 'avanzado';

export type CertificateType = 'incluye' | 'internacional' | 'preparacion';

export interface Certificate {
  type: CertificateType;
  description: string;
}

export interface Teacher {
  name: string;
  role: string;
  company: string;
  experience: string;
  linkedin: string | null;
  photo?: string | null;
}

export interface SyllabusModule {
  title: string;
  hours: number;
  description: string;
  topics: string[];
}

export interface Financing {
  installments: number | null;
  installment_amount: number | null;
  methods: string[];
  notes: string;
}

export interface Course {
  id: string;
  slug: string;
  name: string;
  institution_id: string;
  /** id de categoría (ver categories.json) */
  category: string;
  subcategory: string;
  program_type: ProgramType;
  description: string;
  short_description: string;
  /** Precio regular. 0 = gratis. */
  price: number;
  currency: Currency;
  /** Precio promocional, si existe. */
  discount_price: number | null;
  duration_hours: number;
  duration_weeks: number;
  modality: Modality;
  schedule: string;
  level: Level;
  /** ISO date (YYYY-MM-DD). null = acceso inmediato / a tu ritmo. */
  start_date: string | null;
  certificate: Certificate;
  teachers: Teacher[];
  tools: string[];
  skills: string[];
  syllabus: SyllabusModule[];
  requirements: string[];
  image: string | null;
  url: string;
  /** Listing patrocinado (Featured Listing). */
  featured: boolean;
  rating: number;
  reviews_count: number;
  financing: Financing;
  keywords: string[];
  language: string;
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
  founded: number;
  brand_color: string;
  description: string;
  website: string;
  accreditations: string[];
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
