/** Base de datos: migraciones, espejo de escrituras y sincronización completa, contra un PostgreSQL real (PGlite). */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import courses from '../../../src/data/courses.json';
import institutions from '../../../src/data/institutions.json';
import categories from '../../../src/data/categories.json';
import { connect, migrate } from '../../../scripts/migrate.mjs';
import type { Sql } from '../db';

const blobs = new Map<string, { body: string | Buffer; uploadedAt: Date }>();
vi.mock('@vercel/blob', () => ({
  list: async ({ prefix }: { prefix: string }) => ({
    blobs: [...blobs.entries()].filter(([k]) => k.startsWith(prefix)).map(([pathname, v]) => ({ pathname, uploadedAt: v.uploadedAt, size: v.body.length })),
    hasMore: false
  }),
  put: async (pathname: string, body: string | Buffer) => { blobs.set(pathname, { body, uploadedAt: new Date() }); return { pathname }; },
  get: async (pathname: string) => { const b = blobs.get(pathname); return b ? { statusCode: 200, stream: new Response(typeof b.body === 'string' ? b.body : new Uint8Array(b.body)).body } : null; },
  del: async (p: string | string[]) => [p].flat().forEach((x) => blobs.delete(x))
}));

const PORT = 55433;
let pg: PGlite;
let server: PGLiteSocketServer;
let sql: Sql;
let admin: typeof import('../../admin');
let token = '';
const authed = (method: string, action: string, b?: unknown) => new Request(`https://x/api/admin?action=${action}`, { method, headers: { authorization: `Bearer ${token}` }, body: b ? JSON.stringify(b) : undefined });
const catalog = { courses, institutions, categories };

beforeAll(async () => {
  pg = await PGlite.create();
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: '127.0.0.1' });
  await server.start();
  sql = connect(`postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`) as unknown as Sql;
  Object.assign(process.env, { ADMIN_PASSWORD: 'pw', ADMIN_SESSION_SECRET: 's', BLOB_READ_WRITE_TOKEN: 'fake', POSTGRES_URL: `postgres://postgres:postgres@127.0.0.1:${PORT}/postgres` });
  const db = await import('../db');
  db.setSqlForTests(sql);
  admin = await import('../../admin');
  token = ((await (await admin.POST(new Request('https://x/api/admin?action=login', { method: 'POST', body: JSON.stringify({ password: 'pw' }) }))).json()) as { token: string }).token;
});

afterAll(async () => {
  await sql?.end({ timeout: 1 });
  await server?.stop();
  await pg?.close();
  delete process.env.POSTGRES_URL;
});

