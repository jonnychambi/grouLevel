import { Link, useSearchParams } from 'react-router-dom';
import { LinkCards, PageHeader, Sections } from '../components/content/ContentBlocks';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { Icon } from '../components/ui/Icon';
import { useSeo } from '../hooks/useSeo';
import { ANALYZER_SECTIONS } from '../content/analyzer.mjs';
import { CAREERS, HUB_META, careerPath } from '../content/seoModel.mjs';
import { breadcrumbSchema } from '../utils/schema';

/** Landing indexable del analizador. El formulario vive en /mi-ruta y cada resultado (/mi-ruta/:id) es privado y noindex. */
export default function AnalyzerLandingPage() {
  const [params] = useSearchParams();
  const objective = params.get('objetivo');
  // La URL con ?objetivo= es la misma página: canonical sin parámetros.
  useSeo({ ...HUB_META.analizar, path: '/analizar-perfil', jsonLd: breadcrumbSchema([{ name: 'Inicio', path: '/' }, { name: 'Analizar perfil', path: '/analizar-perfil' }]) });
  const to = objective ? `/mi-ruta?objetivo=${encodeURIComponent(objective.slice(0, 160))}` : '/mi-ruta';
  return (
    <div className="container-page pb-16 pt-8">
      <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Analizar perfil' }]} />
      <PageHeader eyebrow="Diagnóstico de perfil · Gratis" title="Descubre qué habilidades necesitas para alcanzar tu próximo objetivo profesional." intro="Analiza tu experiencia, identifica tus brechas de habilidades y encuentra programas de formación alineados con tu carrera.">
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link to={to} className="btn btn-accent btn-lg"><Icon name="sparkle" size={17} />Analizar mi perfil gratis</Link>
          <span className="text-sm text-muted">Sin registro y sin costo. Tu resultado es privado.</span>
        </div>
      </PageHeader>
      <div className="mt-14"><Sections sections={ANALYZER_SECTIONS} /></div>
      <div className="mt-10"><Link to={to} className="btn btn-accent"><Icon name="sparkle" size={16} />Analizar mi perfil gratis</Link></div>
      <LinkCards title="¿Aún no tienes claro tu objetivo? Explora carreras" items={CAREERS.map((c) => ({ to: careerPath(c.slug), label: c.name }))} />
    </div>
  );
}
