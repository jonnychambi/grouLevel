/** MBA como tipo propio: la migración 012 reclasifica los MBA ya publicados (tablas y versión vigente). */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { startTestDb } from './testDb';

const db = await startTestDb({ seedCatalog: true });
afterAll(() => db.stop());
const sql = db.sql;
const { getCurrentCatalog, publishCatalog } = await import('../catalogRepo');
const { validateCatalog } = await import('../validate');

describe('migración 012: MBA', () => {
  it('pasa a "mba" solo los MBA y deja las demás maestrías', async () => {
    const cur = (await getCurrentCatalog(sql))!;
    const [a, b, c, d] = cur.data.courses;
    const renamed = cur.data.courses.map((x) =>
      x.id === a.id ? { ...x, name: 'MBA Ejecutivo', program_type: 'programa-ejecutivo' }
      : x.id === b.id ? { ...x, name: 'Maestría en Administración de Empresas', program_type: 'maestria' }
      : x.id === c.id ? { ...x, name: 'Maestría en Data Science', program_type: 'maestria' }
      : x.id === d.id ? { ...x, name: 'Curso de finanzas para tu MBA', program_type: 'curso' } : x);
    await publishCatalog({ ...cur.data, courses: renamed }, 'prueba', cur.version.pathname, {}, sql);

    await sql.unsafe(readFileSync(join(process.cwd(), 'db/migrations/012_program_type_mba.sql'), 'utf8'));

    const after = (await getCurrentCatalog(sql))!;
    const type = (id: unknown) => after.data.courses.find((x) => x.id === id)!.program_type;
    expect([type(a.id), type(b.id), type(c.id), type(d.id)]).toEqual(['mba', 'mba', 'maestria', 'curso']);
    expect(after.data.courses.length).toBe(renamed.length);
    const rows = await sql`select id, program_type, raw->>'program_type' raw_type from courses where id = any(${[a.id, b.id, c.id].map(String)}) order by id`;
    expect(rows.every((r) => r.program_type === r.raw_type)).toBe(true);
    expect(rows.filter((r) => r.program_type === 'mba').length).toBe(2);
    expect(validateCatalog(after.data).ok).toBe(true);
  });
});
