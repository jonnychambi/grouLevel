/** Actualización automática de programas: lectura del link, huella, IA (simulada), propuestas y aplicación. */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startTestDb } from './testDb';

const aiCalls: { system: string; messages: { content: string }[]; model: string; thinking: unknown; output_config: unknown }[] = [];
let aiFacts: Record<string, unknown> = {};
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = {
      create: async (params: (typeof aiCalls)[number]) => {
        aiCalls.push(params);
        const facts = { found: true, price: null, discount_price: null, currency: null, start_date: null, start_text: null, duration_hours: null, duration_weeks: null, duration_text: null, modality: null, schedule: null, enrollment_open: null, installments: null, installment_amount: null, ...aiFacts };
        return { stop_reason: 'end_turn', usage: { input_tokens: 900, output_tokens: 120 }, content: [{ type: 'text', text: JSON.stringify(facts) }] };
      }
    };
  }
}));

const pages = new Map<string, string>();
const fetched: string[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (!/^https:\/\/inst\./.test(url)) return realFetch(input, init);
  fetched.push(url);
  const html = pages.get(url);
  return html === undefined ? new Response('no', { status: 404 }) : new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
}) as typeof fetch;

const page = (price: string, start: string) => `<html><head><title>Curso de Datos</title><script>var x = "S/ 9999";</script></head><body>
<nav>Inicio Cursos Precio</nav><h1>Curso de Datos</h1><p>Aprende con nosotros.</p>
<div class="precio">Precio regular: ${price}</div><div>Inicio: ${start}</div><div>Duración: 10 semanas (40 horas)</div>
<p>Modalidad online en vivo · Lunes y miércoles 7:00 p.m.</p><footer>S/ 1 Términos</footer></body></html>`;

const db = await startTestDb({ seedCatalog: true });
afterAll(() => db.stop());
const sql = db.sql;
const admin = await import('../../admin');
const refresh = await import('../programRefresh');
const { getCurrentCatalog } = await import('../catalogRepo');
let token = '';
const authed = (method: string, action: string, b?: unknown) => new Request(`https://x/api/admin?action=${action}`, { method, headers: { authorization: `Bearer ${token}` }, body: b ? JSON.stringify(b) : undefined });

type C = Record<string, unknown> & { id: string; url: string; status: string };
let target: C;
beforeAll(async () => {
  Object.assign(process.env, { ADMIN_PASSWORD: 'pw', ADMIN_SESSION_SECRET: 's' });
  token = ((await (await admin.POST(new Request('https://x/api/admin?action=login', { method: 'POST', body: JSON.stringify({ password: 'pw' }) }))).json()) as { token: string }).token;
  // Links simulados para todos los programas; solo el primero tiene página.
  const cat = (await getCurrentCatalog(sql))!;
  const courses = (cat.data.courses as C[]).map((c) => ({ ...c, url: `https://inst.test/${c.id}` }) as C);
  const { publishCatalog } = await import('../catalogRepo');
  await publishCatalog({ ...cat.data, courses }, 'links', null, { force: true }, sql);
  target = courses.find((c) => c.status === 'publicado' && !c.is_demo)!;
  target.price = 1500;
  target.start_date = '2099-01-10';
});
beforeEach(() => {
  aiCalls.length = 0;
  fetched.length = 0;
});

