import { useCallback, useEffect, useMemo, useState } from 'react';
import { deleteProfileRecord, downloadProfileFile, fetchProfileDetail, fetchProfiles, updateProfileRecord, type ProfileListItem } from '../../services/adminApi';
import type { ProfileAnalysis, ProfileStatus } from '../../types';
import { EDUCATION_LABELS, PROFICIENCY_LABELS, SENIORITY_LABELS } from '../../utils/profileAnalysis';
import { normalize } from '../../utils/text';
import { Icon } from '../ui/Icon';

const STATUS_LABELS: Record<ProfileStatus, string> = { nuevo: 'Nuevos', contactado: 'Contactados', descartado: 'Descartados' };
const when = (iso: string) => new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function toCsv(rows: ProfileListItem[]): string {
  const cols: [string, (p: ProfileListItem) => unknown][] = [
    ['Fecha', (p) => new Date(p.created_at).toLocaleString('es-PE')], ['Nombre', (p) => p.name], ['Email', (p) => p.email], ['Teléfono', (p) => p.phone], ['País', (p) => p.country],
    ['Posición actual', (p) => p.current_role], ['Seniority', (p) => SENIORITY_LABELS[p.seniority]], ['Años de experiencia', (p) => p.years_experience],
    ['Grado más alto', (p) => (p.highest_degree ? EDUCATION_LABELS[p.highest_degree] : '')], ['Objetivo', (p) => p.objective], ['Materias objetivo', (p) => p.target_areas.join(' / ')],
    ['Quiere contacto', (p) => (p.contact_ok ? 'Sí' : 'No')], ['Fuente', (p) => (p.source === 'cv' ? 'CV' : 'Descripción')], ['Motor', (p) => p.engine], ['Estado', (p) => p.status], ['Notas', (p) => p.notes], ['ID', (p) => p.id]
  ];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return '﻿' + [cols.map(([h]) => esc(h)).join(','), ...rows.map((r) => cols.map(([, f]) => esc(f(r))).join(','))].join('\r\n');
}

