/**
 * Groulevel Reviews — API pública.
 *
 *   GET  /api/reviews?summary=1              → promedios y dimensiones por programa e institución (solo aprobadas)
 *   GET  /api/reviews?course=<id>            → { reviews (del programa), institution_reviews (de su institución) }
 *   GET  /api/reviews?institution=<id>       → { reviews }
 *   GET  /api/reviews?action=me              → { user, reviews, wallet }  (Authorization: Bearer <token>)
 *   GET  /api/reviews?action=status          → { auth: boolean }  (¿registro disponible?)
 *   POST /api/reviews?action=auth-start      { email, next? } → envía código/enlace de acceso por correo
 *   POST /api/reviews?action=auth-verify     { email, code }  → { session }
 *   POST /api/reviews?action=report          { id, reason, details? } → reporta una reseña sospechosa
 *   POST /api/reviews?action=redeem          { course_id, amount } (Bearer) → canjea créditos como descuento en un programa
 *   POST /api/reviews                        multipart (Bearer): campos del formulario + evidence (opcional) + ref (código de referido)
 *
 * Solo personas con correo validado pueden opinar. El correo y la evidencia nunca se publican; no se guarda la IP.
 */
import { rateLimited } from './_lib/guard.js';
import { json, readJson } from './_lib/http.js';
import { isDbConfigured } from './_lib/db.js';
import { AuthError, isAuthConfigured, startEmailLogin, userFromRequest, verifyEmailCode } from './_lib/reviewAuth.js';
import { CreditError, myReviews, myWallet, parseSubmission, redeemCredit, publicSummary, reportReview, reviewsForCourse, reviewsForInstitution, submitReview, type EvidenceFile } from './_lib/reviews.js';

const CACHE = { 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=600' };
const REPORT_REASONS = ['falsa', 'ofensiva', 'publicidad', 'datos_personales', 'conflicto_interes', 'otro'];

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  if (params.get('action') === 'status') return json(200, { auth: isAuthConfigured() && isDbConfigured() });
  if (!isDbConfigured()) return json(503, { error: 'store_not_configured' });
  if (params.get('action') === 'me') {
    const user = await userFromRequest(request);
    if (!user) return json(401, { error: 'unauthorized', message: 'Tu sesión venció. Ingresa de nuevo con tu correo.' });
    const reviews = await myReviews(user);
    return json(200, { user: { email: user.email, email_verified: user.email_verified }, reviews, wallet: await myWallet(user) });
  }
  if (params.get('summary')) return json(200, await publicSummary(), CACHE);
  const course = params.get('course');
  if (course) return json(200, await reviewsForCourse(course), CACHE);
  const institution = params.get('institution');
  if (institution) return json(200, { reviews: await reviewsForInstitution(institution) }, CACHE);
  return json(400, { error: 'bad_request', message: 'Indica summary=1, course=<id> o institution=<id>.' });
}

export async function POST(request: Request): Promise<Response> {
  if (!isDbConfigured()) return json(503, { error: 'store_not_configured', message: 'Las reseñas no están disponibles en este momento.' });
  const action = new URL(request.url).searchParams.get('action');
  try {
    if (action === 'auth-start') {
      if (rateLimited(request, 'review-auth', 5, 15 * 60_000)) return json(429, { error: 'rate_limited', message: 'Demasiados intentos. Espera unos minutos.' });
      const body = await readJson<{ email?: string; next?: string }>(request);
      await startEmailLogin(String(body?.email ?? ''), String(body?.next ?? '/opinar'));
      return json(200, { ok: true });
    }
    if (action === 'auth-verify') {
      if (rateLimited(request, 'review-verify', 10, 15 * 60_000)) return json(429, { error: 'rate_limited', message: 'Demasiados intentos. Espera unos minutos.' });
      const body = await readJson<{ email?: string; code?: string }>(request);
      return json(200, { session: await verifyEmailCode(String(body?.email ?? ''), String(body?.code ?? '')) });
    }
  } catch (err) {
    if (err instanceof AuthError) return json(err.status, { error: 'auth', message: err.message });
    throw err;
  }
  if (action === 'report') {
    if (rateLimited(request, 'review-report', 10)) return json(429, { error: 'rate_limited', message: 'Demasiados reportes. Inténtalo más tarde.' });
    const body = await readJson<{ id?: string; reason?: string; details?: string }>(request);
    if (!REPORT_REASONS.includes(String(body?.reason))) return json(400, { error: 'bad_request', message: 'Elige un motivo.' });
    return (await reportReview(request, String(body?.id ?? ''), String(body?.reason), String(body?.details ?? '')))
      ? json(200, { ok: true })
      : json(404, { error: 'not_found', message: 'La reseña no existe.' });
  }

  if (action === 'redeem') {
    if (rateLimited(request, 'review-redeem', 10, 60 * 60_000)) return json(429, { error: 'rate_limited', message: 'Demasiados intentos. Inténtalo más tarde.' });
    const user = await userFromRequest(request);
    if (!user) return json(401, { error: 'unauthorized', message: 'Tu sesión venció. Ingresa de nuevo con tu correo.' });
    const body = await readJson<{ course_id?: string; amount?: number }>(request);
    try {
      return json(201, { redemption: await redeemCredit(user, String(body?.course_id ?? ''), Number(body?.amount)) });
    } catch (err) {
      if (err instanceof CreditError) return json(409, { error: 'credit', message: err.message });
      throw err;
    }
  }

  // Envío de una reseña (requiere sesión con correo validado).
  if (rateLimited(request, 'reviews', 6, 60 * 60_000)) return json(429, { error: 'rate_limited', message: 'Demasiados envíos. Inténtalo más tarde.' });
  const user = await userFromRequest(request);
  if (!user) return json(401, { error: 'unauthorized', message: 'Ingresa con tu correo para publicar tu reseña.' });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, { error: 'bad_request', message: 'Solicitud inválida.' });
  }
  const fields: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string') fields[k] = v;
  if (fields.website?.trim()) return json(201, { ok: true, status: 'pendiente' }); // bot
  const upload = form.get('evidence');
  const file: EvidenceFile | null = upload && typeof upload !== 'string' && upload.size > 0
    ? { name: upload.name || 'constancia', type: upload.type, bytes: new Uint8Array(await upload.arrayBuffer()) }
    : null;
  const result = await submitReview(user, parseSubmission(fields), file, { pageUrl: fields.page_url ?? '', ref: (fields.ref ?? '').slice(0, 20) });
  if (!result.ok) return json(result.status, { error: 'invalid', message: result.message, errors: result.errors });
  return json(201, { ok: true, id: result.review.id, status: 'pendiente', incentive: result.incentive });
}
