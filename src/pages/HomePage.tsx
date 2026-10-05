import { Link, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { SearchBar, POPULAR_SEARCHES } from '../components/search/SearchBar';
import { CourseGrid } from '../components/course/CourseGrid';
import { RecentlyViewed } from '../components/course/RecentlyViewed';
import { InstitutionLogo } from '../components/institution/InstitutionLogo';
import { Icon, type IconName } from '../components/ui/Icon';
import { PriceDisplay } from '../components/ui/PriceDisplay';
import { useCatalog } from '../hooks/useCatalog';
import { useCompare } from '../hooks/useCompare';
import { useSeo } from '../hooks/useSeo';
import { featuredCourses } from '../services/catalogService';
import { websiteSchema } from '../utils/schema';
import { PROGRAM_TYPE_LABELS } from '../utils/labels';
import type { ProgramType } from '../types';

/** Decoración "Growth Signals": ruido → señales → patrón → crecimiento (SVG estático, sin JS). */
function GrowthSignals() {
  const dots = useMemo(() => {
    const out: { x: number; y: number; r: number; c: string; o: number }[] = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 120; i++) {
      const t = i / 120;
      const x = 40 + t * 520 + (rnd() - 0.5) * (1 - t) * 160;
      const curve = 330 - Math.pow(t, 1.6) * 280;
      const y = curve + (rnd() - 0.5) * (1 - t) * 220;
      const c = t < 0.4 ? '#7657FF' : t < 0.75 ? '#246BFE' : '#00E7FF';
      out.push({ x, y, r: 0.8 + t * 2.6, c, o: 0.25 + t * 0.7 });
    }
    return out;
  }, []);
  return (
    <svg viewBox="0 0 600 380" className="pointer-events-none absolute -right-24 top-6 hidden h-[420px] w-[680px] opacity-70 md:block" aria-hidden="true">
      {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.c} opacity={d.o} />)}
      <circle cx="562" cy="48" r="9" fill="#00E7FF" />
      <circle cx="562" cy="48" r="22" fill="none" stroke="#00E7FF" strokeOpacity=".3" />
    </svg>
  );
}

const TYPES: { type: ProgramType; icon: IconName; hint: string }[] = [
  { type: 'curso', icon: 'book', hint: 'Habilidades puntuales' },
  { type: 'bootcamp', icon: 'target', hint: 'Cambio de carrera' },
  { type: 'diplomado', icon: 'award', hint: 'Especialización formal' },
  { type: 'maestria', icon: 'layers', hint: 'Posgrado' },
  { type: 'certificacion', icon: 'shield', hint: 'Credencial de industria' },
  { type: 'programa-ejecutivo', icon: 'chart', hint: 'Líderes y gerentes' }
];

