/**
 * GET /api/health — estado de los servicios (sin datos sensibles).
 * { ok, blob: bool, db: 'connected' | 'not_configured' | 'error', migrations: string[], initial_sync }
 * La primera vez que responde con la base conectada, copia los datos existentes de Blob (una sola vez).
 */
import { json } from './_lib/http.js';
import { isStoreConfigured } from './_lib/store.js';
import { getSql, isDbConfigured } from './_lib/db.js';
import { ensureInitialSync } from './_lib/dbSync.js';
import { blobSources } from './_lib/dbSources.js';

export async function GET(): Promise<Response> {
  let db: 'connected' | 'not_configured' | 'error' = 'not_configured';
  let migrations: string[] = [];
  let initial_sync: 'ran' | 'done' | 'skipped' | 'error' = 'skipped';
  if (isDbConfigured()) {
    try {
      migrations = (await getSql()`select version from schema_migrations order by version`).map((r) => r.version as string);
      db = 'connected';
      if (isStoreConfigured() && migrations.length) {
        try {
          initial_sync = await ensureInitialSync(getSql(), blobSources);
        } catch (err) {
          console.error('initial_sync_failed', err instanceof Error ? err.message : err);
          initial_sync = 'error';
        }
      }
    } catch (err) {
      console.error('health_db_error', err instanceof Error ? err.message : err);
      db = 'error';
    }
  }
  return json(db === 'error' ? 503 : 200, { ok: db !== 'error', blob: isStoreConfigured(), db, migrations, initial_sync });
}
