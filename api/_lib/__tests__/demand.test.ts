/** Panel de Demanda: clasificación del origen, contadores anónimos, leads y reporte con filtros. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import courses from '../../../src/data/courses.json';
import { startTestDb } from './testDb';

const db = await startTestDb({ seedCatalog: true });
afterAll(() => db.stop());
const sql = db.sql;
const { classifyOrigin, deviceOf } = await import('../demand');
const track = await import('../../track');
const admin = await import('../../admin');
let token = '';

const pub = (courses as { id: string; institution_id: string; status: string; category: string }[]).filter((c) => c.status === 'publicado');
const [a, b] = [pub[0], pub.find((c) => c.institution_id !== pub[0].institution_id)!];
const UA_MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1';
const UA_DESK = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130 Safari/537.36';
const hit = (body: Record<string, unknown>, ua = UA_DESK, geo: Record<string, string> = { 'x-vercel-ip-country': 'PE', 'x-vercel-ip-city': 'Lima' }) =>
  track.POST(new Request('https://x/api/track', { method: 'POST', headers: { 'user-agent': ua, 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 200)}`, ...geo }, body: JSON.stringify(body) }));

beforeAll(async () => {
  Object.assign(process.env, { ADMIN_PASSWORD: 'pw', ADMIN_SESSION_SECRET: 's' });
  token = ((await (await admin.POST(new Request('https://x/api/admin?action=login', { method: 'POST', body: JSON.stringify({ password: 'pw' }) }))).json()) as { token: string }).token;
});

describe('origen', () => {
  it('clasifica canal, fuente y campaña', () => {
    expect(classifyOrigin({ referrer: 'https://www.google.com/' })).toEqual({ channel: 'Búsqueda orgánica', source: 'google', campaign: '' });
    expect(classifyOrigin({ utm_source: 'www.google.com', utm_medium: 'referral', referrer: 'https://www.google.com/' }).channel).toBe('Búsqueda orgánica');
    expect(classifyOrigin({ utm_source: 'facebook', utm_medium: 'cpc', utm_campaign: 'data-oct' })).toEqual({ channel: 'Pago', source: 'facebook', campaign: 'data-oct' });
    expect(classifyOrigin({ referrer: 'https://l.instagram.com/' }).channel).toBe('Redes sociales');
    expect(classifyOrigin({ utm_source: 'newsletter', utm_medium: 'email' }).channel).toBe('Email');
    expect(classifyOrigin({ referrer: 'https://chatgpt.com/' }).channel).toBe('Asistentes de IA');
    expect(classifyOrigin({ referrer: 'https://blog.ejemplo.pe/post' })).toEqual({ channel: 'Referido', source: 'blog.ejemplo.pe', campaign: '' });
    expect(classifyOrigin({ referrer: 'https://www.groulevel.com/programas' }).channel).toBe('Directo');
    expect(classifyOrigin({}).channel).toBe('Directo');
    expect([deviceOf(UA_MOBILE), deviceOf(UA_DESK)]).toEqual(['móvil', 'escritorio']);
  });
});

describe('contadores y reporte', () => {
  it('suma interacciones anónimas e ignora bots, eventos y programas inválidos', async () => {
    for (let i = 0; i < 3; i++) expect((await hit({ event: 'view', course_id: a.id, referrer: 'https://www.google.com/' }, UA_MOBILE)).status).toBe(204);
    await hit({ event: 'view', course_id: b.id, utm_source: 'facebook', utm_medium: 'cpc', utm_campaign: 'oct' }, UA_DESK, { 'x-vercel-ip-country': 'CO', 'x-vercel-ip-city': 'Bogot%C3%A1' });
    await hit({ event: 'compare', course_id: a.id });
    await hit({ event: 'outbound', course_id: a.id, referrer: 'https://www.google.com/' });
    await hit({ event: 'institution_view', institution_id: b.institution_id });
    await hit({ event: 'view', course_id: a.id }, 'Googlebot/2.1 (+http://www.google.com/bot.html)');
    expect((await hit({ event: 'lead', course_id: a.id })).status).toBe(400);
    expect((await hit({ event: 'view', course_id: 'no-existe' })).status).toBe(400);
    const rows = await sql`select event, course_id, channel, source, country, city, device, count from demand_daily where event = 'view' order by count desc`;
    expect(rows[0]).toMatchObject({ course_id: a.id, channel: 'Búsqueda orgánica', source: 'google', country: 'Perú', city: 'Lima', device: 'móvil', count: 3 });
    expect(rows[1]).toMatchObject({ channel: 'Pago', country: 'Colombia', city: 'Bogotá' });
    expect(rows).toHaveLength(2); // el bot no sumó
  });

  it('un lead guardado se cuenta con su origen', async () => {
    const leads = await import('../../leads');
    const res = await leads.POST(new Request('https://x/api/leads', {
      method: 'POST', headers: { 'user-agent': UA_DESK, 'x-forwarded-for': '10.1.1.1', 'x-vercel-ip-country': 'PE' },
      body: JSON.stringify({ course_id: a.id, page_url: 'https://www.groulevel.com/programa/x', website: '',
        input: { first_name: 'Ana', last_name: 'Rojas', email: 'ana@empresa.pe', whatsapp: '+51 999 888 777', country: 'Perú', start_timeline: 'inmediato', objective: 'cambiar-carrera', consent: true },
        signals: { compared_programs: 1, viewed_programs: 2, source: 'detalle' }, attribution: { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'leads-oct' } })
    }));
    expect(res.status).toBe(201);
    const [row] = await sql`select channel, campaign, count from demand_daily where event = 'lead'`;
    expect(row).toEqual({ channel: 'Pago', campaign: 'leads-oct', count: 1 });
  });

  it('reporte: ranking de programas e instituciones, origen y filtros', async () => {
    const get = async (q = '') => (await (await admin.GET(new Request(`https://x/api/admin?action=demand&days=30${q}`, { headers: { authorization: `Bearer ${token}` } }))).json()) as Record<string, any>;
    const r = await get();
    expect(r.totals).toMatchObject({ views: 4, compares: 1, outbound: 1, leads: 1, institution_views: 1 });
    expect(r.courses[0]).toMatchObject({ course_id: a.id, views: 3, compares: 1, outbound: 1, leads: 1 });
    expect(r.courses[0].name).toBeTruthy();
    expect(r.institutions.find((i: { institution_id: string }) => i.institution_id === b.institution_id)).toMatchObject({ views: 1, institution_views: 1 });
    expect(r.channels.map((c: { key: string }) => c.key)).toEqual(expect.arrayContaining(['Búsqueda orgánica', 'Pago', 'Directo']));
    expect(r.sources.find((s: { source: string }) => s.source === 'facebook')).toMatchObject({ campaign: 'oct', views: 1 });
    expect(r.cities[0]).toMatchObject({ key: 'Lima', country: 'Perú' });
    expect(r.daily).toHaveLength(1);
    const onlyPaid = await get('&channel=Pago');
    expect(onlyPaid.totals).toMatchObject({ views: 1, leads: 1 });
    const byCountry = await get('&country=Colombia');
    expect(byCountry.courses.map((c: { course_id: string }) => c.course_id)).toEqual([b.id]);
    const byCat = await get(`&category=${a.category}`);
    expect(byCat.courses.every((c: { category_id: string }) => c.category_id === a.category)).toBe(true);
    expect((await admin.GET(new Request('https://x/api/admin?action=demand'))).status).toBe(401);
  });
});