export default function HomePage() {
  const { catalog, loading } = useCatalog();
  const { replace } = useCompare();
  const navigate = useNavigate();

  useSeo({ path: '/', jsonLd: websiteSchema() });

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    catalog?.courses.forEach((c) => m.set(c.category, (m.get(c.category) ?? 0) + 1));
    return m;
  }, [catalog]);

  const featured = catalog ? featuredCourses(catalog, 6) : [];
  // Ejemplo real del comparador: los 3 programas de Data Analytics/BI mejor valorados.
  const sample = useMemo(() => {
    if (!catalog) return [];
    const picked: typeof catalog.courses = [];
    const seen = new Set<string>();
    for (const c of featuredCourses(catalog, 400)) {
      if (c.category !== 'data-analytics' || c.price == null || c.duration_hours == null || seen.has(c.institution_id)) continue;
      picked.push(c);
      seen.add(c.institution_id);
      if (picked.length === 3) break;
    }
    return picked;
  }, [catalog]);

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 bg-[radial-gradient(80%_70%_at_75%_30%,#0d1838_0%,#050816_70%)]" aria-hidden="true" />
        <GrowthSignals />
        <div className="container-page relative pb-16 pt-14 sm:pb-24 sm:pt-24">
          <span className="eyebrow">Comparador de formación tecnológica</span>
          <h1 className="mt-5 max-w-3xl text-[40px] leading-[1.02] text-white sm:text-6xl lg:text-7xl">
            Encuentra la formación que te lleva al <span className="grad-text">siguiente nivel.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-gray sm:text-xl">
            Compara cursos, bootcamps, diplomados y maestrías en tecnología de las principales instituciones.
          </p>

          <SearchBar size="hero" source="home" className="mt-8 max-w-3xl" />

          <div className="mt-5 flex max-w-3xl flex-wrap items-center gap-2">
            <span className="mr-1 text-sm text-muted">Búsquedas populares:</span>
            {POPULAR_SEARCHES.map((s) => (
              <Link key={s} to={`/programas?q=${encodeURIComponent(s)}`} state={{ searchSource: 'home' }} className="chip">{s}</Link>
            ))}
          </div>

          <dl className="mt-14 grid max-w-3xl grid-cols-3 gap-4 border-t border-line pt-6">
            {[
              { k: 'Programas', v: catalog?.courses.length },
              { k: 'Instituciones', v: catalog?.institutions.length },
              { k: 'Áreas tech', v: catalog ? counts.size : undefined }
            ].map((s) => (
              <div key={s.k}>
                <dt className="label-mono">{s.k}</dt>
                <dd className="tnum mt-1 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{s.v ?? '—'}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section className="container-page py-16 sm:py-20" aria-labelledby="how-title">
        <h2 id="how-title" className="max-w-2xl text-3xl text-white sm:text-4xl">Decide con información comparable, no con anuncios.</h2>
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { n: '01', t: 'Descubre', d: 'Busca por tema, herramienta o institución y filtra por precio, modalidad, duración y nivel.', icon: 'search' as IconName },
            { n: '02', t: 'Compara', d: 'Pon hasta 3 programas lado a lado con criterios homogéneos: precio, horas, certificación, docentes.', icon: 'compare' as IconName },
            { n: '03', t: 'Decide', d: 'Solicita información solo cuando estés listo. Sin registro para explorar ni comparar.', icon: 'check' as IconName }
          ].map((s) => (
            <li key={s.n} className="card p-6">
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-line-strong text-cyan"><Icon name={s.icon} size={20} /></span>
                <span className="font-mono text-sm text-dim">{s.n}</span>
              </div>
              <h3 className="mt-5 text-xl text-white">{s.t}</h3>
              <p className="mt-2 text-gray">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* CATEGORÍAS */}
      <section className="container-page py-8" aria-labelledby="cat-title">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <span className="label-mono">Áreas</span>
            <h2 id="cat-title" className="mt-2 text-3xl text-white sm:text-4xl">Explora por área</h2>
          </div>
          <Link to="/programas" className="btn btn-ghost btn-sm hidden sm:inline-flex">Ver todos <Icon name="arrow-right" size={15} /></Link>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {(catalog?.categories.filter((c) => (counts.get(c.id) ?? 0) > 0) ?? Array.from({ length: 8 }, (_, i) => ({ id: String(i), slug: '', name: '', group: '' }))).map((c) => (
            <li key={c.id}>
              {loading ? (
                <div className="skeleton h-[84px]" />
              ) : (
                <Link to={`/programas/${c.slug}`} className="card group flex h-full flex-col justify-between gap-3 p-4 transition-colors hover:border-cyan/40">
                  <span className="label-mono text-[10px]">{c.group}</span>
                  <span className="flex items-end justify-between gap-2">
                    <span className="font-medium leading-tight text-white group-hover:text-cyan">{c.name}</span>
                    <span className="tnum shrink-0 font-mono text-xs text-muted">{counts.get(c.id) ?? 0}</span>
                  </span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* COMPARADOR TEASER */}
      {sample.length === 3 && (
        <section className="container-page py-16 sm:py-20" aria-labelledby="cmp-title">
          <div className="card overflow-hidden lg:grid lg:grid-cols-[1fr_1.35fr]">
            <div className="p-6 sm:p-10">
              <span className="eyebrow">La función estrella</span>
              <h2 id="cmp-title" className="mt-4 text-3xl text-white sm:text-4xl">Entiende las diferencias en segundos.</h2>
              <p className="mt-4 text-gray">Precio, duración, modalidad, certificación, docentes, herramientas y financiamiento en una sola vista. Resaltamos lo que cambia entre opciones.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button className="btn btn-accent" onClick={() => { replace(sample.map((c) => c.id)); navigate('/comparar'); }}>
                  Comparar estos 3 programas
                </button>
                <Link to="/programas" className="btn btn-ghost">Elegir los míos</Link>
              </div>
            </div>
            <div className="border-t border-line bg-navy/60 p-4 sm:p-6 lg:border-l lg:border-t-0">
              <table className="w-full table-fixed text-left text-sm">
                <caption className="sr-only">Vista previa del comparador</caption>
                <thead>
                  <tr>
                    <th className="w-20 pb-3 sm:w-24"><span className="sr-only">Atributo</span></th>
                    {sample.map((c) => (
                      <th key={c.id} className="pb-3 pl-2 align-top font-normal">
                        <InstitutionLogo institution={c.institution} size={28} />
                        <span className="mt-2 line-clamp-2 block text-xs font-medium leading-tight text-white sm:text-sm">{c.name}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="[&_td]:border-t [&_td]:border-line [&_td]:py-3 [&_td]:pl-2 [&_th]:border-t [&_th]:border-line [&_th]:py-3">
                  <tr>
                    <th scope="row" className="label-mono text-[10px]">Precio</th>
                    {sample.map((c) => <td key={c.id}><PriceDisplay course={c} size="sm" showFrom={false} /></td>)}
                  </tr>
                  <tr>
                    <th scope="row" className="label-mono text-[10px]">Duración</th>
                    {sample.map((c) => <td key={c.id} className="tnum font-semibold text-white">{c.duration_hours} h</td>)}
                  </tr>
                  <tr>
                    <th scope="row" className="label-mono text-[10px]">Tipo</th>
                    {sample.map((c) => <td key={c.id} className="text-gray">{PROGRAM_TYPE_LABELS[c.program_type]}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* DESTACADOS */}
      <section className="container-page py-8" aria-labelledby="feat-title">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <span className="label-mono">Selección</span>
            <h2 id="feat-title" className="mt-2 text-3xl text-white sm:text-4xl">Programas para empezar a comparar</h2>
            <p className="mt-2 text-sm text-muted">Programas con información más completa y próximos inicios. Los marcados como “Destacado” son posiciones patrocinadas.</p>
          </div>
        </div>
        <CourseGrid courses={featured} loading={loading} source="home" />
        <div className="mt-8 text-center">
          <Link to="/programas" className="btn btn-primary">Explorar todos los programas</Link>
        </div>
      </section>

      {/* TIPOS */}
      <section className="container-page py-16" aria-labelledby="types-title">
        <h2 id="types-title" className="text-2xl text-white sm:text-3xl">¿Qué tipo de formación buscas?</h2>
        <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {TYPES.map((t) => (
            <li key={t.type}>
              <Link to={`/programas?tipo=${t.type}`} className="card flex h-full flex-col gap-3 p-4 transition-colors hover:border-cyan/40">
                <Icon name={t.icon} className="text-cyan" />
                <span>
                  <span className="block font-medium text-white">{PROGRAM_TYPE_LABELS[t.type]}</span>
                  <span className="text-xs text-muted">{t.hint}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <RecentlyViewed className="container-page py-8" />

      {/* B2B */}
      <section className="container-page pt-16">
        <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-violet/30 bg-[linear-gradient(135deg,rgba(118,87,255,.16),rgba(36,107,254,.08)_50%,rgba(0,231,255,.06))] p-8 sm:p-12">
          <span className="label-mono text-violet-soft">Para instituciones</span>
          <h2 className="mt-3 max-w-2xl text-3xl text-white sm:text-4xl">Conecta tus programas con profesionales que están buscando dónde estudiar.</h2>
          <p className="mt-3 max-w-xl text-gray">Leads calificados con Signal Score™, visibilidad destacada y métricas de interés por programa.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/instituciones/partners" className="btn btn-primary">Publicar mis programas</Link>
            <Link to="/instituciones/partners#contacto" className="btn btn-ghost">Hablar con Groulevel</Link>
          </div>
        </div>
      </section>
    </>
  );
}
