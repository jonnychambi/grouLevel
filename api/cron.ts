/**
 * Tarea programada (Vercel Cron, ver vercel.json): revisa los links de los programas y deja propuestas de cambio.
 * Vercel envía Authorization: Bearer <CRON_SECRET>. La frecuencia real (diario / semanal / desactivado) se
 * configura en /admin → Actualizaciones; esta función corre a diario y solo revisa los programas que tocan.
 */
import { json } from './_lib/http.js';
import { isDbConfigured } from './_lib/db.js';
import { runRefresh } from './_lib/programRefresh.js';

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return json(401, { error: 'unauthorized' });
  if (!isDbConfigured()) return json(503, { error: 'db_not_configured' });
  const summary = await runRefresh('cron', { timeBudgetMs: 250_000 });
  console.log('refresh', JSON.stringify(summary));
  return json(200, summary);
}
