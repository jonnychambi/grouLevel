import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CourseEditor, emptyCourse, STATUS_LABELS } from '../components/admin/CourseEditor';
import { emptyInstitution, InstitutionEditor } from '../components/admin/InstitutionEditor';
import { ImportPanel } from '../components/admin/ImportPanel';
import { LeadsPanel } from '../components/admin/LeadsPanel';
import { ReviewsPanel } from '../components/admin/ReviewsPanel';
import { InstitutionLogo } from '../components/institution/InstitutionLogo';
import { Icon } from '../components/ui/Icon';
import { Logo } from '../components/ui/Logo';
import { useSeo } from '../hooks/useSeo';
import {
  AdminApiError, fetchCatalog, fetchVersions, getSession, loadBundledCatalog, login, logout, restoreVersion, saveCatalog,
  type AdminCatalog, type VersionInfo
} from '../services/adminApi';
import type { Course, CourseStatus, Institution } from '../types';
import { completeness } from '../utils/completeness';
import { effectivePrice, formatDate, formatMoney } from '../utils/format';
import { PROGRAM_TYPE_LABELS } from '../utils/labels';
import { normalize } from '../utils/text';

type Tab = 'programas' | 'leads' | 'reseñas' | 'instituciones' | 'importar' | 'versiones';
type Editing = { kind: 'course'; course: Course; isNew: boolean } | { kind: 'institution'; institution: Institution; isNew: boolean } | null;
type Notice = { tone: 'ok' | 'error' | 'info'; text: string; details?: string[] } | null;

const PAGE = 30;
const STATUS_TONE: Record<CourseStatus, string> = { publicado: 'text-pos border-pos/40', borrador: 'text-warn border-warn/40', oculto: 'text-gray border-line-strong' };

/* ------------------------------------------------------------------ Login */

