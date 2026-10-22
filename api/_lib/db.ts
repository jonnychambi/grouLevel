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
    // Una conexión por instancia: con el pooler de Supabase, varias consultas en paralelo desde la misma
    // instancia llegaron a quedarse esperando indefinidamente. En serie son igual de rápidas a esta escala.
    max: 1,
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

/**
 * Descarta el cliente actual (p. ej. tras una consulta que no respondió): con `max: 1`, una conexión muerta
 * dejaría esperando a todas las solicitudes siguientes de la instancia. La próxima consulta abre una nueva.
 */
export function resetSql() {
  if (!testClient) client = null;
}

/**
 * Diagnóstico cuando una consulta no responde: con un cliente nuevo y límites cortos mide por separado la
 * conexión y un `select 1`, y registra host, puerto y nombres de parámetros de la URL (nunca usuario ni clave).
 */
export async function diagnoseDb(): Promise<string> {
  const url = process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
  if (!url) return 'sin POSTGRES_URL';
  const u = new URL(url);
  const where = `${u.hostname}:${u.port || '5432'} (${process.env.POSTGRES_URL ? 'POSTGRES_URL' : 'NON_POOLING'}; params: ${[...u.searchParams.keys()].join(',') || '—'})`;
  const sql = createSql(url, { connect_timeout: 6, idle_timeout: 1 });
  const t = Date.now();
  try {
    const r = await Promise.race([
      sql`select 1 as ok`.then(() => `select 1 en ${Date.now() - t} ms`),
      new Promise<string>((resolve) => setTimeout(() => resolve(`select 1 sin respuesta tras ${Date.now() - t} ms`), 12_000))
    ]);
    return `${where} → ${r}`;
  } catch (err) {
    return `${where} → error tras ${Date.now() - t} ms: ${err instanceof Error ? `${(err as { code?: string }).code ?? ''} ${err.message}` : String(err)}`;
  } finally {
    void sql.end({ timeout: 1 }).catch(() => {});
  }
}

/** Solo para pruebas: inyecta una conexión. */
export function setSqlForTests(sql: Sql | null) {
  client = sql;
  testClient = !!sql;
}
