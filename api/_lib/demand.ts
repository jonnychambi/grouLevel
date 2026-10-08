/**
 * Demanda: cuántas veces se ve, compara, guarda, visita en la web de la institución y solicita cada programa,
 * y desde dónde llega esa gente (canal, fuente/campaña, país/ciudad, dispositivo).
 *
 * Contadores diarios agregados: no se guarda la IP, ni la sesión, ni datos personales; por eso no depende del
 * consentimiento de cookies (a diferencia de GA4). Los bots conocidos se ignoran.
 */
import type { Sql } from './db.js';
import { getSql } from './db.js';

export const DEMAND_EVENTS = ['view', 'compare', 'favorite', 'outbound', 'lead_open', 'lead', 'share', 'institution_view'] as const;
export type DemandEvent = (typeof DEMAND_EVENTS)[number];

export interface Origin { utm_source?: string | null; utm_medium?: string | null; utm_campaign?: string | null; referrer?: string | null }

const SEARCH = /(^|\.)(google|bing|yahoo|duckduckgo|yandex|baidu|ecosia|brave)\./i;
const SOCIAL = /(facebook|fb\.|instagram|linkedin|lnkd\.in|tiktok|t\.co$|twitter|x\.com|youtube|youtu\.be|whatsapp|wa\.me|telegram|reddit|pinterest|threads)/i;
const AI = /(chatgpt|openai|perplexity|claude\.ai|gemini\.google|copilot)/i;

const host = (s: string | null | undefined) => {
  if (!s) return '';
  try {
    return new URL(s.includes('://') ? s : `https://${s}`).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
};
const clip = (s: unknown, n = 80) => String(s ?? '').trim().slice(0, n);

/** Canal de origen a partir de las UTM y el referrer (misma lógica para visitas y leads). */
export function classifyOrigin(o: Origin, siteHost = 'groulevel.com'): { channel: string; source: string; campaign: string } {
  const medium = clip(o.utm_medium).toLowerCase();
  const utmSource = clip(o.utm_source).toLowerCase();
  const ref = host(o.referrer);
  const campaign = clip(o.utm_campaign, 120);
  const internal = ref && (ref === siteHost || ref.endsWith(`.${siteHost}`));
  const src = (utmSource && medium !== 'referral' ? utmSource : '') || (internal ? '' : ref) || utmSource;
  if (/^(cpc|ppc|paid|paidsocial|paid_social|display|cpm|ads?)$/.test(medium) || /ads?$/.test(medium)) return { channel: 'Pago', source: src || 'pago', campaign };
  if (/^e-?mail|newsletter/.test(medium)) return { channel: 'Email', source: src || 'email', campaign };
  if (/social/.test(medium) || SOCIAL.test(src)) return { channel: 'Redes sociales', source: src, campaign };
  if (SEARCH.test(`${src}.`) || SEARCH.test(src)) return { channel: 'Búsqueda orgánica', source: src.split('.')[0] || src, campaign };
  if (AI.test(src)) return { channel: 'Asistentes de IA', source: src, campaign };
  if (src && !internal) return { channel: campaign ? 'Campaña' : 'Referido', source: src, campaign };
  return { channel: 'Directo', source: '', campaign };
}

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|pingdom|monitor|curl|wget|python-requests|facebookexternalhit|vercel-screenshot/i;
export const isBot = (ua: string | null) => !ua || BOT.test(ua);

export function deviceOf(ua: string | null): string {
  if (!ua) return '';
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return 'tablet';
  if (/mobi|iphone|android/i.test(ua)) return 'móvil';
  return 'escritorio';
}

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['es'], { type: 'region' });
  } catch {
    return null;
  }
})();

/** País y ciudad desde los headers de geolocalización de Vercel (aproximados, por IP; la IP no se guarda). */
export function geoOf(request: Request): { country: string; city: string } {
  const code = (request.headers.get('x-vercel-ip-country') ?? '').toUpperCase();
  let city = request.headers.get('x-vercel-ip-city') ?? '';
  try {
    city = decodeURIComponent(city);
  } catch {
    /* tal cual */
  }
  let country = code;
  try {
    if (code && regionNames) country = regionNames.of(code) ?? code;
  } catch {
    /* código */
  }
  return { country: clip(country, 60), city: clip(city, 60) };
}

export interface DemandHit { event: DemandEvent; course_id?: string; institution_id?: string; origin: Origin; country: string; city: string; device: string; day?: string }

