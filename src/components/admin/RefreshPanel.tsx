import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Course } from '../../types';
import {
  applyProgramUpdate, checkProgram, discardProgramUpdate, fetchRefresh, runRefreshNow, saveRefreshSettings,
  type CheckStatus, type ProgramUpdate, type RefreshFrequency, type RefreshOverview
} from '../../services/adminApi';
import { Icon } from '../ui/Icon';

const when = (iso: string) => new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const num = (n: number) => n.toLocaleString('es-PE');
const show = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'boolean' ? (v ? 'Sí' : 'No') : String(v));

const STATUS: Record<CheckStatus, { label: string; tone: string }> = {
  sin_cambios: { label: 'Sin cambios', tone: 'text-pos' },
  cambios: { label: 'Con cambios', tone: 'text-cyan' },
  error: { label: 'Error', tone: 'text-neg' },
  sin_contenido: { label: 'Sin contenido', tone: 'text-warn' }
};
const FREQ: { id: RefreshFrequency; label: string; hint: string }[] = [
  { id: 'diario', label: 'Diario', hint: 'Cada programa se revisa una vez al día.' },
  { id: 'semanal', label: 'Semanal', hint: 'Cada programa se revisa una vez por semana (el catálogo se reparte en 7 días).' },
  { id: 'desactivado', label: 'Desactivado', hint: 'Solo revisiones manuales.' }
];
type Filter = 'todos' | 'nunca' | CheckStatus;

/**
 * Actualización de programas desde sus links: configuración del proceso automático, propuestas de cambio
 * pendientes de aprobación y revisión manual por programa.
 */
