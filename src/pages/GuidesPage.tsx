import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { AnalyzerCta, DataTable, LinkCards, PageHeader, Sections, Updated } from '../components/content/ContentBlocks';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { useCatalog } from '../hooks/useCatalog';
import { useSeo } from '../hooks/useSeo';
import { track } from '../services/analytics';
import {
  COMPARISONS, CONTENT_UPDATED, GUIDES, HUB_META, careerBySlug, careerPath, comparisonBySlug, comparisonPath, comparisonStats, fitTitle, guideBySlug, guidePath, skillBySlug, skillPath,
  type Comparison, type Guide
} from '../content/seoModel.mjs';
import { articleSchema, breadcrumbSchema } from '../utils/schema';
import NotFoundPage from './NotFoundPage';

/** /guias, /guias/:slug y /comparar/:slug (comparaciones editoriales). */
export default function GuidesPage({ comparison = false }: { comparison?: boolean }) {
  const { slug } = useParams();
  if (comparison) {
    const cmp = slug ? comparisonBySlug.get(slug) : undefined;
    return cmp ? <Article key={slug} item={cmp} comparison /> : <NotFoundPage />;
  }
  if (!slug) return <GuidesHub />;
  const guide = guideBySlug.get(slug);
  return guide ? <Article key={slug} item={guide} /> : <NotFoundPage />;
}

function GuidesHub() {
  useSeo({ ...HUB_META.guias, path: '/guias', jsonLd: breadcrumbSchema([{ name: 'Inicio', path: '/' }, { name: 'Guías', path: '/guias' }]) });
  return (
    <div className="container-page pb-16 pt-8">
      <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Guías' }]} />
      <PageHeader eyebrow="Orientación profesional" title="Guías para decidir qué estudiar" />
      <LinkCards title="Guías" items={GUIDES.map((g) => ({ to: guidePath(g.slug), label: g.h1, hint: g.description }))} />
      <LinkCards title="Comparaciones" items={COMPARISONS.map((c) => ({ to: comparisonPath(c.slug), label: c.h1, hint: c.description }))} />
      <AnalyzerCta />
    </div>
  );
}

const soles = (n: number) => `S/ ${Math.round(n).toLocaleString('en-US')}`;

function Article({ item, comparison = false }: { item: Guide | Comparison; comparison?: boolean }) {
  const { catalog } = useCatalog();
  const path = comparison ? comparisonPath(item.slug) : guidePath(item.slug);
  const rows = useMemo(() => (comparison && catalog ? comparisonStats(item as Comparison, catalog.courses) : []), [comparison, catalog, item]);
  useSeo({
    title: fitTitle(item.title), description: item.description, path, type: 'article',
    jsonLd: [breadcrumbSchema([{ name: 'Inicio', path: '/' }, { name: 'Guías', path: '/guias' }, { name: item.h1, path }]), articleSchema(path, item.title, item.description, CONTENT_UPDATED)]
  });
  useEffect(() => {
    track('landing_viewed', { kind: comparison ? 'comparacion' : 'guia', slug: item.slug, programs_count: 0 });
  }, [comparison, item.slug]);

  return (
    <div className="container-page pb-16 pt-8">
      <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Guías', to: '/guias' }, { label: item.h1 }]} />
      <PageHeader eyebrow={comparison ? 'Comparación' : 'Guía'} title={item.h1} intro={item.intro} />
      <div className="mt-12"><Sections sections={item.sections} /></div>
      {rows.length > 0 && (
        <section className="mt-10">
          <h2 className="text-2xl text-white sm:text-3xl">Lo que muestra el catálogo de Groulevel</h2>
          <DataTable
            caption="Datos del catálogo"
            head={['', 'Programas', 'Instituciones', 'Precio mediano', 'Horas (mediana)']}
            rows={rows.map((r) => [r.label, r.count, r.institutions, r.pricePEN ? soles(r.pricePEN.median) : 'Sin datos', r.hours ? r.hours.median : 'Sin datos'])}
          />
          <p className="mt-2 text-xs text-dim">Calculado con los programas publicados hoy en Groulevel. Solo se consideran precios publicados en soles.</p>
        </section>
      )}
      <LinkCards title="Habilidades relacionadas" items={(item.skills ?? []).map((s) => skillBySlug.get(s)).filter((s) => !!s).map((s) => ({ to: skillPath(s!.slug), label: s!.name }))} />
      <LinkCards title="Carreras relacionadas" items={(item.careers ?? []).map((c) => careerBySlug.get(c)).filter((c) => !!c).map((c) => ({ to: careerPath(c!.slug), label: c!.name }))} />
      <LinkCards title="Comparaciones" items={(item.comparisons ?? []).map((c) => comparisonBySlug.get(c)).filter((c) => !!c).map((c) => ({ to: comparisonPath(c!.slug), label: c!.h1 }))} />
      <LinkCards title="Guías" items={(item.guides ?? []).map((g) => guideBySlug.get(g)).filter((g) => !!g).map((g) => ({ to: guidePath(g!.slug), label: g!.h1 }))} />
      <AnalyzerCta title={comparison ? 'Encuentra el programa que mejor encaja contigo' : undefined} />
      <Updated date={CONTENT_UPDATED} />
    </div>
  );
}
