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
  /** Rol al que quiere llegar (texto libre, opcional). */
  target_role?: string | null;
  /** Salario mensual que espera ganar en el rol objetivo (opcional). */
  expected_salary?: number | null;
  salary_currency?: SalaryCurrency;
}

export type SalaryCurrency = 'PEN' | 'USD';
/** Nivel del puesto (escalera profesional). */
export type RoleLevel = 'junior' | 'semi-senior' | 'senior' | 'lider';

/** Rango salarial mensual bruto referencial. */
export interface SalaryRange { min: number; max: number; currency: SalaryCurrency; note: string }

export interface SuggestedRole {
  title: string;
  area_id: string | null;
  area: string | null;
  level: RoleLevel;
  /** 0–100: qué tan preparado está hoy para el puesto. */
  fit: number;
  reason: string;
  salary: SalaryRange | null;
}

export type GapKind = 'area' | 'tecnica' | 'blanda' | 'experiencia';

/** Una brecha entre el nivel actual y el requerido por el rol objetivo (0–100, o años para experiencia). */
export interface GapItem { kind: GapKind; name: string; current: number; required: number; note: string }

export interface RoleGap {
  target_role: string;
  target_level: RoleLevel;
  target_areas: string[];
  /** 0–100: preparación actual para el rol objetivo. */
  readiness: number;
  summary: string;
  items: GapItem[];
  time_estimate: string;
  target_salary: SalaryRange | null;
  expected_salary: { amount: number; currency: SalaryCurrency } | null;
  /** Salario esperado frente al rango referencial del rol objetivo. */
  salary_comparison: 'debajo' | 'dentro' | 'encima' | null;
}

export interface ProfileDiagnosis {
  suggested_roles: SuggestedRole[];
  gap: RoleGap;
}

export type StudyTerm = 'corto' | 'largo';
export interface StudyOption { course_id: string; term: StudyTerm; reason: string; covers: string[] }

/** Estudios sugeridos: corto plazo (cursos, diplomados, bootcamps, especializaciones) y largo plazo (maestrías). */
export interface StudyPlan { short_term: StudyOption[]; long_term: StudyOption[]; note: string }

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
  /** Diagnóstico para el rol objetivo (los diagnósticos anteriores a esta versión no lo tienen). */
  diagnosis?: ProfileDiagnosis;
  studies?: StudyPlan;
  file: StoredFile | null;
  contact_ok: boolean;
  status: ProfileStatus;
  notes: string;
}

/** Datos personales visibles para el usuario: sin correo, teléfono ni LinkedIn. */
export type PublicPersonalData = Omit<PersonalData, 'email' | 'phone' | 'linkedin'>;

/** Lo que se devuelve al navegador: sin archivo, datos internos ni datos de contacto. */
export type PublicProfileAnalysis = Omit<ProfileAnalysis, 'file' | 'status' | 'notes' | 'extract'> & {
  has_file: boolean;
  extract: Omit<ProfileExtract, 'personal'> & { personal: PublicPersonalData };
};
