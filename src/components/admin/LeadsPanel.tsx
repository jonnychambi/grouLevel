import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { deleteLeadRecord, fetchLeads, updateLeadStatus, type StoredLead } from '../../services/adminApi';
import type { LeadStatus, SignalTier } from '../../types';
import { OBJECTIVE_OPTIONS, TIER_LABELS, TIMELINE_OPTIONS } from '../../utils/leadScoring';
import { normalize } from '../../utils/text';
import { Icon } from '../ui/Icon';
import { Modal } from '../ui/Modal';

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  enviado: 'Enviado a la institución',
  matriculado: 'Matriculado',
  descartado: 'Descartado'
};
const STATUS_TONE: Record<LeadStatus, string> = {
  nuevo: 'text-cyan border-cyan/40',
  contactado: 'text-blue-soft border-blue/40',
  enviado: 'text-violet-soft border-violet/40',
  matriculado: 'text-pos border-pos/40',
  descartado: 'text-gray border-line-strong'
};
const TIER_TONE: Record<SignalTier, string> = { HIGH_INTENT: 'text-cyan', WARM: 'text-blue-soft', NURTURE: 'text-violet-soft', LOW: 'text-gray' };
const timelineLabel = (v: string) => TIMELINE_OPTIONS.find((o) => o.value === v)?.label ?? v;
const objectiveLabel = (v: string) => OBJECTIVE_OPTIONS.find((o) => o.value === v)?.label ?? v;
const when = (iso: string) => new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/** CSV compatible con Excel (BOM UTF-8, separador coma, comillas escapadas). */
function toCsv(leads: StoredLead[]): string {
  const cols: [string, (l: StoredLead) => unknown][] = [
    ['Fecha', (l) => new Date(l.created_at).toLocaleString('es-PE')],
    ['Nombre', (l) => l.first_name], ['Apellido', (l) => l.last_name], ['Email', (l) => l.email], ['WhatsApp', (l) => l.whatsapp], ['País', (l) => l.country],
    ['Programa', (l) => l.course_name], ['Institución', (l) => l.institution_name],
    ['Inicio deseado', (l) => timelineLabel(l.start_timeline)], ['Objetivo', (l) => objectiveLabel(l.objective)],
    ['Signal Score', (l) => l.lead_score], ['Tier', (l) => TIER_LABELS[l.lead_tier]], ['Segmento', (l) => l.lead_segment],
    ['Estado', (l) => LEAD_STATUS_LABELS[l.status] ?? l.status], ['Notas', (l) => l.notes ?? ''],
    ['Origen en el sitio', (l) => l.source], ['utm_source', (l) => l.utm_source], ['utm_medium', (l) => l.utm_medium], ['utm_campaign', (l) => l.utm_campaign],
    ['utm_term', (l) => l.utm_term], ['utm_content', (l) => l.utm_content], ['Referrer', (l) => l.referrer], ['Página', (l) => l.page_url], ['ID', (l) => l.id]
  ];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return '﻿' + [cols.map(([h]) => esc(h)).join(','), ...leads.map((l) => cols.map(([, f]) => esc(f(l))).join(','))].join('\r\n');
}

