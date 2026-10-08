/**
 * Groulevel Reviews (cliente): lectura de reputación y reseñas aprobadas, acceso con correo validado
 * (Supabase Auth vía /api/reviews), envío del formulario y reportes.
 * Donde no hay API (GitHub Pages, desarrollo) el sitio funciona sin valoraciones.
 */
import type { PublicReview, ReviewsSummary } from '../types';
import type { ReviewSubmission } from '../utils/reviews';
import { storage } from './storage';

const ENDPOINT = `${import.meta.env.BASE_URL}api/reviews`;
const EMPTY: ReviewsSummary = { courses: {}, institutions: {}, updated_at: '' };
const SESSION_KEY = 'review-session';

async function getJson<T>(url: string, timeoutMs = 4000, headers: Record<string, string> = {}): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('application/json')) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

let summaryPromise: Promise<ReviewsSummary> | null = null;
export function fetchReviewsSummary(): Promise<ReviewsSummary> {
  summaryPromise ??= getJson<ReviewsSummary>(`${ENDPOINT}?summary=1`).then((s) => (s && s.courses ? s : EMPTY));
  return summaryPromise;
}

/** Reseñas del programa y de su institución (para mostrar la reputación de la institución como respaldo). */
export async function fetchCourseReviews(courseId: string): Promise<{ reviews: PublicReview[]; institution_reviews: PublicReview[] }> {
  const res = await getJson<{ reviews: PublicReview[]; institution_reviews?: PublicReview[] }>(`${ENDPOINT}?course=${encodeURIComponent(courseId)}`);
  return { reviews: res?.reviews ?? [], institution_reviews: res?.institution_reviews ?? [] };
}

export async function fetchInstitutionReviews(institutionId: string): Promise<PublicReview[]> {
  return (await getJson<{ reviews: PublicReview[] }>(`${ENDPOINT}?institution=${encodeURIComponent(institutionId)}`))?.reviews ?? [];
}

/* ─────────────────────────── Sesión (correo validado) ─────────────────────────── */

export interface ReviewSession { access_token: string; expires_at: number; email: string }

export function getReviewSession(): ReviewSession | null {
  const s = storage.get<ReviewSession | null>(SESSION_KEY, null);
  return s && s.expires_at * 1000 > Date.now() + 60_000 ? s : null;
}
export function clearReviewSession() {
  storage.set(SESSION_KEY, null);
}

/** Si la persona llegó desde el enlace del correo (#access_token=…), guarda la sesión y limpia la URL. */
export function consumeLinkSession(): ReviewSession | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const token = hash.get('access_token');
  if (!token) return null;
  let email = '';
  try {
    email = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).email ?? '';
  } catch {
    /* sin email visible */
  }
  const session: ReviewSession = { access_token: token, expires_at: Number(hash.get('expires_at')) || Math.floor(Date.now() / 1000) + Number(hash.get('expires_in') || 3600), email };
  storage.set(SESSION_KEY, session);
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return session;
}

export class ReviewApiError extends Error {
  constructor(message: string, public status = 0, public details: string[] = []) {
    super(message);
  }
}

async function send<T>(url: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ReviewApiError('No pudimos conectarnos. Revisa tu conexión e inténtalo nuevamente.');
  }
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) throw new ReviewApiError('Las reseñas no están disponibles en este entorno.', res.status);
  const body = (await res.json()) as T & { message?: string; errors?: string[] };
  if (!res.ok) {
    if (res.status === 401) clearReviewSession();
    throw new ReviewApiError(body.message ?? 'Algo salió mal.', res.status, body.errors ?? []);
  }
  return body;
}

export const reviewAuthAvailable = async () => (await getJson<{ auth: boolean }>(`${ENDPOINT}?action=status`))?.auth ?? false;

export const startReviewLogin = (email: string, next: string) =>
  send<{ ok: true }>(`${ENDPOINT}?action=auth-start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, next }) });

export async function verifyReviewCode(email: string, code: string): Promise<ReviewSession> {
  const { session } = await send<{ session: ReviewSession }>(`${ENDPOINT}?action=auth-verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code }) });
  storage.set(SESSION_KEY, session);
  return session;
}

export interface MyReview { id: string; institution_name: string; course_name: string | null; status: string; evidence_status: string; verified: boolean; created_at: string; incentives: { kind: string; amount: number; status: string }[] }
export async function fetchMyReviews(): Promise<MyReview[] | null> {
  const s = getReviewSession();
  if (!s) return null;
  try {
    return (await send<{ reviews: MyReview[] }>(`${ENDPOINT}?action=me`, { headers: { Authorization: `Bearer ${s.access_token}` } })).reviews;
  } catch {
    return null;
  }
}

export async function submitReviewForm(v: ReviewSubmission, evidence: File | null, honeypot: string): Promise<{ incentive: number }> {
  const s = getReviewSession();
  if (!s) throw new ReviewApiError('Tu sesión venció. Ingresa de nuevo con tu correo.', 401);
  const f = new FormData();
  const entries: Record<string, string> = {
    institution_id: v.institution_id, course_id: v.course_id ?? '', inst_scores: JSON.stringify(v.inst_scores), program_scores: v.course_id ? JSON.stringify(v.program_scores ?? {}) : '',
    best: v.best, improve: v.improve, recommend: v.recommend == null ? '' : v.recommend ? 'si' : 'no', study_year: String(v.study_year ?? ''), student_status: v.student_status ?? '',
    author_name: v.author_name, wants_incentive: String(v.wants_incentive), payout_method: v.payout_method ?? '', payout_account: v.payout_account, consent: String(v.consent),
    page_url: window.location.href, website: honeypot
  };
  for (const [k, val] of Object.entries(entries)) f.set(k, val);
  if (evidence) f.set('evidence', evidence);
  return send<{ incentive: number }>(ENDPOINT, { method: 'POST', headers: { Authorization: `Bearer ${s.access_token}` }, body: f });
}

export const reportReview = (id: string, reason: string, details: string) =>
  send<{ ok: true }>(`${ENDPOINT}?action=report`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, reason, details }) });
