/**
 * Tarea programada (Vercel Cron, ver vercel.json): corre a diario.
 *  1. Descubrimiento: revisa las páginas de programas de cada institución y pone en cola los programas nuevos;
 *     una vez por semana busca instituciones nuevas en la web (programDiscovery).
 *  2. Lee con IA los links en cola (programImport) y publica solos los encontrados automáticamente que estén completos.
 *  3. Revisa los links de los programas publicados y deja propuestas de cambio (programRefresh; frecuencia en /admin).
 * Vercel envía Authorization: Bearer <CRON_SECRET>. También aplica la política de conservación de documentos
 * (CV y constancias: FILE_RETENTION_DAYS, por defecto 180 días).
 */
import { json } from './_lib/http.js';
import { isDbConfigured } from './_lib/db.js';
import { runRefresh } from './_lib/programRefresh.js';
import { processQueue } from './_lib/programImport.js';
import { autoPublish, runDiscovery, searchDue, searchInstitutions } from './_lib/programDiscovery.js';
import { purgeOldFiles } from './_lib/profiles.js';

const failed = (step: string) => (err: unknown) => {
  console.error(`${step}_failed`, err instanceof Error ? err.message : err);
  return { error: err instanceof Error ? err.message : String(err) };
};

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return json(401, { error: 'unauthorized' });
  if (!isDbConfigured()) return json(503, { error: 'db_not_configured' });
  const started = Date.now();
  const purged = await purgeOldFiles().catch(failed('purge'));
  const discovered = await runDiscovery({ timeBudgetMs: 35_000 }).catch(failed('discovery'));
  const searched = (await searchDue().catch(() => false)) ? await searchInstitutions({ timeoutMs: 60_000 }).catch(failed('search')) : null;
  const imported = await processQueue({ timeBudgetMs: 70_000, concurrency: 6 });
  const published = await autoPublish().catch(failed('autopublish'));
  const summary = await runRefresh('cron', { timeBudgetMs: Math.max(30_000, 280_000 - (Date.now() - started)) });
  const report = { discovered, searched, imported, published, purged };
  console.log('refresh', JSON.stringify(summary), 'cron', JSON.stringify(report));
  return json(200, { ...summary, ...report });
}
