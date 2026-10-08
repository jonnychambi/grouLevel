import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Category } from '../../types';
import { fetchDemand, type DemandMetrics, type DemandReport } from '../../services/adminApi';
import { Icon } from '../ui/Icon';

const num = (n: number) => n.toLocaleString('es-PE');
const rate = (leads: number, views: number) => (views ? `${((leads / views) * 100).toFixed(1)}%` : '—');
const shortDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });

type SortKey = 'views' | 'compares' | 'favorites' | 'outbound' | 'leads' | 'conv';
const sortValue = (r: DemandMetrics, k: SortKey) => (k === 'conv' ? (r.views ? r.leads / r.views : 0) : r[k]);

function csv(name: string, rows: (string | number)[][]) {
  const text = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([`﻿${text}`], { type: 'text/csv;charset=utf-8' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Barras horizontales de una sola serie (magnitud): etiqueta, valor y solicitudes como dato secundario. */
function Ranking({ title, rows, empty = 'Sin datos en el período.' }: { title: string; rows: { label: string; sub?: string; views: number; leads: number }[]; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.views));
  return (
    <section className="card p-5">
      <h2 className="label-mono">{title}</h2>
      {!rows.length ? <p className="mt-3 text-sm text-muted">{empty}</p> : (
        <ul className="mt-3 space-y-2.5">
          {rows.map((r) => (
            <li key={`${r.label}-${r.sub ?? ''}`} className="text-sm" title={`${r.label}${r.sub ? ` (${r.sub})` : ''}: ${num(r.views)} vistas · ${num(r.leads)} solicitudes · conversión ${rate(r.leads, r.views)}`}>
              <div className="flex justify-between gap-3">
                <span className="min-w-0 truncate text-gray">{r.label}{r.sub && <span className="text-muted"> · {r.sub}</span>}</span>
                <span className="tnum shrink-0 text-white">{num(r.views)} <span className="text-muted">· {num(r.leads)} sol.</span></span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-raise"><div className="h-full rounded-full bg-blue" style={{ width: `${Math.max(2, (r.views / max) * 100)}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Vistas por día (columnas de una serie) con tooltip nativo por columna. */
function Trend({ daily, days }: { daily: DemandReport['daily']; days: number }) {
  const series = useMemo(() => {
    const byDay = new Map(daily.map((d) => [d.day, d]));
    const out: { day: string; views: number; leads: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = new Date(Date.now() - i * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
      const d = byDay.get(day);
      out.push({ day, views: d?.views ?? 0, leads: d?.leads ?? 0 });
    }
    return out;
  }, [daily, days]);
  const max = Math.max(1, ...series.map((s) => s.views));
  return (
    <section className="card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="label-mono">Vistas de programas por día</h2>
        <span className="text-xs text-muted">Pasa el cursor sobre una columna para ver el detalle</span>
      </div>
      <div className="mt-4 flex h-32 items-end gap-[2px]" role="img" aria-label={`Vistas por día en los últimos ${days} días`}>
        {series.map((s) => (
          <div key={s.day} className="group relative flex h-full flex-1 items-end" title={`${shortDay(s.day)}: ${num(s.views)} vistas · ${num(s.leads)} solicitudes`}>
            <div className="w-full rounded-t-[4px] bg-blue/80 transition-colors group-hover:bg-cyan" style={{ height: `${s.views ? Math.max(3, (s.views / max) * 100) : 0}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted"><span>{shortDay(series[0]?.day ?? '')}</span><span>{shortDay(series.at(-1)?.day ?? '')}</span></div>
    </section>
  );
}

function SortTh({ k, label, sort, setSort }: { k: SortKey; label: string; sort: SortKey; setSort: (k: SortKey) => void }) {
  return (
    <th className="px-3 py-2 text-right">
      <button onClick={() => setSort(k)} className={`inline-flex items-center gap-1 ${sort === k ? 'text-white' : 'hover:text-white'}`} aria-sort={sort === k ? 'descending' : undefined}>
        {label}{sort === k && <Icon name="chevron-down" size={12} />}
      </button>
    </th>
  );
}

/** Panel de Demanda: qué programas e instituciones generan interés y desde dónde llega esa gente. */
export function DemandPanel({ categories, onError }: { categories: Category[]; onError: (e: unknown) => void }) {
  const [days, setDays] = useState(30);
  const [channel, setChannel] = useState('');
  const [country, setCountry] = useState('');
  const [category, setCategory] = useState('');
  const [data, setData] = useState<DemandReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<SortKey>('views');
  const [instSort, setInstSort] = useState<SortKey>('views');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(25);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchDemand({ days, channel, country, category }));
    } catch (e) {
      onError(e);
    } finally {
      setLoading(false);
    }
  }, [days, channel, country, category, onError]);
  useEffect(() => { void load(); }, [load]);

  const courses = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...(data?.courses ?? [])]
      .filter((c) => !q || `${c.name} ${c.institution_name}`.toLowerCase().includes(q))
      .sort((a, b) => sortValue(b, sort) - sortValue(a, sort));
  }, [data, sort, query]);
  const institutions = useMemo(() => [...(data?.institutions ?? [])].sort((a, b) => sortValue(b, instSort) - sortValue(a, instSort)), [data, instSort]);
  const t = data?.totals;
  const filtered = !!(channel || country || category);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-white">Rendimiento</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray">Qué programas e instituciones generan más interés y desde dónde llega la gente. Conteo propio y anónimo (sin datos personales), independiente de GA4 y del banner de cookies. Las solicitudes se cuentan al guardarse.</p>
        </div>
        <button className="btn btn-quiet btn-sm" onClick={() => void load()} disabled={loading}>{loading ? 'Cargando…' : 'Actualizar'}</button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Período" className="flex rounded-full border border-line p-0.5">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)} aria-pressed={days === d} className={`h-8 rounded-full px-3 text-sm ${days === d ? 'bg-raise text-white' : 'text-gray hover:text-white'}`}>{d} días</button>
          ))}
        </div>
        <select aria-label="Canal" className="input min-h-9 w-auto cursor-pointer py-1.5 text-sm" value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="">Todos los canales</option>
          {(data?.options.channels ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select aria-label="País" className="input min-h-9 w-auto cursor-pointer py-1.5 text-sm" value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="">Todos los países</option>
          {(data?.options.countries ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select aria-label="Área" className="input min-h-9 w-auto cursor-pointer py-1.5 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Todas las áreas</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {filtered && <button className="text-sm text-blue-soft hover:text-white" onClick={() => { setChannel(''); setCountry(''); setCategory(''); }}>Quitar filtros</button>}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ['Vistas de programas', t?.views],
          ['Comparaciones', t?.compares],
          ['Favoritos', t?.favorites],
          ['Clics a la institución', t?.outbound],
          ['Solicitudes', t?.leads]
        ].map(([label, v]) => (
          <div key={label as string} className="card p-4"><dt className="text-xs text-gray">{label}</dt><dd className="tnum mt-1 text-2xl text-white">{v == null ? '—' : num(v as number)}</dd></div>
        ))}
        <div className="card p-4"><dt className="text-xs text-gray">Conversión (sol./vistas)</dt><dd className="tnum mt-1 text-2xl text-white">{t ? rate(t.leads, t.views) : '—'}</dd></div>
      </dl>

      {data && t && t.views + t.leads + t.institution_views === 0 && (
        <p className="mt-4 rounded-xl border border-cyan/30 bg-cyan/5 p-3 text-sm text-gray">
          <Icon name="info" size={15} className="mr-1.5 inline text-cyan" />
          Aún no hay datos en este período{filtered ? ' con estos filtros' : ''}. El conteo empieza desde que se activó este panel; el histórico anterior está en Google Analytics.
        </p>
      )}

      {data && (
        <>
          <div className="mt-5"><Trend daily={data.daily} days={data.days} /></div>

          <h2 className="mt-10 text-lg text-white">Origen de las visitas</h2>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <Ranking title="Por canal" rows={data.channels.map((c) => ({ label: c.key, views: c.views + c.institution_views, leads: c.leads }))} />
            <section className="card p-5">
              <h2 className="label-mono">Fuentes y campañas</h2>
              {!data.sources.length ? <p className="mt-3 text-sm text-muted">Sin fuentes identificadas (tráfico directo).</p> : (
                <table className="mt-3 w-full text-left text-sm">
                  <thead className="text-xs text-muted"><tr><th className="py-1">Fuente</th><th className="py-1">Campaña</th><th className="py-1 text-right">Vistas</th><th className="py-1 text-right">Sol.</th></tr></thead>
                  <tbody className="tnum">
                    {data.sources.map((s) => (
                      <tr key={`${s.channel}-${s.source}-${s.campaign}`} className="border-t border-line">
                        <td className="py-1.5 text-white">{s.source || '—'} <span className="text-xs text-muted">{s.channel}</span></td>
                        <td className="py-1.5 text-gray">{s.campaign || '—'}</td>
                        <td className="py-1.5 text-right text-white">{num(s.views)}</td>
                        <td className="py-1.5 text-right text-white">{num(s.leads)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
            <Ranking title="Por país" rows={data.countries.map((c) => ({ label: c.key || 'Sin identificar', views: c.views + c.institution_views, leads: c.leads }))} />
            <Ranking title="Por ciudad" rows={data.cities.map((c) => ({ label: c.key, sub: c.country, views: c.views + c.institution_views, leads: c.leads }))} />
            <Ranking title="Por dispositivo" rows={data.devices.map((d) => ({ label: d.key || 'Sin identificar', views: d.views + d.institution_views, leads: d.leads }))} />
          </div>

          <div className="mt-10 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg text-white">Programas <span className="text-gray">({num(courses.length)})</span></h2>
            <div className="flex gap-2">
              <input className="input min-h-9 w-56 py-1.5 text-sm" placeholder="Buscar programa o institución" value={query} onChange={(e) => setQuery(e.target.value)} />
              <button className="btn btn-quiet btn-sm" onClick={() => csv(`demanda-programas-${data.days}d.csv`, [
                ['Programa', 'Institución', 'Vistas', 'Comparaciones', 'Favoritos', 'Clics a la institución', 'Abrió formulario', 'Solicitudes', 'Conversión'],
                ...courses.map((c) => [c.name ?? c.course_id, c.institution_name ?? '', c.views, c.compares, c.favorites, c.outbound, c.lead_opens, c.leads, rate(c.leads, c.views)])
              ])}>Exportar CSV</button>
            </div>
          </div>
          <div className="mt-3 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-midnight text-xs text-gray">
                <tr>
                  <th className="px-3 py-2">#</th><th className="px-3 py-2">Programa</th>
                  <SortTh k="views" label="Vistas" sort={sort} setSort={setSort} />
                  <SortTh k="compares" label="Comparaciones" sort={sort} setSort={setSort} />
                  <SortTh k="favorites" label="Favoritos" sort={sort} setSort={setSort} />
                  <SortTh k="outbound" label="Clics web" sort={sort} setSort={setSort} />
                  <SortTh k="leads" label="Solicitudes" sort={sort} setSort={setSort} />
                  <SortTh k="conv" label="Conversión" sort={sort} setSort={setSort} />
                </tr>
              </thead>
              <tbody className="tnum">
                {courses.slice(0, limit).map((c, i) => (
                  <tr key={c.course_id} className="border-t border-line">
                    <td className="px-3 py-2 text-muted">{i + 1}</td>
                    <td className="max-w-[360px] px-3 py-2">
                      {c.slug ? <a href={`/programa/${c.slug}`} target="_blank" rel="noreferrer" className="block truncate text-white hover:text-cyan">{c.name}</a> : <span className="text-muted">{c.course_id} (eliminado)</span>}
                      <span className="block truncate text-xs text-gray">{c.institution_name}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-white">{num(c.views)}</td>
                    <td className="px-3 py-2 text-right text-gray">{num(c.compares)}</td>
                    <td className="px-3 py-2 text-right text-gray">{num(c.favorites)}</td>
                    <td className="px-3 py-2 text-right text-gray">{num(c.outbound)}</td>
                    <td className="px-3 py-2 text-right text-white">{num(c.leads)}</td>
                    <td className="px-3 py-2 text-right text-gray">{rate(c.leads, c.views)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!courses.length && <p className="px-3 py-4 text-sm text-gray">Sin datos.</p>}
            {courses.length > limit && <button className="w-full border-t border-line py-2 text-sm text-blue-soft hover:text-white" onClick={() => setLimit((l) => l + 50)}>Ver más ({num(courses.length - limit)})</button>}
          </div>

          <div className="mt-10 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg text-white">Instituciones <span className="text-gray">({num(institutions.length)})</span></h2>
            <button className="btn btn-quiet btn-sm" onClick={() => csv(`demanda-instituciones-${data.days}d.csv`, [
              ['Institución', 'Programas con actividad', 'Vistas de programas', 'Vistas de la ficha', 'Comparaciones', 'Clics a la institución', 'Solicitudes', 'Conversión'],
              ...institutions.map((i) => [i.name ?? i.institution_id, i.programs, i.views, i.institution_views, i.compares, i.outbound, i.leads, rate(i.leads, i.views)])
            ])}>Exportar CSV</button>
          </div>
          <div className="mt-3 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-midnight text-xs text-gray">
                <tr>
                  <th className="px-3 py-2">#</th><th className="px-3 py-2">Institución</th><th className="px-3 py-2 text-right">Programas</th>
                  <SortTh k="views" label="Vistas" sort={instSort} setSort={setInstSort} />
                  <th className="px-3 py-2 text-right">Vistas ficha</th>
                  <SortTh k="compares" label="Comparaciones" sort={instSort} setSort={setInstSort} />
                  <SortTh k="outbound" label="Clics web" sort={instSort} setSort={setInstSort} />
                  <SortTh k="leads" label="Solicitudes" sort={instSort} setSort={setInstSort} />
                  <SortTh k="conv" label="Conversión" sort={instSort} setSort={setInstSort} />
                </tr>
              </thead>
              <tbody className="tnum">
                {institutions.map((i, n) => (
                  <tr key={i.institution_id} className="border-t border-line">
                    <td className="px-3 py-2 text-muted">{n + 1}</td>
                    <td className="px-3 py-2">{i.slug ? <a href={`/institucion/${i.slug}`} target="_blank" rel="noreferrer" className="text-white hover:text-cyan">{i.name}</a> : <span className="text-muted">{i.institution_id}</span>}</td>
                    <td className="px-3 py-2 text-right text-gray">{num(i.programs)}</td>
                    <td className="px-3 py-2 text-right text-white">{num(i.views)}</td>
                    <td className="px-3 py-2 text-right text-gray">{num(i.institution_views)}</td>
                    <td className="px-3 py-2 text-right text-gray">{num(i.compares)}</td>
                    <td className="px-3 py-2 text-right text-gray">{num(i.outbound)}</td>
                    <td className="px-3 py-2 text-right text-white">{num(i.leads)}</td>
                    <td className="px-3 py-2 text-right text-gray">{rate(i.leads, i.views)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!institutions.length && <p className="px-3 py-4 text-sm text-gray">Sin datos.</p>}
          </div>
          <p className="mt-4 text-xs text-muted">País y ciudad son aproximados (según la red de la visita); no se guarda la IP. "Clics web" = clics al sitio oficial de la institución. Conversión = solicitudes ÷ vistas del programa.</p>
        </>
      )}
    </div>
  );
}
