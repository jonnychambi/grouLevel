import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnalyzerCta, Faq, LinkCards, PageHeader, ProgramsBlock, StatsLine } from '../components/content/ContentBlocks';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { PageFallback } from '../components/layout/Layout';
import { useCatalog } from '../hooks/useCatalog';
import { useSeo } from '../hooks/useSeo';
import { track } from '../services/analytics';
import {
  HUB_META, TYPE_PATHS, TYPE_PLURAL, TYPE_SINGULAR, careerBySlug, careerPath, coursesHubDescription, coursesPath, faqFor, rankCourses,
  skillLandingMeta, skillLandings, skillPath, stats, typeAreaLandings, typeAreaMeta, typeAreaPath, typeHubMeta
} from '../content/seoModel.mjs';
import { breadcrumbSchema, itemListSchema } from '../utils/schema';
import { typeHubCopy } from '../content/meta.mjs';
import type { CourseWithInstitution } from '../types';
import NotFoundPage from './NotFoundPage';

const instNames = (list: CourseWithInstitution[]) => [...new Set(list.map((c) => c.institution.name))];

/**
 * Páginas transaccionales generadas con el catálogo: /cursos, /cursos/:habilidad, /{tipo} y /{tipo}/:area.
 * Solo existen si superan el mínimo de oferta (ver seoModel.mjs); si no, 404 (igual que el servidor).
 */
export default function CatalogLandingPage({ type }: { type?: keyof typeof TYPE_PATHS }) {
  const { slug } = useParams();
  const { catalog, loading } = useCatalog();
  if (loading || !catalog) return <PageFallback />;
  if (!type) return slug ? <SkillLanding slug={slug} courses={catalog.courses} /> : <CoursesHub courses={catalog.courses} />;
  return slug ? <TypeAreaLanding type={type} slug={slug} courses={catalog.courses} categories={catalog.categories} /> : <TypeHub type={type} courses={catalog.courses} categories={catalog.categories} />;
}

function CoursesHub({ courses }: { courses: CourseWithInstitution[] }) {
  const landings = useMemo(() => skillLandings(courses), [courses]);
  useSeo({ title: HUB_META.cursos.title, description: coursesHubDescription(landings), path: '/cursos', jsonLd: breadcrumbSchema([{ name: 'Inicio', path: '/' }, { name: 'Cursos', path: '/cursos' }]) });
  return (
    <div className="container-page pb-16 pt-8">
      <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Cursos' }]} />
      <PageHeader eyebrow="Compara por habilidad" title="Cursos de tecnología por habilidad" intro="Elige la habilidad que quieres aprender y compara los programas que la enseñan: precio, duración, modalidad, institución y contenido. Solo listamos habilidades con oferta suficiente para comparar." />
      <LinkCards title="Habilidades" items={landings.map((l) => ({ to: coursesPath(l.skill.slug), label: `Cursos de ${l.skill.name}`, hint: `${l.courses.length} programas` }))} />
      <p className="mt-8"><Link to="/programas" className="btn btn-ghost btn-sm">Ver todos los programas</Link></p>
    </div>
  );
}

function SkillLanding({ slug, courses }: { slug: string; courses: CourseWithInstitution[] }) {
  const landing = useMemo(() => skillLandings(courses).find((l) => l.skill.slug === slug), [courses, slug]);
  if (!landing) return <NotFoundPage />;
  const { skill, courses: list } = landing;
  return (
    <Landing
      kind="cursos" slug={slug} list={list} meta={skillLandingMeta(skill, stats(list))} path={coursesPath(slug)}
      crumbs={[{ label: 'Cursos', to: '/cursos' }, { label: skill.name }]} eyebrow="Cursos por habilidad" h1={`Cursos de ${skill.name}`} intro={skill.courseIntro} faqLabel={skill.name}
      links={[{ to: skillPath(skill.slug), label: `Qué es ${skill.name} y cómo aprenderlo` }, ...(skill.careers ?? []).map((c) => careerBySlug.get(c)).filter((c) => !!c).map((c) => ({ to: careerPath(c!.slug), label: c!.h1 }))]}
    />
  );
}

