/**
 * Cliente del API de administración (/api/admin). La sesión vive en sessionStorage
 * (se cierra al cerrar la pestaña) y expira a las 12 horas.
 */
import type { Category, Course, EducationLevel, Institution, Lead, LeadStatus, ProfileAnalysis, ProfileEngine, ProfileSource, ProfileStatus, Review, ReviewStatus, Seniority } from '../types';
import { sessionStore } from './storage';

export interface AdminCatalog {
  courses: Course[];
  institutions: Institution[];
  categories: Category[];
  meta?: { saved_at?: string; note?: string };
}

export interface VersionInfo { pathname: string; uploaded_at: string; size: number; note: string }

export class AdminApiError extends Error {
  constructor(message: string, public status: number, public details: string[] = [], public code = '') {
    super(message);
  }
}

const SESSION_KEY = 'admin-session';
const ENDPOINT = `${import.meta.env.BASE_URL}api/admin`;

interface Session { token: string; expires_at: string }

export function getSession(): Session | null {
  const s = sessionStore.get<Session | null>(SESSION_KEY, null);
  return s && new Date(s.expires_at).getTime() > Date.now() ? s : null;
}

export function logout() {
  sessionStore.set(SESSION_KEY, null);
}

async function call<T>(action: string, init: RequestInit = {}): Promise<T> {
  const session = getSession();
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?action=${action}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.token}` } : {}), ...(init.headers ?? {}) }
    });
  } catch {
    throw new AdminApiError('No hay conexión con el servidor.', 0);
  }
  const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
  if (!isJson) {
    if (res.status >= 500) throw new AdminApiError(`El servidor no respondió a tiempo o falló (código ${res.status}). Intenta de nuevo en unos segundos.`, res.status, [], 'server');
    throw new AdminApiError('El API de administración no está disponible en este entorno (funciona en el despliegue de Vercel).', res.status, [], 'no_api');
  }
  const body = (await res.json()) as T & { message?: string; errors?: string[]; error?: string };
  if (!res.ok) {
    if (res.status === 401 && action !== 'login') logout();
    throw new AdminApiError(body.message ?? 'Error inesperado.', res.status, body.errors ?? [], body.error ?? '');
  }
  return body;
}

export async function login(password: string): Promise<void> {
  const session = await call<Session>('login', { method: 'POST', body: JSON.stringify({ password }) });
  sessionStore.set(SESSION_KEY, session);
}

export const fetchCatalog = () => call<{ catalog: AdminCatalog | null; version: VersionInfo | null }>('catalog');

export const saveCatalog = (catalog: AdminCatalog, baseVersion: string | null, note: string) =>
  call<{ version: VersionInfo }>('catalog', { method: 'PUT', body: JSON.stringify({ catalog, baseVersion, note }) });

export const fetchVersions = () => call<{ versions: VersionInfo[] }>('versions');

export const restoreVersion = (pathname: string) => call<{ version: VersionInfo }>('restore', { method: 'POST', body: JSON.stringify({ pathname }) });

/** Catálogo incluido en el build (el que se generó desde el Excel). */
export async function loadBundledCatalog(): Promise<AdminCatalog> {
  const [courses, institutions, categories] = await Promise.all([
    import('../data/courses.json').then((m) => m.default as Course[]),
    import('../data/institutions.json').then((m) => m.default as Institution[]),
    import('../data/categories.json').then((m) => m.default as Category[])
  ]);
  return { courses, institutions, categories };
}

/* ------------------------------------------------------------------ Leads */

export type StoredLead = Lead & { pathname: string };

export const fetchLeads = (limit = 1000) => call<{ leads: StoredLead[]; total: number }>(`leads&limit=${limit}`);

export const updateLeadStatus = (pathname: string, patch: { status?: LeadStatus; notes?: string }) =>
  call<{ lead: StoredLead }>('lead', { method: 'POST', body: JSON.stringify({ pathname, ...patch }) });

export const deleteLeadRecord = (pathname: string) => call<{ ok: true }>('lead-delete', { method: 'POST', body: JSON.stringify({ pathname }) });

/* --------------------------------------------------------------- Reseñas */

export type StoredReview = Review & { pathname: string };

export const fetchReviews = () => call<{ reviews: StoredReview[] }>('reviews');

export const moderateReview = (pathname: string, patch: { status?: ReviewStatus; reply?: string; rejection_reason?: string }) =>
  call<{ review: StoredReview }>('review', { method: 'POST', body: JSON.stringify({ pathname, ...patch }) });

export const deleteReviewRecord = (pathname: string) => call<{ ok: true }>('review-delete', { method: 'POST', body: JSON.stringify({ pathname }) });

/* ------------------------------------------------------ Mi ruta (perfiles) */

export interface ProfileListItem {
  id: string; created_at: string; updated_at: string; source: ProfileSource; engine: ProfileEngine; objective: string; status: ProfileStatus; notes: string; contact_ok: boolean;
  file: ProfileAnalysis['file']; name: string; email: string | null; phone: string | null; country: string | null; current_role: string | null; seniority: Seniority;
  years_experience: number | null; highest_degree: EducationLevel | null; target_areas: string[];
  target_role: string | null; readiness: number | null; expected_salary: number | null; expected_salary_currency: 'PEN' | 'USD' | null;
}

export const fetchProfiles = (limit = 500) => call<{ profiles: ProfileListItem[]; total: number }>(`profiles&limit=${limit}`);

export const fetchProfileDetail = (id: string) => call<{ profile: ProfileAnalysis }>(`profile&id=${encodeURIComponent(id)}`);

export const updateProfileRecord = (id: string, patch: { status?: ProfileStatus; notes?: string }) =>
  call<{ profile: ProfileAnalysis }>('profile', { method: 'POST', body: JSON.stringify({ id, ...patch }) });

export const deleteProfileRecord = (id: string) => call<{ ok: true }>('profile-delete', { method: 'POST', body: JSON.stringify({ id }) });

/** Descarga el CV original (requiere sesión; no se expone por URL pública). */
export async function downloadProfileFile(id: string, fileName: string): Promise<void> {
  const session = getSession();
  const res = await fetch(`${ENDPOINT}?action=profile-file&id=${encodeURIComponent(id)}`, { headers: session ? { Authorization: `Bearer ${session.token}` } : {} });
  if (!res.ok) throw new AdminApiError(res.status === 401 ? 'Sesión inválida o vencida. Vuelve a ingresar.' : 'No se pudo descargar el CV.', res.status);
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/* ------------------------------------------------- Base de datos (Supabase) */

export interface DbStatus {
  configured: boolean;
  connected?: boolean;
  error?: string;
  migrations?: { version: string; applied_at: string }[];
  counts?: Record<'courses' | 'institutions' | 'categories' | 'catalog_versions' | 'catalog_changes' | 'leads' | 'reviews' | 'profiles', number>;
  last_sync?: { id: number; started_at: string; finished_at: string | null; trigger: string; stats: Record<string, unknown> | null; error: string | null } | null;
}

export const fetchDbStatus = () => call<DbStatus>('db-status');

export const runDbImport = () => call<{ stats: { versions: number; leads: number; reviews: number; profiles: number; ms: number; skipped: Record<string, number> } }>('db-import', { method: 'POST' });

/* ---------------------------------------------------- Actualización de programas */

export type RefreshFrequency = 'diario' | 'semanal' | 'desactivado';
export interface RefreshSettings { frequency: RefreshFrequency; batch_size: number }
export interface FieldChange { field: string; label: string; current: unknown; proposed: unknown }
export interface ProgramUpdate {
  id: number; course_id: string; course_name: string; detected_at: string; status: 'pendiente' | 'aplicada' | 'descartada'; changes: FieldChange[];
  source_url: string | null; method: 'ia' | 'huella'; model: string | null; input_tokens: number; output_tokens: number;
  decided_at: string | null; version: string | null; note: string | null;
}
export type CheckStatus = 'sin_cambios' | 'cambios' | 'error' | 'sin_contenido';
export interface ProgramCheck { course_id: string; last_checked_at: string; last_status: CheckStatus; http_status: number | null; last_error: string | null; last_changed_at: string | null }
export interface RefreshRun { id: number; trigger: string; started_at: string; finished_at: string | null; checked: number; unchanged: number; changed: number; errors: number; ai_calls: number; input_tokens: number; output_tokens: number }
export interface RefreshOverview {
  settings: RefreshSettings;
  ai: { configured: boolean; model: string };
  usage_30d: { input_tokens: number; output_tokens: number; ai_calls: number; runs: number; estimated_usd: number };
  pending: ProgramUpdate[];
  recent: ProgramUpdate[];
  runs: RefreshRun[];
  checks: ProgramCheck[];
}
export interface RefreshSummary { checked: number; unchanged: number; changed: number; errors: number; ai_calls: number; input_tokens: number; output_tokens: number; remaining: number }
export interface CheckResult { course_id: string; status: CheckStatus; changes: FieldChange[]; ai_used: boolean; usage: { input_tokens: number; output_tokens: number }; http_status: number | null; error?: string }

export const fetchRefresh = () => call<RefreshOverview>('refresh');
export const saveRefreshSettings = (settings: Partial<RefreshSettings>) => call<{ settings: RefreshSettings }>('refresh-settings', { method: 'POST', body: JSON.stringify(settings) });
export const runRefreshNow = () => call<{ summary: RefreshSummary }>('refresh-run', { method: 'POST' });
export const checkProgram = (course_id: string) => call<{ result: CheckResult }>('refresh-check', { method: 'POST', body: JSON.stringify({ course_id }) });
export const applyProgramUpdate = (id: number, fields: string[]) => call<{ version: VersionInfo }>('refresh-apply', { method: 'POST', body: JSON.stringify({ id, fields }) });
export const discardProgramUpdate = (id: number) => call<{ ok: true }>('refresh-discard', { method: 'POST', body: JSON.stringify({ id }) });

/* ---------------------------------------------------- Alta de programas desde links */

export interface DraftData {
  name: string; program_type: string; published_type: string | null; category: string; short_description: string; description: string; target_audience: string | null;
  level: string | null; modality: string | null; language: string; price: number | null; discount_price: number | null; currency: 'PEN' | 'USD';
  duration_hours: number | null; duration_weeks: number | null; duration_text: string | null; start_date: string | null; start_text: string | null; schedule: string | null;
  certificate: { type: string; description: string } | null; objectives: string[]; syllabus: { title: string; hours: number | null }[]; tools: string[]; skills: string[]; requirements: string[];
  financing: { installments: number | null; installment_amount: number | null; methods: string[]; notes: string }; enrollment_open: boolean | null; institution_name: string | null; url: string;
}
export type DraftStatus = 'en_cola' | 'procesando' | 'listo' | 'error' | 'publicado' | 'descartado';
export interface ProgramDraft {
  id: number; url: string; status: DraftStatus; institution_id: string | null; data: DraftData | null; missing: string[]; error: string | null;
  model: string | null; input_tokens: number; output_tokens: number; attempts: number; course_id: string | null; created_at: string; updated_at: string; published_at: string | null;
}
export interface AdminSummary { updates: number; drafts_ready: number; drafts_queue: number; reviews: number; leads: number; profiles_week: number }

export const fetchSummary = () => call<AdminSummary>('summary');
export const fetchDrafts = () => call<{ drafts: ProgramDraft[]; recent: ProgramDraft[]; ai: { configured: boolean; model: string } }>('import');
export const addLinks = (links: string, institution_id: string | null) => call<{ added: number; skipped: { url: string; reason: string }[] }>('import-add', { method: 'POST', body: JSON.stringify({ links, institution_id }) });
export const processDrafts = (ids?: number[]) => call<{ processed: number; ready: number; errors: number; remaining: number }>('import-process', { method: 'POST', body: JSON.stringify({ ids }) });
export const updateDraft = (id: number, patch: { data?: Partial<DraftData>; institution_id?: string | null }) => call<{ draft: ProgramDraft }>('import-update', { method: 'POST', body: JSON.stringify({ id, ...patch }) });
export const retryDraft = (id: number) => call<{ ok: true }>('import-retry', { method: 'POST', body: JSON.stringify({ id }) });
export const discardDraft = (id: number) => call<{ ok: true }>('import-discard', { method: 'POST', body: JSON.stringify({ id }) });
export const publishDrafts = (ids: number[], status: 'publicado' | 'borrador') =>
  call<{ version: VersionInfo; published: number; skipped: { id: number; reason: string }[] }>('import-publish', { method: 'POST', body: JSON.stringify({ ids, status }) });
