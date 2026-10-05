import { useEffect, useMemo, useState } from 'react';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { EmptyState } from '../components/ui/EmptyState';
import { useCatalog } from '../hooks/useCatalog';
import { useSeo } from '../hooks/useSeo';
import { getStoredEvents } from '../services/analytics';
import { getLeadService } from '../services/leadService';
import { getCplEvents } from '../services/monetization';
import type { Lead } from '../types';
import { formatMoney } from '../utils/format';
import { TIER_LABELS } from '../utils/leadScoring';
import { computeMetrics } from '../utils/metrics';

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function Breakdown({ title, data, money = false }: { title: string; data: Record<string, number>; money?: boolean }) {
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <section className="card p-5">
      <h2 className="label-mono mb-4">{title}</h2>
      {rows.length === 0 ? <p className="text-sm text-muted">Sin datos aún.</p> : (
        <ul className="space-y-2.5">
          {rows.map(([k, v]) => (
            <li key={k} className="text-sm">
              <div className="flex justify-between gap-3"><span className="truncate text-gray">{k}</span><span className="tnum text-white">{money ? formatMoney(v, 'PEN') : v}</span></div>
              <div className="mt-1 h-1.5 rounded-full bg-raise"><div className="h-full rounded-full bg-blue" style={{ width: `${(v / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Panel interno: métricas del funnel calculadas con los eventos locales (solo demo). */
export default function MetricsPage() {
  useSeo({ title: 'Métricas internas', noindex: true });
  const { catalog } = useCatalog();
  const [leads, setLeads] = useState<Lead[]>([]);
  useEffect(() => { void getLeadService().list().then(setLeads); }, []);

  const metrics = useMemo(() => {
    const events = getStoredEvents();
    const cpl = getCplEvents();
    const instName = (id: string) => catalog?.institutions.find((i) => i.id === id)?.short_name ?? id;
    const courseName = (id: string) => catalog?.byId.get(id)?.name ?? id;
    const m = computeMetrics(events, leads, cpl, (id) => catalog?.categories.find((c) => c.id === catalog.byId.get(id)?.category)?.name);
    const rename = (r: Record<string, number>, f: (k: string) => string) => Object.fromEntries(Object.entries(r).map(([k, v]) => [f(k), v]));
    return { ...m, revenueByInstitutionPEN: rename(m.revenueByInstitutionPEN, instName), revenueByCoursePEN: rename(m.revenueByCoursePEN, courseName) };
  }, [catalog, leads]);

  return (
    <div className="container-page pt-8">
      <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Métricas internas' }]} />
      <h1 className="mt-5 text-3xl text-white">Métricas del funnel</h1>
      <p className="mt-2 max-w-2xl text-sm text-gray">Vista interna de demostración. Calculada con los eventos y leads guardados en este navegador; en producción las mismas fórmulas se aplican sobre el warehouse.</p>

      <dl className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        {[
          ['Búsquedas', metrics.totals.searches],
          ['Vistas de programa', metrics.totals.views],
          ['Comparaciones', metrics.totals.comparisons],
          ['Leads', metrics.totals.leads],
          ['Search → View', pct(metrics.searchToViewRate)],
          ['View → Lead', pct(metrics.viewToLeadRate)],
          ['Compare → Lead', pct(metrics.comparisonToLeadRate)],
          ['Signal Score prom.', metrics.avgLeadScore.toFixed(0)],
          ['CPL promedio', formatMoney(metrics.avgCplPEN, 'PEN')],
          ['Revenue CPL', formatMoney(metrics.totals.revenuePEN, 'PEN')]
        ].map(([k, v]) => (
          <div key={k as string} className="card p-4">
            <dt className="label-mono text-[10px]">{k}</dt>
            <dd className="tnum mt-1 text-2xl font-semibold text-white">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Breakdown title="Leads por institución" data={metrics.leadsByInstitution} />
        <Breakdown title="Leads por programa" data={metrics.leadsByCourse} />
        <Breakdown title="Leads por categoría" data={metrics.leadsByCategory} />
        <Breakdown title="Leads por fuente (utm_source)" data={metrics.leadsBySource} />
        <Breakdown title="Leads por campaña" data={metrics.leadsByCampaign} />
        <Breakdown title="Revenue CPL por institución" data={metrics.revenueByInstitutionPEN} money />
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-xl text-white">Últimos leads</h2>
        {leads.length === 0 ? (
          <EmptyState icon="user" title="Sin leads todavía" description="Envía una solicitud desde cualquier programa para verla aquí con su Signal Score." />
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-midnight text-gray"><tr>{['Fecha', 'Programa', 'Institución', 'Score', 'Tier', 'Segmento', 'Fuente'].map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {[...leads].reverse().slice(0, 20).map((l) => (
                  <tr key={l.id} className="border-t border-line">
                    <td className="p-3 text-gray">{new Date(l.created_at).toLocaleString('es-PE')}</td>
                    <td className="p-3 text-white">{l.course_name}</td>
                    <td className="p-3 text-gray">{l.institution_name}</td>
                    <td className="tnum p-3 font-semibold text-white">{l.lead_score}</td>
                    <td className="p-3 font-mono text-xs text-cyan">{TIER_LABELS[l.lead_tier]}</td>
                    <td className="p-3 text-gray">{l.lead_segment}</td>
                    <td className="p-3 text-gray">{l.utm_source ?? l.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