function LoginForm({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(password);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo ingresar.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-6">
        <Logo size={22} />
        <h1 className="mt-6 text-2xl text-white">Administración</h1>
        <p className="mt-1 text-sm text-gray">Gestiona los programas e instituciones publicados en Groulevel.</p>
        <label htmlFor="admin-pass" className="mt-6 block text-sm font-medium text-white">Contraseña</label>
        <input id="admin-pass" type="password" autoComplete="current-password" className="input mt-1.5" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus aria-invalid={!!error} aria-describedby={error ? 'admin-pass-e' : undefined} />
        {error && <p id="admin-pass-e" role="alert" className="mt-2 text-sm text-neg">{error}</p>}
        <button className="btn btn-accent mt-5 w-full" disabled={busy || !password}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
        <Link to="/" className="mt-4 block text-center text-sm text-muted hover:text-white">Volver al sitio</Link>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------- Admin page */

export default function AdminPage() {
  useSeo({ title: 'Administración', noindex: true });
  const [authed, setAuthed] = useState(() => !!getSession());
  const [catalog, setCatalog] = useState<AdminCatalog | null>(null);
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [tab, setTab] = useState<Tab>('programas');
  const [editing, setEditing] = useState<Editing>(null);

  const handleError = useCallback((e: unknown) => {
    if (e instanceof AdminApiError && e.status === 401) setAuthed(false);
    setNotice({ tone: 'error', text: e instanceof Error ? e.message : 'Error inesperado.', details: e instanceof AdminApiError ? e.details : undefined });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchCatalog();
      setVersion(res.version);
      if (res.catalog) {
        setCatalog(res.catalog);
        setInitialized(true);
      } else {
        setCatalog(await loadBundledCatalog());
        setInitialized(false);
      }
    } catch (e) {
      handleError(e);
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  useEffect(() => {
    if (authed) void load();
  }, [authed, load]);

  /** Guarda el catálogo completo como una nueva versión (con control de conflictos). */
  const persist = async (next: AdminCatalog, note: string, okText: string) => {
    setSaving(true);
    setNotice(null);
    try {
      const res = await saveCatalog(next, version?.pathname ?? null, note);
      setCatalog(next);
      setVersion(res.version);
      setInitialized(true);
      setEditing(null);
      setNotice({ tone: 'ok', text: `${okText} Los cambios se verán en el sitio en aproximadamente 1 minuto.` });
      return true;
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 409) {
        setNotice({ tone: 'error', text: e.message });
      } else handleError(e);
      return false;
    } finally {
      setSaving(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (!authed) return <LoginForm onDone={() => setAuthed(true)} />;

  const counts = new Map<string, number>();
  catalog?.courses.forEach((c) => counts.set(c.institution_id, (counts.get(c.institution_id) ?? 0) + 1));

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line bg-navy/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <Link to="/" aria-label="Ir al sitio"><Logo size={18} /></Link>
          <span className="rounded-full border border-violet/40 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-violet-soft">Admin</span>
          <nav className="ml-2 flex gap-1" aria-label="Secciones del administrador">
            {(['programas', 'leads', 'reseñas', 'instituciones', 'importar', 'versiones'] as Tab[]).map((t) => (
              <button key={t} onClick={() => { setTab(t); setEditing(null); }} aria-current={tab === t ? 'page' : undefined} className={`rounded-full px-3 py-1.5 text-sm capitalize ${tab === t ? 'bg-raise text-white' : 'text-gray hover:text-white'}`}>
                {t}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {version && <span className="hidden text-xs text-muted md:inline">Última publicación: {new Date(version.uploaded_at).toLocaleString('es-PE')}</span>}
            <button className="btn btn-quiet btn-sm" onClick={() => { logout(); setAuthed(false); }}>Salir</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {notice && (
          <div role={notice.tone === 'error' ? 'alert' : 'status'} className={`mb-5 flex items-start gap-3 rounded-xl border p-3 text-sm ${notice.tone === 'ok' ? 'border-pos/40 bg-pos/10' : notice.tone === 'error' ? 'border-neg/40 bg-neg/10' : 'border-cyan/30 bg-cyan/5'}`}>
            <Icon name={notice.tone === 'ok' ? 'check' : notice.tone === 'error' ? 'alert' : 'info'} className={notice.tone === 'ok' ? 'text-pos' : notice.tone === 'error' ? 'text-neg' : 'text-cyan'} />
            <div className="flex-1 text-white">
              <p>{notice.text}</p>
              {notice.details && notice.details.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs text-gray">{notice.details.map((d) => <li key={d}>{d}</li>)}</ul>}
              {notice.tone === 'error' && notice.text.includes('Recarga') && <button className="mt-1 font-medium text-cyan hover:underline" onClick={() => void load()}>Recargar catálogo</button>}
            </div>
            <button onClick={() => setNotice(null)} aria-label="Cerrar aviso" className="text-muted hover:text-white"><Icon name="x" size={16} /></button>
          </div>
        )}

        {!initialized && catalog && (
          <div className="mb-5 rounded-2xl border border-warn/40 bg-warn/5 p-4">
            <p className="font-medium text-white">El catálogo administrable aún no está inicializado.</p>
            <p className="mt-1 text-sm text-gray">Se muestra el catálogo incluido en el sitio ({catalog.courses.length} programas importados desde el Excel). Al guardar cualquier cambio, o con el botón, se crea la primera versión administrable.</p>
            <button className="btn btn-primary btn-sm mt-3" disabled={saving} onClick={() => void persist(catalog, 'inicializacion', 'Catálogo inicializado.')}>Inicializar catálogo</button>
          </div>
        )}

        {loading || !catalog ? (
          <div className="space-y-3" aria-busy="true">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-12" />)}</div>
        ) : editing?.kind === 'course' ? (
          <CourseEditor
            key={editing.course.id}
            course={editing.course}
            isNew={editing.isNew}
            institutions={catalog.institutions}
            categories={catalog.categories}
            takenSlugs={new Set(catalog.courses.filter((c) => c.id !== editing.course.id).map((c) => c.slug))}
            saving={saving}
            onCancel={() => setEditing(null)}
            onSave={(course) => {
              const exists = catalog.courses.some((c) => c.id === course.id);
              const courses = exists ? catalog.courses.map((c) => (c.id === course.id ? course : c)) : [...catalog.courses, course];
              void persist({ ...catalog, courses }, `${exists ? 'edita' : 'crea'} ${course.slug}`, exists ? `“${course.name}” actualizado.` : `“${course.name}” creado.`);
            }}
            onDelete={editing.isNew ? undefined : () => {
              if (!window.confirm(`¿Eliminar “${editing.course.name}”? Si solo quieres retirarlo del sitio, usa el estado “Oculto”.`)) return;
              void persist({ ...catalog, courses: catalog.courses.filter((c) => c.id !== editing.course.id) }, `elimina ${editing.course.slug}`, 'Programa eliminado.');
            }}
          />
        ) : editing?.kind === 'institution' ? (
          <InstitutionEditor
            key={editing.institution.id || 'new'}
            institution={editing.institution}
            isNew={editing.isNew}
            programs={counts.get(editing.institution.id) ?? 0}
            takenSlugs={new Set(catalog.institutions.filter((i) => i.id !== editing.institution.id).map((i) => i.slug))}
            saving={saving}
            onCancel={() => setEditing(null)}
            onSave={(inst) => {
              const exists = catalog.institutions.some((i) => i.id === inst.id);
              const institutions = exists ? catalog.institutions.map((i) => (i.id === inst.id ? inst : i)) : [...catalog.institutions, inst];
              void persist({ ...catalog, institutions }, `${exists ? 'edita' : 'crea'} ${inst.slug}`, `Institución “${inst.name}” guardada.`);
            }}
            onDelete={editing.isNew ? undefined : () => {
              if (!window.confirm(`¿Eliminar la institución “${editing.institution.name}”?`)) return;
              void persist({ ...catalog, institutions: catalog.institutions.filter((i) => i.id !== editing.institution.id) }, `elimina ${editing.institution.slug}`, 'Institución eliminada.');
            }}
          />
        ) : tab === 'programas' ? (
          <CourseList
            catalog={catalog}
            onEdit={(course) => setEditing({ kind: 'course', course, isNew: false })}
            onNew={() => setEditing({ kind: 'course', course: emptyCourse(catalog.institutions[0]?.id ?? '', catalog.categories[0]?.id ?? '', new Set(catalog.courses.map((c) => c.id))), isNew: true })}
            onDuplicate={(course) => {
              const id = emptyCourse('', '', new Set(catalog.courses.map((c) => c.id))).id;
              setEditing({ kind: 'course', isNew: true, course: { ...course, id, slug: `${course.slug}-copia`, name: `${course.name} (copia)`, status: 'borrador' } });
            }}
            onBulkStatus={(ids, status) => void persist({ ...catalog, courses: catalog.courses.map((c) => (ids.has(c.id) ? { ...c, status } : c)) }, `estado ${status} ${ids.size}`, `${ids.size} programas marcados como ${STATUS_LABELS[status].toLowerCase()}.`)}
            saving={saving}
          />
        ) : tab === 'reseñas' ? (
          <ReviewsPanel onError={handleError} onNotice={(text) => setNotice({ tone: 'ok', text })} />
        ) : tab === 'leads' ? (
          <LeadsPanel onError={handleError} />
        ) : tab === 'importar' ? (
          <ImportPanel catalog={catalog} saving={saving} onImport={(next, note, message) => persist(next, note, message)} />
        ) : tab === 'instituciones' ? (
          <InstitutionList institutions={catalog.institutions} counts={counts} onEdit={(institution) => setEditing({ kind: 'institution', institution, isNew: false })} onNew={() => setEditing({ kind: 'institution', institution: emptyInstitution(), isNew: true })} />
        ) : (
          <VersionsPanel
            current={version}
            onRestore={async (v) => {
              if (!window.confirm(`¿Restaurar la versión del ${new Date(v.uploaded_at).toLocaleString('es-PE')}? Se creará una nueva versión con ese contenido.`)) return;
              try {
                setSaving(true);
                await restoreVersion(v.pathname);
                await load();
                setNotice({ tone: 'ok', text: 'Versión restaurada. El sitio se actualizará en ~1 minuto.' });
              } catch (e) {
                handleError(e);
              } finally {
                setSaving(false);
              }
            }}
            onResetToBundle={async () => {
              if (!window.confirm('¿Reemplazar el catálogo por el incluido en el último despliegue (importado del Excel)? Se perderán las ediciones hechas desde el administrador (quedan en el historial).')) return;
              void persist(await loadBundledCatalog(), 'restablece desde build', 'Catálogo restablecido desde el build.');
            }}
            onExport={() => {
              const blob = new Blob([JSON.stringify(catalog, null, 2)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `groulevel-catalogo-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(a.href);
            }}
            disabled={saving}
          />
        )}
      </main>
    </div>
  );
}

/* --------------------------------------------------------------- Programas */

function CourseList({ catalog, onEdit, onNew, onDuplicate, onBulkStatus, saving }: {
  catalog: AdminCatalog;
  onEdit: (c: Course) => void;
  onNew: () => void;
  onDuplicate: (c: Course) => void;
  onBulkStatus: (ids: Set<string>, status: CourseStatus) => void;
  saving: boolean;
}) {
  const [q, setQ] = useState('');
  const [inst, setInst] = useState('');
  const [cat, setCat] = useState('');
  const [status, setStatus] = useState('');
  const [quality, setQuality] = useState('');
  const [sort, setSort] = useState<'nombre' | 'actualizado' | 'completitud'>('nombre');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const instName = useMemo(() => new Map(catalog.institutions.map((i) => [i.id, i])), [catalog.institutions]);
  const catName = useMemo(() => new Map(catalog.categories.map((c) => [c.id, c.name])), [catalog.categories]);

  const rows = useMemo(() => {
    const nq = normalize(q);
    const list = catalog.courses.filter((c) => {
      if (inst && c.institution_id !== inst) return false;
      if (cat && c.category !== cat) return false;
      if (status && c.status !== status) return false;
      if (quality === 'sin-precio' && c.price != null) return false;
      if (quality === 'sin-inicio' && (c.start_date || c.modality === 'grabado')) return false;
      if (quality === 'incompletos' && completeness(c) >= 0.6) return false;
      if (nq && !normalize(`${c.name} ${instName.get(c.institution_id)?.name ?? ''} ${c.slug} ${c.id}`).includes(nq)) return false;
      return true;
    });
    const by = {
      nombre: (a: Course, b: Course) => a.name.localeCompare(b.name, 'es'),
      actualizado: (a: Course, b: Course) => b.updated_at.localeCompare(a.updated_at),
      completitud: (a: Course, b: Course) => completeness(a) - completeness(b)
    }[sort];
    return list.sort(by);
  }, [catalog.courses, q, inst, cat, status, quality, sort, instName]);

  useEffect(() => setPage(1), [q, inst, cat, status, quality, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const visible = rows.slice((page - 1) * PAGE, page * PAGE);
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allVisibleSelected = visible.length > 0 && visible.every((c) => selected.has(c.id));

  const stats = {
    total: catalog.courses.length,
    published: catalog.courses.filter((c) => c.status === 'publicado').length,
    noPrice: catalog.courses.filter((c) => c.price == null).length,
    incomplete: catalog.courses.filter((c) => completeness(c) < 0.6).length
  };

  const sel = 'input min-h-10 cursor-pointer py-2 text-sm';
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-white">Programas</h1>
          <p className="mt-1 text-sm text-gray">
            {stats.total} en total · {stats.published} publicados · {stats.noPrice} sin precio · {stats.incomplete} con datos incompletos
          </p>
        </div>
        <button className="btn btn-accent btn-sm" onClick={onNew}><Icon name="plus" size={15} /> Nuevo programa</button>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_repeat(5,1fr)]">
        <div className="relative">
          <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input aria-label="Buscar programas" className="input min-h-10 py-2 pl-9 text-sm" placeholder="Buscar por nombre, institución, slug o id" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select aria-label="Institución" className={sel} value={inst} onChange={(e) => setInst(e.target.value)}>
          <option value="">Todas las instituciones</option>
          {catalog.institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <select aria-label="Categoría" className={sel} value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {catalog.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select aria-label="Estado" className={sel} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select aria-label="Calidad de datos" className={sel} value={quality} onChange={(e) => setQuality(e.target.value)}>
          <option value="">Calidad: todos</option>
          <option value="incompletos">Datos incompletos (&lt;60%)</option>
          <option value="sin-precio">Sin precio</option>
          <option value="sin-inicio">Sin fecha de inicio</option>
        </select>
        <select aria-label="Ordenar" className={sel} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="nombre">Orden: nombre</option>
          <option value="actualizado">Orden: actualizados</option>
          <option value="completitud">Orden: menos completos</option>
        </select>
      </div>

      {selected.size > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-cyan/30 bg-cyan/5 p-2 text-sm">
          <span className="px-2 text-white">{selected.size} seleccionados</span>
          {(['publicado', 'oculto', 'borrador'] as CourseStatus[]).map((s) => (
            <button key={s} className="btn btn-ghost btn-sm" disabled={saving} onClick={() => { onBulkStatus(selected, s); setSelected(new Set()); }}>Marcar {STATUS_LABELS[s].toLowerCase()}</button>
          ))}
          <button className="btn btn-quiet btn-sm" onClick={() => setSelected(new Set())}>Quitar selección</button>
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-midnight text-xs uppercase tracking-[0.08em] text-muted">
            <tr>
              <th className="w-10 p-3"><input type="checkbox" aria-label="Seleccionar página" checked={allVisibleSelected} onChange={() => setSelected((s) => { const n = new Set(s); visible.forEach((c) => (allVisibleSelected ? n.delete(c.id) : n.add(c.id))); return n; })} className="h-4 w-4 accent-[#00E7FF]" /></th>
              <th className="p-3 font-medium">Programa</th>
              <th className="p-3 font-medium">Tipo</th>
              <th className="p-3 font-medium">Precio</th>
              <th className="p-3 font-medium">Inicio</th>
              <th className="p-3 font-medium">Estado</th>
              <th className="p-3 font-medium">Datos</th>
              <th className="p-3 font-medium">Actualizado</th>
              <th className="p-3"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => {
              const i = instName.get(c.institution_id);
              const price = effectivePrice(c);
              const pct = Math.round(completeness(c) * 100);
              return (
                <tr key={c.id} className="border-t border-line align-middle hover:bg-midnight/60">
                  <td className="p-3"><input type="checkbox" aria-label={`Seleccionar ${c.name}`} checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 accent-[#00E7FF]" /></td>
                  <td className="max-w-[340px] p-3">
                    <button onClick={() => onEdit(c)} className="flex items-center gap-2.5 text-left">
                      {i && <InstitutionLogo institution={i} size={28} />}
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-white hover:text-cyan">{c.name}</span>
                        <span className="block truncate text-xs text-muted">{i?.name ?? c.institution_id} · {catName.get(c.category) ?? c.category}</span>
                      </span>
                    </button>
                  </td>
                  <td className="p-3 text-gray">{PROGRAM_TYPE_LABELS[c.program_type]}</td>
                  <td className="tnum p-3 text-gray">{price == null ? <span className="text-dim">—</span> : price === 0 ? 'Gratis' : formatMoney(price, c.currency)}</td>
                  <td className="p-3 text-gray">{c.start_date ? formatDate(c.start_date, { day: 'numeric', month: 'short', year: '2-digit' }) : <span className="text-dim">—</span>}</td>
                  <td className="p-3"><span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_TONE[c.status]}`}>{STATUS_LABELS[c.status]}</span></td>
                  <td className="p-3">
                    <div className="flex items-center gap-2" title={`${pct}% de los campos clave`}>
                      <div className="h-1.5 w-14 rounded-full bg-raise"><div className={`h-full rounded-full ${pct >= 80 ? 'bg-pos' : pct >= 60 ? 'bg-blue' : 'bg-warn'}`} style={{ width: `${pct}%` }} /></div>
                      <span className="tnum text-xs text-muted">{pct}%</span>
                    </div>
                  </td>
                  <td className="p-3 text-xs text-muted">{formatDate(c.updated_at, { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <button className="btn btn-ghost btn-sm" onClick={() => onEdit(c)}>Editar</button>
                      <button className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-raise hover:text-white" onClick={() => onDuplicate(c)} aria-label={`Duplicar ${c.name}`} title="Duplicar"><Icon name="layers" size={15} /></button>
                      {c.status === 'publicado' && <a className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-raise hover:text-white" href={`${import.meta.env.BASE_URL}programa/${c.slug}`} target="_blank" rel="noreferrer" aria-label={`Ver ${c.name} en el sitio`} title="Ver en el sitio"><Icon name="external" size={15} /></a>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-gray">No hay programas con esos filtros.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-gray">
        <span>{rows.length} resultados</span>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</button>
          <span className="tnum">{page} / {pages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page === pages} onClick={() => setPage((p) => p + 1)}>Siguiente</button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- Instituciones */

function InstitutionList({ institutions, counts, onEdit, onNew }: { institutions: Institution[]; counts: Map<string, number>; onEdit: (i: Institution) => void; onNew: () => void }) {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-white">Instituciones</h1>
          <p className="mt-1 text-sm text-gray">{institutions.length} instituciones</p>
        </div>
        <button className="btn btn-accent btn-sm" onClick={onNew}><Icon name="plus" size={15} /> Nueva institución</button>
      </div>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...institutions].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0)).map((i) => (
          <li key={i.id}>
            <button onClick={() => onEdit(i)} className="card flex w-full items-center gap-3 p-4 text-left transition-colors hover:border-line-strong">
              <InstitutionLogo institution={i} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-white">{i.name}</span>
                <span className="block truncate text-xs text-muted">{i.type} · {i.country}</span>
              </span>
              <span className="tnum text-sm text-gray">{counts.get(i.id) ?? 0}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --------------------------------------------------------------- Versiones */

function VersionsPanel({ current, onRestore, onResetToBundle, onExport, disabled }: { current: VersionInfo | null; onRestore: (v: VersionInfo) => void; onResetToBundle: () => void; onExport: () => void; disabled: boolean }) {
  const [versions, setVersions] = useState<VersionInfo[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetchVersions().then((r) => setVersions(r.versions)).catch((e: Error) => setError(e.message));
  }, [current]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section>
        <h1 className="text-2xl text-white">Historial de versiones</h1>
        <p className="mt-1 text-sm text-gray">Cada guardado crea una versión. Se conservan las últimas 50.</p>
        {error && <p role="alert" className="mt-4 text-sm text-neg">{error}</p>}
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {versions === null && !error && <li className="p-4"><div className="skeleton h-6" /></li>}
          {versions?.length === 0 && <li className="p-4 text-sm text-gray">Aún no hay versiones guardadas.</li>}
          {versions?.map((v) => (
            <li key={v.pathname} className="flex items-center gap-3 p-3 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block text-white">{new Date(v.uploaded_at).toLocaleString('es-PE')}</span>
                <span className="block truncate text-xs text-muted">{v.note || 'sin nota'} · {(v.size / 1024).toFixed(0)} KB</span>
              </span>
              {current?.pathname === v.pathname ? (
                <span className="rounded-full border border-pos/40 px-2 py-0.5 text-xs text-pos">Vigente</span>
              ) : (
                <button className="btn btn-ghost btn-sm" disabled={disabled} onClick={() => onRestore(v)}>Restaurar</button>
              )}
            </li>
          ))}
        </ul>
      </section>
      <aside className="space-y-3">
        <div className="card p-4">
          <h2 className="text-base text-white">Exportar</h2>
          <p className="mt-1 text-sm text-gray">Descarga el catálogo completo en JSON (respaldo o análisis).</p>
          <button className="btn btn-ghost btn-sm mt-3" onClick={onExport}>Descargar JSON</button>
        </div>
        <div className="card p-4">
          <h2 className="text-base text-white">Restablecer desde el build</h2>
          <p className="mt-1 text-sm text-gray">Reemplaza todo el catálogo por el incluido en el código del sitio (la importación inicial). Para agregar programas usa mejor «Importar».</p>
          <button className="btn btn-ghost btn-sm mt-3 text-warn" disabled={disabled} onClick={onResetToBundle}>Restablecer</button>
        </div>
      </aside>
    </div>
  );
}