export function RefreshPanel({ courses, onError, onNotice, onApplied, onEdit }: {
  courses: Course[];
  onError: (e: unknown) => void;
  onNotice: (text: string) => void;
  onApplied: () => Promise<void> | void;
  onEdit: (course: Course) => void;
}) {
  const [data, setData] = useState<RefreshOverview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('todos');

  const load = useCallback(async () => {
    try {
      setData(await fetchRefresh());
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

  const byId = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const checks = useMemo(() => new Map((data?.checks ?? []).map((c) => [c.course_id, c])), [data]);
  const pendingIds = useMemo(() => new Set((data?.pending ?? []).map((u) => u.course_id)), [data]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses
      .filter((c) => c.status === 'publicado' && !c.is_demo)
      .filter((c) => !q || `${c.name} ${c.institution_id} ${c.url}`.toLowerCase().includes(q))
      .filter((c) => {
        const ch = checks.get(c.id);
        return filter === 'todos' || (filter === 'nunca' ? !ch : ch?.last_status === filter);
      });
  }, [courses, query, filter, checks]);

  const counts = useMemo(() => {
    const out: Record<Filter, number> = { todos: 0, nunca: 0, sin_cambios: 0, cambios: 0, error: 0, sin_contenido: 0 };
    for (const c of courses) {
      if (c.status !== 'publicado' || c.is_demo) continue;
      out.todos++;
      const ch = checks.get(c.id);
      out[ch ? ch.last_status : 'nunca']++;
    }
    return out;
  }, [courses, checks]);

  const setFrequency = (frequency: RefreshFrequency) => run('settings', async () => {
    const { settings } = await saveRefreshSettings({ frequency });
    setData((d) => (d ? { ...d, settings } : d));
    onNotice(`Frecuencia: ${FREQ.find((f) => f.id === settings.frequency)?.label.toLowerCase()}.`);
  });

  const runBatch = () => run('batch', async () => {
    const { summary: s } = await runRefreshNow();
    onNotice(`Revisados ${s.checked} programas: ${s.changed} con cambios, ${s.unchanged} sin cambios, ${s.errors} con error. IA: ${s.ai_calls} consultas (${num(s.input_tokens + s.output_tokens)} fichas).${s.remaining > 0 ? ` Quedan ${s.remaining}; vuelve a ejecutar para continuar.` : ''}`);
    await load();
  });

  const checkOne = (course: Course) => run(`check:${course.id}`, async () => {
    const { result } = await checkProgram(course.id);
    const tokens = result.usage.input_tokens + result.usage.output_tokens;
    onNotice(result.status === 'cambios'
      ? `“${course.name}”: se detectaron ${result.changes.length || 'posibles'} cambios. Revísalos en las propuestas.`
      : result.status === 'sin_cambios' ? `“${course.name}”: la información coincide con la página${tokens ? ` (${num(tokens)} fichas)` : ''}.`
      : `“${course.name}”: ${result.error ?? 'no se pudo revisar.'}`);
    await load();
  });

  const apply = (u: ProgramUpdate, fields: string[]) => run(`apply:${u.id}`, async () => {
    await applyProgramUpdate(u.id, fields);
    onNotice(`“${u.course_name}” actualizado. Los cambios se verán en el sitio en aproximadamente 1 minuto.`);
    await Promise.all([load(), onApplied()]);
  });

  const discard = (u: ProgramUpdate) => run(`discard:${u.id}`, async () => {
    await discardProgramUpdate(u.id);
    await load();
  });

  const lastRun = data?.runs.find((r) => r.trigger !== 'programa');

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-white">Actualización de programas</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray">
            Se lee el link oficial de cada programa y se compara con el catálogo (precio, inicio, duración, modalidad, horario, cuotas e inscripciones).
            Si la página no cambió no se consulta la IA. Los cambios detectados quedan como propuestas: nada se publica hasta que las apliques.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-accent btn-sm" onClick={runBatch} disabled={!!busy}>
            <Icon name="history" size={15} /> {busy === 'batch' ? 'Revisando… (hasta 4 min)' : 'Revisar lote ahora'}
          </button>
          <button className="btn btn-quiet btn-sm" onClick={() => void load()} disabled={!!busy}>Actualizar</button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <p className="label-mono">Proceso automático</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {FREQ.map((f) => (
              <button key={f.id} onClick={() => setFrequency(f.id)} disabled={!!busy || !data}
                className={`rounded-full border px-3 py-1.5 text-sm ${data?.settings.frequency === f.id ? 'border-violet bg-violet/15 text-white' : 'border-line text-gray hover:text-white'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray">{FREQ.find((f) => f.id === data?.settings.frequency)?.hint ?? '—'} Se ejecuta a las 4:00 a. m. (Lima).</p>
          <p className="label-mono mt-5">Última ejecución</p>
          <p className="mt-1 text-sm text-gray">
            {lastRun ? <>{when(lastRun.started_at)} · {lastRun.trigger === 'cron' ? 'automática' : 'manual'} · {lastRun.checked} revisados, {lastRun.changed} con cambios, {lastRun.errors} con error</> : 'Nunca.'}
          </p>
        </div>
        <div className="card p-5">
          <p className="label-mono">Modelo de IA</p>
          {data?.ai.configured ? (
            <p className="mt-2 text-sm text-white"><span className="font-mono">{data.ai.model}</span> <span className="text-gray">· extracción con salida estructurada, sin razonamiento extendido</span></p>
          ) : (
            <p className="mt-2 text-sm text-warn">Sin ANTHROPIC_API_KEY: solo se detecta que la página cambió (por huella) y se marca para revisión manual.</p>
          )}
          <p className="label-mono mt-5">Consumo (30 días)</p>
          {data ? (
            <dl className="mt-2 grid grid-cols-3 gap-3">
              <div><dt className="text-xs text-gray">Consultas IA</dt><dd className="tnum mt-1 text-lg text-white">{num(data.usage_30d.ai_calls)}</dd></div>
              <div><dt className="text-xs text-gray">Fichas</dt><dd className="tnum mt-1 text-lg text-white">{num(data.usage_30d.input_tokens + data.usage_30d.output_tokens)}</dd></div>
              <div><dt className="text-xs text-gray">Costo aprox.</dt><dd className="tnum mt-1 text-lg text-white">US$ {data.usage_30d.estimated_usd.toFixed(2)}</dd></div>
            </dl>
          ) : <p className="mt-2 text-sm text-gray">—</p>}
        </div>
        <div className="card p-5">
          <p className="label-mono">Estado de los links</p>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            {(['sin_cambios', 'cambios', 'error', 'sin_contenido'] as CheckStatus[]).map((s) => (
              <div key={s}><dt className="text-xs text-gray">{STATUS[s].label}</dt><dd className={`tnum mt-1 text-lg ${STATUS[s].tone}`}>{num(counts[s])}</dd></div>
            ))}
            <div><dt className="text-xs text-gray">Nunca revisados</dt><dd className="tnum mt-1 text-lg text-white">{num(counts.nunca)}</dd></div>
            <div><dt className="text-xs text-gray">Propuestas pendientes</dt><dd className="tnum mt-1 text-lg text-cyan">{num(data?.pending.length ?? 0)}</dd></div>
          </dl>
        </div>
      </div>

      <h2 className="mt-10 text-lg text-white">Propuestas pendientes {data && <span className="text-gray">({data.pending.length})</span>}</h2>
      {!data ? <p className="mt-3 text-sm text-gray">Cargando…</p> : !data.pending.length ? (
        <p className="mt-3 text-sm text-gray">No hay cambios por revisar.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {data.pending.map((u) => (
            <UpdateCard key={u.id} update={u} course={byId.get(u.course_id)} busy={busy} onApply={apply} onDiscard={discard} onEdit={onEdit} onCheck={checkOne} />
          ))}
        </div>
      )}

      <h2 className="mt-10 text-lg text-white">Revisar programas</h2>
      <p className="mt-1 text-sm text-gray">Revisa un programa leyendo su link en este momento, o edítalo a mano.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray" />
          <input className="input min-h-10 py-2 pl-9 text-sm" placeholder="Buscar programa, institución o link" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {(['todos', 'nunca', 'cambios', 'error', 'sin_contenido', 'sin_cambios'] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 text-xs ${filter === f ? 'bg-raise text-white' : 'text-gray hover:text-white'}`}>
            {f === 'todos' ? 'Todos' : f === 'nunca' ? 'Nunca revisados' : STATUS[f].label} ({num(counts[f])})
          </button>
        ))}
      </div>
      <div className="mt-3 overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-midnight text-xs text-gray">
            <tr><th className="px-3 py-2">Programa</th><th className="px-3 py-2">Última revisión</th><th className="px-3 py-2">Resultado</th><th className="px-3 py-2 text-right">Acciones</th></tr>
          </thead>
          <tbody>
            {rows.slice(0, 100).map((c) => {
              const ch = checks.get(c.id);
              return (
                <tr key={c.id} className="border-t border-line align-top">
                  <td className="px-3 py-2">
                    <p className="text-white">{c.name}</p>
                    <a href={c.url} target="_blank" rel="noreferrer" className="block max-w-[340px] truncate text-xs text-gray hover:text-cyan">{c.url}</a>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray">{ch ? when(ch.last_checked_at) : '—'}</td>
                  <td className="px-3 py-2">
                    {ch ? <span className={STATUS[ch.last_status].tone}>{STATUS[ch.last_status].label}</span> : <span className="text-gray">Nunca</span>}
                    {pendingIds.has(c.id) && <span className="ml-2 rounded-full bg-cyan/15 px-2 py-0.5 text-xs text-cyan">propuesta</span>}
                    {ch?.last_error && <p className="mt-0.5 max-w-[280px] text-xs text-gray">{ch.last_error}</p>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button className="btn btn-quiet btn-sm" onClick={() => checkOne(c)} disabled={!!busy}>{busy === `check:${c.id}` ? 'Leyendo…' : 'Revisar link'}</button>
                    <button className="btn btn-quiet btn-sm" onClick={() => onEdit(c)} disabled={!!busy}>Editar</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length > 100 && <p className="border-t border-line px-3 py-2 text-xs text-gray">Mostrando 100 de {num(rows.length)}. Usa la búsqueda para encontrar otros.</p>}
        {!rows.length && <p className="px-3 py-4 text-sm text-gray">Sin resultados.</p>}
      </div>

      {data && data.recent.length > 0 && (
        <>
          <h2 className="mt-10 text-lg text-white">Historial</h2>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line text-sm">
            {data.recent.map((u) => (
              <li key={u.id} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                <span className="text-white">{u.course_name}</span>
                <span className="text-gray">{u.status === 'aplicada' ? 'Aplicada' : 'Descartada'} · {u.decided_at ? when(u.decided_at) : '—'}{u.note ? ` · ${u.note}` : ''}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {data && data.runs.length > 0 && (
        <>
          <h2 className="mt-10 text-lg text-white">Ejecuciones</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-midnight text-xs text-gray">
                <tr><th className="px-3 py-2">Inicio</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2 text-right">Revisados</th><th className="px-3 py-2 text-right">Cambios</th><th className="px-3 py-2 text-right">Errores</th><th className="px-3 py-2 text-right">Consultas IA</th><th className="px-3 py-2 text-right">Fichas</th></tr>
              </thead>
              <tbody className="tnum">
                {data.runs.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="px-3 py-2 text-gray">{when(r.started_at)}{!r.finished_at && ' (en curso)'}</td>
                    <td className="px-3 py-2 text-gray">{r.trigger === 'cron' ? 'Automática' : r.trigger === 'programa' ? 'Un programa' : 'Lote manual'}</td>
                    <td className="px-3 py-2 text-right text-white">{r.checked}</td>
                    <td className="px-3 py-2 text-right text-cyan">{r.changed}</td>
                    <td className="px-3 py-2 text-right text-neg">{r.errors}</td>
                    <td className="px-3 py-2 text-right text-white">{r.ai_calls}</td>
                    <td className="px-3 py-2 text-right text-white">{num(r.input_tokens + r.output_tokens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function UpdateCard({ update: u, course, busy, onApply, onDiscard, onEdit, onCheck }: {
  update: ProgramUpdate;
  course: Course | undefined;
  busy: string | null;
  onApply: (u: ProgramUpdate, fields: string[]) => void;
  onDiscard: (u: ProgramUpdate) => void;
  onEdit: (c: Course) => void;
  onCheck: (c: Course) => void;
}) {
  const [selected, setSelected] = useState(() => new Set(u.changes.map((c) => c.field)));
  const toggle = (field: string) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(field)) next.delete(field);
    else next.add(field);
    return next;
  });
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-white">{u.course_name}</p>
          <p className="mt-0.5 text-xs text-gray">
            Detectado {when(u.detected_at)} · {u.method === 'ia' ? `IA (${num(u.input_tokens + u.output_tokens)} fichas)` : 'cambio en la página'}
            {u.source_url && <> · <a href={u.source_url} target="_blank" rel="noreferrer" className="text-cyan hover:underline">ver página <Icon name="external" size={11} className="inline" /></a></>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {u.changes.length > 0 && (
            <button className="btn btn-accent btn-sm" disabled={!!busy || !selected.size} onClick={() => onApply(u, [...selected])}>
              <Icon name="check" size={14} /> {busy === `apply:${u.id}` ? 'Aplicando…' : `Aplicar ${selected.size === u.changes.length ? 'todo' : `${selected.size} campos`}`}
            </button>
          )}
          {course && <button className="btn btn-quiet btn-sm" disabled={!!busy} onClick={() => onEdit(course)}>Editar a mano</button>}
          {course && u.method === 'huella' && <button className="btn btn-quiet btn-sm" disabled={!!busy} onClick={() => onCheck(course)}>Revisar con IA</button>}
          <button className="btn btn-quiet btn-sm text-gray" disabled={!!busy} onClick={() => onDiscard(u)}>Descartar</button>
        </div>
      </div>
      {u.note && <p className="mt-2 text-sm text-warn">{u.note}</p>}
      {u.changes.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-xs text-gray"><tr><th className="w-8 py-1" /><th className="py-1">Campo</th><th className="py-1">Actual</th><th className="py-1">En la página</th></tr></thead>
            <tbody>
              {u.changes.map((c) => (
                <tr key={c.field} className="border-t border-line">
                  <td className="py-1.5"><input type="checkbox" checked={selected.has(c.field)} onChange={() => toggle(c.field)} aria-label={`Aplicar ${c.label}`} className="accent-violet" /></td>
                  <td className="py-1.5 text-gray">{c.label}</td>
                  <td className="py-1.5 text-gray line-through decoration-gray/50">{show(c.current)}</td>
                  <td className="py-1.5 text-white">{show(c.proposed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
