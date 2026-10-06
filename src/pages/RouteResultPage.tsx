import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { CourseCard, CourseCardSkeleton } from '../components/course/CourseCard';
import { Badge } from '../components/ui/Badge';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { EmptyState } from '../components/ui/EmptyState';
import { Icon } from '../components/ui/Icon';
import { useCatalog } from '../hooks/useCatalog';
import { useCompare } from '../hooks/useCompare';
import { useSeo } from '../hooks/useSeo';
import { fetchProfile } from '../services/profileService';
import { formatDate, initials } from '../utils/format';
import { EDUCATION_LABELS, PROFICIENCY_LABELS, SENIORITY_LABELS } from '../utils/profileAnalysis';
import type { ProficiencyLevel, PublicProfileAnalysis, SkillScore } from '../types';

const LEVEL_COLOR: Record<ProficiencyLevel, string> = {
  'sin-evidencia': 'bg-line-strong',
  basico: 'bg-blue/70',
  intermedio: 'bg-blue',
  avanzado: 'bg-violet',
  experto: 'bg-cyan'
};

function ScoreBar({ name, score, level, evidence }: { name: string; score: number; level: ProficiencyLevel; evidence?: string }) {
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-white">{name}</span>
        <span className="shrink-0 font-mono text-xs text-gray"><span className="text-white">{score}</span>/100 · {PROFICIENCY_LABELS[level]}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-raise" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} aria-label={`${name}: ${score} de 100`}>
        <div className={`h-full rounded-full ${LEVEL_COLOR[level]}`} style={{ width: `${Math.max(score, 2)}%` }} />
      </div>
      {evidence && <p className="mt-1 text-xs text-muted">{evidence}</p>}
    </li>
  );
}