describe('base de datos', () => {
  it('aplica las migraciones una sola vez, con RLS en todas las tablas', async () => {
    const first = await migrate(sql, { log: () => {} });
    expect(first.pending).toEqual([]);
    expect(first.applied).toContain('001_init.sql');
    const again = await migrate(sql, { log: () => {} });
    expect(again.applied).toEqual(['001_init.sql']);
    const noRls = await sql`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`;
    expect(noRls.map((r) => r.relname)).toEqual([]);
  });

  it('guardar el catálogo en /admin lo replica en la base y registra el historial de cambios', async () => {
    const save = async (cat: unknown, baseVersion: string | null, note: string) => {
      const res = await admin.PUT(authed('PUT', 'catalog', { catalog: cat, baseVersion, note }));
      expect(res.status).toBe(200);
      return ((await res.json()) as { version: { pathname: string } }).version.pathname;
    };
    const v1 = await save(catalog, null, 'inicial');
    const [counts] = await sql`select (select count(*) from courses)::int c, (select count(*) from institutions)::int i, (select count(*) from categories)::int k, (select count(*) from catalog_changes)::int ch`;
    expect(counts).toEqual({ c: courses.length, i: institutions.length, k: categories.length, ch: 0 });
    const [c1] = await sql`select name, tools, teachers, price, raw->>'slug' as slug from courses where id = ${courses[0].id}`;
    expect(c1.name).toBe(courses[0].name);
    expect(c1.tools).toEqual(courses[0].tools);
    expect(c1.slug).toBe(courses[0].slug);

    // Edición: cambia un precio y elimina un programa → 2 cambios en el historial.
    const edited = structuredClone(catalog) as typeof catalog;
    edited.courses[0].price = (courses[0].price ?? 0) + 100; // sube el precio (sigue siendo mayor que el promocional)
    const removed = edited.courses.pop()!;
    await save(edited, v1, 'precio');
    const changes = await sql`select entity_id, action from catalog_changes order by id`;
    expect(changes).toEqual(expect.arrayContaining([{ entity_id: courses[0].id, action: 'update' }, { entity_id: removed.id, action: 'delete' }]));
    expect(changes).toHaveLength(2);
    const [cur] = await sql`select count(*)::int n from catalog_versions where is_current`;
    expect(cur.n).toBe(1);
  });

  it('leads, reseñas y diagnósticos nuevos se guardan también en la base', async () => {
    const leadsApi = await import('../../leads');
    const reviewsApi = await import('../../reviews');
    const c = courses[1];
    const leadRes = await leadsApi.POST(new Request('https://x/api/leads', { method: 'POST', headers: { 'x-forwarded-for': '1.1.1.1' }, body: JSON.stringify({
      course_id: c.id, input: { first_name: 'Ana', last_name: 'Torres', email: 'ana@empresa.com', whatsapp: '+51 999 888 777', country: 'Perú', start_timeline: 'inmediato', objective: 'cambiar-trabajo', consent: true },
      signals: { source: 'detalle', compared_programs: 2, viewed_programs: 4 }
    }) }));
    expect(leadRes.status).toBe(201);
    const [lead] = await sql`select first_name, course_id, lead_score, blob_path from leads`;
    expect(lead).toMatchObject({ first_name: 'Ana', course_id: c.id });
    expect(lead.blob_path).toMatch(/^leads\//);

    const revRes = await reviewsApi.POST(new Request('https://x/api/reviews', { method: 'POST', headers: { 'x-forwarded-for': '2.2.2.2' }, body: JSON.stringify({
      course_id: c.id, rating: 4, title: 'Bueno', comment: 'Buen contenido práctico y docentes con experiencia real.', author_name: 'Luis Pérez', author_email: 'luis@mail.com', relationship: 'egresado', consent: true, website: ''
    }) }));
    expect(revRes.status).toBe(201);
    const [rev] = await sql`select id, status, rating, blob_path from reviews`;
    expect(rev).toMatchObject({ status: 'pendiente', rating: 4 });

    // Moderación en /admin → la vista de valoraciones solo cuenta las aprobadas.
    expect((await sql`select * from course_ratings`)).toHaveLength(0);
    await admin.POST(authed('POST', 'review', { pathname: rev.blob_path, status: 'aprobada' }));
    const [rating] = await sql`select avg_rating::float as avg, reviews_count from course_ratings where course_id = ${c.id}`;
    expect(rating).toEqual({ avg: 4, reviews_count: 1 });

    // Lead: cambio de estado y borrado.
    await admin.POST(authed('POST', 'lead', { pathname: lead.blob_path, status: 'contactado', notes: 'Llamar' }));
    expect((await sql`select status, notes from leads`)[0]).toEqual({ status: 'contactado', notes: 'Llamar' });
    await admin.POST(authed('POST', 'lead-delete', { pathname: lead.blob_path }));
    expect((await sql`select count(*)::int n from leads`)[0].n).toBe(0);
  });

  it('diagnóstico de Mi ruta: perfil, estudios, experiencia, puntajes y ruta en tablas', async () => {
    const profileApi = await import('../../profile');
    const fd = new FormData();
    fd.set('description', 'Me llamo Jorge Ramírez. Trabajo como analista de datos en Retail SAC desde 2020, manejo Excel, Power BI y SQL. Bachiller en Economía en la Universidad de Lima (2019). Lidero un equipo de 2 personas.');
    fd.set('objective', 'Quiero convertirme en científico de datos y aprender machine learning con Python');
    fd.set('consent', 'true');
    fd.set('contact_ok', 'true');
    const res = await profileApi.POST(new Request('https://x/api/profile', { method: 'POST', headers: { 'x-forwarded-for': '3.3.3.3' }, body: fd }));
    expect(res.status).toBe(201);
    const { profile } = (await res.json()) as { profile: { id: string } };
    const [p] = await sql`select first_name, current_position, years_experience, highest_degree, contact_ok, analysis->'route'->'stages' is not null as has_route from profiles where id = ${profile.id}`;
    expect(p).toMatchObject({ first_name: 'Jorge', contact_ok: true, has_route: true, highest_degree: 'bachiller' });
    expect(p.current_position).toMatch(/analista de datos/i);
    const [n] = await sql`select (select count(*) from profile_education where profile_id = ${profile.id})::int edu,
      (select count(*) from profile_experience where profile_id = ${profile.id})::int exp,
      (select count(*) from profile_scores where profile_id = ${profile.id} and kind = 'area')::int areas,
      (select count(*) from profile_scores where profile_id = ${profile.id} and kind = 'blanda')::int soft,
      (select count(*) from profile_route_courses where profile_id = ${profile.id})::int route`;
    expect(n.edu).toBeGreaterThan(0);
    expect(n.areas).toBe(categories.length);
    expect(n.soft).toBe(10);
    expect(n.route).toBeGreaterThan(0);

    await admin.POST(authed('POST', 'profile', { id: profile.id, status: 'contactado' }));
    expect((await sql`select status from profiles where id = ${profile.id}`)[0].status).toBe('contactado');
    await admin.POST(authed('POST', 'profile-delete', { id: profile.id }));
    expect((await sql`select count(*)::int n from profile_scores`)[0].n).toBe(0); // cascada
  });

  it('sincronización completa desde Blob: idempotente y reconcilia borrados', async () => {
    await sql`insert into leads (id, created_at, course_name, first_name, last_name, email, raw) values ('lead_huerfano', now(), 'x', 'x', 'x', 'x@x.com', '{}')`;
    const sync = async () => {
      const res = await admin.POST(authed('POST', 'db-sync'));
      expect(res.status).toBe(200);
      return ((await res.json()) as { stats: { leads: number; reviews: number; profiles: number; removed: { leads: number }; catalog: { courses: number } } }).stats;
    };
    const s1 = await sync();
    expect(s1.catalog.courses).toBe(courses.length - 1);
    expect(s1.removed.leads).toBe(1);
    const s2 = await sync();
    expect(s2.removed).toEqual({ leads: 0, reviews: 0, profiles: 0 });

    const status = (await (await admin.GET(authed('GET', 'db-status'))).json()) as { connected: boolean; counts: Record<string, number>; last_sync: { error: string | null } };
    expect(status.connected).toBe(true);
    expect(status.counts.courses).toBe(courses.length - 1);
    expect(status.counts.reviews).toBe(1);
    expect(status.last_sync.error).toBeNull();

    const health = await (await import('../../health')).GET();
    expect(await health.json()).toEqual({ ok: true, blob: true, db: 'connected', migrations: ['001_init.sql'], initial_sync: 'done' });
  });
});
