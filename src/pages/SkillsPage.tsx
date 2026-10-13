import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnalyzerCta, LinkCards, PageHeader, ProgramsBlock, Sections, StatsLine, Updated } from '../components/content/ContentBlocks';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { Icon } from '../components/ui/Icon';
import { useCatalog } from '../hooks/useCatalog';
import { useSeo } from '../hooks/useSeo';
import { track } from '../services/analytics';
import { CONTENT_UPDATED, HUB_META, SKILLS, careerBySlug, careerPath, coursesForSkill, coursesPath, fitTitle, skillBySlug, skillLandings, skillPath, stats } from '../content/seoModel.mjs';
import { articleSchema, breadcrumbSchema } from '../utils/schema';
import NotFoundPage from './NotFoundPage';

export default function SkillsPage() {
  const { slug } = useParams();
  if (!slug) return <SkillsHub />;
  return skillBySlug.has(slug) ? <SkillDetail key={slug} slug={slug} /> : <NotFoundPage />;
}

function SkillsHub() {
  useSeo({ ...HUB_META.habilidades, path: '/habilidades', jsonLd: breadcrumbSchema([{ name: 'Inicio', path: '/' }, { name: 'Habilidades', path: '/habilidades' }]) });
  return (
    <div className="container-page pb-16 pt-8">
      <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Habilidades' }]} />
      <PageHeader eyebrow="Qué aprender" title="Habilidades tecnológicas" intro="Qué es cada habilidad, para qué sirve, qué perfiles la usan y dónde aprenderla." />
      <ul className="mt-10 grid gap-4 md:grid-cols-2">
        {SKILLS.map((s) => (
          <li key={s.slug}>
            <Link to={skillPath(s.slug)} className="card group flex h-full flex-col gap-2 p-6 transition-colors hover:border-cyan/40">
              <span className="flex items-center justify-between gap-3 text-xl font-medium text-white group-hover:text-cyan">{s.name}<Icon name="arrow-right" size={18} className="text-dim group-hover:text-cyan" /></span>
              <span className="text-gray">{s.description}</span>
            </Link>
          </li>
        ))}
      </ul>
      <AnalyzerCta />
    </div>
  );
}

function SkillDetail({ slug }: { slug: string }) {
  const skill = skillBySlug.get(slug)!;
  const { catalog, loading } = useCatalog();
  const list = useMemo(() => (catalog ? coursesForSkill(skill, catalog.courses) : []), [catalog, skill]);
  const hasLanding = useMemo(() => (catalog ? skillLandings(catalog.courses).some((l) => l.skill.slug === slug) : false), [catalog, slug]);
  const path = skillPath(slug);
  useSeo({
    title: fitTitle(skill.title), description: skill.description, path, type: 'article',
    jsonLd: [breadcrumbSchema([{ name: 'Inicio', path: '/' }, { name: 'Habilidades', path: '/habilidades' }, { name: skill.name, path }]), articleSchema(path, skill.title, skill.description, CONTENT_UPDATED)]
  });
  useEffect(() => {
    if (catalog) track('skill_viewed', { skill: slug, programs_count: list.length });
  }, [catalog, slug, list.length]);

  return (
    <div className="container-page pb-16 pt-8">
      <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Habilidades', to: '/habilidades' }, { label: skill.name }]} />
      <PageHeader eyebrow="Habilidad" title={skill.h1} intro={skill.intro} />
      <div className="mt-12"><Sections sections={skill.sections} /></div>
      <LinkCards title={`Perfiles que usan ${skill.name}`} items={(skill.careers ?? []).map((c) => careerBySlug.get(c)).filter((c) => !!c).map((c) => ({ to: careerPath(c!.slug), label: c!.name }))} />
      <section className="mt-14">
        <h2 className="text-2xl text-white sm:text-3xl">Programas para aprender {skill.name}</h2>
        {loading ? <div className="skeleton mt-5 h-40" /> : list.length ? (
          <>
            <StatsLine st={stats(list)} />
            <ProgramsBlock courses={list} limit={12} source="listado" moreTo={hasLanding ? coursesPath(slug) : undefined} moreLabel={`Comparar todos los cursos de ${skill.name}`} />
          </>
        ) : <p className="mt-3 text-gray">Por ahora hay poca oferta específica de {skill.name} en el catálogo.</p>}
      </section>
      <LinkCards title="Habilidades relacionadas" items={(skill.related ?? []).map((s) => skillBySlug.get(s)).filter((s) => !!s).map((s) => ({ to: skillPath(s!.slug), label: s!.name }))} />
      <AnalyzerCta />
      <Updated date={CONTENT_UPDATED} />
    </div>
  );
}
