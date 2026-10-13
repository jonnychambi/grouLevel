import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CourseList } from '../course/CourseList';
import { Icon } from '../ui/Icon';
import type { ContentSection, Stats } from '../../content/seoModel.mjs';
import type { CourseWithInstitution, LeadSource } from '../../types';

/** Secciones editoriales (h2 + párrafos, listas, tablas y notas) con el estilo del sitio. */
export function Sections({ sections }: { sections: ContentSection[] }) {
  return (
    <div className="space-y-10">
      {sections.map((s) => (
        <section key={s.h2}>
          <h2 className="text-2xl text-white sm:text-3xl">{s.h2}</h2>
          {s.p?.map((t) => <p key={t} className="mt-3 max-w-3xl text-gray">{t}</p>)}
          {s.ul && <ul className="mt-4 max-w-3xl space-y-2">{s.ul.map((t) => <li key={t} className="flex gap-2.5 text-gray"><Icon name="check" size={16} className="mt-1 shrink-0 text-cyan" />{t}</li>)}</ul>}
          {s.ol && (
            <ol className="mt-4 max-w-3xl space-y-2.5">
              {s.ol.map((t, i) => (
                <li key={t} className="flex gap-3 text-gray">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-cyan/50 font-mono text-xs text-cyan">{i + 1}</span>
                  <span className="pt-0.5">{t}</span>
                </li>
              ))}
            </ol>
          )}
          {s.table && <DataTable head={s.table.head} rows={s.table.rows} />}
          {s.note && <p className="mt-3 max-w-3xl text-sm italic text-muted">{s.note}</p>}
        </section>
      ))}
    </div>
  );
}

export function DataTable({ head, rows, caption }: { head: string[]; rows: ReactNode[][]; caption?: string }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-[var(--radius-card)] border border-line">
      <table className="w-full min-w-[520px] text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-surface">
          <tr>{head.map((h, i) => <th key={i} scope="col" className="px-4 py-3 font-medium text-white">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row" className="px-4 py-3 align-top font-medium text-white">{c}</th> : <td key={j} className="px-4 py-3 align-top text-gray">{c}</td>))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PageHeader({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro?: string; children?: ReactNode }) {
  return (
    <header className="mt-6 max-w-4xl">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-3 text-4xl leading-[1.06] text-white sm:text-5xl">{title}</h1>
      {intro && <p className="mt-4 text-lg text-gray">{intro}</p>}
      {children}
    </header>
  );
}

const soles = (n: number) => `S/ ${Math.round(n).toLocaleString('en-US')}`;

/** Resumen con datos reales del catálogo (sin estimaciones). */
export function StatsLine({ st }: { st: Stats }) {
  const parts = [
    `${st.count} programas de ${st.institutions} instituciones`,
    st.pricePEN ? `precios publicados desde ${soles(st.pricePEN.min)}` : null,
    st.live ? `${st.live} con clases en vivo o presenciales` : null
  ].filter(Boolean);
  return <p className="mt-3 text-sm text-muted">{parts.join(', ')}.</p>;
}

/** Listado de programas: primero los que tienen clases en vivo; los grabados aparte. */
export function ProgramsBlock({ courses, limit, source, moreTo, moreLabel }: { courses: CourseWithInstitution[]; limit?: number; source: LeadSource; moreTo?: string; moreLabel?: string }) {
  const [expanded, setExpanded] = useState(false);
  const live = courses.filter((c) => c.modality !== 'grabado');
  const recorded = courses.filter((c) => c.modality === 'grabado');
  const all = expanded || !limit;
  const shownLive = all ? live : live.slice(0, limit);
  const shownRecorded = all ? recorded : recorded.slice(0, Math.max(0, limit - live.length));
  return (
    <div className="mt-5">
      {shownLive.length > 0 && <CourseList courses={shownLive} source={source} />}
      {shownRecorded.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-3 text-lg text-white">Cursos grabados (a tu ritmo)</h3>
          <CourseList courses={shownRecorded} source={source} />
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        {limit && courses.length > limit && !expanded && <button className="btn btn-ghost btn-sm" onClick={() => setExpanded(true)}>Ver los {courses.length} programas</button>}
        {moreTo && <Link to={moreTo} className="btn btn-quiet btn-sm">{moreLabel} <Icon name="arrow-right" size={15} /></Link>}
      </div>
    </div>
  );
}

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  if (!items.length) return null;
  return (
    <section className="mt-14" aria-labelledby="faq-title">
      <h2 id="faq-title" className="text-2xl text-white sm:text-3xl">Preguntas frecuentes</h2>
      <dl className="mt-5 divide-y divide-line border-y border-line">
        {items.map((f) => (
          <div key={f.q} className="py-5">
            <dt className="font-medium text-white">{f.q}</dt>
            <dd className="mt-2 max-w-3xl text-gray">{f.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function LinkCards({ title, items }: { title: string; items: { to: string; label: string; hint?: string }[] }) {
  if (!items.length) return null;
  return (
    <section className="mt-14">
      <h2 className="text-2xl text-white sm:text-3xl">{title}</h2>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => (
          <li key={i.to}>
            <Link to={i.to} className="card group flex h-full flex-col gap-1.5 p-4 transition-colors hover:border-cyan/40">
              <span className="flex items-center justify-between gap-2 font-medium text-white group-hover:text-cyan">{i.label}<Icon name="arrow-right" size={15} className="shrink-0 text-dim group-hover:text-cyan" /></span>
              {i.hint && <span className="text-sm text-muted">{i.hint}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Llamado al analizador de perfil (con objetivo precargado si aplica). */
export function AnalyzerCta({ title = 'Descubre qué te falta para alcanzar tu objetivo', text = 'Analiza tu perfil gratis: identificamos tus habilidades, la brecha con el rol que buscas y una ruta de formación con programas que puedes comparar.', objective, label = 'Analiza tu perfil gratis' }: { title?: string; text?: string; objective?: string; label?: string }) {
  return (
    <section className="card relative mt-14 overflow-hidden p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-20 -top-28 h-64 w-64 rounded-full bg-violet/25 blur-3xl" aria-hidden="true" />
      <div className="relative">
        <h2 className="text-2xl text-white sm:text-3xl">{title}</h2>
        <p className="mt-2 max-w-2xl text-gray">{text}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to={objective ? `/analizar-perfil?objetivo=${encodeURIComponent(objective)}` : '/analizar-perfil'} className="btn btn-accent"><Icon name="sparkle" size={16} />{label}</Link>
          <Link to="/comparar" className="btn btn-ghost">Comparar programas</Link>
        </div>
      </div>
    </section>
  );
}

export function Updated({ date }: { date: string }) {
  return <p className="mt-10 text-xs text-dim">Contenido actualizado: {date}.</p>;
}
