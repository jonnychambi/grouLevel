/** Flujo de leads con Vercel Blob simulado en memoria. */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import courses from '../../../src/data/courses.json';
import institutions from '../../../src/data/institutions.json';
import categories from '../../../src/data/categories.json';

const blobs = new Map<string, { body: string; uploadedAt: Date }>();
vi.mock('@vercel/blob', () => ({
  list: async ({ prefix }: { prefix: string }) => ({
    blobs: [...blobs.entries()].filter(([k]) => k.startsWith(prefix)).map(([pathname, v]) => ({ pathname, uploadedAt: v.uploadedAt, size: v.body.length })),
    hasMore: false
  }),
  put: async (pathname: string, body: string) => { blobs.set(pathname, { body, uploadedAt: new Date() }); return { pathname }; },
  get: async (pathname: string) => { const b = blobs.get(pathname); return b ? { statusCode: 200, stream: new Response(b.body).body } : null; },
  del: async (p: string | string[]) => [p].flat().forEach((x) => blobs.delete(x))
}));

const leadsApi = await import('../../leads');
const admin = await import('../../admin');
const course = courses[0];

const valid = (over: Record<string, unknown> = {}) => ({
  course_id: course.id,
  page_url: 'https://www.groulevel.com/programa/x',
  input: { first_name: ' Ana ', last_name: 'Rojas', email: 'ANA@empresa.pe', whatsapp: '+51 999 888 777', country: 'Perú', start_timeline: 'inmediato', objective: 'cambiar-carrera', consent: true },
  signals: { compared_programs: 3, viewed_programs: 5, source: 'comparador' },
  attribution: { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'q4' },
  lead_score: 1, // un navegador malicioso no puede fijar su puntaje
  website: '',
  ...over
});
const post = (body: unknown, ip = '1.1.1.1') => leadsApi.POST(new Request('https://x/api/leads', { method: 'POST', headers: { 'x-forwarded-for': ip }, body: JSON.stringify(body) }));
let token = '';
const authed = (method: string, action: string, body?: unknown) =>
  new Request(`https://x/api/admin?action=${action}`, { method, headers: { authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });

beforeAll(async () => {
  process.env.ADMIN_PASSWORD = 'pw';
  process.env.ADMIN_SESSION_SECRET = 's';
  process.env.BLOB_READ_WRITE_TOKEN = 'fake';
  // catálogo publicado (el endpoint valida que el programa exista)
  blobs.set('catalog/versions/2026-10-05T00-00-00-000Z__init.json', { body: JSON.stringify({ courses, institutions, categories }), uploadedAt: new Date() });
  const res = await admin.POST(new Request('https://x/api/admin?action=login', { method: 'POST', body: JSON.stringify({ password: 'pw' }) }));
  token = ((await res.json()) as { token: string }).token;
});

describe('POST /api/leads', () => {
  it('guarda el lead con datos normalizados y puntaje calculado en el servidor', async () => {
    const res = await post(valid());
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; lead_score: number; lead_tier: string; course_name: string };
    expect(body.lead_score).toBe(100); // 40 inicio + 25 objetivo + 20 comportamiento + 15 contacto (email corporativo), no el 1 enviado por el cliente
    expect(body.lead_tier).toBe('HIGH_INTENT');
    expect(body.course_name).toBe(course.name);
    const stored = [...blobs.entries()].find(([k]) => k.startsWith('leads/'))!;
    const lead = JSON.parse(stored[1].body);
    expect(lead).toMatchObject({ first_name: 'Ana', email: 'ana@empresa.pe', utm_source: 'google', status: 'nuevo', institution_id: course.institution_id });
    expect(JSON.stringify(lead)).not.toContain('1.1.1.1'); // no se guarda la IP
  });

  it('rechaza datos inválidos y programas inexistentes', async () => {
    const bad = await post(valid({ input: { ...valid().input, email: 'no-es-email', consent: false } }), '2.2.2.2');
    expect(bad.status).toBe(422);
    const errors = ((await bad.json()) as { errors: string[] }).errors.join(' ');
    expect(errors).toContain('Email');
    expect(errors).toContain('autorización');
    expect((await post(valid({ course_id: 'crs-no-existe' }), '2.2.2.3')).status).toBe(422);
  });

  it('ignora bots que llenan el campo trampa', async () => {
    const before = [...blobs.keys()].filter((k) => k.startsWith('leads/')).length;
    expect((await post(valid({ website: 'http://spam' }), '3.3.3.3')).status).toBe(200);
    expect([...blobs.keys()].filter((k) => k.startsWith('leads/')).length).toBe(before);
  });

  it('limita envíos repetidos desde la misma IP', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 10; i++) codes.push((await post(valid(), '9.9.9.9')).status);
    expect(codes.slice(0, 8).every((c) => c === 201)).toBe(true);
    expect(codes.at(-1)).toBe(429);
  });
});

describe('Leads en el administrador', () => {
  it('requiere sesión', async () => {
    expect((await admin.GET(new Request('https://x/api/admin?action=leads'))).status).toBe(401);
  });

  it('lista, actualiza estado/notas y elimina', async () => {
    const list = (await (await admin.GET(authed('GET', 'leads'))).json()) as { leads: { pathname: string; created_at: string; status: string }[]; total: number };
    expect(list.total).toBeGreaterThan(1);
    expect(list.leads[0].created_at >= list.leads.at(-1)!.created_at).toBe(true); // más recientes primero
    const target = list.leads[0];
    const upd = (await (await admin.POST(authed('POST', 'lead', { pathname: target.pathname, status: 'contactado', notes: 'Llamado' }))).json()) as { lead: { status: string; notes: string } };
    expect(upd.lead).toMatchObject({ status: 'contactado', notes: 'Llamado' });
    expect((await admin.POST(authed('POST', 'lead', { pathname: target.pathname, status: 'hackeado' }))).status).toBe(200);
    expect(JSON.parse(blobs.get(target.pathname)!.body).status).toBe('contactado'); // estado inválido ignorado
    expect((await admin.POST(authed('POST', 'lead', { pathname: 'catalog/versions/x.json', status: 'nuevo' }))).status).toBe(404); // fuera de leads/
    expect((await admin.POST(authed('POST', 'lead-delete', { pathname: target.pathname }))).status).toBe(200);
    expect(blobs.has(target.pathname)).toBe(false);
  });
});