type Cat = { id: string; slug: string; name: string; description?: string | null };

function TypeHub({ type, courses, categories }: { type: keyof typeof TYPE_PATHS; courses: CourseWithInstitution[]; categories: Cat[] }) {
  const all = useMemo(() => rankCourses(courses.filter((c) => c.program_type === type)), [courses, type]);
  const areas = useMemo(() => typeAreaLandings(courses, categories).filter((l) => l.type === type), [courses, categories, type]);
  if (all.length < 3) return <NotFoundPage />;
  return (
    <Landing
      kind="tipo" slug={type} list={all} meta={typeHubMeta(type, stats(all))} path={`/${TYPE_PATHS[type]}`}
      crumbs={[{ label: TYPE_PLURAL[type] }]} eyebrow="Compara por tipo" h1={typeHubCopy(type).h1} intro={typeHubCopy(type).subtitle} note={typeHubCopy(type).note} faqLabel={TYPE_SINGULAR[type]}
      areas={areas.map((l) => ({ to: typeAreaPath(type, l.category.slug), label: `${TYPE_PLURAL[type]} en ${l.category.name}`, hint: `${l.courses.length} programas` }))}
    />
  );
}

function TypeAreaLanding({ type, slug, courses, categories }: { type: keyof typeof TYPE_PATHS; slug: string; courses: CourseWithInstitution[]; categories: Cat[] }) {
  const landing = useMemo(() => typeAreaLandings(courses, categories).find((l) => l.type === type && l.category.slug === slug), [courses, categories, type, slug]);
  if (!landing) return <NotFoundPage />;
  const { category, courses: list } = landing;
  const { label, ...meta } = typeAreaMeta(type, category, stats(list));
  return (
    <Landing
      kind="tipo-area" slug={`${type}/${slug}`} list={list} meta={meta} path={typeAreaPath(type, slug)}
      crumbs={[{ label: TYPE_PLURAL[type], to: `/${TYPE_PATHS[type]}` }, { label: category.name }]} eyebrow={`${TYPE_PLURAL[type]} por área`} h1={label} intro={category.description ?? undefined}
      faqLabel={`${TYPE_SINGULAR[type]} de ${category.name}`}
      links={[{ to: `/programas/${category.slug}`, label: `Todos los programas de ${category.name}` }, { to: `/${TYPE_PATHS[type]}`, label: `Todos los ${TYPE_PLURAL[type].toLowerCase()}` }]}
    />
  );
}

function Landing({ kind, slug, list, meta, path, crumbs, eyebrow, h1, intro, note, faqLabel, links = [], areas = [] }: {
  kind: 'cursos' | 'tipo' | 'tipo-area'; slug: string; list: CourseWithInstitution[]; meta: { title: string; description: string }; path: string;
  crumbs: { label: string; to?: string }[]; eyebrow: string; h1: string; intro?: string; note?: string; faqLabel: string;
  links?: { to: string; label: string }[]; areas?: { to: string; label: string; hint?: string }[];
}) {
  const st = stats(list);
  const faq = faqFor(faqLabel, st, instNames(list));
  useSeo({ ...meta, path, jsonLd: [breadcrumbSchema([{ name: 'Inicio', path: '/' }, ...crumbs.map((c, i) => ({ name: c.label, path: c.to ?? (i === crumbs.length - 1 ? path : '/') }))]), itemListSchema(list)] });
  useEffect(() => {
    track('landing_viewed', { kind, slug, programs_count: list.length });
  }, [kind, slug, list.length]);
  return (
    <div className="container-page pb-16 pt-8">
      <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, ...crumbs]} />
      <PageHeader eyebrow={eyebrow} title={h1} intro={intro}>
        <StatsLine st={st} />
        {note && <p className="mt-2 text-xs text-dim">{note}</p>}
      </PageHeader>
      <LinkCards title="Por área" items={areas} />
      <section className="mt-10" aria-label="Programas">
        <ProgramsBlock courses={list} limit={24} source="listado" />
      </section>
      <Faq items={faq} />
      <LinkCards title="Antes de elegir" items={links} />
      <AnalyzerCta title="¿No sabes cuál elegir?" />
    </div>
  );
}
