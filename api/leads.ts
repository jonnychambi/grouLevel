/**
 * POST /api/leads — recibe una solicitud de información desde el sitio y la guarda (Blob privado).
 *
 * Seguridad: validación estricta, campo trampa anti-bots ("website"), límite por IP,
 * el programa debe existir en el catálogo publicado y el Signal Score se recalcula aquí
 * (no se confía en el puntaje que envía el navegador). No se guarda la IP.
 *
 * Opcional: LEAD_WEBHOOK_URL reenvía cada lead (p. ej. a Zapier/Make → Google Sheets o un CRM).
 */
import { json, readJson } from './_lib/http.js';
import { buildLeadFromRequest, saveLead } from './_lib/leads.js';
import { findCourse, rateLimited } from './_lib/guard.js';
import { isDbConfigured } from './_lib/db.js';

async function forwardWebhook(lead: unknown) {
  const url = process.env.LEAD_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead), signal: AbortSignal.timeout(4000) });
  } catch {
    /* el lead ya está guardado; el webhook es best-effort */
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!isDbConfigured()) return json(503, { error: 'store_not_configured', message: 'El registro de solicitudes no está disponible.' });
  if (rateLimited(request, 'leads', 8)) return json(429, { error: 'rate_limited', message: 'Demasiadas solicitudes. Inténtalo en unos minutos.' });

  const body = await readJson<Record<string, unknown>>(request);
  if (!body) return json(400, { error: 'bad_request', message: 'Solicitud inválida.' });
  // Campo trampa: los humanos no lo ven; si viene lleno es un bot. Respondemos OK sin guardar.
  if (typeof body.website === 'string' && body.website.trim()) return json(200, { ok: true });

  const course = await findCourse(String((body.course_id as string) ?? ''));
  const result = buildLeadFromRequest(body, course);
  if (!result.ok) return json(422, { error: 'invalid', message: 'Revisa los datos del formulario.', errors: result.errors });

  await saveLead(result.lead);
  await forwardWebhook(result.lead);
  const { id, lead_score, lead_tier, lead_segment, created_at, course_id, course_name, institution_id, institution_name, source } = result.lead;
  return json(201, { id, lead_score, lead_tier, lead_segment, created_at, course_id, course_name, institution_id, institution_name, source });
}
