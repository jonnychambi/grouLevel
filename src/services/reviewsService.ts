/**
 * Reseñas: lectura de promedios/reseñas aprobadas y envío de nuevas (quedan pendientes de validación).
 * Donde no hay API (GitHub Pages, desarrollo) el sitio funciona sin valoraciones.
 */
import type { PublicReview, ReviewsSummary } from '../types';
import type { ReviewInput } from '../utils/reviews';

const ENDPOINT = `${import.meta.env.BASE_URL}api/reviews`;
const EMPTY: ReviewsSummary = { courses: {}, institutions: {}, updated_at: '' };

async function getJson<T>(url: string, timeoutMs = 3000): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
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

export async function fetchCourseReviews(courseId: string): Promise<PublicReview[]> {
  const res = await getJson<{ reviews: PublicReview[] }>(`${ENDPOINT}?course=${encodeURIComponent(courseId)}`);
  return res?.reviews ?? [];
}

export class ReviewSubmitError extends Error {
  constructor(message: string, public details: string[] = []) {
    super(message);
  }
}

export async function submitReview(courseId: string, input: ReviewInput, honeypot: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, course_id: courseId, page_url: window.location.href, website: honeypot })
    });
  } catch {
    throw new ReviewSubmitError('No pudimos conectarnos. Revisa tu conexión e inténtalo nuevamente.');
  }
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) throw new ReviewSubmitError('Las reseñas no están disponibles en este entorno.');
  const body = (await res.json()) as { message?: string; errors?: string[] };
  if (!res.ok) throw new ReviewSubmitError(body.message ?? 'No pudimos enviar tu reseña.', body.errors ?? []);
}
