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
