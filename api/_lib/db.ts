/**
 * Conexión a la base de datos (Supabase / PostgreSQL) desde las Vercel Functions.
 *
 * Usa POSTGRES_URL (pooler de Supabase en modo transacción): sin sentencias preparadas y con
 * pocas conexiones por instancia. Mientras Vercel Blob siga siendo la fuente principal, las
 * escrituras a la base son un espejo "best effort" (mirror): si la base falla, el sitio sigue funcionando.
 */
import postgres from 'postgres';

export type Sql = postgres.Sql;

let client: Sql | null = null;

export const isDbConfigured = () => !!(process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING);

/** postgres.js envía los parámetros de la URL al servidor; los de Supabase/Vercel (?sslmode, ?supa…) se quitan. */
export function createSql(url: string, opts: postgres.Options<Record<string, postgres.PostgresType>> = {}): Sql {
  const u = new URL(url);
  const local = ['localhost', '127.0.0.1'].includes(u.hostname);
  const sslmode = u.searchParams.get('sslmode');
  u.search = '';
  return postgres(u.toString(), {
    ssl: local || sslmode === 'disable' ? false : 'require',
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connect_timeout: 8,
    onnotice: () => {},
    ...opts
  });
}

export function getSql(): Sql {
  if (!client) {
    const url = process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
    if (!url) throw new Error('db_not_configured');
    client = createSql(url);
  }
  return client;
}

/** Solo para pruebas: inyecta una conexión. */
export function setSqlForTests(sql: Sql | null) {
  client = sql;
}

/**
 * Replica una escritura en la base sin afectar la respuesta: si no hay base configurada no hace nada,
 * y si falla (o tarda más de `timeoutMs`) solo deja registro en los logs de Vercel.
 */
export async function mirror(label: string, fn: (sql: Sql) => Promise<unknown>, timeoutMs = 5000): Promise<boolean> {
  if (!isDbConfigured()) return false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      fn(getSql()),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), timeoutMs); })
    ]);
    return true;
  } catch (err) {
    console.error(`db_mirror_failed:${label}`, err instanceof Error ? err.message : err);
    return false;
  } finally {
    clearTimeout(timer);
  }
}
