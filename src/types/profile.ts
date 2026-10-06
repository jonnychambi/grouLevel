/** Diagnóstico de perfil profesional y ruta de formación sugerida ("Mi ruta"). */

export type ProfileSource = 'cv' | 'texto';
/** ia = análisis con Claude · reglas = motor heurístico local (sin clave de IA o si la IA falla). */
export type ProfileEngine = 'ia' | 'reglas';
export type ProficiencyLevel = 'sin-evidencia' | 'basico' | 'intermedio' | 'avanzado' | 'experto';
export type EducationLevel = 'secundaria' | 'tecnico' | 'bachiller' | 'licenciatura' | 'maestria' | 'doctorado' | 'certificacion' | 'otro';
export type EducationStatus = 'completo' | 'en-curso' | 'incompleto' | 'no-indicado';
export type Seniority = 'estudiante' | 'junior' | 'semi-senior' | 'senior' | 'lider' | 'ejecutivo' | 'no-indicado';
export type ProfileStatus = 'nuevo' | 'contactado' | 'descartado';

export interface PersonalData {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  linkedin: string | null;
}

export interface EducationItem {
  degree: string;
  field: string | null;
  institution: string | null;
  level: EducationLevel;
  status: EducationStatus;
  end_year: number | null;
}

export interface ExperienceItem {
  role: string;
  company: string | null;
  start_year: number | null;
  end_year: number | null;
  current: boolean;
}

export interface LanguageItem { language: string; level: string }

/** Datos estructurados extraídos del CV o de la descripción. */
export interface ProfileExtract {
  personal: PersonalData;
  current_role: string | null;
  current_company: string | null;
  headline: string | null;
  seniority: Seniority;
  years_experience: number | null;
  highest_degree: EducationLevel | null;
  /** Formación que está cursando actualmente (si la hay). */
  current_studies: string | null;
  education: EducationItem[];
  experience: ExperienceItem[];
  certifications: string[];
  languages: LanguageItem[];
  tools: string[];
}

/** Conocimiento por materia (las materias son las categorías del catálogo). */
export interface AreaScore {
  area_id: string;
  area: string;
  score: number;
  level: ProficiencyLevel;
  evidence: string;
}

export interface SkillScore {
  name: string;
  score: number;
  level: ProficiencyLevel;
  evidence: string;
}

export interface ProfileEvaluation {
  summary: string;
  areas: AreaScore[];
  technical_skills: SkillScore[];
  soft_skills: SkillScore[];
  strengths: string[];
  gaps: string[];
}

export interface RouteStage {
  order: number;
  title: string;
  goal: string;
  skills: string[];
  /** ids de programas del catálogo (validados en el servidor). */
  course_ids: string[];
  rationale: string;
}

export interface TrainingRoute {
  objective_summary: string;
  target_role: string | null;
  target_areas: string[];
  stages: RouteStage[];
  advice: string[];
}

export interface ProfilePreferences {
  modality: 'cualquiera' | 'en-vivo' | 'grabado' | 'hibrido' | 'presencial';
  /** Presupuesto máximo por programa en PEN (null = sin límite). */
  budget_pen: number | null;
  hours_per_week: number | null;
}

export interface StoredFile { pathname: string; name: string; type: string; size: number }

export interface ProfileAnalysis {
  id: string;
  created_at: string;
  updated_at: string;
  source: ProfileSource;
  engine: ProfileEngine;
  objective: string;
  description: string | null;
  preferences: ProfilePreferences;
  extract: ProfileExtract;
  evaluation: ProfileEvaluation;
  route: TrainingRoute;
  file: StoredFile | null;
  contact_ok: boolean;
  status: ProfileStatus;
  notes: string;
}

/** Lo que se devuelve al navegador (sin el archivo ni datos internos). */
export type PublicProfileAnalysis = Omit<ProfileAnalysis, 'file' | 'status' | 'notes'> & { has_file: boolean };
