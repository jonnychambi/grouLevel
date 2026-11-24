import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Institution } from '../../types';
import {
  addDiscoverySource, fetchDiscovery, runDiscoveryNow, saveDiscoverySettings, searchInstitutionsNow, setDiscoverySourceStatus,
  type DiscoveryOverview, type DiscoverySettings, type DiscoverySource
} from '../../services/adminApi';
import { Icon } from '../ui/Icon';

const num = (n: number) => n.toLocaleString('es-PE');
const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Nunca');
const ORIGIN: Record<DiscoverySource['origin'], string> = { auto: 'Automática', manual: 'Agregada', sugerida: 'Búsqueda web', semilla: 'Inicial' };

/**
 * Descubrimiento autónomo: fuentes (páginas que listan programas) que se revisan solas, instituciones nuevas
 * sugeridas por búsqueda web y la publicación automática de los programas completos.
 */
export function DiscoveryPanel({ institutions, onError, onNotice, onPublished }: {
  institutions: Institution[];
  onError: (e: unknown) => void;
  onNotice: (text: string) => void;
  onPublished: () => Promise<void> | void;
}) {
  const [data, setData] = useState<DiscoveryOverview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [inst, setInst] = useState('');
  const [name, setName] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await fetchDiscovery());
    } catch (e) {
      onError(e);
    }
  }, [onError]);
  useEffect(() => { void load(); }, [load]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(null);
    }
  };

  const save = (patch: Partial<DiscoverySettings>) => run('settings', async () => {
    const { settings } = await saveDiscoverySettings(patch);
    setData((d) => (d ? { ...d, settings } : d));
  });

  const discover = (ids?: number[]) => run(ids ? `run:${ids[0]}` : 'run', async () => {
    const r = await runDiscoveryNow(ids);
    const d = r.discovered;
    onNotice(`Se revisaron ${num(d.sources)} fuentes: ${num(d.added)} programas nuevos en cola. La IA leyó ${num(r.imported.processed)} (${num(r.imported.ready)} útiles)`
      + `${r.published.published ? ` y se publicaron solos ${num(r.published.published)} completos` : ''}.`
      + `${r.imported.remaining ? ` Quedan ${num(r.imported.remaining)} en cola: se leen en la próxima ejecución diaria o desde Agregar programas.` : ''}`
      + `${r.published.waiting ? ` ${num(r.published.waiting)} incompletos esperan revisión en Agregar programas.` : ''}`);
    await Promise.all([load(), r.published.published ? onPublished() : null]);
  });

  const search = () => run('search', async () => {
    const { result } = await searchInstitutionsNow();
    if (result.error) onError(new Error(result.error));
    else onNotice(`Búsqueda web: ${num(result.suggested)} instituciones nuevas${result.approved ? ` (${num(result.approved)} aprobadas solas)` : ' para revisar'}. ${num(result.searches)} búsquedas, costo aprox. US$ ${result.cost_usd.toFixed(2)}.`);
    await load();
  });

  const status = (s: DiscoverySource, next: 'activa' | 'pausada' | 'descartada') => run(`status:${s.id}`, async () => {
    await setDiscoverySourceStatus(s.id, next);
    await load();
  });

  const add = () => run('add', async () => {
    await addDiscoverySource(url.trim(), inst || null, inst ? undefined : name.trim() || undefined);
    setUrl(''); setName('');
    onNotice('Fuente agregada. Pulsa «Buscar programas ahora» o espera la ejecución diaria.');
    await load();
  });

  const suggested = useMemo(() => data?.sources.filter((s) => s.status === 'sugerida') ?? [], [data]);
  const sources = useMemo(() => data?.sources.filter((s) => s.status !== 'sugerida') ?? [], [data]);
  const s = data?.settings;
  const aiOff = data && !data.ai.configured;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-2xl text-white">Descubrimiento automático</h1>
          <p className="mt-1 text-sm text-gray">
            Groulevel revisa solo las páginas de programas de cada institución, pone en cola los programas nuevos y la IA los lee. Se quedan únicamente los de
            <strong className="text-white"> Tecnología y Negocios dictados en español</strong>; los demás se descartan con el motivo. Una vez por semana busca instituciones nuevas en la web.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-quiet btn-sm" onClick={() => void load()} disabled={!!busy}>Actualizar</button>
          <button className="btn btn-accent btn-sm h-auto max-w-full whitespace-normal" onClick={() => discover()} disabled={!!busy || !!aiOff}>
            <Icon name="search" size={15} /> {busy === 'run' ? 'Buscando y leyendo… (hasta 4 min)' : 'Buscar programas ahora'}
          </button>
        </div>
      </div>

      {aiOff && <p role="alert" className="mt-4 rounded-lg border border-neg/40 bg-neg/10 p-3 text-sm text-neg">Falta una ANTHROPIC_API_KEY válida en Vercel: sin ella no se pueden leer los programas ni buscar instituciones.</p>}

      {s && (
        <section className="card mt-6 grid gap-4 p-5 md:grid-cols-2" aria-label="Configuración">
          <label className="min-w-0 text-sm text-gray">
            <span className="block text-white">Frecuencia</span>
            <select className="input mt-1.5" value={s.frequency} disabled={!!busy} onChange={(e) => save({ frequency: e.target.value as DiscoverySettings['frequency'] })}>
              <option value="semanal">Semanal (recomendado)</option>
              <option value="diario">Diaria</option>
              <option value="desactivado">Desactivado</option>
            </select>
          </label>
          <label className="min-w-0 text-sm text-gray">
            <span className="block text-white">Programas nuevos por fuente y ejecución</span>
            <input type="number" min={1} max={50} className="input mt-1.5" defaultValue={s.max_per_source} key={s.max_per_source} disabled={!!busy}
              onBlur={(e) => Number(e.target.value) !== s.max_per_source && save({ max_per_source: Number(e.target.value) })} />
            <span className="mt-1 block text-xs text-muted">Limita el gasto: cada programa leído cuesta menos de US$ 0,01.</span>
          </label>
          <Toggle checked={s.auto_publish} disabled={!!busy} onChange={(v) => save({ auto_publish: v })} label="Publicar solos los programas completos"
            hint="Con institución, tema y español, precio o duración, temario y descripción. Los incompletos esperan en Agregar programas." />
          <Toggle checked={s.search_institutions} disabled={!!busy} onChange={(v) => save({ search_institutions: v })} label="Buscar instituciones nuevas cada semana"
            hint="Claude busca en la web instituciones con programas en español de Tecnología y Negocios que no estén en el catálogo." />
          <Toggle checked={s.auto_approve} disabled={!!busy} onChange={(v) => save({ auto_approve: v })} label="Aprobar solas las instituciones sugeridas"
            hint="Si está apagado, cada institución sugerida espera tu aprobación antes de leer sus programas." />
          <p className="min-w-0 text-sm text-muted">
            Encontrados automáticamente: {num(data!.drafts.publicado ?? 0)} publicados · {num(data!.drafts.listo ?? 0)} por revisar · {num((data!.drafts.en_cola ?? 0) + (data!.drafts.procesando ?? 0))} en cola · {num(data!.drafts.descartado ?? 0)} descartados.
            <span className="block">Modelo: {data!.ai.model}.</span>
          </p>
        </section>
      )}

      <section className="card mt-6 p-5" aria-labelledby="sug-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h2 id="sug-title" className="text-lg text-white">Instituciones sugeridas</h2>
            <p className="mt-1 text-sm text-gray">
              Última búsqueda: {when(data?.last_search?.at)}
              {data?.last_search?.error ? <span className="text-neg"> · {data.last_search.error}</span> : data?.last_search ? <> · {num(data.last_search.suggested)} nuevas</> : null}.
              Al aprobar una, se crea la institución en el catálogo cuando se encuentra su primer programa.
            </p>
          </div>
          <button className="btn btn-quiet btn-sm" onClick={search} disabled={!!busy || !!aiOff}>
            <Icon name="globe" size={15} /> {busy === 'search' ? 'Buscando en la web… (1-2 min)' : 'Buscar instituciones ahora'}
          </button>
        </div>
        {suggested.length ? (
          <ul className="mt-4 divide-y divide-line">
            {suggested.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-white">{x.institution?.name ?? x.url} <span className="text-xs text-muted">· {x.institution?.type} · {x.institution?.country}</span></p>
                  <a href={x.url} target="_blank" rel="noreferrer" className="block truncate text-sm text-cyan hover:underline">{x.url}</a>
                  {x.reason && <p className="text-sm text-gray">{x.reason}</p>}
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-accent btn-sm" disabled={!!busy} onClick={() => status(x, 'activa')}>Aprobar</button>
                  <button className="btn btn-quiet btn-sm" disabled={!!busy} onClick={() => status(x, 'descartada')}>Descartar</button>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-sm text-muted">No hay sugerencias pendientes.</p>}
      </section>

      <section className="card mt-6 p-5" aria-labelledby="src-title">
        <h2 id="src-title" className="text-lg text-white">Fuentes ({num(sources.length)})</h2>
        <p className="mt-1 text-sm text-gray">Páginas que listan programas. Las automáticas se deducen de los links ya publicados de cada institución; puedes agregar otras (por ejemplo, la página de posgrados).</p>
        <div className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr_auto]">
          <input className="input min-w-0" placeholder="https://institucion.edu.pe/programas/" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Link de la página de programas" />
          <select className="input min-w-0" value={inst} onChange={(e) => setInst(e.target.value)} aria-label="Institución">
            <option value="">Institución nueva…</option>
            {institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <button className="btn btn-accent btn-sm" disabled={!!busy || !/^https?:\/\//.test(url.trim())} onClick={add}><Icon name="plus" size={15} /> Agregar fuente</button>
          {!inst && <input className="input min-w-0 md:col-span-2" placeholder="Nombre de la institución nueva" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre de la institución nueva" />}
        </div>
        <ul className="mt-4 divide-y divide-line">
          {sources.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-white">
                  {x.institution_name ?? 'Sin institución'} <span className="text-xs text-muted">· {ORIGIN[x.origin]}{x.status === 'pausada' ? ' · Pausada' : ''}</span>
                </p>
                <a href={x.url} target="_blank" rel="noreferrer" className="block truncate text-sm text-cyan hover:underline">{x.url}</a>
                <p className="text-xs text-muted">
                  Última revisión: {when(x.last_run_at)}{x.last_run_at ? ` · ${num(x.last_found)} links de programas · ${num(x.last_added)} nuevos` : ''}
                  {x.last_error && <span className="text-neg"> · {x.last_error}</span>}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-quiet btn-sm" disabled={!!busy || x.status !== 'activa' || !!aiOff} onClick={() => discover([x.id])}>{busy === `run:${x.id}` ? 'Revisando…' : 'Revisar'}</button>
                {x.status === 'activa'
                  ? <button className="btn btn-quiet btn-sm" disabled={!!busy} onClick={() => status(x, 'pausada')}>Pausar</button>
                  : <button className="btn btn-quiet btn-sm" disabled={!!busy} onClick={() => status(x, 'activa')}>Reactivar</button>}
                <button className="btn btn-quiet btn-sm" disabled={!!busy} onClick={() => status(x, 'descartada')} aria-label={`Quitar ${x.url}`}><Icon name="trash" size={14} /></button>
              </div>
            </li>
          ))}
        </ul>
        {!sources.length && <p className="mt-3 text-sm text-muted">Las fuentes automáticas se crean en la primera búsqueda.</p>}
      </section>
    </div>
  );
}

function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string; disabled?: boolean }) {
  return (
    <label className="flex min-w-0 items-start gap-3 text-sm">
      <input type="checkbox" className="mt-1 accent-violet" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="min-w-0">
        <span className="block text-white">{label}</span>
        <span className="block text-gray">{hint}</span>
      </span>
    </label>
  );
}