function Section({ id, eyebrow, title, children, aside }: { id: string; eyebrow: string; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 id={`${id}-title`} className="mt-2 text-2xl text-white sm:text-3xl">{title}</h2>
        </div>
        {aside}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

const Fact = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="min-w-0">
    <dt className="label-mono">{label}</dt>
    <dd className="mt-1 break-words text-sm text-white">{value || <span className="text-muted">No indicado</span>}</dd>
  </div>
);

export default function RouteResultPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const initial = (location.state as { profile?: PublicProfileAnalysis } | null)?.profile;
  const [profile, setProfile] = useState<PublicProfileAnalysis | null | undefined>(initial?.id === id ? initial : undefined);
  const { catalog, loading } = useCatalog();
  const { replace } = useCompare();
  const [showAllAreas, setShowAllAreas] = useState(false);
  const [copied, setCopied] = useState(false);
  useSeo({ title: 'Tu diagnóstico y ruta de formación', path: `/mi-ruta/${id}`, noindex: true });

  useEffect(() => {
    if (profile?.id === id) return;
    let alive = true;
    fetchProfile(id).then((p) => alive && setProfile(p));
    return () => { alive = false; };
  }, [id, profile?.id]);

  if (profile === undefined) {
    return (
      <div className="container-page pt-8 pb-16" aria-busy="true">
        <div className="skeleton h-40 w-full" />
        <div className="mt-6 grid gap-4 md:grid-cols-3"><CourseCardSkeleton /><CourseCardSkeleton /><CourseCardSkeleton /></div>
      </div>
    );
  }
  if (profile === null) {
    return (
      <div className="container-page pt-16 pb-16">
        <EmptyState icon="route" title="No encontramos este diagnóstico" description="El enlace puede estar incompleto o el diagnóstico fue eliminado." action={<Link to="/mi-ruta" className="btn btn-primary">Hacer un diagnóstico</Link>} />
      </div>
    );
  }

  const { extract: x, evaluation: ev, route } = profile;
  const p = x.personal;
  const fullName = [p.first_name, p.last_name].filter(Boolean).join(' ');
  const areas = [...ev.areas].sort((a, b) => b.score - a.score);
  const withEvidence = areas.filter((a) => a.score > 0);
  const visibleAreas = showAllAreas ? areas : withEvidence.slice(0, 8);
  const softSorted = [...ev.soft_skills].sort((a, b) => b.score - a.score);
  const courseOf = (cid: string) => catalog?.byId.get(cid);
  const allRouteIds = route.stages.flatMap((s) => s.course_ids);
  const totalHours = allRouteIds.reduce((acc, cid) => acc + (courseOf(cid)?.duration_hours ?? 0), 0);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* sin portapapeles */
    }
  };

  return (
    <div className="container-page pt-8 pb-16">
      <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Mi ruta', to: '/mi-ruta' }, { label: 'Diagnóstico' }]} />

      {/* PERFIL */}
      <header className="card relative mt-6 overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-violet/20 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet to-blue text-xl font-semibold text-white">{fullName ? initials(fullName) : <Icon name="user" size={26} />}</span>
            <div className="min-w-0">
              <h1 className="text-3xl text-white sm:text-4xl">{fullName || 'Tu diagnóstico'}</h1>
              <p className="mt-1 text-gray">{[x.headline ?? x.current_role, x.current_company].filter(Boolean).join(' · ') || 'Perfil profesional'}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {x.seniority !== 'no-indicado' && <Badge tone="violet">{SENIORITY_LABELS[x.seniority]}</Badge>}
                {x.years_experience !== null && <Badge>{x.years_experience} año{x.years_experience === 1 ? '' : 's'} de experiencia</Badge>}
                {x.highest_degree && <Badge>{EDUCATION_LABELS[x.highest_degree]}</Badge>}
                {p.country && <Badge><Icon name="map-pin" size={12} />{[p.city, p.country].filter(Boolean).join(', ')}</Badge>}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button className="btn btn-ghost btn-sm" onClick={share}><Icon name={copied ? 'check' : 'link'} size={15} />{copied ? 'Enlace copiado' : 'Copiar enlace'}</button>
            <Link to="/mi-ruta" className="btn btn-quiet btn-sm">Nuevo diagnóstico</Link>
          </div>
        </div>
        <p className="relative mt-6 max-w-3xl text-lg text-gray">{ev.summary}</p>
        <div className="relative mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4 text-xs text-muted">
          <span className="flex items-center gap-1.5"><Icon name={profile.engine === 'ia' ? 'sparkle' : 'chart'} size={14} className="text-cyan" />{profile.engine === 'ia' ? 'Análisis con inteligencia artificial' : 'Análisis automático por reglas'}</span>
          <span>{profile.source === 'cv' ? 'Basado en tu CV' : 'Basado en tu descripción'}</span>
          <span>{formatDate(profile.created_at.slice(0, 10))}</span>
          <span>Este diagnóstico es orientativo; revisa que tus datos sean correctos.</span>
        </div>
      </header>

      <nav aria-label="Secciones del diagnóstico" className="scrollbar-none -mx-4 mt-6 flex gap-2 overflow-x-auto px-4">
        {[['ruta', 'Tu ruta'], ['conocimientos', 'Conocimientos'], ['habilidades', 'Habilidades'], ['datos', 'Datos del CV']].map(([h, t]) => (
          <a key={h} href={`#${h}`} className="chip shrink-0">{t}</a>
        ))}
      </nav>

      <div className="mt-10 space-y-16">
        {/* RUTA */}
        <Section
          id="ruta"
          eyebrow="Ruta de formación sugerida"
          title={route.target_role ? `Hacia: ${route.target_role}` : 'Tu camino hacia el objetivo'}
          aside={totalHours > 0 ? <p className="font-mono text-sm text-gray">{route.stages.length} etapas · {allRouteIds.length} programas · {totalHours} h</p> : undefined}
        >
          <div className="card mb-8 p-5">
            <p className="label-mono">Tu objetivo</p>
            <p className="mt-2 text-white">{profile.objective}</p>
            {route.target_areas.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{route.target_areas.map((a) => <Badge key={a} tone="live">{a}</Badge>)}</div>}
          </div>

          {route.stages.length === 0 ? (
            <EmptyState icon="route" title="No encontramos programas para tu ruta" description="Prueba con un objetivo más concreto o ampliando tu presupuesto y modalidad." action={<Link to="/mi-ruta" className="btn btn-primary">Ajustar diagnóstico</Link>} />
          ) : (
            <ol className="relative space-y-10 border-l border-line-strong pl-6 sm:pl-10">
              {route.stages.map((s) => {
                const courses = s.course_ids.map(courseOf).filter((c): c is NonNullable<typeof c> => !!c);
                return (
                  <li key={s.order} className="relative">
                    <span className="absolute -left-[41px] top-0 grid h-8 w-8 place-items-center rounded-full border border-cyan/60 bg-navy font-mono text-sm text-cyan sm:-left-[57px]" aria-hidden="true">{s.order}</span>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="max-w-3xl">
                        <p className="label-mono">Etapa {s.order}</p>
                        <h3 className="mt-1 text-2xl text-white">{s.title}</h3>
                        <p className="mt-2 text-gray">{s.goal}</p>
                        {s.rationale && <p className="mt-2 flex gap-2 text-sm text-muted"><Icon name="info" size={15} className="mt-0.5 shrink-0" />{s.rationale}</p>}
                      </div>
                      {courses.length >= 2 && (
                        <Link to="/comparar" onClick={() => replace(courses.slice(0, 3).map((c) => c.id))} className="btn btn-ghost btn-sm"><Icon name="compare" size={15} />Comparar etapa</Link>
                      )}
                    </div>
                    {s.skills.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">{s.skills.map((k) => <span key={k} className="rounded-md border border-line px-2 py-0.5 text-xs text-gray">{k}</span>)}</div>
                    )}
                    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {loading && !catalog ? s.course_ids.map((cid) => <CourseCardSkeleton key={cid} />) : courses.map((c) => <CourseCard key={c.id} course={c} source="ruta" />)}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {route.advice.length > 0 && (
            <div className="card mt-10 p-5 sm:p-6">
              <h3 className="flex items-center gap-2 text-lg text-white"><Icon name="target" size={18} className="text-cyan" />Recomendaciones</h3>
              <ul className="mt-4 space-y-2.5">{route.advice.map((a) => <li key={a} className="flex gap-2.5 text-gray"><Icon name="check" size={16} className="mt-1 shrink-0 text-pos" />{a}</li>)}</ul>
            </div>
          )}
        </Section>

        {/* CONOCIMIENTOS POR MATERIA */}
        <Section
          id="conocimientos"
          eyebrow="Evaluación"
          title="Conocimientos por materia"
          aside={<button className="btn btn-quiet btn-sm" onClick={() => setShowAllAreas((v) => !v)}>{showAllAreas ? 'Ver solo con evidencia' : `Ver las ${areas.length} materias`}</button>}
        >
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="card p-5 sm:p-6">
              {visibleAreas.length ? (
                <ul className="grid gap-5 md:grid-cols-2">{visibleAreas.map((a) => <ScoreBar key={a.area_id} name={a.area} score={a.score} level={a.level} evidence={a.evidence} />)}</ul>
              ) : (
                <p className="text-gray">No encontramos evidencia de conocimientos en las materias del catálogo. Agrega herramientas, proyectos y logros a tu CV para un diagnóstico más preciso.</p>
              )}
            </div>
            <div className="space-y-4">
              <div className="card p-5">
                <h3 className="flex items-center gap-2 text-white"><Icon name="award" size={17} className="text-pos" />Fortalezas</h3>
                <ul className="mt-3 space-y-2 text-sm text-gray">{ev.strengths.map((s) => <li key={s} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-pos" />{s}</li>)}</ul>
              </div>
              <div className="card p-5">
                <h3 className="flex items-center gap-2 text-white"><Icon name="target" size={17} className="text-warn" />Brechas frente a tu objetivo</h3>
                <ul className="mt-3 space-y-2 text-sm text-gray">{ev.gaps.length ? ev.gaps.map((s) => <li key={s} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />{s}</li>) : <li>Sin brechas relevantes detectadas.</li>}</ul>
              </div>
            </div>
          </div>
        </Section>

        {/* HABILIDADES */}
        <Section id="habilidades" eyebrow="Evaluación" title="Habilidades técnicas y blandas">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card p-5 sm:p-6">
              <h3 className="flex items-center gap-2 text-lg text-white"><Icon name="tool" size={18} className="text-cyan" />Técnicas</h3>
              {ev.technical_skills.length ? (
                <ul className="mt-5 space-y-4">{ev.technical_skills.map((s: SkillScore) => <ScoreBar key={s.name} {...s} />)}</ul>
              ) : (
                <p className="mt-4 text-sm text-gray">No identificamos herramientas o tecnologías concretas. Menciónalas en tu CV.</p>
              )}
            </div>
            <div className="card p-5 sm:p-6">
              <h3 className="flex items-center gap-2 text-lg text-white"><Icon name="user" size={18} className="text-violet-soft" />Blandas</h3>
              <ul className="mt-5 space-y-4">{softSorted.map((s) => <ScoreBar key={s.name} {...s} />)}</ul>
            </div>
          </div>
        </Section>

        {/* DATOS EXTRAÍDOS */}
        <Section id="datos" eyebrow="Tu información" title={profile.source === 'cv' ? 'Datos extraídos de tu CV' : 'Datos de tu perfil'}>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="card p-5 sm:p-6">
              <h3 className="text-lg text-white">Datos personales</h3>
              <dl className="mt-4 grid grid-cols-2 gap-4">
                <Fact label="Nombres" value={p.first_name} />
                <Fact label="Apellidos" value={p.last_name} />
                <div className="col-span-2"><Fact label="Correo" value={p.email} /></div>
                <Fact label="Teléfono" value={p.phone} />
                <Fact label="País" value={p.country} />
                {p.linkedin && <div className="col-span-2"><Fact label="LinkedIn" value={p.linkedin} /></div>}
              </dl>
            </div>
            <div className="card p-5 sm:p-6">
              <h3 className="text-lg text-white">Formación</h3>
              <dl className="mt-4 grid grid-cols-2 gap-4">
                <Fact label="Grado más alto" value={x.highest_degree ? EDUCATION_LABELS[x.highest_degree] : null} />
                <Fact label="Formación actual" value={x.current_studies} />
              </dl>
              <ul className="mt-5 space-y-3 border-t border-line pt-4">
                {x.education.length ? x.education.map((e, i) => (
                  <li key={i} className="text-sm">
                    <p className="text-white">{e.degree}</p>
                    <p className="text-gray">{[e.institution, e.end_year, e.status === 'en-curso' ? 'En curso' : null].filter(Boolean).join(' · ')}</p>
                  </li>
                )) : <li className="text-sm text-muted">No identificamos estudios.</li>}
              </ul>
              {x.certifications.length > 0 && (
                <>
                  <p className="label-mono mt-5">Certificaciones</p>
                  <ul className="mt-2 space-y-1 text-sm text-gray">{x.certifications.map((c) => <li key={c}>{c}</li>)}</ul>
                </>
              )}
            </div>
            <div className="card p-5 sm:p-6">
              <h3 className="text-lg text-white">Experiencia</h3>
              <dl className="mt-4 grid grid-cols-2 gap-4">
                <Fact label="Posición actual" value={x.current_role} />
                <Fact label="Empresa" value={x.current_company} />
              </dl>
              <ul className="mt-5 space-y-3 border-t border-line pt-4">
                {x.experience.length ? x.experience.map((e, i) => (
                  <li key={i} className="text-sm">
                    <p className="text-white">{e.role}</p>
                    <p className="text-gray">{[e.company, e.start_year ? `${e.start_year} – ${e.current ? 'actualidad' : e.end_year ?? '¿?'}` : null].filter(Boolean).join(' · ')}</p>
                  </li>
                )) : <li className="text-sm text-muted">No identificamos experiencias con fechas.</li>}
              </ul>
              {x.languages.length > 0 && (
                <>
                  <p className="label-mono mt-5">Idiomas</p>
                  <p className="mt-2 text-sm text-gray">{x.languages.map((l) => `${l.language} (${l.level.toLowerCase()})`).join(' · ')}</p>
                </>
              )}
            </div>
          </div>
          {x.tools.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-1.5"><span className="label-mono mr-2 self-center">Herramientas</span>{x.tools.map((t) => <span key={t} className="rounded-md border border-line px-2 py-0.5 text-xs text-gray">{t}</span>)}</div>
          )}
        </Section>
      </div>
    </div>
  );
}