/** Diagnósticos de "Mi ruta": CVs recibidos, datos extraídos, evaluación y ruta sugerida. */
export function ProfilesPanel({ onError, onNotice, courseName }: { onError: (e: unknown) => void; onNotice: (text: string) => void; courseName: (id: string) => string }) {
  const [profiles, setProfiles] = useState<ProfileListItem[] | null>(null);
  const [tab, setTab] = useState<ProfileStatus>('nuevo');
  const [q, setQ] = useState('');
  const [onlyContact, setOnlyContact] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProfileAnalysis | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setProfiles((await fetchProfiles()).profiles);
    } catch (e) {
      onError(e);
      setProfiles([]);
    }
  }, [onError]);
  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => {
    const c: Record<ProfileStatus, number> = { nuevo: 0, contactado: 0, descartado: 0 };
    (profiles ?? []).forEach((p) => c[p.status]++);
    return c;
  }, [profiles]);

  const rows = useMemo(() => {
    const nq = normalize(q);
    return (profiles ?? []).filter((p) => p.status === tab && (!onlyContact || p.contact_ok) && (!nq || normalize(`${p.name} ${p.email} ${p.current_role} ${p.objective} ${p.country} ${p.target_areas.join(' ')}`).includes(nq)));
  }, [profiles, tab, q, onlyContact]);

  const toggle = async (id: string) => {
    if (open === id) { setOpen(null); return; }
    setOpen(id);
    setDetail(null);
    try {
      const { profile } = await fetchProfileDetail(id);
      setDetail(profile);
      setNotes(profile.notes);
    } catch (e) {
      onError(e);
    }
  };

  const save = async (id: string, patch: { status?: ProfileStatus; notes?: string }, message: string) => {
    setBusy(true);
    try {
      const { profile } = await updateProfileRecord(id, patch);
      setProfiles((list) => (list ?? []).map((p) => (p.id === id ? { ...p, status: profile.status, notes: profile.notes } : p)));
      setDetail(profile);
      onNotice(message);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: ProfileListItem) => {
    if (!window.confirm(`¿Eliminar el diagnóstico de ${p.name}${p.file ? ' y su CV' : ''}? No se puede deshacer.`)) return;
    try {
      await deleteProfileRecord(p.id);
      setProfiles((list) => (list ?? []).filter((x) => x.id !== p.id));
      setOpen(null);
      onNotice('Diagnóstico eliminado.');
    } catch (e) {
      onError(e);
    }
  };

  const exportCsv = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
    a.download = `groulevel-perfiles-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-white">Perfiles · Mi ruta</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray">CVs y descripciones recibidos en /mi-ruta, con los datos extraídos, la evaluación por materia y la ruta sugerida. Solo se contacta a quien marcó que quiere ser contactado.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={exportCsv} disabled={!rows.length}><Icon name="book" size={15} /> Exportar CSV ({rows.length})</button>
          <button className="btn btn-quiet btn-sm" onClick={() => void load()}>Actualizar</button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full border border-line-strong p-1" role="tablist">
          {(Object.keys(STATUS_LABELS) as ProfileStatus[]).map((s) => (
            <button key={s} role="tab" aria-selected={tab === s} onClick={() => setTab(s)} className={`rounded-full px-3 py-1 text-sm ${tab === s ? 'bg-white text-navy' : 'text-gray hover:text-white'}`}>{STATUS_LABELS[s]} ({counts[s]})</button>
          ))}
        </div>
        <input className="input max-w-xs" placeholder="Buscar por nombre, email, objetivo…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar perfiles" />
        <label className="flex items-center gap-2 text-sm text-gray"><input type="checkbox" checked={onlyContact} onChange={(e) => setOnlyContact(e.target.checked)} /> Solo quieren contacto</label>
      </div>

      {profiles === null ? (
        <p className="mt-8 text-gray">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-gray">No hay perfiles en esta vista.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((p) => (
            <li key={p.id} className="card overflow-hidden">
              <button className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 p-4 text-left hover:bg-surface" onClick={() => void toggle(p.id)} aria-expanded={open === p.id}>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-white">{p.name}</span>
                    {p.contact_ok && <span className="rounded-full border border-pos/40 bg-pos/10 px-2 py-0.5 text-[11px] text-pos">Quiere contacto</span>}
                    {p.file && <span className="rounded-full border border-line-strong px-2 py-0.5 text-[11px] text-gray">CV</span>}
                    <span className="rounded-full border border-line-strong px-2 py-0.5 text-[11px] text-gray">{p.engine === 'ia' ? 'IA' : 'Reglas'}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-gray">{[p.current_role, p.years_experience !== null ? `${p.years_experience} años` : null, p.country, p.email].filter(Boolean).join(' · ')}</span>
                  <span className="mt-0.5 block truncate text-sm text-muted">Objetivo: {p.objective}</span>
                </span>
                <span className="font-mono text-xs text-dim">{when(p.created_at)}</span>
                <Icon name={open === p.id ? 'chevron-up' : 'chevron-down'} size={16} className="text-gray" />
              </button>

              {open === p.id && (
                <div className="border-t border-line p-4 sm:p-5">
                  {!detail ? <p className="text-sm text-gray">Cargando diagnóstico…</p> : (
                    <div className="grid gap-6 lg:grid-cols-3">
                      <div className="space-y-4 text-sm">
                        <div>
                          <p className="label-mono">Contacto</p>
                          <p className="mt-1 text-white">{[detail.extract.personal.first_name, detail.extract.personal.last_name].filter(Boolean).join(' ') || 'Sin nombre'}</p>
                          <p className="text-gray">{detail.extract.personal.email ?? 'Sin email'} · {detail.extract.personal.phone ?? 'Sin teléfono'}</p>
                          <p className="text-gray">{[detail.extract.personal.city, detail.extract.personal.country].filter(Boolean).join(', ') || 'País no indicado'}</p>
                          {detail.extract.personal.linkedin && <p className="truncate text-gray">{detail.extract.personal.linkedin}</p>}
                        </div>
                        <div>
                          <p className="label-mono">Perfil</p>
                          <p className="mt-1 text-gray">{[detail.extract.current_role, detail.extract.current_company].filter(Boolean).join(' · ') || '—'}</p>
                          <p className="text-gray">{SENIORITY_LABELS[detail.extract.seniority]}{detail.extract.highest_degree ? ` · ${EDUCATION_LABELS[detail.extract.highest_degree]}` : ''}</p>
                          {detail.extract.current_studies && <p className="text-gray">Estudia: {detail.extract.current_studies}</p>}
                        </div>
                        <div>
                          <p className="label-mono">Formación</p>
                          <ul className="mt-1 space-y-1 text-gray">{detail.extract.education.length ? detail.extract.education.map((e, i) => <li key={i}>{e.degree}{e.institution ? ` — ${e.institution}` : ''}{e.end_year ? ` (${e.end_year})` : ''}</li>) : <li>—</li>}</ul>
                        </div>
                        <div>
                          <p className="label-mono">Experiencia</p>
                          <ul className="mt-1 space-y-1 text-gray">{detail.extract.experience.length ? detail.extract.experience.map((e, i) => <li key={i}>{e.role}{e.company ? ` — ${e.company}` : ''} {e.start_year ? `(${e.start_year}–${e.current ? 'act.' : e.end_year ?? '?'})` : ''}</li>) : <li>—</li>}</ul>
                        </div>
                        {detail.extract.languages.length > 0 && <p className="text-gray"><span className="label-mono mr-2">Idiomas</span>{detail.extract.languages.map((l) => `${l.language} (${l.level})`).join(', ')}</p>}
                      </div>

                      <div className="space-y-4 text-sm">
                        <div>
                          <p className="label-mono">Conocimientos por materia</p>
                          <ul className="mt-2 space-y-1.5">
                            {[...detail.evaluation.areas].filter((a) => a.score > 0).sort((a, b) => b.score - a.score).slice(0, 8).map((a) => (
                              <li key={a.area_id} className="flex items-center gap-2">
                                <span className="w-36 shrink-0 truncate text-gray">{a.area}</span>
                                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-raise"><span className="block h-full rounded-full bg-blue" style={{ width: `${a.score}%` }} /></span>
                                <span className="w-32 shrink-0 text-right font-mono text-xs text-gray whitespace-nowrap">{a.score} · {PROFICIENCY_LABELS[a.level]}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="label-mono">Técnicas</p>
                          <p className="mt-1 text-gray">{detail.evaluation.technical_skills.map((s) => `${s.name} (${s.score})`).join(', ') || '—'}</p>
                        </div>
                        <div>
                          <p className="label-mono">Blandas</p>
                          <p className="mt-1 text-gray">{detail.evaluation.soft_skills.filter((s) => s.score > 0).map((s) => `${s.name} (${s.score})`).join(', ') || '—'}</p>
                        </div>
                        <p className="text-gray">{detail.evaluation.summary}</p>
                      </div>

                      <div className="space-y-4 text-sm">
                        <div>
                          <p className="label-mono">Ruta sugerida</p>
                          <ol className="mt-2 space-y-2">
                            {detail.route.stages.map((s) => (
                              <li key={s.order}>
                                <p className="text-white">{s.order}. {s.title}</p>
                                <ul className="ml-4 list-disc text-gray">{s.course_ids.map((id) => <li key={id}>{courseName(id)}</li>)}</ul>
                              </li>
                            ))}
                          </ol>
                        </div>
                        <div>
                          <label className="label-mono" htmlFor={`notes-${p.id}`}>Notas internas</label>
                          <textarea id={`notes-${p.id}`} className="input mt-1 py-2" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button className="btn btn-ghost btn-sm" disabled={busy || notes === detail.notes} onClick={() => void save(p.id, { notes }, 'Notas guardadas.')}>Guardar notas</button>
                          {(Object.keys(STATUS_LABELS) as ProfileStatus[]).filter((s) => s !== detail.status).map((s) => (
                            <button key={s} className="btn btn-quiet btn-sm" disabled={busy} onClick={() => void save(p.id, { status: s }, `Marcado como ${STATUS_LABELS[s].toLowerCase().replace(/s$/, '')}.`)}>Marcar {STATUS_LABELS[s].toLowerCase().replace(/s$/, '')}</button>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                          {detail.file && <button className="btn btn-accent btn-sm" onClick={() => downloadProfileFile(p.id, detail.file!.name).catch(onError)}><Icon name="file" size={15} /> Descargar CV</button>}
                          <a className="btn btn-ghost btn-sm" href={`/mi-ruta/${p.id}`} target="_blank" rel="noreferrer"><Icon name="external" size={15} /> Ver como usuario</a>
                          <button className="btn btn-quiet btn-sm text-neg" onClick={() => void remove(p)}><Icon name="trash" size={15} /> Eliminar</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
