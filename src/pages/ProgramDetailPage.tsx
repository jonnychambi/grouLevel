import { useEffect, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { CompareButton } from '../components/course/CompareButton';
import { FavoriteButton } from '../components/course/FavoriteButton';
import { RecentlyViewed } from '../components/course/RecentlyViewed';
import { RelatedCourses } from '../components/course/RelatedCourses';
import { TeacherCard } from '../components/course/TeacherCard';
import { ReviewsSection } from '../components/reviews/ReviewsSection';
import { Stars } from '../components/reviews/Stars';
import { InstitutionLogo } from '../components/institution/InstitutionLogo';
import { Accordion } from '../components/ui/Accordion';
import { Badge } from '../components/ui/Badge';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { EmptyState } from '../components/ui/EmptyState';
import { Icon, type IconName } from '../components/ui/Icon';
import { PriceDisplay } from '../components/ui/PriceDisplay';
import { useLeadModal } from '../context/LeadModalContext';
import { useToast } from '../context/ToastContext';
import { useCatalog } from '../hooks/useCatalog';
import { useCompare } from '../hooks/useCompare';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import { useSeo } from '../hooks/useSeo';
import { courseContext, track } from '../services/analytics';
import { getRelated } from '../services/catalogService';
import { durationLabel, effectivePrice, formatDate, formatMoney, formatWeeks, startLabel } from '../utils/format';
import { CERTIFICATE_LABELS, LEVEL_LABELS, MODALITY_EXPLANATIONS, MODALITY_LABELS, MODALITY_SHORT, PROGRAM_TYPE_LABELS } from '../utils/labels';
import type { CourseWithInstitution } from '../types';
import { breadcrumbSchema, courseSchema } from '../utils/schema';
import { TypeBadge } from '../components/course/TypeBadge';

const SECTIONS = [
  { id: 'sobre', label: 'Sobre el programa' },
  { id: 'aprenderas', label: 'Lo que aprenderás' },
  { id: 'contenido', label: 'Contenido' },
  { id: 'docentes', label: 'Docentes' },
  { id: 'modalidad', label: 'Modalidad' },
  { id: 'certificacion', label: 'Certificación' },
  { id: 'precio', label: 'Precio' },
  { id: 'institucion', label: 'Institución' },
  { id: 'resenas', label: 'Valoraciones' }
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="scroll-mt-32 border-t border-line pt-10">
      <h2 id={`${id}-t`} className="mb-5 text-2xl text-white">{title}</h2>
      {children}
    </section>
  );
}

function KeyFact({ icon, label, value, sub }: { icon: IconName; label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-navy/50 p-4">
      <dt className="flex items-center gap-1.5 label-mono text-[10.5px]"><Icon name={icon} size={14} />{label}</dt>
      <dd className="mt-1.5 text-lg font-semibold tracking-tight text-white">{value}</dd>
      {sub && <dd className="text-xs text-muted">{sub}</dd>}
    </div>
  );
}

function seoDescription(c: CourseWithInstitution): string {
  const p = effectivePrice(c);
  const parts = [PROGRAM_TYPE_LABELS[c.program_type]];
  if (c.modality) parts.push(MODALITY_LABELS[c.modality].toLowerCase());
  if (c.duration_hours) parts.push(`${c.duration_hours} horas`);
  if (p != null) parts.push(p === 0 ? 'gratis' : `desde ${formatMoney(p, c.currency)}`);
  return `${c.short_description} ${parts.join(', ')}. Compáralo con otros programas en Groulevel.`.slice(0, 300);
}

function includesList(c: CourseWithInstitution): string[] {
  const f = c.features;
  return [
    f.live_classes && 'Clases en vivo',
    f.recorded_classes && 'Clases grabadas',
    f.final_project && 'Proyecto final',
    f.mentoring && 'Mentoría',
    f.lifetime_access && 'Acceso de por vida',
    f.job_board && 'Bolsa de trabajo',
    f.community && 'Comunidad'
  ].filter((x): x is string => !!x);
}

