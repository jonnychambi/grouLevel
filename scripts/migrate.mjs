/**
 * Aplica las migraciones SQL de db/migrations a la base (Supabase/PostgreSQL).
 *
 *   node scripts/migrate.mjs            → aplica las pendientes
 *   node scripts/migrate.mjs --status   → solo informa
 *
 * Usa POSTGRES_URL_NON_POOLING (o POSTGRES_URL). En Vercel corre en el build de producción
 * (VERCEL_ENV=production) o si MIGRATE=1; sin variables de conexión no hace nada.
 * Cada migración se aplica una sola vez, dentro de una transacción, y queda registrada en schema_migrations.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');

/** Opciones de conexión: quita parámetros de la URL que postgres.js enviaría al servidor (p. ej. ?supa=…). */
export function connect(url, opts = {}) {
  const u = new URL(url);
  const local = ['localhost', '127.0.0.1'].includes(u.hostname);
  const sslmode = u.searchParams.get('sslmode');
  u.search = '';
  return postgres(u.toString(), { ssl: local || sslmode === 'disable' ? false : 'require', prepare: false, max: 1, onnotice: () => {}, ...opts });
}

export async function migrate(sql, { log = console.log, statusOnly = false } = {}) {
  await sql`create table if not exists schema_migrations (version text primary key, applied_at timestamptz not null default now())`;
  await sql`alter table schema_migrations enable row level security`;
  const applied = new Set((await sql`select version from schema_migrations`).map((r) => r.version));
  const files = readdirSync(dir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  const pending = files.filter((f) => !applied.has(f));
  if (statusOnly || !pending.length) {
    log(`db: ${applied.size} migraciones aplicadas, ${pending.length} pendientes${pending.length ? ` (${pending.join(', ')})` : ''}`);
    return { applied: [...applied], pending };
  }
  for (const file of pending) {
    const body = readFileSync(join(dir, file), 'utf8');
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into schema_migrations (version) values (${file})`;
    });
    log(`db: migración aplicada ${file}`);
  }
  return { applied: [...applied, ...pending], pending: [] };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  const onVercel = !!process.env.VERCEL;
  const shouldRun = !onVercel || process.env.VERCEL_ENV === 'production' || process.env.MIGRATE === '1';
  if (!url) console.log('db: sin POSTGRES_URL; se omiten las migraciones.');
  else if (!shouldRun) console.log(`db: entorno ${process.env.VERCEL_ENV}; las migraciones solo corren en producción (o con MIGRATE=1).`);
  else {
    const sql = connect(url);
    try {
      await migrate(sql, { statusOnly: process.argv.includes('--status') });
    } catch (err) {
      console.error('db: error en migraciones:', err.message);
      // No bloquea el deploy del sitio salvo que se pida (MIGRATE_STRICT=1): la API sigue funcionando con Blob.
      process.exitCode = process.env.MIGRATE_STRICT === '1' ? 1 : 0;
    } finally {
      await sql.end({ timeout: 5 });
    }
  }
}