describe('texto relevante y huella', () => {
  it('se queda con precios, fechas y modalidad; descarta scripts, menú y pie', () => {
    const text = refresh.extractRelevantText(page('S/ 1 800', '15 de marzo'));
    expect(text).toContain('TÍTULO: Curso de Datos');
    expect(text).toContain('Precio regular: S/ 1 800');
    expect(text).toContain('Modalidad online en vivo');
    expect(text).not.toContain('9999');
    expect(text).not.toContain('Términos');
    expect(text.length).toBeLessThan(600);
    expect(refresh.contentHash(text)).toBe(refresh.contentHash(`${text}  `.replace('Curso', 'CURSO')));
  });

  it('compara sin borrar datos que la página no muestra', () => {
    const course = { price: 1500, discount_price: 1200, currency: 'PEN', start_date: '2099-01-10', start_text: '10 de enero', duration_text: '10 semanas', modality: 'en-vivo', financing: { installments: 3 }, features: { enrollment_open: true } };
    const facts = { found: true, price: 1800, discount_price: null, currency: 'PEN', start_date: '2099-03-15', start_text: '10 de Enero', duration_hours: null, duration_weeks: null, duration_text: '10 semanas', modality: 'en-vivo', schedule: null, enrollment_open: null, installments: 3, installment_amount: null } as const;
    expect(refresh.diffFacts(course, facts, '2099-01-01').map((c) => [c.field, c.current, c.proposed])).toEqual([['price', 1500, 1800], ['start_date', '2099-01-10', '2099-03-15']]);
    expect(refresh.diffFacts(course, { ...facts, start_date: '2020-01-01', price: 1500.2 }, '2099-01-01')).toEqual([]); // fecha pasada y diferencia de céntimos
    expect(refresh.diffFacts(course, { ...facts, found: false }, '2099-01-01')).toEqual([]);
  });
});

describe('revisión de programas', () => {
  it('sin cambios en la página no vuelve a llamar al modelo (0 fichas)', async () => {
    process.env.ANTHROPIC_API_KEY = 'test';
    aiFacts = { price: 1500, start_date: '2099-01-10' };
    pages.set(target.url, page('S/ 1500', '10 de enero de 2099'));
    const first = await refresh.checkCourse(target, { sql });
    expect(first).toMatchObject({ status: 'sin_cambios', ai_used: true });
    expect(aiCalls).toHaveLength(1);
    // Modelo pequeño, sin razonamiento extendido y con salida estructurada.
    expect(aiCalls[0]).toMatchObject({ model: 'claude-haiku-5-5', thinking: { type: 'disabled' }, output_config: { effort: 'low', format: { type: 'json_schema' } } });
    expect(aiCalls[0].messages[0].content).not.toContain('<nav>');
    const second = await refresh.checkCourse(target, { sql });
    expect(second).toMatchObject({ status: 'sin_cambios', ai_used: false, usage: { input_tokens: 0, output_tokens: 0 } });
    expect(aiCalls).toHaveLength(1);
  });

  it('si la página cambia deja una propuesta pendiente (no publica nada)', async () => {
    aiFacts = { price: 1800, start_date: '2099-03-15', start_text: '15 de marzo de 2099' };
    pages.set(target.url, page('S/ 1800', '15 de marzo de 2099'));
    const r = await refresh.checkCourse(target, { sql });
    expect(r.status).toBe('cambios');
    expect(r.changes.map((c) => c.field)).toEqual(['price', 'start_date', 'start_text']);
    const before = (await getCurrentCatalog(sql))!;
    expect((before.data.courses as C[]).find((c) => c.id === target.id)!.price).not.toBe(1800);
    const [row] = await sql`select status, method, input_tokens from program_updates where course_id = ${target.id}`;
    expect(row).toEqual({ status: 'pendiente', method: 'ia', input_tokens: 900 });
  });

  it('el administrador aplica solo los campos elegidos y se publica una versión nueva', async () => {
    const overview = (await (await admin.GET(authed('GET', 'refresh'))).json()) as Awaited<ReturnType<typeof refresh.refreshOverview>>;
    expect(overview.pending).toHaveLength(1);
    expect(overview.ai).toEqual({ configured: true, model: 'claude-haiku-5-5' });
    const id = overview.pending[0].id;
    const res = await admin.POST(authed('POST', 'refresh-apply', { id, fields: ['price'] }));
    expect(res.status).toBe(200);
    const cur = (await getCurrentCatalog(sql))!;
    const course = (cur.data.courses as C[]).find((c) => c.id === target.id)!;
    expect(course.price).toBe(1800);
    expect(course.start_date).not.toBe('2099-03-15');
    expect(course.updated_at).toBe(new Date().toISOString().slice(0, 10));
    expect(cur.version.note).toContain('actualizacion');
    expect((await sql`select price::float p from courses where id = ${target.id}`)[0].p).toBe(1800);
    expect((await admin.POST(authed('POST', 'refresh-apply', { id }))).status).toBe(409); // ya aplicada
  });

  it('revisión manual de un programa: siempre lee el link y consulta al modelo', async () => {
    aiFacts = { price: 1800, start_date: '2099-03-15', start_text: '15 de marzo de 2099' };
    const res = await admin.POST(authed('POST', 'refresh-check', { course_id: target.id }));
    const { result } = (await res.json()) as { result: { status: string; changes: { field: string }[] } };
    expect(aiCalls).toHaveLength(1);
    expect(result.status).toBe('cambios');
    expect(result.changes.map((c) => c.field)).toEqual(['start_date', 'start_text']);
    const pending = (await sql`select id from program_updates where status = 'pendiente'`)[0];
    expect((await admin.POST(authed('POST', 'refresh-discard', { id: pending.id }))).status).toBe(200);
    expect((await sql`select count(*)::int n from program_updates where status = 'pendiente'`)[0].n).toBe(0);
  });

  it('sin IA configurada avisa por huella que la página cambió', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    pages.set(target.url, page('S/ 2100', '1 de abril de 2099'));
    const r = await refresh.checkCourse(target, { sql });
    expect(r).toMatchObject({ status: 'cambios', ai_used: false });
    expect(aiCalls).toHaveLength(0);
    const [row] = await sql`select method, changes from program_updates where status = 'pendiente'`;
    expect(row).toEqual({ method: 'huella', changes: [] });
  });
});