export function LeadsPanel({ onError }: { onError: (e: unknown) => void }) {
  const [leads, setLeads] = useState<StoredLead[] | null>(null);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [tier, setTier] = useState('');
  const [inst, setInst] = useState('');
  const [period, setPeriod] = useState('');
  const [open, setOpen] = useState<StoredLead | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetchLeads(2000);
      setLeads(res.leads);
      setTotal(res.total);
    } catch (e) {
      onError(e);
      setLeads([]);
    }
  }, [onError]);
  useEffect(() => { void load(); }, [load]);

  const institutions = useMemo(() => [...new Set((leads ?? []).map((l) => l.institution_name))].sort(), [leads]);
  const rows = useMemo(() => {
    const nq = normalize(q);
    const since = period ? Date.now() - Number(period) * 86_400_000 : 0;
    return (leads ?? []).filter((l) =>
      (!status || l.status === status) &&
      (!tier || l.lead_tier === tier) &&
      (!inst || l.institution_name === inst) &&
      (!since || new Date(l.created_at).getTime() >= since) &&
      (!nq || normalize(`${l.first_name} ${l.last_name} ${l.email} ${l.whatsapp} ${l.course_name} ${l.institution_name}`).includes(nq))
    );
  }, [leads, q, status, tier, inst, period]);

  const stats = useMemo(() => {
    const all = leads ?? [];
    const week = all.filter((l) => Date.now() - new Date(l.created_at).getTime() < 7 * 86_400_000).length;
    const hot = all.filter((l) => l.lead_tier === 'HIGH_INTENT').length;
    const pending = all.filter((l) => l.status === 'nuevo').length;
    const avg = all.length ? Math.round(all.reduce((s, l) => s + l.lead_score, 0) / all.length) : 0;
    return { week, hot, pending, avg };
  }, [leads]);

  const save = async (lead: StoredLead, patch: { status?: LeadStatus; notes?: string }) => {
    setBusy(true);
    try {
      const { lead: updated } = await updateLeadStatus(lead.pathname, patch);
      setLeads((ls) => (ls ?? []).map((l) => (l.pathname === updated.pathname ? updated : l)));
      setOpen((o) => (o && o.pathname === updated.pathname ? updated : o));
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (lead: StoredLead) => {
    if (!window.confirm(`¿Eliminar definitivamente el lead de ${lead.first_name} ${lead.last_name}? Úsalo, por ejemplo, si la persona pide borrar sus datos.`)) return;
    setBusy(true);
    try {
      await deleteLeadRecord(lead.pathname);
      setLeads((ls) => (ls ?? []).filter((l) => l.pathname !== lead.pathname));
      setTotal((t) => t - 1);
      setOpen(null);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `groulevel-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const sel = 'input min-h-10 cursor-pointer py-2 text-sm';
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-white">Leads</h1>
          <p className="mt-1 text-sm text-gray">Solicitudes de información enviadas desde el sitio. Datos personales: trátalos con reserva.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-quiet btn-sm" onClick={() => { setLeads(null); void load(); }}><Icon name="history" size={15} /> Actualizar</button>
          <button className="btn btn-ghost btn-sm" onClick={exportCsv} disabled={!rows.length}><Icon name="book" size={15} /> Exportar CSV ({rows.length})</button>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ['Total', total, 'text-white'],
          ['Últimos 7 días', stats.week, 'text-white'],
          ['Sin gestionar', stats.pending, 'text-cyan'],
          ['High intent', stats.hot, 'text-cyan'],
          ['Signal Score prom.', stats.avg, 'text-white']
        ].map(([k, v, tone]) => (
          <div key={k as string} className="card p-4">
            <dt className="label-mono text-[10px]">{k}</dt>
            <dd className={`tnum mt-1 text-2xl font-semibold ${tone}`}>{leads ? v : '—'}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_repeat(4,1fr)]">
        <div className="relative">
          <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input aria-label="Buscar leads" className="input min-h-10 py-2 pl-9 text-sm" placeholder="Nombre, email, teléfono, programa…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select aria-label="Estado" className={sel} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(LEAD_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select aria-label="Intención" className={sel} value={tier} onChange={(e) => setTier(e.target.value)}>
          <option value="">Toda intención</option>
          {Object.entries(TIER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select aria-label="Institución" className={sel} value={inst} onChange={(e) => setInst(e.target.value)}>
          <option value="">Todas las instituciones</option>
          {institutions.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
        <select aria-label="Periodo" className={sel} value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="">Todo el periodo</option>
          <option value="1">Últimas 24 h</option>
          <option value="7">Últimos 7 días</option>
          <option value="30">Últimos 30 días</option>
        </select>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-midnight text-xs uppercase tracking-[0.08em] text-muted">
            <tr>
              <th className="p-3 font-medium">Fecha</th><th className="p-3 font-medium">Persona</th><th className="p-3 font-medium">Programa</th>
              <th className="p-3 font-medium">Score</th><th className="p-3 font-medium">Inicio deseado</th><th className="p-3 font-medium">Fuente</th><th className="p-3 font-medium">Estado</th>
              <th className="p-3"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {leads === null && Array.from({ length: 4 }, (_, i) => <tr key={i} className="border-t border-line"><td colSpan={8} className="p-3"><div className="skeleton h-6" /></td></tr>)}
            {rows.map((l) => (
              <tr key={l.pathname} className="border-t border-line align-top hover:bg-midnight/60">
                <td className="whitespace-nowrap p-3 text-gray">{when(l.created_at)}</td>
                <td className="p-3">
                  <button className="text-left" onClick={() => setOpen(l)}>
                    <span className="block font-medium text-white hover:text-cyan">{l.first_name} {l.last_name}</span>
                    <span className="block text-xs text-muted">{l.email} · {l.whatsapp}</span>
                  </button>
                </td>
                <td className="max-w-[260px] p-3"><span className="block truncate text-white">{l.course_name}</span><span className="block truncate text-xs text-muted">{l.institution_name}</span></td>
                <td className="p-3"><span className="tnum font-semibold text-white">{l.lead_score}</span> <span className={`font-mono text-[10.5px] uppercase ${TIER_TONE[l.lead_tier]}`}>{TIER_LABELS[l.lead_tier]}</span></td>
                <td className="p-3 text-gray">{timelineLabel(l.start_timeline)}</td>
                <td className="p-3 text-xs text-gray">{l.utm_source ?? 'directo'}{l.utm_campaign ? ` · ${l.utm_campaign}` : ''}<span className="block text-muted">{l.source}</span></td>
                <td className="p-3">
                  <select aria-label={`Estado de ${l.first_name}`} disabled={busy} value={l.status} onChange={(e) => void save(l, { status: e.target.value as LeadStatus })} className={`cursor-pointer rounded-full border bg-navy px-2 py-1 text-xs ${STATUS_TONE[l.status] ?? ''}`}>
                    {Object.entries(LEAD_STATUS_LABELS).map(([v, lab]) => <option key={v} value={v}>{lab}</option>)}
                  </select>
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <a className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-raise hover:text-white" href={`https://wa.me/${l.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" aria-label={`WhatsApp a ${l.first_name}`} title="Abrir WhatsApp"><Icon name="share" size={15} /></a>
                    <a className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-raise hover:text-white" href={`mailto:${l.email}`} aria-label={`Email a ${l.first_name}`} title="Enviar email"><Icon name="external" size={15} /></a>
                    <button className="btn btn-ghost btn-sm" onClick={() => setOpen(l)}>Ver</button>
                  </div>
                </td>
              </tr>
            ))}
            {leads && rows.length === 0 && (
              <tr><td colSpan={8} className="p-8 text-center text-gray">{leads.length ? 'No hay leads con esos filtros.' : 'Todavía no hay leads. Aparecerán aquí cuando alguien use “Solicitar información”.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {total > (leads?.length ?? 0) && <p className="mt-2 text-xs text-muted">Mostrando los {leads?.length} más recientes de {total}.</p>}

      {open && <LeadDetail lead={open} busy={busy} onClose={() => setOpen(null)} onSave={(patch) => void save(open, patch)} onDelete={() => void remove(open)} />}
    </div>
  );
}

function LeadDetail({ lead, busy, onClose, onSave, onDelete }: { lead: StoredLead; busy: boolean; onClose: () => void; onSave: (p: { status?: LeadStatus; notes?: string }) => void; onDelete: () => void }) {
  const [notes, setNotes] = useState(lead.notes ?? '');
  const row = (k: string, v: ReactNode) => (
    <div className="flex justify-between gap-4 border-b border-line py-2 text-sm"><dt className="text-muted">{k}</dt><dd className="text-right text-white">{v || '—'}</dd></div>
  );
  return (
    <Modal open onClose={onClose} title={`${lead.first_name} ${lead.last_name}`} description={`${when(lead.created_at)} · ${lead.course_name}`} variant="drawer">
      <div className="space-y-5 p-5">
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-navy/60 p-4">
          <span className="tnum text-4xl font-semibold text-white">{lead.lead_score}</span>
          <span><span className={`block font-mono text-xs uppercase ${TIER_TONE[lead.lead_tier]}`}>{TIER_LABELS[lead.lead_tier]}</span><span className="text-xs text-muted">Signal Score · segmento {lead.lead_segment}</span></span>
        </div>
        <dl>
          {row('Email', <a className="text-cyan hover:underline" href={`mailto:${lead.email}`}>{lead.email}</a>)}
          {row('WhatsApp', <a className="text-cyan hover:underline" href={`https://wa.me/${lead.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">{lead.whatsapp}</a>)}
          {row('País', lead.country)}
          {row('Programa', lead.course_name)}
          {row('Institución', lead.institution_name)}
          {row('Inicio deseado', timelineLabel(lead.start_timeline))}
          {row('Objetivo', objectiveLabel(lead.objective))}
          {row('Origen en el sitio', lead.source)}
          {row('Campaña', [lead.utm_source, lead.utm_medium, lead.utm_campaign].filter(Boolean).join(' / '))}
          {row('Referrer', lead.referrer)}
          {row('Página', lead.page_url && <span className="break-all text-xs">{lead.page_url}</span>)}
        </dl>
        <div>
          <label htmlFor="lead-status" className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted">Estado</label>
          <select id="lead-status" className="input min-h-10 py-2 text-sm" value={lead.status} disabled={busy} onChange={(e) => onSave({ status: e.target.value as LeadStatus })}>
            {Object.entries(LEAD_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="lead-notes" className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted">Notas internas</label>
          <textarea id="lead-notes" rows={4} className="input py-2 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej. Llamado el 06/10, pidió brochure…" />
          <button className="btn btn-ghost btn-sm mt-2" disabled={busy || notes === (lead.notes ?? '')} onClick={() => onSave({ notes })}>Guardar notas</button>
        </div>
        <button className="btn btn-quiet btn-sm text-neg" disabled={busy} onClick={onDelete}><Icon name="trash" size={15} /> Eliminar lead</button>
      </div>
    </Modal>
  );
}
