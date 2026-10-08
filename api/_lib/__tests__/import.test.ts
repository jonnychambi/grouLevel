/** Alta de programas desde links: cola, detección de institución, extracción (IA simulada), revisión y publicación. */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startTestDb } from './testDb';

const aiCalls: { system: string; messages: { content: string }[]; output_config: { format: { schema: { properties: { category: { enum: string[] } } } } } }[] = [];
let aiOut: Record<string, unknown> = {};
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = {
      create: async (params: (typeof aiCalls)[number]) => {
        aiCalls.push(params);
        return { stop_reason: 'end_turn', usage: { input_tokens: 2500, output_tokens: 600 }, content: [{ type: 'text', text: JSON.stringify(aiOut) }] };
      }
    };
  }
}));

const pages = new Map<string, string>();
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (!/^https:\/\/(www\.)?(nueva|cibertec)/.test(url) && !url.includes('educacioncontinua.cibertec')) return realFetch(input, init);
  const html = pages.get(url);
  return html === undefined ? new Response('no', { status: 403 }) : new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
}) as typeof fetch;

const db = await startTestDb({ seedCatalog: true });
afterAll(() => db.stop());
const sql = db.sql;
const admin = await import('../../admin');
const { getCurrentCatalog } = await import('../catalogRepo');
let token = '';
const call = async (method: string, action: string, b?: unknown) => {
  const res = await (method === 'GET' ? admin.GET : admin.POST)(new Request(`https://x/api/admin?action=${action}`, { method, headers: { authorization: `Bearer ${token}` }, body: b ? JSON.stringify(b) : undefined }));
  return { status: res.status, body: (await res.json()) as Record<string, any> };
};

const LONG = Array.from({ length: 30 }, (_, i) => `<p>Módulo ${i + 1}: contenido del programa con proyectos aplicados y casos reales.</p>`).join('');
const page = (title: string) => `<html><head><title>${title}</title></head><body><nav>menu</nav><h1>${title}</h1><p>Precio S/ 2,400 · Inicio 15 de marzo</p>${LONG}</body></html>`;
const fullAi = (over: Record<string, unknown> = {}) => ({
  found: true, name: 'Analítica de Datos con Python', institution_name: 'Cibertec', program_type: 'especializacion', published_type: 'Programa de especialización',
  category: 'data-analytics', short_description: 'Analiza datos con Python y toma mejores decisiones.', description: 'Programa práctico de análisis de datos.', target_audience: null,
  level: 'intermedio', modality: 'en-vivo', language: 'Español', price: 2400, discount_price: 2600, currency: 'PEN', duration_hours: 96, duration_weeks: 12, duration_text: '12 semanas',
  start_date: '2099-03-15', start_text: '15 de marzo', schedule: 'Mar y Jue 7 pm', certificate: { type: 'incluye', description: 'Certificado Cibertec' },
  objectives: ['Limpiar datos', 'Limpiar datos', 'Visualizar'], syllabus: [{ title: 'Python básico', hours: 12 }, { title: '', hours: null }], tools: ['Python', 'Pandas'], skills: [], requirements: [],
  installments: 3, installment_amount: 800, enrollment_open: true, ...over
});

beforeAll(async () => {
  Object.assign(process.env, { ADMIN_PASSWORD: 'pw', ADMIN_SESSION_SECRET: 's', ANTHROPIC_API_KEY: 'test' });
  token = ((await (await admin.POST(new Request('https://x/api/admin?action=login', { method: 'POST', body: JSON.stringify({ password: 'pw' }) }))).json()) as { token: string }).token;
});

