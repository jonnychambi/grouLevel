import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import type { CourseStatus } from '../../types';
import type { AdminCatalog } from '../../services/adminApi';
import { applyImportPlan, planImport, rowsToRecords, type Cell, type ExcelRecord, type ImportMode, type ImportOptions } from '../../utils/excelImport';
import { effectivePrice, formatMoney } from '../../utils/format';
import { PROGRAM_TYPE_LABELS } from '../../utils/labels';
import { InstitutionLogo } from '../institution/InstitutionLogo';
import { Icon } from '../ui/Icon';

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_ROWS = 5000;
type View = 'nuevos' | 'actualizaciones' | 'descartados' | 'protegidos' | 'instituciones';

interface Props {
  catalog: AdminCatalog;
  saving: boolean;
  onImport: (next: AdminCatalog, note: string, message: string) => Promise<boolean>;
}

/** Importación masiva desde Excel con vista previa: nada se guarda hasta confirmar. */
export function ImportPanel({ catalog, saving, onImport }: Props) {
  const [fileName, setFileName] = useState('');
  const [records, setRecords] = useState<ExcelRecord[] | null>(null);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [view, setView] = useState<View>('nuevos');
  const [opts, setOpts] = useState<Omit<ImportOptions, 'today'>>({ mode: 'nuevos-y-actualizar', newStatus: 'borrador', techOnly: true, overwriteManual: false });
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [updateIds, setUpdateIds] = useState<Set<string>>(new Set());
  const input = useRef<HTMLInputElement>(null);

  const plan = useMemo(
    () => (records ? planImport(records, catalog, { ...opts, today: new Date().toISOString().slice(0, 10) }) : null),
    [records, catalog, opts]
  );

  // Por defecto se selecciona todo lo propuesto.
  useEffect(() => {
    if (!plan) return;
    setNewIds(new Set(plan.newCourses.map((n) => n.course.id)));
    setUpdateIds(new Set(plan.updates.map((u) => u.after.id)));
  }, [plan]);

  const instName = useMemo(() => {
    const m = new Map(catalog.institutions.map((i) => [i.id, i]));
    plan?.newInstitutions.forEach((i) => m.set(i.id, i));
    return m;
  }, [catalog.institutions, plan]);
  const catName = useMemo(() => new Map(catalog.categories.map((c) => [c.id, c.name])), [catalog.categories]);

  const reset = () => {
    setRecords(null);
    setFileName('');
    setError('');
    if (input.current) input.current.value = '';
  };

  const read = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setRecords(null);
    setFileName(file.name);
    if (!/\.xlsx$/i.test(file.name)) return setError('El archivo debe ser un Excel .xlsx (puedes guardarlo así desde Excel o Google Sheets).');
    if (file.size > MAX_BYTES) return setError('El archivo supera los 15 MB.');
    setReading(true);
    try {
      const { default: readXlsxFile } = await import('read-excel-file/browser');
      const sheets = await readXlsxFile(file);
      const sheet = sheets.find((s) => s.sheet.trim().toUpperCase() === 'CURSOS') ?? sheets[0];
      if (!sheet) throw new Error('El archivo no tiene hojas.');
      const parsed = rowsToRecords(sheet.data as Cell[][]);
      if (parsed.missingColumns.length) {
        setError(`Faltan columnas obligatorias en la hoja «${sheet.sheet}»: ${parsed.missingColumns.join(', ')}. Usa la plantilla como referencia.`);
      } else if (!parsed.records.length) {
        setError('La hoja no tiene filas con programas.');
      } else if (parsed.records.length > MAX_ROWS) {
        setError(`El archivo tiene ${parsed.records.length} filas; el máximo por importación es ${MAX_ROWS}.`);
      } else {
        setRecords(parsed.records);
        setView('nuevos');
      }
    } catch (e) {
      setError(`No se pudo leer el archivo: ${e instanceof Error ? e.message : 'formato no reconocido'}.`);
    } finally {
      setReading(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void read(e.dataTransfer.files[0]);
  };

  const confirm = async () => {
    if (!plan) return;
    const result = applyImportPlan(catalog, plan, { newIds, updateIds });
    const parts = [
      result.added && `${result.added} programas nuevos`,
      result.updated && `${result.updated} actualizados`,
      result.institutionsAdded && `${result.institutionsAdded} instituciones nuevas`
    ].filter(Boolean);
    if (!window.confirm(`¿Importar ${parts.join(', ')} desde «${fileName}»? Se creará una nueva versión del catálogo (se puede restaurar la anterior).`)) return;
    const ok = await onImport(
      { courses: result.courses, institutions: result.institutions, categories: result.categories },
      `importacion excel ${result.added} nuevos ${result.updated} actualizados`,
      `Importación completada: ${parts.join(', ')}.${opts.newStatus === 'borrador' && result.added ? ' Los nuevos quedaron como borrador: revísalos y publícalos desde Programas.' : ''}`
    );
    if (ok) reset();
  };

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const n = new Set(set);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setter(n);
  };

  const count = { nuevos: plan?.newCourses.length ?? 0, actualizaciones: plan?.updates.length ?? 0, descartados: plan?.skipped.length ?? 0, protegidos: plan?.protectedManual.length ?? 0, instituciones: plan?.newInstitutions.length ?? 0 };
  const selectedTotal = newIds.size + updateIds.size;
  const chk = 'h-4 w-4 accent-[#00E7FF]';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-white">Importar programas desde Excel</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray">
            Sube un .xlsx con la plantilla de Groulevel (o el formato completo del relevamiento). Verás qué se agrega, qué cambia y qué se descarta antes de guardar.
          </p>
        </div>
        <a href={`${import.meta.env.BASE_URL}plantilla-programas-groulevel.xlsx`} download className="btn btn-ghost btn-sm">
          <Icon name="book" size={15} /> Descargar plantilla
        </a>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${dragging ? 'border-cyan bg-cyan/5' : 'border-line-strong hover:border-gray/50'}`}
        >
          <input ref={input} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(e) => void read(e.target.files?.[0])} />
          <Icon name="plus" size={26} className="text-cyan" />
          {reading ? (
            <span className="text-white">Leyendo «{fileName}»…</span>
          ) : fileName && records ? (
            <>
              <span className="font-medium text-white">{fileName}</span>
              <span className="text-sm text-gray">{records.length} filas leídas · haz clic para elegir otro archivo</span>
            </>
          ) : (
            <>
              <span className="font-medium text-white">Arrastra tu Excel aquí o haz clic para elegirlo</span>
              <span className="text-sm text-muted">Formato .xlsx · hoja «CURSOS» · máx. 15 MB</span>
            </>
          )}
        </label>

        <fieldset className="space-y-3 rounded-2xl border border-line bg-navy/40 p-4 text-sm">
          <legend className="px-1 font-semibold text-white">Opciones</legend>
          <div role="radiogroup" aria-label="Modo de importación" className="space-y-2">
            {([['nuevos-y-actualizar', 'Agregar nuevos y actualizar existentes', 'Los existentes se reconocen por su URL. Las celdas vacías no borran datos.'], ['nuevos', 'Solo agregar programas nuevos', 'Los que ya existen no se tocan.']] as [ImportMode, string, string][]).map(([v, l, h]) => (
              <label key={v} className="flex cursor-pointer gap-2.5">
                <input type="radio" name="mode" checked={opts.mode === v} onChange={() => setOpts({ ...opts, mode: v })} className="mt-1 accent-[#00E7FF]" />
                <span><span className="text-white">{l}</span><span className="block text-xs text-muted">{h}</span></span>
              </label>
            ))}
          </div>
          <label className="flex items-center justify-between gap-3 border-t border-line pt-3">
            <span className="text-white">Estado de los programas nuevos</span>
            <select className="input min-h-9 w-52 py-1 text-sm" value={opts.newStatus} onChange={(e) => setOpts({ ...opts, newStatus: e.target.value as CourseStatus })}>
              <option value="borrador">Borrador (revisar antes)</option>
              <option value="publicado">Publicado</option>
            </select>
          </label>
          <label className="flex cursor-pointer gap-2.5">
            <input type="checkbox" checked={opts.techOnly} onChange={(e) => setOpts({ ...opts, techOnly: e.target.checked })} className={`mt-0.5 ${chk}`} />
            <span><span className="text-white">Solo áreas tecnológicas</span><span className="block text-xs text-muted">Descarta finanzas, energía, derecho, etc. (área “Otro”).</span></span>
          </label>
          {opts.mode === 'nuevos-y-actualizar' && (
            <label className="flex cursor-pointer gap-2.5">
              <input type="checkbox" checked={opts.overwriteManual} onChange={(e) => setOpts({ ...opts, overwriteManual: e.target.checked })} className={`mt-0.5 ${chk}`} />
              <span><span className="text-white">Actualizar también los editados a mano</span><span className="block text-xs text-muted">Por defecto se respetan los cambios hechos en este panel.</span></span>
            </label>
          )}
        </fieldset>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-neg/40 bg-neg/10 p-3 text-sm text-white">
          <Icon name="alert" className="mt-0.5 shrink-0 text-neg" />{error}
        </div>
      )}

      {plan && (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ['Filas leídas', plan.totalRows, ''],
              ['Nuevos', count.nuevos, 'text-pos'],
              ['Actualizaciones', count.actualizaciones, 'text-cyan'],
              ['Sin cambios', plan.unchanged.length, ''],
              ['Protegidos', count.protegidos, 'text-violet-soft'],
              ['Descartados', count.descartados, 'text-warn']
            ].map(([k, v, tone]) => (
              <div key={k as string} className="card p-4">
                <dt className="label-mono text-[10px]">{k}</dt>
                <dd className={`tnum mt-1 text-2xl font-semibold ${tone || 'text-white'}`}>{v}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap gap-1 border-b border-line" role="tablist">
            {(['nuevos', 'actualizaciones', 'protegidos', 'descartados', 'instituciones'] as View[]).map((v) => (
              <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`-mb-px border-b-2 px-3 py-2 text-sm capitalize ${view === v ? 'border-cyan text-white' : 'border-transparent text-gray hover:text-white'}`}>
                {v === 'instituciones' ? 'Instituciones nuevas' : v} <span className="tnum text-muted">({count[v]})</span>
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-line">
            {view === 'nuevos' && (
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-midnight text-xs uppercase tracking-[0.08em] text-muted">
                  <tr>
                    <th className="w-10 p-3"><input type="checkbox" aria-label="Seleccionar todos los nuevos" className={chk} checked={count.nuevos > 0 && newIds.size === count.nuevos} onChange={(e) => setNewIds(e.target.checked ? new Set(plan.newCourses.map((n) => n.course.id)) : new Set())} /></th>
                    <th className="p-3 font-medium">Programa</th><th className="p-3 font-medium">Tipo</th><th className="p-3 font-medium">Categoría</th><th className="p-3 font-medium">Precio</th><th className="p-3 font-medium">Datos</th><th className="p-3 font-medium">Fila</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.newCourses.map(({ course, row, institutionIsNew }) => {
                    const inst = instName.get(course.institution_id);
                    const p = effectivePrice(course);
                    return (
                      <tr key={course.id} className="border-t border-line">
                        <td className="p-3"><input type="checkbox" aria-label={`Importar ${course.name}`} className={chk} checked={newIds.has(course.id)} onChange={() => toggle(newIds, course.id, setNewIds)} /></td>
                        <td className="max-w-[320px] p-3">
                          <span className="flex items-center gap-2.5">
                            {inst && <InstitutionLogo institution={inst} size={26} />}
                            <span className="min-w-0">
                              <span className="block truncate text-white">{course.name}</span>
                              <span className="block truncate text-xs text-muted">{inst?.name}{institutionIsNew && <span className="ml-1.5 text-pos">· institución nueva</span>}</span>
                            </span>
                          </span>
                        </td>
                        <td className="p-3 text-gray">{PROGRAM_TYPE_LABELS[course.program_type]}</td>
                        <td className="p-3 text-gray">{catName.get(course.category)}</td>
                        <td className="tnum p-3 text-gray">{p == null ? '—' : p === 0 ? 'Gratis' : formatMoney(p, course.currency)}</td>
                        <td className="tnum p-3 text-gray">{Math.round(course.completeness * 100)}%</td>
                        <td className="tnum p-3 text-muted">{row}</td>
                      </tr>
                    );
                  })}
                  {!count.nuevos && <tr><td colSpan={7} className="p-6 text-center text-gray">No hay programas nuevos en este archivo.</td></tr>}
                </tbody>
              </table>
            )}

            {view === 'actualizaciones' && (
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-midnight text-xs uppercase tracking-[0.08em] text-muted">
                  <tr>
                    <th className="w-10 p-3"><input type="checkbox" aria-label="Seleccionar todas las actualizaciones" className={chk} checked={count.actualizaciones > 0 && updateIds.size === count.actualizaciones} onChange={(e) => setUpdateIds(e.target.checked ? new Set(plan.updates.map((u) => u.after.id)) : new Set())} /></th>
                    <th className="p-3 font-medium">Programa</th><th className="p-3 font-medium">Cambios</th><th className="p-3 font-medium">Fila</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.updates.map(({ before, after, changes, row }) => (
                    <tr key={after.id} className="border-t border-line align-top">
                      <td className="p-3"><input type="checkbox" aria-label={`Actualizar ${before.name}`} className={chk} checked={updateIds.has(after.id)} onChange={() => toggle(updateIds, after.id, setUpdateIds)} /></td>
                      <td className="max-w-[280px] p-3"><span className="block text-white">{before.name}</span><span className="block text-xs text-muted">{instName.get(before.institution_id)?.name} · {before.id}</span></td>
                      <td className="p-3">
                        <ul className="flex flex-wrap gap-1.5">
                          {changes.map((c) => (
                            <li key={c.field} className="max-w-[340px] rounded-md border border-line px-2 py-0.5 text-xs text-gray" title={`${c.before} → ${c.after}`}>
                              <span className="text-white">{c.label}:</span> <span className="line-through decoration-neg/60">{c.before.slice(0, 40)}</span> → <span className="text-cyan">{c.after.slice(0, 40)}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="tnum p-3 text-muted">{row}</td>
                    </tr>
                  ))}
                  {!count.actualizaciones && <tr><td colSpan={4} className="p-6 text-center text-gray">{opts.mode === 'nuevos' ? 'Modo “solo nuevos”: los existentes no se actualizan.' : 'Ningún programa existente tiene cambios.'}</td></tr>}
                </tbody>
              </table>
            )}

            {view === 'protegidos' && (
              <ul className="divide-y divide-line text-sm">
                <li className="bg-midnight p-3 text-xs text-muted">Estos programas fueron editados a mano en el panel y no se actualizarán. Activa “Actualizar también los editados a mano” para incluirlos.</li>
                {plan.protectedManual.map(({ course, row }) => <li key={course.id} className="flex justify-between gap-3 p-3"><span className="text-white">{course.name}</span><span className="tnum text-muted">Fila {row}</span></li>)}
                {!count.protegidos && <li className="p-6 text-center text-gray">Ninguno.</li>}
              </ul>
            )}

            {view === 'descartados' && (
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-midnight text-xs uppercase tracking-[0.08em] text-muted"><tr><th className="p-3 font-medium">Fila</th><th className="p-3 font-medium">Programa</th><th className="p-3 font-medium">Institución</th><th className="p-3 font-medium">Motivo</th></tr></thead>
                <tbody>
                  {plan.skipped.map((s) => (
                    <tr key={`${s.row}-${s.name}`} className="border-t border-line">
                      <td className="tnum p-3 text-muted">{s.row}</td><td className="p-3 text-white">{s.name}</td><td className="p-3 text-gray">{s.institution}</td><td className="p-3 text-warn">{s.reason}</td>
                    </tr>
                  ))}
                  {!count.descartados && <tr><td colSpan={4} className="p-6 text-center text-gray">No se descartó ninguna fila.</td></tr>}
                </tbody>
              </table>
            )}

            {view === 'instituciones' && (
              <ul className="divide-y divide-line text-sm">
                <li className="bg-midnight p-3 text-xs text-muted">Se crearán solo si importas al menos un programa suyo. Luego puedes completar su descripción, web y logo en Instituciones.</li>
                {plan.newInstitutions.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 p-3">
                    <InstitutionLogo institution={i} size={32} />
                    <span className="flex-1"><span className="block text-white">{i.name}</span><span className="block text-xs text-muted">{i.type} · {i.country} · {i.website || 'sin web'}</span></span>
                  </li>
                ))}
                {!count.instituciones && <li className="p-6 text-center text-gray">Todas las instituciones del archivo ya existen.</li>}
              </ul>
            )}
          </div>

          <div className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-navy/95 p-3 backdrop-blur">
            <p className="flex-1 text-sm text-gray">
              Seleccionados: <span className="text-white">{newIds.size} nuevos</span> · <span className="text-white">{updateIds.size} actualizaciones</span>
            </p>
            <button className="btn btn-ghost btn-sm" onClick={reset} disabled={saving}>Descartar archivo</button>
            <button className="btn btn-accent btn-sm" onClick={() => void confirm()} disabled={saving || selectedTotal === 0}>
              {saving ? 'Importando…' : `Importar ${selectedTotal} ${selectedTotal === 1 ? 'cambio' : 'cambios'}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
