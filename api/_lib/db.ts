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
let lastUsed = 0;
let testClient = false;
/**
 * Vercel congela la instancia entre invocaciones: una conexión que quedó abierta puede estar muerta al
 * despertar y la consulta quedarse colgada hasta el timeout de la función. Si pasó este tiempo sin uso,
 * se crea un cliente nuevo (el anterior no se cierra a la fuerza por si alguna tarea larga aún lo usa;
 * sus conexiones se liberan solas por idle_timeout).
 */
const MAX_IDLE_MS = 15_000;

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
  const now = Date.now();
  if (client && !testClient && now - lastUsed > MAX_IDLE_MS) client = null;
  lastUsed = now;
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
  testClient = !!sql;
}