describe('alta de programas desde links', () => {
  let existingUrl = '';
  it('encola links limpios, sin duplicados ni programas que ya están en el catálogo', async () => {
    const cat = (await getCurrentCatalog(sql))!;
    const cib = cat.data.courses.find((c) => String(c.url).includes('educacioncontinua.cibertec'))!;
    existingUrl = String(cib.url);
    const { status, body } = await call('POST', 'import-add', {
      links: `https://educacioncontinua.cibertec.edu.pe/programas/analitica-python/?utm_source=x#top\nhttps://educacioncontinua.cibertec.edu.pe/programas/analitica-python/\n${existingUrl}\nno-es-link\nhttps://nueva-academia.test/curso-sin-institucion`
    });
    expect(status).toBe(200);
    expect(body.added).toBe(2);
    expect(body.skipped.map((s: { reason: string }) => s.reason.slice(0, 18))).toEqual(['Ya está en el catá', 'No es un link váli']);
    const rows = await sql`select url, institution_id, status from program_drafts order by id`;
    expect(rows[0]).toEqual({ url: 'https://educacioncontinua.cibertec.edu.pe/programas/analitica-python/', institution_id: cib.institution_id, status: 'en_cola' });
    expect(rows[1].institution_id).toBeNull();
    // Volver a pegar el mismo link no lo duplica.
    expect((await call('POST', 'import-add', { links: ['https://educacioncontinua.cibertec.edu.pe/programas/analitica-python'] })).body.added).toBe(0);
  });

  it('procesa la cola: lee la página, la IA arma el borrador y se marcan los datos faltantes', async () => {
    pages.set('https://educacioncontinua.cibertec.edu.pe/programas/analitica-python/', page('Analítica de Datos con Python'));
    aiOut = fullAi();
    const { body } = await call('POST', 'import-process');
    expect(body).toMatchObject({ processed: 2, ready: 1, errors: 1, remaining: 0 });
    expect(aiCalls).toHaveLength(1);
    expect(aiCalls[0].messages[0].content).toContain('Módulo 30');
    expect(aiCalls[0].messages[0].content).not.toContain('menu');
    expect(aiCalls[0].output_config.format.schema.properties.category.enum).toContain('data-analytics');
    const list = (await call('GET', 'import')).body;
    const ready = list.drafts.find((d: { status: string }) => d.status === 'listo');
    expect(ready.data).toMatchObject({ name: 'Analítica de Datos con Python', price: 2400, discount_price: null, objectives: ['Limpiar datos', 'Visualizar'], syllabus: [{ title: 'Python básico', hours: 12 }] });
    expect(ready.missing).toEqual([]);
    const failed = list.drafts.find((d: { status: string }) => d.status === 'error');
    expect(failed.error).toContain('403');
  });

  it('el administrador corrige el borrador y lo publica como programa nuevo', async () => {
    const draft = (await call('GET', 'import')).body.drafts.find((d: { status: string }) => d.status === 'listo');
    const upd = await call('POST', 'import-update', { id: draft.id, data: { price: 2200, status: 'oculto', id: 'hack' } });
    expect(upd.body.draft.data.price).toBe(2200);
    expect(upd.body.draft.data.id).toBeUndefined();
    const before = (await getCurrentCatalog(sql))!.data.courses.length;
    const pub = await call('POST', 'import-publish', { ids: [draft.id] });
    expect(pub.status).toBe(200);
    expect(pub.body.published).toBe(1);
    const cat = (await getCurrentCatalog(sql))!;
    expect(cat.data.courses.length).toBe(before + 1);
    const created = cat.data.courses.at(-1)!;
    expect(created).toMatchObject({ name: 'Analítica de Datos con Python', slug: 'analitica-de-datos-con-python', status: 'publicado', price: 2200, category: 'data-analytics', features: { enrollment_open: true }, financing: { installments: 3 } });
    expect(String(created.id)).toMatch(/^crs-\d{4}$/);
    expect((await sql`select count(*)::int n from courses where id = ${String(created.id)}`)[0].n).toBe(1);
    expect((await sql`select status, course_id from program_drafts where id = ${draft.id}`)[0]).toEqual({ status: 'publicado', course_id: created.id });
    // Ahora el link ya está en el catálogo.
    expect((await call('POST', 'import-add', { links: [String(created.url)] })).body.skipped[0].reason).toContain('Ya está en el catálogo');
  });

  it('sin institución no se publica; se elige, se reintenta y se descarta', async () => {
    const failed = (await call('GET', 'import')).body.drafts.find((d: { status: string }) => d.status === 'error');
    pages.set(failed.url, page('Curso de IA'));
    aiOut = fullAi({ name: 'Analítica de Datos con Python', price: null, discount_price: null, modality: null, syllabus: [], certificate: null });
    expect((await call('POST', 'import-retry', { id: failed.id })).status).toBe(200);
    await call('POST', 'import-process', { ids: [failed.id] });
    const ready = (await call('GET', 'import')).body.drafts.find((d: { id: number }) => d.id === failed.id);
    expect(ready.missing).toEqual(['Precio', 'Modalidad', 'Temario', 'Certificado']);
    const noInst = await call('POST', 'import-publish', { ids: [failed.id] });
    expect(noInst.status).toBe(422);
    expect(noInst.body.errors[0]).toContain('institución');
    const inst = (await getCurrentCatalog(sql))!.data.institutions[0].id;
    await call('POST', 'import-update', { id: failed.id, institution_id: inst });
    const pub = await call('POST', 'import-publish', { ids: [failed.id], status: 'borrador' });
    expect(pub.status).toBe(200);
    const created = (await getCurrentCatalog(sql))!.data.courses.at(-1)!;
    expect(created.status).toBe('borrador');
    expect(created.slug).not.toBe('analitica-de-datos-con-python'); // slug único
    const summary = (await call('GET', 'summary')).body;
    expect(summary).toMatchObject({ drafts_ready: 0, drafts_queue: 0 });
  });
});
