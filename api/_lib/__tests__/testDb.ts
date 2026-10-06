/** PostgreSQL real (PGlite) para las pruebas del API: aplica las migraciones y conecta los repositorios. */
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import courses from '../../../src/data/courses.json';
import institutions from '../../../src/data/institutions.json';
import categories from '../../../src/data/categories.json';
import { connect, migrate } from '../../../scripts/migrate.mjs';
import type { Sql } from '../db';

export const bundledCatalog = () => JSON.parse(JSON.stringify({ courses, institutions, categories }));

export async function startTestDb(opts: { seedCatalog?: boolean } = {}) {
  const pg = await PGlite.create();
  let server: PGLiteSocketServer | null = null;
  let port = 0;
  for (let attempt = 0; attempt < 5 && !server; attempt++) {
    port = 40000 + Math.floor(Math.random() * 20000);
    const candidate = new PGLiteSocketServer({ db: pg, port, host: '127.0.0.1' });
    try {
      await candidate.start();
      server = candidate;
    } catch {
      /* puerto ocupado: probar otro */
    }
  }
  if (!server) throw new Error('No se pudo iniciar PGlite');
  const url = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`;
  const sql = connect(url) as unknown as Sql;
  await migrate(sql, { log: () => {} });
  process.env.POSTGRES_URL = url;
  (await import('../db')).setSqlForTests(sql);
  if (opts.seedCatalog) await (await import('../catalogRepo')).publishCatalog(bundledCatalog(), 'inicial', null, { force: true }, sql);
  return {
    sql,
    stop: async () => {
      (await import('../db')).setSqlForTests(null);
      await sql.end({ timeout: 1 });
      await server!.stop();
      await pg.close();
    }
  };
}
