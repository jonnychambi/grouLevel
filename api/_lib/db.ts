/**
 * Conexión a la base de datos (Supabase / PostgreSQL) desde las Vercel Functions.
 *
 * La base es la fuente principal de los datos (catálogo, leads, reseñas, diagnósticos).
 * Usa el pooler de Supabase (ver dbUrl: modo sesión por defecto): sin sentencias preparadas y con
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

/**
 * URL de conexión. Por defecto POSTGRES_URL_NON_POOLING (pooler de Supabase en modo sesión): en oct-2026 el modo
 * transacción (POSTGRES_URL, puerto 6543) dejó colgadas todas las consultas desde las funciones, mientras el modo
 * sesión respondía en ~1 s. Con max: 1 e idle_timeout corto, cada instancia usa una sola conexión y la libera pronto.
 * DB_POOL_MODE=transaction vuelve a POSTGRES_URL.
 */
const dbUrl = () => (process.env.DB_POOL_MODE === 'transaction'
  ? process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING
  : process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL);

export function getSql(): Sql {
  const now = Date.now();
  if (client && !testClient && now - lastUsed > MAX_IDLE_MS) client = null;
  lastUsed = now;
  if (!client) {
    const url = dbUrl();
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
  const urls = [['POSTGRES_URL', process.env.POSTGRES_URL], ['POSTGRES_URL_NON_POOLING', process.env.POSTGRES_URL_NON_POOLING]].filter(([, u]) => u) as [string, string][];
  if (!urls.length) return 'sin POSTGRES_URL';
  const results = await Promise.all(urls.map(async ([name, url]) => {
    const u = new URL(url);
    const where = `${name} ${u.hostname}:${u.port || '5432'}`;
    const sql = createSql(url, { connect_timeout: 6, idle_timeout: 1 });
    const t = Date.now();
    try {
      const timed = (label: string, q: () => Promise<unknown>) => {
        const t0 = Date.now();
        return Promise.race([
          q().then(() => `${label} en ${Date.now() - t0} ms`),
          new Promise<string>((resolve) => setTimeout(() => resolve(`${label} sin respuesta tras ${Date.now() - t0} ms`), 10_000))
        ]);
      };
      // Una respuesta chica y otras grandes: si solo fallan las grandes, el problema es de red (p. ej. MTU), no de la base.
      const small = await timed('select 1', () => sql`select 1 as ok`);
      const big = small.includes('sin respuesta') ? 'omitida' : await timed('256 KB', () => sql`select repeat('x', 262144) as big`);
      const real = big.includes('sin respuesta') || big === 'omitida' ? 'omitida' : await timed('catálogo', () => sql`select length(data::text) from catalog_versions where is_current limit 1`.then(() => sql`select data from catalog_versions where is_current limit 1`));
      return `${where} → ${small} · ${big} · ${real}`;
    } catch (err) {
      return `${where} → error tras ${Date.now() - t} ms: ${err instanceof Error ? `${(err as { code?: string }).code ?? ''} ${err.message}` : String(err)}`;
    } finally {
      void sql.end({ timeout: 1 }).catch(() => {});
    }
  }));
  return results.join(' | ');
}

/** Solo para pruebas: inyecta una conexión. */
export function setSqlForTests(sql: Sql | null) {
  client = sql;
  testClient = !!sql;
}
