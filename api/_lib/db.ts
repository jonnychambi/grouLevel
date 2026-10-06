/**
 * Conexión a la base de datos (Supabase / PostgreSQL) desde las Vercel Functions.
 *
 * La base es la fuente principal de los datos (catálogo, leads, reseñas, diagnósticos).
 * Usa POSTGRES_URL (pooler de Supabase en modo transacción): sin sentencias preparadas y con
 * pocas conexiones por instancia.
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
