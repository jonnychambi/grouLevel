/** Base de datos como fuente principal: migraciones, catálogo versionado, historial, importación desde Blob y estado. */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import courses from '../../../src/data/courses.json';
import categories from '../../../src/data/categories.json';
import { migrate } from '../../../scripts/migrate.mjs';
import { bundledCatalog, startTestDb } from './testDb';

// Vercel Blob simulado: solo contiene datos "antiguos" (antes de Supabase).
const blobs = new Map<string, { body: string; uploadedAt: Date }>();
vi.mock('@vercel/blob', () => ({
  list: async ({ prefix }: { prefix: string }) => ({
    blobs: [...blobs.entries()].filter(([k]) => k.startsWith(prefix)).map(([pathname, v]) => ({ pathname, uploadedAt: v.uploadedAt, size: v.body.length })),
    hasMore: false
  }),
  put: async () => ({}),
  get: async (pathname: string) => { const b = blobs.get(pathname); return b ? { statusCode: 200, stream: new Response(b.body).body } : null; },
  del: async () => undefined
}));

const db = await startTestDb();
afterAll(() => db.stop());
const sql = db.sql;
const admin = await import('../../admin');
let token = '';
const authed = (method: string, action: string, b?: unknown) => new Request(`https://x/api/admin?action=${action}`, { method, headers: { authorization: `Bearer ${token}` }, body: b ? JSON.stringify(b) : undefined });
const save = async (cat: unknown, baseVersion: string | null, note: string) => {
  const res = await admin.PUT(authed('PUT', 'catalog', { catalog: cat, baseVersion, note }));
  expect(res.status).toBe(200);
  return ((await res.json()) as { version: { pathname: string } }).version.pathname;
};

beforeAll(async () => {
  Object.assign(process.env, { ADMIN_PASSWORD: 'pw', ADMIN_SESSION_SECRET: 's', BLOB_READ_WRITE_TOKEN: 'fake' });
  token = ((await (await admin.POST(new Request('https://x/api/admin?action=login', { method: 'POST', body: JSON.stringify({ password: 'pw' }) }))).json()) as { token: string }).token;
});

