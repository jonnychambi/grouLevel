/**
 * Reseñas públicas de programas.
 *
 *   GET  /api/reviews?summary=1        → promedios por programa e institución (solo aprobadas)
 *   GET  /api/reviews?course=<id>      → reseñas aprobadas de un programa
 *   POST /api/reviews                  → envía una reseña; queda PENDIENTE hasta que se apruebe en /admin
 *
 * Anti-abuso: validación, campo trampa ("website"), límite por IP, una reseña por email y programa,
 * y el programa debe existir. El email nunca se publica ni se guarda la IP.
 */
import { findCourse, rateLimited } from './_lib/guard.js';
import { json, readJson } from './_lib/http.js';
import { publicReviews, publicSummary, submitReview } from './_lib/reviews.js';
import { isDbConfigured } from './_lib/db.js';

const CACHE = { 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=600' };

export async function GET(request: Request): Promise<Response> {
  if (!isDbConfigured()) return json(503, { error: 'store_not_configured' });
  const params = new URL(request.url).searchParams;
  if (params.get('summary')) return json(200, await publicSummary(), CACHE);
  const course = params.get('course');
  if (course) return json(200, { reviews: await publicReviews(course) }, CACHE);
  return json(400, { error: 'bad_request', message: 'Indica summary=1 o course=<id>.' });
}

export async function POST(request: Request): Promise<Response> {
  if (!isDbConfigured()) return json(503, { error: 'store_not_configured', message: 'Las reseñas no están disponibles en este momento.' });
  if (rateLimited(request, 'reviews', 5)) return json(429, { error: 'rate_limited', message: 'Demasiados envíos. Inténtalo más tarde.' });
  const body = await readJson<Record<string, unknown>>(request);
  if (!body) return json(400, { error: 'bad_request', message: 'Solicitud inválida.' });
  if (typeof body.website === 'string' && body.website.trim()) return json(201, { ok: true, status: 'pendiente' }); // bot

  const result = await submitReview(body, await findCourse(String(body.course_id ?? '')));
  if (!result.ok) return json(result.status, { error: 'invalid', message: result.message, errors: result.errors });
  return json(201, { ok: true, id: result.review.id, status: result.review.status });
}