describe('ejecución programada', () => {
  it('respeta la frecuencia, reparte el semanal y registra errores y consumo', async () => {
    const cron = await import('../../cron');
    expect((await cron.GET(new Request('https://x/api/cron'))).status).toBe(401);
    process.env.CRON_SECRET = 'cs';
    const call = () => cron.GET(new Request('https://x/api/cron', { headers: { authorization: 'Bearer cs' } }));

    expect((await admin.POST(authed('POST', 'refresh-settings', { frequency: 'desactivado' }))).status).toBe(200);
    expect(await (await call()).json()).toMatchObject({ skipped: 'desactivado', checked: 0 });

    await admin.POST(authed('POST', 'refresh-settings', { frequency: 'semanal', batch_size: 400 }));
    const total = (await sql`select count(*)::int n from courses where status = 'publicado' and not coalesce((raw->>'is_demo')::boolean, false)`)[0].n;
    const s1 = (await (await call()).json()) as { checked: number; errors: number; remaining: number };
    expect(s1.checked).toBe(Math.ceil(total / 7) + 5);
    expect(s1.errors).toBeGreaterThan(0); // páginas inexistentes (404) quedan como error
    // El programa ya revisado hace poco no se vuelve a revisar.
    expect(fetched).not.toContain(target.url);

    await admin.POST(authed('POST', 'refresh-settings', { frequency: 'diario' }));
    const s2 = (await (await call()).json()) as { checked: number; remaining: number };
    expect(s2.checked + s2.remaining).toBe(total - s1.checked - 1);
    const [err] = await sql`select last_status, http_status from program_checks where course_id <> ${target.id} limit 1`;
    expect(err).toEqual({ last_status: 'error', http_status: 404 });
    const overview = (await (await admin.GET(authed('GET', 'refresh'))).json()) as { runs: unknown[]; settings: { frequency: string }; usage_30d: { input_tokens: number; estimated_usd: number } };
    expect(overview.settings.frequency).toBe('diario');
    expect(overview.usage_30d.input_tokens).toBeGreaterThan(0);
    expect(overview.usage_30d.estimated_usd).toBeGreaterThan(0);
  });
});
