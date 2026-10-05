/** Ciclo completo de reseñas con Vercel Blob simulado en memoria. */
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

const api = await import('../../reviews');
const admin = await import('../../admin');
const [c1, c2] = courses.filter((c) => c.institution_id === courses[0].institution_id);
const other = courses.find((c) => c.institution_id !== c1.institution_id)!;
let n = 0;
const body = (over: Record<string, unknown> = {}) => ({
  course_id: c1.id, rating: 5, title: 'Excelente', comment: 'Contenido práctico, docentes con experiencia y buen soporte.',
  author_name: 'Ana Torres', author_email: `user${n++}@mail.com`, relationship: 'egresado', consent: true, website: '', ...over
});
const post = (b: unknown, ip = `10.0.0.${n}`) => api.POST(new Request('https://x/api/reviews', { method: 'POST', headers: { 'x-forwarded-for': ip }, body: JSON.stringify(b) }));
const getJson = async (qs: string) => (await api.GET(new Request(`https://x/api/reviews?${qs}`))).json() as Promise<Record<string, unknown>>;
let token = '';
const authed = (method: string, action: string, b?: unknown) => new Request(`https://x/api/admin?action=${action}`, { method, headers: { authorization: `Bearer ${token}` }, body: b ? JSON.stringify(b) : undefined });
type Stored = { pathname: string; course_id: string; status: string; rating: number; author_email: string };
const all = async () => ((await (await admin.GET(authed('GET', 'reviews'))).json()) as { reviews: Stored[] }).reviews;

beforeAll(async () => {
  process.env.ADMIN_PASSWORD = 'pw';
  process.env.ADMIN_SESSION_SECRET = 's';
  process.env.BLOB_READ_WRITE_TOKEN = 'fake';
  blobs.set('catalog/versions/2026-10-05T00-00-00-000Z__init.json', { body: JSON.stringify({ courses, institutions, categories }), uploadedAt: new Date() });
  token = ((await (await admin.POST(new Request('https://x/api/admin?action=login', { method: 'POST', body: JSON.stringify({ password: 'pw' }) }))).json()) as { token: string }).token;
});

describe('reseñas', () => {
  it('una reseña nueva queda pendiente y no se publica', async () => {
    expect((await post(body())).status).toBe(201);
    expect(await getJson(`course=${c1.id}`)).toEqual({ reviews: [] });
    const [r] = await all();
    expect(r).toMatchObject({ status: 'pendiente', rating: 5, course_id: c1.id });
    expect(JSON.stringify(await getJson('summary=1'))).not.toContain(c1.id);
  });

  it('rechaza datos inválidos, programas inexistentes y duplicados por email', async () => {
    expect((await post(body({ rating: 7, comment: 'corto' }))).status).toBe(422);
    expect((await post(body({ course_id: 'crs-9999' }))).status).toBe(422);
    const dup = body({ author_email: 'repetido@mail.com' });
    expect((await post(dup)).status).toBe(201);
    expect((await post({ ...dup, author_email: 'REPETIDO@mail.com ' })).status).toBe(409);
  });

  it('ignora bots (campo trampa) sin guardar', async () => {
    const before = (await all()).length;
    expect((await post(body({ website: 'spam' }))).status).toBe(201);
    expect((await all()).length).toBe(before);
  });

  it('aprobar publica la reseña (sin email) y actualiza promedios del programa y la institución', async () => {
    await post(body({ course_id: c1.id, rating: 3 }));
    await post(body({ course_id: c2.id, rating: 4 }));
    await post(body({ course_id: other.id, rating: 2 }));
    for (const r of (await all()).filter((x) => x.status === 'pendiente')) {
      expect((await admin.POST(authed('POST', 'review', { pathname: r.pathname, status: 'aprobada' }))).status).toBe(200);
    }
    const pub = (await getJson(`course=${c1.id}`)).reviews as { rating: number; author_name: string }[];
    expect(pub.map((r) => r.rating).sort()).toEqual([3, 5, 5]);
    expect(JSON.stringify(pub)).not.toContain('@mail.com');
    expect(pub[0].author_name).toBe('Ana T.');
    const summary = (await getJson('summary=1')) as { courses: Record<string, { avg: number; count: number }>; institutions: Record<string, { avg: number; count: number }> };
    expect(summary.courses[c1.id]).toMatchObject({ avg: 4.3, count: 3 });
    expect(summary.institutions[c1.institution_id]).toMatchObject({ avg: 4.3, count: 4 }); // (5+5+3+4)/4 = 4.25 → 4.3
    expect(summary.institutions[other.institution_id]).toMatchObject({ avg: 2, count: 1 });
  });

  it('rechazar o eliminar retira la reseña y recalcula', async () => {
    const target = (await all()).find((r) => r.course_id === c1.id && r.rating === 3)!;
    await admin.POST(authed('POST', 'review', { pathname: target.pathname, status: 'rechazada', rejection_reason: 'spam' }));
    let summary = (await getJson('summary=1')) as { courses: Record<string, { avg: number; count: number }> };
    expect(summary.courses[c1.id]).toMatchObject({ avg: 5, count: 2 });
    const otherReview = (await all()).find((r) => r.course_id === other.id)!;
    expect((await admin.POST(authed('POST', 'review-delete', { pathname: otherReview.pathname }))).status).toBe(200);
    summary = (await getJson('summary=1')) as { courses: Record<string, { avg: number; count: number }> };
    expect(summary.courses[other.id]).toBeUndefined();
  });

  it('la moderación requiere sesión y rutas válidas', async () => {
    expect((await admin.GET(new Request('https://x/api/admin?action=reviews'))).status).toBe(401);
    expect((await admin.POST(authed('POST', 'review', { pathname: 'leads/x.json', status: 'aprobada' }))).status).toBe(404);
  });
});
