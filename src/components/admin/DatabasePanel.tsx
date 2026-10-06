import { useCallback, useEffect, useState } from 'react';
import { fetchDbStatus, runDbSync, type DbStatus } from '../../services/adminApi';
import { Icon } from '../ui/Icon';

const LABELS: Record<string, string> = {
  courses: 'Programas', institutions: 'Instituciones', categories: 'Categorías', catalog_versions: 'Versiones del catálogo',
  catalog_changes: 'Cambios registrados', leads: 'Leads', reviews: 'Reseñas', profiles: 'Diagnósticos Mi ruta'
};
const when = (iso: string) => new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Estado de la base de datos (Supabase) y sincronización completa desde Vercel Blob. */
export function DatabasePanel({ onError, onNotice }: { onError: (e: unknown) => void; onNotice: (text: string) => void }) {
  const [status, setStatus] = useState<DbStatus | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus(await fetchDbStatus());
    } catch (e) {
      onError(e);
    }
  }, [onError]);
  useEffect(() => { void load(); }, [load]);

  const sync = async () => {
    setSyncing(true);
    try {
      const { stats } = await runDbSync();
      onNotice(`Sincronizado en ${(stats.ms / 1000).toFixed(1)} s: ${stats.catalog?.courses ?? 0} programas, ${stats.leads} leads, ${stats.reviews} reseñas, ${stats.profiles} diagnósticos.`);
      await load();
    } catch (e) {
      onError(e);
    } finally {
      setSyncing(false);
    }
  };

  const tone = !status ? 'text-gray' : !status.configured ? 'text-warn' : status.connected ? 'text-pos' : 'text-neg';
  const label = !status ? 'Consultando…' : !status.configured ? 'No configurada' : status.connected ? 'Conectada' : 'Sin conexión';

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-white">Base de datos</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray">Supabase (PostgreSQL). Cada alta o cambio de programas, leads, reseñas y diagnósticos se replica automáticamente. La sincronización completa copia todo lo guardado en Vercel Blob y elimina de la base lo que ya no existe.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-accent btn-sm" onClick={() => void sync()} disabled={syncing || !status?.connected}>
            <Icon name="history" size={15} /> {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
          </button>
          <button className="btn btn-quiet btn-sm" onClick={() => void load()}>Actualizar</button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <p className="label-mono">Estado</p>
          <p className={`mt-2 flex items-center gap-2 text-lg ${tone}`}><span className="h-2.5 w-2.5 rounded-full bg-current" />{label}</p>
          {status?.error && <p className="mt-2 break-words text-sm text-neg">{status.error}</p>}
          {status && !status.configured && <p className="mt-2 text-sm text-gray">Conecta Supabase al proyecto en Vercel (Storage → Supabase). Se crean las variables POSTGRES_URL automáticamente.</p>}
          {status?.migrations && (
            <>
              <p className="label-mono mt-5">Migraciones aplicadas</p>
              <ul className="mt-2 space-y-1 font-mono text-xs text-gray">{status.migrations.map((m) => <li key={m.version}>{m.version} · {when(m.applied_at)}</li>)}</ul>
            </>
          )}
        </div>
        <div className="card p-5 lg:col-span-2">
          <p className="label-mono">Registros en la base</p>
          {status?.counts ? (
            <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Object.entries(status.counts).map(([k, v]) => (
                <div key={k}><dt className="text-xs text-gray">{LABELS[k] ?? k}</dt><dd className="tnum mt-1 text-2xl text-white">{v.toLocaleString('es-PE')}</dd></div>
              ))}
            </dl>
          ) : <p className="mt-3 text-sm text-gray">—</p>}
          <p className="label-mono mt-6">Última sincronización completa</p>
          <p className="mt-2 text-sm text-gray">
            {status?.last_sync
              ? status.last_sync.error
                ? <span className="text-neg">Falló el {when(status.last_sync.started_at)}: {status.last_sync.error}</span>
                : <>{when(status.last_sync.started_at)} · {status.last_sync.finished_at ? 'completada' : 'en curso'}</>
              : 'Nunca. Pulsa "Sincronizar ahora" para copiar los datos existentes.'}
          </p>
        </div>
      </div>
    </div>
  );
}
