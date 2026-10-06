/**
 * GET /api/health — estado de los servicios (sin datos sensibles).
 * { ok, db: 'connected' | 'not_configured' | 'error', blob: bool, migrations: string[] }
 */
import { json } from './_lib/http.js';
import { isStoreConfigured } from './_lib/store.js';
import { getSql, isDbConfigured } from './_lib/db.js';

export async function GET(): Promise<Response> {
  let db: 'connected' | 'not_configured' | 'error' = 'not_configured';
  let migrations: string[] = [];
  if (isDbConfigured()) {
    try {
      migrations = (await getSql()`select version from schema_migrations order by version`).map((r) => r.version as string);
      db = 'connected';
    } catch (err) {
      console.error('health_db_error', err instanceof Error ? err.message : err);
      db = 'error';
    }
  }
  return json(db === 'connected' ? 200 : 503, { ok: db === 'connected', db, blob: isStoreConfigured(), migrations });
}
