import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Category, Institution, Modality, ProgramType } from '../../types';
import {
  addLinks, discardDraft, fetchDrafts, processDrafts, publishDrafts, retryDraft, updateDraft,
  AdminApiError, type DraftData, type ProgramDraft
} from '../../services/adminApi';
import { LEVEL_LABELS, MODALITY_LABELS, PROGRAM_TYPE_LABELS } from '../../utils/labels';
import { formatMoney } from '../../utils/format';
import { TypeBadge } from '../course/TypeBadge';
import { Icon } from '../ui/Icon';
import { NullableText, NumberInput, Select, TextArea, TextInput } from './fields';

type View = 'listos' | 'cola' | 'errores' | 'historial';
const when = (iso: string) => new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const opts = <T extends string>(labels: Record<T, string>) => (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));

/**
 * Alta de programas a partir de links: se pegan los links (uno por programa), la IA lee cada página y arma
 * un borrador; aquí se revisan, corrigen y publican. Los que no se pueden leer se agregan a mano.
 */
export function AddProgramsPanel({ institutions, categories, onError, onNotice, onPublished, onManual }: {
  institutions: Institution[];
  categories: Category[];
  onError: (e: unknown) => void;
  onNotice: (text: string) => void;
  onPublished: () => Promise<void> | void;
  onManual: (url: string, institutionId: string | null) => void;
}) {
  const [drafts, setDrafts] = useState<ProgramDraft[]>([]);
  const [recent, setRecent] = useState<ProgramDraft[]>([]);
  const [ai, setAi] = useState<{ configured: boolean; model: string } | null>(null);
  const [links, setLinks] = useState('');
  const [institution, setInstitution] = useState('');
  const [skipped, setSkipped] = useState<{ url: string; reason: string }[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useState<View>('listos');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState<number | null>(null);
  const stop = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetchDrafts();
      setDrafts(res.drafts);
      setRecent(res.recent);
      setAi(res.ai);
      return res.drafts;
    } catch (e) {
      onError(e);
      return null;
    }
  }, [onError]);
  useEffect(() => {
    void load();
    return () => { stop.current = true; };
  }, [load]);

  const instName = useMemo(() => new Map(institutions.map((i) => [i.id, i.name])), [institutions]);
  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const groups = useMemo(() => ({
    listos: drafts.filter((d) => d.status === 'listo'),
    cola: drafts.filter((d) => d.status === 'en_cola' || d.status === 'procesando'),
    errores: drafts.filter((d) => d.status === 'error'),
    historial: recent
  }), [drafts, recent]);

  /** Lee los links en cola en tandas hasta terminar (cada tanda ~1 minuto). */
  const runQueue = useCallback(async (total: number) => {
    setBusy('process');
    setProgress({ done: 0, total });
    stop.current = false;
    let done = 0;
    try {
      for (let round = 0; round < 40 && !stop.current; round++) {
        const r = await processDrafts();
        done += r.processed;
        setProgress({ done, total: Math.max(total, done + r.remaining) });
        await load();
        if (r.remaining === 0 || r.processed === 0) break;
      }
    } catch (e) {
      if (!(e instanceof AdminApiError && e.status >= 500)) onError(e);
      else onNotice('La lectura se interrumpió; los links pendientes siguen en cola. Pulsa "Leer pendientes" para continuar.');
    } finally {
      setBusy(null);
      setProgress(null);
      await load();
    }
  }, [load, onError, onNotice]);

  const submit = async () => {
    setBusy('add');
    setSkipped([]);
    try {
      const res = await addLinks(links, institution || null);
      setSkipped(res.skipped);
      if (res.added) {
        setLinks('');
        setView('listos');
        await load();
        await runQueue(res.added);
        onNotice(`Se leyeron ${res.added} links. Revisa los borradores listos y publícalos.`);
      } else {
        onNotice('No se agregaron links nuevos (revisa el detalle debajo del formulario).');
        setBusy(null);
      }
    } catch (e) {
      onError(e);
      setBusy(null);
    }
  };

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      await load();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(null);
    }
  };

  const publish = (ids: number[], status: 'publicado' | 'borrador') => act('publish', async () => {
    const res = await publishDrafts(ids, status);
    setSelected(new Set());
    setOpen(null);
    await onPublished();
    onNotice(`${res.published} ${res.published === 1 ? 'programa agregado' : 'programas agregados'} ${status === 'publicado' ? 'y publicados en el sitio (se verán en ~1 minuto)' : 'como borrador (no visibles en el sitio)'}.${res.skipped.length ? ` ${res.skipped.length} no se publicaron: ${res.skipped.map((s) => s.reason).join(' ')}` : ''}`);
  });

  const ready = groups.listos;
  const selectable = ready.filter((d) => d.institution_id);
  const allSelected = selectable.length > 0 && selectable.every((d) => selected.has(d.id));
  const lines = links.split(/[\s,;]+/).filter((l) => /^https?:\/\//i.test(l)).length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-white">Agregar programas</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray">Pega los links de los programas (uno por línea). Se lee cada página y se arma un borrador con nombre, tipo, área, precio, duración, inicio, temario y más. Revisa, corrige lo que falte y publica.</p>
        </div>
        <button className="btn btn-quiet btn-sm" onClick={() => void load()} disabled={!!busy}>Actualizar</button>
      </div>

      {ai && !ai.configured && (
        <div className="mt-5 rounded-xl border border-warn/40 bg-warn/5 p-3 text-sm text-white">
          <Icon name="alert" size={15} className="mr-1.5 inline text-warn" />
          Falta configurar <span className="font-mono">ANTHROPIC_API_KEY</span> en Vercel: sin ella los links quedan en cola y no se pueden leer. Mientras tanto puedes agregar programas a mano.
        </div>
      )}

      <section className="card mt-6 p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div>
            <label htmlFor="links" className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted">Links de programas</label>
            <textarea id="links" rows={5} className="input py-2 font-mono text-xs" value={links} onChange={(e) => setLinks(e.target.value)}
              placeholder={'https://institucion.edu.pe/programas/analitica-de-datos\nhttps://institucion.edu.pe/cursos/power-bi'} />
            <p className="mt-1 text-xs text-dim">Hasta 200 por vez. Se ignoran duplicados y programas que ya están en el catálogo.</p>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <label htmlFor="inst" className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted">Institución</label>
              <select id="inst" className="input min-h-10 cursor-pointer py-2 text-sm" value={institution} onChange={(e) => setInstitution(e.target.value)}>
                <option value="">Detectar por el dominio</option>
                {institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              <p className="mt-1 text-xs text-dim">Si es nueva, créala antes en Instituciones.</p>
            </div>
            <button className="btn btn-accent mt-auto" disabled={!!busy || !lines} onClick={() => void submit()}>
              <Icon name="sparkle" size={16} /> {busy === 'add' ? 'Agregando…' : `Leer ${lines || ''} ${lines === 1 ? 'link' : 'links'}`}
            </button>
          </div>
        </div>
        {progress && (
          <div className="mt-4" role="status">
            <div className="flex items-center justify-between text-sm text-gray">
              <span>Leyendo páginas… {progress.done} de {progress.total}</span>
              <button className="text-xs text-muted hover:text-white" onClick={() => { stop.current = true; }}>Pausar</button>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-raise"><div className="h-full rounded-full bg-cyan transition-all" style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }} /></div>
          </div>
        )}
        {skipped.length > 0 && (
          <ul className="mt-4 space-y-1 text-xs text-gray">
            {skipped.map((s, i) => <li key={i}><span className="text-warn">Omitido:</span> {s.url && <span className="font-mono">{s.url}</span>} — {s.reason}</li>)}
          </ul>
        )}
      </section>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        {([['listos', 'Listos para revisar'], ['cola', 'En cola'], ['errores', 'No se pudieron leer'], ['historial', 'Historial']] as [View, string][]).map(([v, label]) => (
          <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={`rounded-full px-3 py-1.5 text-sm ${view === v ? 'bg-raise text-white' : 'text-gray hover:text-white'}`}>
            {label} <span className={`tnum ${v === 'listos' && groups.listos.length ? 'text-cyan' : v === 'errores' && groups.errores.length ? 'text-warn' : 'text-muted'}`}>({groups[v].length})</span>
          </button>
        ))}
        {groups.cola.length > 0 && !busy && <button className="btn btn-quiet btn-sm ml-auto" onClick={() => void runQueue(groups.cola.length)}>Leer pendientes ({groups.cola.length})</button>}
      </div>

      {view === 'listos' && (
        <section className="mt-4">
          {!ready.length ? <p className="text-sm text-gray">No hay borradores por revisar.</p> : (
            <>
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-midnight px-3 py-2">
                <label className="flex items-center gap-2 text-sm text-gray">
                  <input type="checkbox" className="accent-violet" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(selectable.map((d) => d.id)))} /> Seleccionar todos
                </label>
                <span className="text-sm text-muted">{selected.size} seleccionados</span>
                <div className="ml-auto flex gap-2">
                  <button className="btn btn-quiet btn-sm" disabled={!selected.size || !!busy} onClick={() => publish([...selected], 'borrador')}>Agregar como borrador</button>
                  <button className="btn btn-accent btn-sm" disabled={!selected.size || !!busy} onClick={() => publish([...selected], 'publicado')}>
                    <Icon name="check" size={14} /> {busy === 'publish' ? 'Publicando…' : 'Publicar seleccionados'}
                  </button>
                </div>
              </div>
              <ul className="mt-3 space-y-2">
                {ready.map((d) => (
                  <li key={d.id} className="card overflow-hidden">
                    <div className="flex flex-wrap items-center gap-3 p-3">
                      <input type="checkbox" className="accent-violet" aria-label={`Seleccionar ${d.data?.name}`} disabled={!d.institution_id} checked={selected.has(d.id)}
                        onChange={() => setSelected((s) => { const n = new Set(s); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n; })} />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-white">
                          {d.data?.name || <span className="text-warn">Sin nombre</span>}
                          {d.data && <TypeBadge type={d.data.program_type as ProgramType} />}
                        </p>
                        <p className="mt-0.5 text-xs text-gray">
                          {d.institution_id ? instName.get(d.institution_id) : <span className="text-warn">Elige la institución{d.data?.institution_name ? ` (la página dice “${d.data.institution_name}”)` : ''}</span>}
                          {' · '}{catName.get(d.data?.category ?? '') ?? '—'}
                          {' · '}{d.data?.price != null ? formatMoney(d.data.discount_price ?? d.data.price, d.data.currency) : 'sin precio'}
                          {' · '}<a href={d.url} target="_blank" rel="noreferrer" className="text-blue-soft hover:text-white">ver página <Icon name="external" size={11} className="inline" /></a>
                        </p>
                        {d.missing.length > 0 && <p className="mt-1 flex flex-wrap gap-1">{d.missing.map((m) => <span key={m} className="rounded-full border border-warn/30 px-2 py-0.5 text-[11px] text-warn">Falta {m.toLowerCase()}</span>)}</p>}
                      </div>
                      <div className="flex gap-2">
                        <button className="btn btn-quiet btn-sm" onClick={() => setOpen(open === d.id ? null : d.id)}>{open === d.id ? 'Cerrar' : 'Revisar'}</button>
                        <button className="btn btn-quiet btn-sm text-gray" disabled={!!busy} onClick={() => void act(`discard:${d.id}`, () => discardDraft(d.id))}>Descartar</button>
                      </div>
                    </div>
                    {open === d.id && d.data && (
                      <DraftEditor draft={d} institutions={institutions} categories={categories} busy={!!busy}
                        onSave={(patch) => act(`save:${d.id}`, async () => { await updateDraft(d.id, patch); onNotice('Borrador actualizado.'); })}
                        onPublish={() => publish([d.id], 'publicado')} />
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {view === 'cola' && (
        <ul className="mt-4 space-y-1 text-sm">
          {!groups.cola.length ? <li className="text-gray">No hay links en cola.</li> : groups.cola.map((d) => (
            <li key={d.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${d.status === 'procesando' ? 'animate-pulse bg-cyan' : 'bg-gray'}`} />
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-gray">{d.url}</span>
              <span className="text-xs text-muted">{d.status === 'procesando' ? 'Leyendo…' : 'En cola'}</span>
            </li>
          ))}
        </ul>
      )}

      {view === 'errores' && (
        <ul className="mt-4 space-y-2">
          {!groups.errores.length ? <li className="text-sm text-gray">Sin errores.</li> : groups.errores.map((d) => (
            <li key={d.id} className="card flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <a href={d.url} target="_blank" rel="noreferrer" className="block truncate font-mono text-xs text-gray hover:text-cyan">{d.url}</a>
                <p className="mt-0.5 text-sm text-warn">{d.error}</p>
              </div>
              <button className="btn btn-quiet btn-sm" disabled={!!busy} onClick={() => void act(`retry:${d.id}`, async () => { await retryDraft(d.id); await processDrafts([d.id]); })}>{busy === `retry:${d.id}` ? 'Leyendo…' : 'Reintentar'}</button>
              <button className="btn btn-quiet btn-sm" onClick={() => onManual(d.url, d.institution_id)}>Agregar a mano</button>
              <button className="btn btn-quiet btn-sm text-gray" disabled={!!busy} onClick={() => void act(`discard:${d.id}`, () => discardDraft(d.id))}>Descartar</button>
            </li>
          ))}
        </ul>
      )}

      {view === 'historial' && (
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line text-sm">
          {!recent.length ? <li className="p-3 text-gray">Aún no hay altas.</li> : recent.map((d) => (
            <li key={d.id} className="flex flex-wrap justify-between gap-2 px-3 py-2">
              <span className="min-w-0 truncate text-white">{d.data?.name ?? d.url}</span>
              <span className="text-gray">{d.status === 'publicado' ? `Agregado (${d.course_id})` : 'Descartado'} · {when(d.updated_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Corrección rápida de los datos clave antes de publicar. El resto se edita luego en el editor completo. */
function DraftEditor({ draft, institutions, categories, busy, onSave, onPublish }: {
  draft: ProgramDraft;
  institutions: Institution[];
  categories: Category[];
  busy: boolean;
  onSave: (patch: { data: Partial<DraftData>; institution_id: string | null }) => Promise<void> | void;
  onPublish: () => void;
}) {
  const [d, setD] = useState<DraftData>(draft.data!);
  const [inst, setInst] = useState<string | null>(draft.institution_id);
  const set = <K extends keyof DraftData>(k: K, v: DraftData[K]) => setD((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(d) !== JSON.stringify(draft.data) || inst !== draft.institution_id;
  return (
    <div className="border-t border-line bg-midnight/50 p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TextInput title="Nombre" value={d.name} onChange={(v) => set('name', v)} className="sm:col-span-2" required />
        <Select title="Institución" value={inst} options={institutions.map((i) => ({ value: i.id, label: i.name }))} onChange={setInst} allowEmpty emptyLabel="Elegir…" />
        <Select title="Área" value={d.category} options={categories.map((c) => ({ value: c.id, label: c.name }))} onChange={(v) => set('category', v ?? d.category)} />
        <Select title="Tipo" value={d.program_type as ProgramType} options={opts(PROGRAM_TYPE_LABELS)} onChange={(v) => set('program_type', v ?? d.program_type)} />
        <Select title="Modalidad" value={d.modality as Modality | null} options={opts(MODALITY_LABELS)} onChange={(v) => set('modality', v)} allowEmpty />
        <Select title="Nivel" value={d.level as keyof typeof LEVEL_LABELS | null} options={opts(LEVEL_LABELS)} onChange={(v) => set('level', v)} allowEmpty emptyLabel="No indicado" />
        <Select title="Moneda" value={d.currency} options={[{ value: 'PEN', label: 'Soles (S/)' }, { value: 'USD', label: 'Dólares (US$)' }]} onChange={(v) => set('currency', v ?? 'PEN')} />
        <NumberInput title="Precio regular" value={d.price} onChange={(v) => set('price', v)} />
        <NumberInput title="Precio promocional" value={d.discount_price} onChange={(v) => set('discount_price', v)} />
        <NumberInput title="Horas" value={d.duration_hours} onChange={(v) => set('duration_hours', v)} step="1" />
        <NullableText title="Duración (texto)" value={d.duration_text} onChange={(v) => set('duration_text', v)} />
        <TextInput title="Fecha de inicio" type="date" value={d.start_date} onChange={(v) => set('start_date', v || null)} />
        <NullableText title="Inicio (texto)" value={d.start_text} onChange={(v) => set('start_text', v)} />
        <NullableText title="Horario" value={d.schedule} onChange={(v) => set('schedule', v)} className="sm:col-span-2" />
        <TextArea title="Descripción corta" value={d.short_description} onChange={(v) => set('short_description', v)} rows={2} className="sm:col-span-2 lg:col-span-4" />
      </div>
      <p className="mt-3 text-xs text-dim">
        Temario: {d.syllabus.length} módulos · Objetivos: {d.objectives.length} · Herramientas: {d.tools.join(', ') || '—'}{d.certificate ? ` · Certificado: ${d.certificate.description || d.certificate.type}` : ''}. Se pueden editar después en el editor del programa.
      </p>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button className="btn btn-quiet btn-sm" disabled={busy || !dirty} onClick={() => void onSave({ data: d, institution_id: inst })}>Guardar cambios</button>
        <button className="btn btn-accent btn-sm" disabled={busy || dirty || !draft.institution_id} title={dirty ? 'Guarda los cambios antes de publicar' : !draft.institution_id ? 'Elige la institución' : undefined} onClick={onPublish}>Publicar este programa</button>
      </div>
    </div>
  );
}