export async function recordDemand(hit: DemandHit, sql: Sql = getSql()): Promise<void> {
  const { channel, source, campaign } = classifyOrigin(hit.origin);
  const day = hit.day ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  await sql`
    insert into demand_daily (day, event, course_id, institution_id, channel, source, campaign, country, city, device, count)
    values (${day}, ${hit.event}, ${hit.course_id ?? ''}, ${hit.institution_id ?? ''}, ${channel}, ${source}, ${campaign}, ${hit.country}, ${hit.city}, ${hit.device}, 1)
    on conflict (day, event, course_id, institution_id, channel, source, campaign, country, city, device) do update set count = demand_daily.count + 1`;
}

// ───────────────────────── Reporte ─────────────────────────

export interface DemandFilters { days: number; channel?: string | null; country?: string | null; category?: string | null }

const METRICS = `
  coalesce(sum(d.count) filter (where d.event = 'view'), 0)::int as views,
  coalesce(sum(d.count) filter (where d.event = 'compare'), 0)::int as compares,
  coalesce(sum(d.count) filter (where d.event = 'favorite'), 0)::int as favorites,
  coalesce(sum(d.count) filter (where d.event = 'outbound'), 0)::int as outbound,
  coalesce(sum(d.count) filter (where d.event = 'lead_open'), 0)::int as lead_opens,
  coalesce(sum(d.count) filter (where d.event = 'lead'), 0)::int as leads,
  coalesce(sum(d.count) filter (where d.event = 'institution_view'), 0)::int as institution_views`;

export async function demandReport(f: DemandFilters, sql: Sql = getSql()) {
  const days = Math.min(365, Math.max(1, Math.round(f.days) || 30));
  const since = new Date(Date.now() - (days - 1) * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  // Filtros como parámetros ($1…$4); la categoría se resuelve contra la tabla de programas.
  const params = [since, f.channel || null, f.country || null, f.category || null];
  const where = `d.day >= $1::date and ($2::text is null or d.channel = $2) and ($3::text is null or d.country = $3)
    and ($4::text is null or d.course_id in (select id from courses where category_id = $4) or (d.course_id = '' and d.institution_id in (select institution_id from courses where category_id = $4)))`;
  const q = (text: string) => sql.unsafe(text, params as never[]);

  const [totals, courses, institutions, channels, sources, countries, cities, devices, daily] = await Promise.all([
    q(`select ${METRICS} from demand_daily d where ${where}`),
    q(`select d.course_id, c.name, c.slug, c.institution_id, i.name as institution_name, c.category_id, c.program_type, ${METRICS}
       from demand_daily d left join courses c on c.id = d.course_id left join institutions i on i.id = c.institution_id
       where ${where} and d.course_id <> '' group by d.course_id, c.name, c.slug, c.institution_id, i.name, c.category_id, c.program_type
       order by views desc, leads desc limit 200`),
    q(`select d.institution_id, i.name, i.slug, count(distinct nullif(d.course_id, ''))::int as programs, ${METRICS}
       from demand_daily d left join institutions i on i.id = d.institution_id
       where ${where} and d.institution_id <> '' group by d.institution_id, i.name, i.slug order by views desc, leads desc limit 100`),
    q(`select d.channel as key, ${METRICS} from demand_daily d where ${where} group by d.channel order by views desc`),
    q(`select d.channel, d.source, d.campaign, ${METRICS} from demand_daily d where ${where} and (d.source <> '' or d.campaign <> '')
       group by d.channel, d.source, d.campaign order by views desc, leads desc limit 25`),
    q(`select d.country as key, ${METRICS} from demand_daily d where ${where} group by d.country order by views desc limit 20`),
    q(`select d.city as key, d.country, ${METRICS} from demand_daily d where ${where} and d.city <> '' group by d.city, d.country order by views desc limit 20`),
    q(`select d.device as key, ${METRICS} from demand_daily d where ${where} group by d.device order by views desc`),
    q(`select to_char(d.day, 'YYYY-MM-DD') as day, ${METRICS} from demand_daily d where ${where} group by d.day order by d.day`)
  ]);
  const [filters] = await sql`select coalesce(array_agg(distinct channel), '{}') as channels, coalesce(array_agg(distinct country) filter (where country <> ''), '{}') as countries
    from demand_daily where day >= ${since}`;
  return { days, since, totals: totals[0], courses, institutions, channels, sources, countries, cities, devices, daily, options: filters };
}