function highlights(c: CourseWithInstitution): string[] {
  const out: string[] = [];
  if (c.certificate) out.push(CERTIFICATE_LABELS[c.certificate.type]);
  if (c.syllabus.length) out.push(`${c.syllabus.length} ${c.syllabus.length === 1 ? 'módulo' : 'módulos'}${c.duration_hours ? ` · ${c.duration_hours} horas` : ''}`);
  if (c.teachers.length) out.push(`${c.teachers.length} ${c.teachers.length === 1 ? 'docente publicado' : 'docentes publicados'}`);
  out.push(...includesList(c).slice(0, 2));
  return out.slice(0, 4);
}

export default function ProgramDetailPage() {
  const { slug = '' } = useParams();
  const { catalog, loading, error, retry } = useCatalog();
  const { push } = useRecentlyViewed();
  const { count: compareCount } = useCompare();
  const openLead = useLeadModal();
  const notify = useToast();
  const course = catalog?.bySlug.get(slug);

  // Enlaces con ancla (p. ej. #resenas desde la tarjeta): desplazar cuando el contenido ya existe.
  const { hash } = useLocation();
  useEffect(() => {
    if (!course || !hash) return;
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    return () => clearTimeout(t);
  }, [course, hash]);

  useEffect(() => {
    if (!course) return;
    push(course.id);
    track('course_viewed', courseContext(course));
  }, [course, push]);

  const category = course && catalog?.categories.find((c) => c.id === course.category);
  const crumbs = course
    ? [{ label: 'Inicio', to: '/' }, { label: 'Programas', to: '/programas' }, ...(category ? [{ label: category.name, to: `/programas/${category.slug}` }] : []), { label: course.name }]
    : [];

  useSeo(
    course
      ? {
          title: `${course.name} · ${course.institution.short_name}`,
          description: seoDescription(course),
          path: `/programa/${course.slug}`,
          type: 'product',
          jsonLd: [courseSchema(course), breadcrumbSchema(crumbs.map((c) => ({ name: c.label, path: c.to ?? `/programa/${course.slug}` })))]
        }
      : { title: loading ? 'Cargando programa' : 'Programa no encontrado', noindex: !loading }
  );

  if (error) return <div className="container-page py-16"><EmptyState tone="error" icon="alert" title="No pudimos cargar el programa" action={<button className="btn btn-primary" onClick={retry}>Reintentar</button>} /></div>;
  if (loading) return <DetailSkeleton />;
  if (!course || !catalog) {
    return (
      <div className="container-page py-16">
        <EmptyState title="No encontramos este programa" description="Puede que ya no esté disponible o que el enlace haya cambiado." action={<Link to="/programas" className="btn btn-primary">Explorar programas</Link>} />
      </div>
    );
  }

  const related = getRelated(catalog, course, 4);
  const price = effectivePrice(course);
  const learn = course.objectives.length ? course.objectives : course.skills;
  const includes = includesList(course);
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: course.name, text: course.short_description, url });
        track('share_clicked', { ...courseContext(course), method: 'native' });
      } else {
        await navigator.clipboard.writeText(url);
        track('share_clicked', { ...courseContext(course), method: 'clipboard' });
        notify('Enlace copiado al portapapeles', { tone: 'success' });
      }
    } catch {
      /* el usuario canceló */
    }
  };
  const outbound = () => track('outbound_click', { ...courseContext(course), url: course.url });

  return (
    <article className="pb-24 lg:pb-8">
      {/* HERO */}
      <header className="border-b border-line bg-[radial-gradient(70%_80%_at_80%_0%,#0d1838_0%,#050816_70%)]">
        <div className="container-page pb-10 pt-8">
          <Breadcrumbs items={crumbs} />
          <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
            <div>
              <div className="flex items-center gap-3">
                <InstitutionLogo institution={course.institution} size={52} />
                <Link to={`/institucion/${course.institution.slug}`} className="text-gray hover:text-white">{course.institution.name}</Link>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <TypeBadge type={course.program_type} />
                {course.modality && <Badge tone="live">{course.modality === 'presencial' ? 'Presencial' : course.modality === 'hibrido' ? 'Híbrido' : 'Online'}</Badge>}
                {course.modality && course.modality !== 'presencial' && course.modality !== 'hibrido' && <Badge>{MODALITY_SHORT[course.modality]}</Badge>}
                {course.level && <Badge>{LEVEL_LABELS[course.level]}</Badge>}
                {course.featured && <Badge tone="featured" mono>Destacado</Badge>}
              </div>
              <h1 className="mt-4 text-4xl leading-[1.05] text-white sm:text-5xl">{course.name}</h1>
              <p className="mt-4 max-w-2xl text-lg text-gray">{course.short_description}</p>
              <a href="#resenas" className="mt-4 inline-flex items-center gap-2 text-sm text-gray hover:text-white">
                {course.rating != null && course.reviews_count ? (
                  <><Stars value={course.rating} size={16} /><span className="tnum font-medium text-white">{course.rating.toFixed(1)}</span><span>({course.reviews_count} {course.reviews_count === 1 ? 'reseña' : 'reseñas'})</span></>
                ) : (
                  <><Icon name="star" size={15} className="text-warn" />Sé el primero en valorar este programa</>
                )}
              </a>

              <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KeyFact icon="clock" label="Duración" value={durationLabel(course)} sub={course.duration_hours != null ? (course.duration_weeks ? formatWeeks(course.duration_weeks) : course.duration_text ?? undefined) : undefined} />
                <KeyFact icon="card" label="Precio" value={price == null ? 'A consultar' : price === 0 ? 'Gratis' : formatMoney(price, course.currency)} sub={course.financing.installments ? `o ${course.financing.installments} cuotas` : price != null && price > 0 ? 'Precio publicado' : undefined} />
                <KeyFact icon="calendar" label="Inicio" value={startLabel(course)} sub={course.start_date ? formatDate(course.start_date, { year: 'numeric' }) : course.start_text ?? undefined} />
                <KeyFact icon={course.modality === 'en-vivo' ? 'live' : course.modality === 'grabado' ? 'play' : course.modality === 'presencial' ? 'building' : 'layers'} label="Modalidad" value={course.modality ? MODALITY_SHORT[course.modality] : 'No publicada'} sub={course.language} />
              </dl>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button className="btn btn-accent btn-lg" onClick={() => openLead(course, 'detalle')}>Solicitar información</button>
                <CompareButton course={course} source="detalle" variant="button" />
                <FavoriteButton course={course} withLabel />
                <button className="btn btn-ghost" onClick={share}><Icon name="share" size={16} /> Compartir</button>
              </div>
              <a href={course.url} target="_blank" rel="noopener noreferrer nofollow" onClick={outbound} className="mt-4 inline-flex items-center gap-1.5 text-sm text-blue-soft hover:text-white">
                Ver el programa en el sitio de {course.institution.short_name} <Icon name="external" size={13} />
              </a>
            </div>

            {/* Tarjeta de precio (desktop) */}
            <aside className="hidden lg:block" aria-label="Resumen de precio">
              <div className="card sticky top-24 p-6">
                <span className="label-mono">Inversión</span>
                <PriceDisplay course={course} size="lg" showConversion className="mt-2" />
                {course.financing.installments && (
                  <p className="mt-2 text-sm text-gray">o {course.financing.installments} cuotas{course.financing.installment_amount ? <> de <span className="tnum font-medium text-white">{formatMoney(course.financing.installment_amount, course.currency)}</span></> : null}</p>
                )}
                {price == null && <p className="mt-2 text-sm text-gray">La institución no publica el precio en su web. Solicita información para recibirlo.</p>}
                <ul className="mt-5 space-y-2.5 border-t border-line pt-5 text-sm text-gray">
                  {highlights(course).map((h) => <li key={h} className="flex gap-2"><Icon name="check" size={16} className="mt-0.5 shrink-0 text-pos" />{h}</li>)}
                </ul>
                <button className="btn btn-primary mt-6 w-full" onClick={() => openLead(course, 'detalle')}>Solicitar información</button>
                <p className="mt-3 text-center text-xs text-muted">Gratis y sin compromiso</p>
              </div>
            </aside>
          </div>
        </div>
      </header>

      {/* Navegación interna */}
      <nav aria-label="Secciones del programa" className="sticky top-16 z-30 border-b border-line bg-navy/90 backdrop-blur">
        <ul className="container-page flex gap-1 overflow-x-auto py-2 scrollbar-none">
          {SECTIONS.map((s) => (
            <li key={s.id}><a href={`#${s.id}`} className="block whitespace-nowrap rounded-full px-3 py-1.5 text-sm text-gray hover:bg-raise hover:text-white">{s.label}</a></li>
          ))}
        </ul>
      </nav>

      <div className="container-page grid gap-10 pt-10 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-10">
          <Section id="sobre" title="Sobre el programa">
            <p className="max-w-3xl text-lg leading-relaxed text-gray">{course.description}</p>
            {course.target_audience && (
              <div className="mt-6 max-w-3xl">
                <h3 className="label-mono mb-2">¿Para quién es?</h3>
                <p className="text-gray">{course.target_audience}</p>
              </div>
            )}
            {course.requirements.length > 0 && (
              <div className="mt-6">
                <h3 className="label-mono mb-3">Requisitos</h3>
                <ul className="flex flex-wrap gap-2">{course.requirements.map((r) => <li key={r} className="chip">{r}</li>)}</ul>
              </div>
            )}
          </Section>

          {(learn.length > 0 || course.tools.length > 0) && (
            <Section id="aprenderas" title="Lo que aprenderás">
              {learn.length > 0 && (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {learn.map((s) => (
                    <li key={s} className="flex items-start gap-3 rounded-2xl border border-line bg-midnight p-4 text-white">
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cyan/10 text-cyan"><Icon name="check" size={14} /></span>
                      {s}
                    </li>
                  ))}
                </ul>
              )}
              {course.tools.length > 0 && (
                <>
                  <h3 className={`label-mono mb-3 ${learn.length ? 'mt-8' : ''}`}>Herramientas</h3>
                  <ul className="flex flex-wrap gap-2">
                    {course.tools.map((t) => <li key={t}><Link to={`/programas?q=${encodeURIComponent(t)}`} className="chip">{t}</Link></li>)}
                  </ul>
                </>
              )}
            </Section>
          )}

          <Section id="contenido" title="Contenido">
            {course.syllabus.length > 0 ? (
              <>
                <p className="mb-2 text-gray">{course.syllabus.length} {course.syllabus.length === 1 ? 'módulo' : 'módulos'}{course.duration_hours ? ` · ${course.duration_hours} horas totales` : ''}</p>
                <Accordion
                  defaultOpen={['m0']}
                  items={course.syllabus.map((m, i) => ({
                    id: `m${i}`,
                    title: <><span className="mr-2 font-mono text-sm text-cyan">{course.syllabus.length > 1 ? `Módulo ${i + 1}` : 'Módulo'}</span><span className="text-white">{m.title}</span></>,
                    meta: m.hours ? `${m.hours} h` : undefined,
                    content: (
                      <>
                        <p>{m.description || 'La institución no publica el detalle de este módulo.'}</p>
                        {m.topics.length > 0 && <ul className="mt-3 flex flex-wrap gap-1.5">{m.topics.map((t) => <li key={t} className="rounded-md border border-line px-2 py-0.5 text-sm text-gray">{t}</li>)}</ul>}
                      </>
                    )
                  }))}
                />
              </>
            ) : (
              <p className="text-gray">La institución no publica el temario en su web. Solicita información para recibir el plan de estudios.</p>
            )}
          </Section>

          <Section id="docentes" title="Docentes">
            {course.teachers.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">{course.teachers.map((t) => <TeacherCard key={t.name} teacher={t} />)}</div>
            ) : (
              <p className="text-gray">La institución no publica la plana docente de este programa.</p>
            )}
          </Section>

          <Section id="modalidad" title="Modalidad y duración">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="card p-5">
                <h3 className="flex items-center gap-2 text-lg text-white"><Icon name={course.modality === 'en-vivo' ? 'live' : course.modality === 'grabado' ? 'play' : course.modality === 'presencial' ? 'building' : 'layers'} className="text-cyan" />{course.modality ? MODALITY_LABELS[course.modality] : 'Modalidad no publicada'}</h3>
                {course.modality && <p className="mt-2 text-gray">{MODALITY_EXPLANATIONS[course.modality]}</p>}
                {course.platform && <p className="mt-2 text-sm text-muted">Plataforma: {course.platform}</p>}
              </div>
              <div className="card p-5">
                <h3 className="flex items-center gap-2 text-lg text-white"><Icon name="clock" className="text-cyan" />{course.duration_hours != null ? `${course.duration_hours} horas totales` : course.duration_text ?? 'Duración no publicada'}</h3>
                <dl className="mt-3 space-y-1.5 text-sm">
                  {course.duration_weeks != null && <div className="flex justify-between gap-4"><dt className="text-muted">Duración</dt><dd className="text-right text-white">{formatWeeks(course.duration_weeks)}</dd></div>}
                  {course.duration_hours != null && course.duration_weeks ? <div className="flex justify-between gap-4"><dt className="text-muted">Dedicación aprox.</dt><dd className="text-right text-white">{Math.round(course.duration_hours / course.duration_weeks)} h/semana</dd></div> : null}
                  {course.duration_text && course.duration_hours != null && <div className="flex justify-between gap-4"><dt className="text-muted">Según la institución</dt><dd className="text-right text-white">{course.duration_text}</dd></div>}
                  <div className="flex justify-between gap-4"><dt className="text-muted">Horario</dt><dd className="text-right text-white">{course.schedule ?? 'No publicado'}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-muted">Inicio</dt><dd className="text-right text-white">{course.start_date ? formatDate(course.start_date, { day: 'numeric', month: 'long', year: 'numeric' }) : course.start_text ?? 'Por confirmar'}</dd></div>
                </dl>
              </div>
            </div>
            {includes.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">{includes.map((i) => <li key={i} className="chip"><Icon name="check" size={14} className="text-pos" />{i}</li>)}</ul>
            )}
          </Section>

          <Section id="certificacion" title="Certificación">
            <div className="card flex gap-4 p-5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-line-strong text-cyan"><Icon name="award" size={22} /></span>
              <div>
                <h3 className="text-lg text-white">{course.certificate ? CERTIFICATE_LABELS[course.certificate.type] : 'Certificación no publicada'}</h3>
                <p className="mt-1 text-gray">{course.certificate?.description ?? 'Consulta con la institución qué certificado se entrega al finalizar.'}</p>
              </div>
            </div>
          </Section>

          <Section id="precio" title="Precio y financiamiento">
            <div className="card grid gap-6 p-5 sm:grid-cols-2">
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-muted">Precio regular</dt><dd className="tnum text-white">{course.price == null ? 'No publicado' : course.price === 0 ? 'Gratis' : formatMoney(course.price, course.currency)}</dd></div>
                {course.discount_price != null && <div className="flex justify-between gap-4"><dt className="text-muted">Precio promocional</dt><dd className="tnum font-semibold text-pos">{formatMoney(course.discount_price, course.currency)}</dd></div>}
                {course.price != null && <div className="flex justify-between gap-4"><dt className="text-muted">Moneda</dt><dd className="text-white">{course.currency === 'PEN' ? 'Soles (PEN)' : 'Dólares (USD)'}</dd></div>}
                <div className="flex justify-between gap-4"><dt className="text-muted">Cuotas</dt><dd className="tnum text-white">{course.financing.installments ? `${course.financing.installments}${course.financing.installment_amount ? ` × ${formatMoney(course.financing.installment_amount, course.currency)}` : ' cuotas'}` : 'No publicado'}</dd></div>
              </dl>
              <div className="text-sm">
                {course.financing.notes && <p className="text-white">{course.financing.notes}</p>}
                {course.financing.methods.length > 0 && (
                  <>
                    <p className="label-mono mb-2 mt-4">Medios de pago</p>
                    <ul className="flex flex-wrap gap-1.5">{course.financing.methods.map((m) => <li key={m} className="rounded-md border border-line px-2 py-0.5 text-gray">{m}</li>)}</ul>
                  </>
                )}
                {!course.financing.notes && !course.financing.methods.length && <p className="text-gray">Consulta opciones de pago, becas y descuentos al solicitar información.</p>}
              </div>
            </div>
            <p className="mt-3 text-xs text-muted">Precios referenciales publicados por la institución. Pueden cambiar; confírmalos antes de matricularte.</p>
          </Section>

          <Section id="institucion" title="Institución">
            <div className="card p-5">
              <div className="flex items-center gap-4">
                <InstitutionLogo institution={course.institution} size={56} />
                <div>
                  <h3 className="text-lg text-white">{course.institution.name}</h3>
                  <p className="text-sm text-muted">{course.institution.type} · {course.institution.country}</p>
                  {course.institution.rating != null && (course.institution.reviews_count ?? 0) > 0 && (
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-gray"><Stars value={course.institution.rating} size={14} /><span className="tnum text-white">{course.institution.rating.toFixed(1)}</span> · {course.institution.reviews_count} {course.institution.reviews_count === 1 ? 'reseña' : 'reseñas'}</p>
                  )}
                </div>
              </div>
              <p className="mt-4 text-gray">{course.institution.description}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link to={`/institucion/${course.institution.slug}`} className="btn btn-ghost btn-sm">Ver todos sus programas</Link>
                <a href={course.url} target="_blank" rel="noopener noreferrer nofollow" onClick={outbound} className="btn btn-quiet btn-sm">
                  Página oficial del programa <Icon name="external" size={14} />
                </a>
              </div>
            </div>
          </Section>

          <ReviewsSection course={course} />

          <p className="flex items-start gap-2 text-xs text-muted">
            <Icon name="info" size={14} className="mt-0.5 shrink-0" />
            Información obtenida del sitio web oficial de {course.institution.short_name}, verificada el {formatDate(course.updated_at, { day: 'numeric', month: 'long', year: 'numeric' })}. Groulevel no es responsable de cambios posteriores.
          </p>

          {course.is_demo && (
            <p className="flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/5 p-4 text-sm text-gray">
              <Icon name="info" className="mt-0.5 shrink-0 text-warn" />
              Programa de demostración: la institución, docentes, precios y valoraciones son ficticios.
            </p>
          )}
        </div>

        {/* CTA lateral repetido para conversión */}
        <aside className="hidden lg:block" aria-label="Acciones">
          <div className="sticky top-32 space-y-3">
            <div className="card p-5">
              <p className="text-sm text-gray">¿Te interesa este programa?</p>
              <button className="btn btn-accent mt-3 w-full" onClick={() => openLead(course, 'detalle')}>Solicitar información</button>
              <CompareButton course={course} source="detalle" variant="button" className="mt-2 w-full" />
            </div>
          </div>
        </aside>
      </div>

      <div className="container-page">
        <RelatedCourses courses={related} />
        <RecentlyViewed excludeId={course.id} className="mt-16" />
      </div>

      {/* CTA fija mobile (solo si la barra del comparador no está visible) */}
      {compareCount === 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-navy/95 p-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-3">
            <PriceDisplay course={course} size="sm" className="min-w-0 flex-1" />
            <button className="btn btn-accent shrink-0" onClick={() => openLead(course, 'detalle')}>Solicitar información</button>
          </div>
        </div>
      )}
    </article>
  );
}

function DetailSkeleton() {
  return (
    <div className="container-page py-10" aria-busy="true" aria-label="Cargando programa">
      <div className="skeleton h-4 w-64" />
      <div className="mt-10 flex items-center gap-3"><div className="skeleton h-12 w-12" /><div className="skeleton h-4 w-48" /></div>
      <div className="skeleton mt-6 h-12 w-3/4" />
      <div className="skeleton mt-4 h-5 w-1/2" />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-24" />)}</div>
    </div>
  );
}
