/** Flujo completo del API de administración del catálogo sobre PostgreSQL (PGlite). */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startTestDb } from './testDb';
import courses from '../../../src/data/courses.json';
import institutions from '../../../src/data/institutions.json';
import categories from '../../../src/data/categories.json';


const db = await startTestDb();
afterAll(() => db.stop());
const admin = await import('../../admin');
const pub = await import('../../catalog');
const catalog = () => JSON.parse(JSON.stringify({ courses, institutions, categories }));
const url = (action: string) => `https://x/api/admin?action=${action}`;
let token = '';
const authed = (method: string, action: string, body?: unknown) =>
  new Request(url(action), { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });

beforeAll(() => {
  process.env.ADMIN_PASSWORD = 'pw-test';
  process.env.ADMIN_SESSION_SECRET = 'secret-test';
});
beforeEach(() => vi.useRealTimers());

describe('API de administración', () => {
  it('login rechaza contraseña incorrecta y acepta la correcta', async () => {
    const bad = await admin.POST(new Request(url('login'), { method: 'POST', body: JSON.stringify({ password: 'x' }) }));
    expect(bad.status).toBe(401);
    const ok = await admin.POST(new Request(url('login'), { method: 'POST', body: JSON.stringify({ password: 'pw-test' }) }));
    expect(ok.status).toBe(200);
    token = ((await ok.json()) as { token: string }).token;
    expect(token).toContain('.');
  });

  it('sin token no permite leer ni escribir', async () => {
    expect((await admin.GET(new Request(url('catalog')))).status).toBe(401);
    expect((await admin.PUT(new Request(url('catalog'), { method: 'PUT', body: '{}' }))).status).toBe(401);
  });

  it('catálogo vacío → el sitio público recibe 404 (usa el JSON del build)', async () => {
    expect((await pub.GET()).status).toBe(404);
    const res = await admin.GET(authed('GET', 'catalog'));
    expect(await res.json()).toEqual({ catalog: null, version: null });
  });

  let v1 = '';
  it('inicializa, publica y oculta programas en la API pública', async () => {
    const c = catalog();
    c.courses[0].status = 'oculto';
    const res = await admin.PUT(authed('PUT', 'catalog', { catalog: c, baseVersion: null, note: 'inicializacion' }));
    expect(res.status).toBe(200);
    v1 = ((await res.json()) as { version: { pathname: string } }).version.pathname;
    const pubRes = await pub.GET();
    const data = (await pubRes.json()) as { courses: { id: string }[] };
    expect(pubRes.status).toBe(200);
    expect(data.courses).toHaveLength(courses.length - 1);
    expect(data.courses.some((x) => x.id === c.courses[0].id)).toBe(false);
  });

  it('rechaza datos inválidos (422) y conflictos de versión (409)', async () => {
    const bad = catalog();
    bad.courses[0].slug = 'Slug Inválido';
    expect((await admin.PUT(authed('PUT', 'catalog', { catalog: bad, baseVersion: v1 }))).status).toBe(422);
    expect((await admin.PUT(authed('PUT', 'catalog', { catalog: catalog(), baseVersion: 'otra-version' }))).status).toBe(409);
  });

  it('guarda una edición, lista versiones y restaura la anterior', async () => {
    await new Promise((r) => setTimeout(r, 5)); // timestamps distintos
    const c = catalog();
    c.courses[1].name = 'Nombre editado';
    const res = await admin.PUT(authed('PUT', 'catalog', { catalog: c, baseVersion: v1, note: 'edita nombre' }));
    expect(res.status).toBe(200);
    const versions = ((await (await admin.GET(authed('GET', 'versions'))).json()) as { versions: { pathname: string; note: string }[] }).versions;
    expect(versions).toHaveLength(2);
    expect(versions[0].note).toBe('edita nombre');
    await new Promise((r) => setTimeout(r, 5));
    expect((await admin.POST(authed('POST', 'restore', { pathname: v1 }))).status).toBe(200);
    const latest = (await (await admin.GET(authed('GET', 'catalog'))).json()) as { catalog: { courses: { name: string }[] } };
    expect(latest.catalog.courses[1].name).toBe(courses[1].name);
  });
});