describe('base de datos', () => {
  it('aplica las migraciones una sola vez, con RLS en todas las tablas', async () => {
    const again = await migrate(sql, { log: () => {} });
    expect(again.pending).toEqual([]);
    expect(again.applied).toEqual(['001_init.sql', '002_supabase_primary.sql', '003_profile_diagnosis.sql', '004_program_refresh.sql', '005_program_import.sql', '006_demand.sql', '007_reviews_v2.sql']);
    const noRls = await sql`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`;
    expect(noRls.map((r) => r.relname)).toEqual([]);
  });

  let v1 = '';
  it('publicar el catálogo llena las tablas y guarda la versión completa', async () => {
    v1 = await save(bundledCatalog(), null, 'inicial');
    const [counts] = await sql`select (select count(*) from courses)::int c, (select count(*) from categories)::int k, (select count(*) from catalog_changes)::int ch,
      (select count(*) from catalog_versions where is_current and data is not null)::int cur`;
    expect(counts).toEqual({ c: courses.length, k: categories.length, ch: 0, cur: 1 });
    const [c1] = await sql`select name, tools, position from courses where id = ${courses[3].id}`;
    expect(c1).toEqual({ name: courses[3].name, tools: courses[3].tools, position: 3 });
  });

  it('registra el historial de cambios, incluidos campos anidados (temario)', async () => {
    const edited = bundledCatalog();
    edited.courses[0].syllabus = [{ title: 'Módulo nuevo', hours: 4, description: '', topics: ['x'] }];
    const removed = edited.courses.pop();
    const v2 = await save(edited, v1, 'temario');
    const changes = await sql`select entity_id, action, version from catalog_changes order by id`;
    expect(changes).toEqual([
      { entity_id: courses[0].id, action: 'update', version: v2 },
      { entity_id: removed.id, action: 'delete', version: v2 }
    ]);
    // El catálogo vigente se lee de la base con el orden original.
    const res = (await (await admin.GET(authed('GET', 'catalog'))).json()) as { catalog: { courses: { id: string }[] }; version: { pathname: string } };
    expect(res.version.pathname).toBe(v2);
    expect(res.catalog.courses.map((c) => c.id)).toEqual(edited.courses.map((c: { id: string }) => c.id));
    // Otra sesión con la versión anterior → conflicto.
    expect((await admin.PUT(authed('PUT', 'catalog', { catalog: bundledCatalog(), baseVersion: v1 }))).status).toBe(409);
  });

  it('importa datos antiguos de Blob sin pisar ni borrar lo que ya está en la base', async () => {
    const now = new Date().toISOString();
    const lead = (id: string, status: string) => ({ id, created_at: now, course_id: courses[0].id, course_name: 'x', institution_id: courses[0].institution_id, institution_name: 'x', first_name: 'Ana', last_name: 'T', email: `${id}@x.com`, whatsapp: '999888777', country: 'Perú', start_timeline: 'inmediato', objective: 'cambiar-trabajo', consent: true, page_url: '', source: 'detalle', campaign: null, utm_source: null, utm_medium: null, utm_campaign: null, utm_term: null, utm_content: null, referrer: null, lead_score: 80, lead_tier: 'HIGH_INTENT', lead_segment: 'hot', status, notes: '' });
    // En la base ya existe lead_existente (contactado); en Blob figura como "nuevo" (dato viejo).
    await sql`insert into leads (id, created_at, course_name, first_name, last_name, email, status, raw) values ('lead_existente', now(), 'x', 'Ana', 'T', 'a@x.com', 'contactado', ${sql.json(lead('lead_existente', 'contactado'))})`;
    await sql`insert into leads (id, created_at, course_name, first_name, last_name, email, raw) values ('lead_solo_en_base', now(), 'x', 'B', 'C', 'b@x.com', '{}')`;
    blobs.set('leads/2026-10/a_lead_existente.json', { body: JSON.stringify(lead('lead_existente', 'nuevo')), uploadedAt: new Date() });
    blobs.set('leads/2026-10/b_lead_antiguo.json', { body: JSON.stringify(lead('lead_antiguo', 'nuevo')), uploadedAt: new Date() });
    blobs.set('reviews/crs-0001/x_rev_antigua.json', { body: JSON.stringify({ id: 'rev_antigua1', course_id: courses[0].id, course_name: 'x', institution_id: courses[0].institution_id, institution_name: 'x', rating: 4, title: 't', comment: 'Comentario suficientemente largo para la prueba.', author_name: 'Ana T.', author_email: 'ana@x.com', relationship: 'egresado', created_at: now, status: 'aprobada', rejection_reason: null, moderated_at: now, reply: null, page_url: '' }), uploadedAt: new Date() });
    blobs.set('catalog/versions/2026-09-01T00-00-00-000Z__excel.json', { body: JSON.stringify(bundledCatalog()), uploadedAt: new Date('2026-09-01') });

    const res = await admin.POST(authed('POST', 'db-import'));
    expect(res.status).toBe(200);
    const { stats } = (await res.json()) as { stats: { leads: number; reviews: number; versions: number; skipped: { leads: number } } };
    expect(stats).toMatchObject({ leads: 1, reviews: 1, versions: 1, skipped: { leads: 1 } });
    expect((await sql`select status from leads where id = 'lead_existente'`)[0].status).toBe('contactado'); // no se pisó
    expect((await sql`select count(*)::int n from leads where id = 'lead_solo_en_base'`)[0].n).toBe(1); // no se borró
    expect((await sql`select avg_rating::float avg from course_ratings where course_id = ${courses[0].id}`)[0].avg).toBe(4);

    // Repetir la importación no duplica nada.
    const again = (await (await admin.POST(authed('POST', 'db-import'))).json()) as { stats: { leads: number; reviews: number } };
    expect(again.stats).toMatchObject({ leads: 0, reviews: 0 });
  });

  it('restaura una versión antigua guardada en Blob', async () => {
    const versions = ((await (await admin.GET(authed('GET', 'versions'))).json()) as { versions: { pathname: string }[] }).versions;
    expect(versions.map((v) => v.pathname)).toContain('catalog/versions/2026-09-01T00-00-00-000Z__excel.json');
    expect((await admin.POST(authed('POST', 'restore', { pathname: 'catalog/versions/2026-09-01T00-00-00-000Z__excel.json' }))).status).toBe(200);
    expect((await sql`select count(*)::int n from courses`)[0].n).toBe(courses.length);
    const [cur] = await sql`select note from catalog_versions where is_current`;
    expect(cur.note).toBe('restaurado');
  });

  it('estado de la base y health', async () => {
    const status = (await (await admin.GET(authed('GET', 'db-status'))).json()) as { connected: boolean; counts: Record<string, number>; last_sync: { error: string | null } };
    expect(status.connected).toBe(true);
    expect(status.counts.courses).toBe(courses.length);
    expect(status.last_sync.error).toBeNull();
    expect((await admin.GET(new Request('https://x/api/admin?action=db-status'))).status).toBe(401);
    const health = await (await import('../../health')).GET();
    expect(await health.json()).toEqual({ ok: true, db: 'connected', blob: true, migrations: ['001_init.sql', '002_supabase_primary.sql', '003_profile_diagnosis.sql', '004_program_refresh.sql', '005_program_import.sql', '006_demand.sql', '007_reviews_v2.sql'] });
  });
});
