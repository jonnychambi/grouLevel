/**
 * POST /api/track — registra una interacción anónima con un programa o institución (panel de Demanda).
 * Body: { event, course_id?, institution_id?, utm_source?, utm_medium?, utm_campaign?, referrer? }
 * No guarda IP, sesión ni datos personales: solo suma un contador diario con el origen agregado.
 */
import { json, readJson } from './_lib/http.js';
import { findCourse, rateLimited } from './_lib/guard.js';
import { getSql, isDbConfigured } from './_lib/db.js';
import { DEMAND_EVENTS, deviceOf, geoOf, isBot, recordDemand, type DemandEvent } from './_lib/demand.js';

const CLIENT_EVENTS: readonly string[] = DEMAND_EVENTS.filter((e) => e !== 'lead'); // los leads se cuentan al guardarse (api/leads)

export async function POST(request: Request): Promise<Response> {
  const ua = request.headers.get('user-agent');
  if (!isDbConfigured() || isBot(ua)) return new Response(null, { status: 204 });
  if (rateLimited(request, 'track', 240)) return new Response(null, { status: 204 });
  const body = await readJson<Record<string, unknown>>(request);
  const event = String(body?.event ?? '') as DemandEvent;
  if (!CLIENT_EVENTS.includes(event)) return json(400, { error: 'bad_event' });

  let course_id = '';
  let institution_id = '';
  if (event === 'institution_view') {
    institution_id = String(body?.institution_id ?? '').slice(0, 80);
    const [row] = institution_id ? await getSql()`select 1 from institutions where id = ${institution_id}` : [];
    if (!row) return json(400, { error: 'unknown_institution' });
  } else {
    const course = await findCourse(String(body?.course_id ?? ''));
    if (!course) return json(400, { error: 'unknown_course' });
    course_id = course.id;
    institution_id = course.institution_id;
  }
  const str = (k: string) => (typeof body?.[k] === 'string' ? (body[k] as string) : null);
  await recordDemand({
    event, course_id, institution_id,
    origin: { utm_source: str('utm_source'), utm_medium: str('utm_medium'), utm_campaign: str('utm_campaign'), referrer: str('referrer') },
    ...geoOf(request), device: deviceOf(ua)
  });
  return new Response(null, { status: 204 });
}
