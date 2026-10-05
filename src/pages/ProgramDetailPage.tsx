import { useEffect, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CompareButton } from '../components/course/CompareButton';
import { FavoriteButton } from '../components/course/FavoriteButton';
import { RecentlyViewed } from '../components/course/RecentlyViewed';
import { RelatedCourses } from '../components/course/RelatedCourses';
import { TeacherCard } from '../components/course/TeacherCard';
import { InstitutionLogo } from '../components/institution/InstitutionLogo';
import { Accordion } from '../components/ui/Accordion';
import { Badge } from '../components/ui/Badge';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { EmptyState } from '../components/ui/EmptyState';
import { Icon, type IconName } from '../components/ui/Icon';
import { PriceDisplay } from '../components/ui/PriceDisplay';
import { Rating } from '../components/ui/Rating';
import { useLeadModal } from '../context/LeadModalContext';
import { useToast } from '../context/ToastContext';
import { useCatalog } from '../hooks/useCatalog';
import { useCompare } from '../hooks/useCompare';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import { useSeo } from '../hooks/useSeo';
import { courseContext, track } from '../services/analytics';
import { getRelated } from '../services/catalogService';
import { effectivePrice, formatDate, formatMoney, formatWeeks } from '../utils/format';
import { CERTIFICATE_LABELS, LEVEL_LABELS, MODALITY_EXPLANATIONS, MODALITY_LABELS, PROGRAM_TYPE_LABELS } from '../utils/labels';
import { breadcrumbSchema, courseSchema } from '../utils/schema';

const SECTIONS = [
  { id: 'sobre', label: 'Sobre el programa' },
  { id: 'aprenderas', label: 'Lo que aprenderás' },
  { id: 'contenido', label: 'Contenido' },
  { id: 'docentes', label: 'Docentes' },
  { id: 'modalidad', label: 'Modalidad' },
  { id: 'certificacion', label: 'Certificación' },
  { id: 'precio', label: 'Precio' },
  { id: 'institucion', label: 'Institución' }
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

export default function ProgramDetailPage() {
  const { slug = '' } = useParams();
  const { catalog, loading, error, retry } = useCatalog();
  const { push } = useRecentlyViewed();
  const { count: compareCount } = useCompare();
  const openLead = useLeadModal();
  const notify = useToast();
  const course = catalog?.bySlug.get(slug);

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
          description: `${course.short_description} ${PROGRAM_TYPE_LABELS[course.program_type]} ${MODALITY_LABELS[course.modality].toLowerCase()}, ${course.duration_hours} horas, ${effectivePrice(course) === 0 ? 'gratis' : `desde ${formatMoney(effectivePrice(course), course.currency)}`}.`,
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
                <Badge tone="type" mono>{PROGRAM_TYPE_LABELS[course.program_type]}</Badge>
                <Badge tone="live">{course.modality === 'grabado' ? 'Online' : course.modality === 'hibrido' ? 'Híbrido' : 'Online'}</Badge>
                <Badge>{course.modality === 'en-vivo' ? 'En vivo' : course.modality === 'grabado' ? 'Grabado' : 'En vivo + presencial'}</Badge>
                <Badge>{LEVEL_LABELS[course.level]}</Badge>
                {course.featured && <Badge tone="featured" mono>Destacado</Badge>}
              </div>
              <h1 className="mt-4 text-4xl leading-[1.05] text-white sm:text-5xl">{course.name}</h1>
              <p className="mt-4 max-w-2xl text-lg text-gray">{course.short_description}</p>
              <div className="mt-4"><Rating value={course.rating} count={course.reviews_count} /></div>

              <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KeyFact icon="clock" label="Duración" value={`${course.duration_hours} h`} sub={formatWeeks(course.duration_weeks)} />
                <KeyFact icon="card" label="Precio" value={effectivePrice(course) === 0 ? 'Gratis' : formatMoney(effectivePrice(course), course.currency)} sub={course.financing.installments ? `o ${course.financing.installments} cuotas` : 'Pago único'} />
                <KeyFact icon="calendar" label="Inicio" value={course.start_date ? formatDate(course.start_date, { day: 'numeric', month: 'short' }) : 'Inmediato'} sub={course.start_date ? formatDate(course.start_date, { year: 'numeric' }) : 'A tu ritmo'} />
                <KeyFact icon={course.modality === 'en-vivo' ? 'live' : course.modality === 'grabado' ? 'play' : 'layers'} label="Modalidad" value={MODALITY_LABELS[course.modality].split(' · ')[0]} sub={course.language} />
              </dl>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button className="btn btn-accent btn-lg" onClick={() => openLead(course, 'detalle')}>Solicitar información</button>
                <CompareButton course={course} source="detalle" variant="button" />
                <FavoriteButton course={course} withLabel />
                <button className="btn btn-ghost" onClick={share}><Icon name="share" size={16} /> Compartir</button>
              </div>
            </div>

            {/* Tarjeta de precio (desktop) */}
            <aside className="hidden lg:block" aria-label="Resumen de precio">
              <div className="card sticky top-24 p-6">
                <span className="label-mono">Inversión</span>
                <PriceDisplay course={course} size="lg" showConversion className="mt-2" />
                {course.financing.installments && (
                  <p className="mt-2 text-sm text-gray">o {course.financing.installments} cuotas de <span className="tnum font-medium text-white">{formatMoney(course.financing.installment_amount ?? 0, course.currency)}</span></p>
                )}
                <ul className="mt-5 space-y-2.5 border-t border-line pt-5 text-sm text-gray">
                  <li className="flex gap-2"><Icon name="check" size={16} className="mt-0.5 shrink-0 text-pos" />{CERTIFICATE_LABELS[course.certificate.type]}</li>
                  <li className="flex gap-2"><Icon name="check" size={16} className="mt-0.5 shrink-0 text-pos" />{course.syllabus.length} módulos · {course.duration_hours} horas</li>
                  <li className="flex gap-2"><Icon name="check" size={16} className="mt-0.5 shrink-0 text-pos" />{course.teachers.length} {course.teachers.length === 1 ? 'docente' : 'docentes'} con experiencia en la industria</li>
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
            {course.requirements.length > 0 && (
              <div className="mt-6">
                <h3 className="label-mono mb-3">Requisitos</h3>
                <ul className="flex flex-wrap gap-2">{course.requirements.map((r) => <li key={r} className="chip">{r}</li>)}</ul>
              </div>
            )}
          </Section>

          <Section id="aprenderas" title="Lo que aprenderás">
            <ul className="grid gap-3 sm:grid-cols-2">
              {course.skills.map((s) => (
                <li key={s} className="flex items-start gap-3 rounded-2xl border border-line bg-midnight p-4 text-white">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cyan/10 text-cyan"><Icon name="check" size={14} /></span>
                  {s}
                </li>
              ))}
            </ul>
            <h3 className="label-mono mb-3 mt-8">Herramientas</h3>
            <ul className="flex flex-wrap gap-2">
              {course.tools.map((t) => <li key={t}><Link to={`/programas?q=${encodeURIComponent(t)}`} className="chip">{t}</Link></li>)}
            </ul>
          </Section>

          <Section id="contenido" title="Contenido">
            <p className="mb-2 text-gray">{course.syllabus.length} módulos · {course.duration_hours} horas totales</p>
            <Accordion
              defaultOpen={['m0']}
              items={course.syllabus.map((m, i) => ({
                id: `m${i}`,
                title: <><span className="mr-2 font-mono text-sm text-cyan">Módulo {i + 1}</span><span className="text-white">{m.title}</span></>,
                meta: `${m.hours} h`,
                content: (
                  <>
                    <p>{m.description}</p>
                    <ul className="mt-3 flex flex-wrap gap-1.5">{m.topics.map((t) => <li key={t} className="rounded-md border border-line px-2 py-0.5 text-sm text-gray">{t}</li>)}</ul>
                    <p className="mt-3 text-sm text-muted sm:hidden">{m.hours} horas</p>
                  </>
                )
              }))}
            />
          </Section>

          <Section id="docentes" title="Docentes">
            <div className="grid gap-4 sm:grid-cols-2">{course.teachers.map((t) => <TeacherCard key={t.name} teacher={t} />)}</div>
          </Section>

          <Section id="modalidad" title="Modalidad y duración">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="card p-5">
                <h3 className="flex items-center gap-2 text-lg text-white"><Icon name={course.modality === 'en-vivo' ? 'live' : course.modality === 'grabado' ? 'play' : 'layers'} className="text-cyan" />{MODALITY_LABELS[course.modality]}</h3>
                <p className="mt-2 text-gray">{MODALITY_EXPLANATIONS[course.modality]}</p>
              </div>
              <div className="card p-5">
                <h3 className="flex items-center gap-2 text-lg text-white"><Icon name="clock" className="text-cyan" />{course.duration_hours} horas totales</h3>
                <dl className="mt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between gap-4"><dt className="text-muted">Duración</dt><dd className="text-right text-white">{formatWeeks(course.duration_weeks)}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-muted">Dedicación aprox.</dt><dd className="text-right text-white">{Math.round(course.duration_hours / course.duration_weeks)} h/semana</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-muted">Frecuencia</dt><dd className="text-right text-white">{course.schedule}</dd></div>
                </dl>
              </div>
            </div>
          </Section>

          <Section id="certificacion" title="Certificación">
            <div className="card flex gap-4 p-5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-line-strong text-cyan"><Icon name="award" size={22} /></span>
              <div>
                <h3 className="text-lg text-white">{CERTIFICATE_LABELS[course.certificate.type]}</h3>
                <p className="mt-1 text-gray">{course.certificate.description}</p>
              </div>
            </div>
          </Section>

          <Section id="precio" title="Precio y financiamiento">
            <div className="card grid gap-6 p-5 sm:grid-cols-2">
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-muted">Precio regular</dt><dd className="tnum text-white">{course.price === 0 ? 'Gratis' : formatMoney(course.price, course.currency)}</dd></div>
                {course.discount_price != null && <div className="flex justify-between gap-4"><dt className="text-muted">Precio promocional</dt><dd className="tnum font-semibold text-pos">{formatMoney(course.discount_price, course.currency)}</dd></div>}
                <div className="flex justify-between gap-4"><dt className="text-muted">Moneda</dt><dd className="text-white">{course.currency === 'PEN' ? 'Soles (PEN)' : 'Dólares (USD)'}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted">Cuotas</dt><dd className="tnum text-white">{course.financing.installments ? `${course.financing.installments} × ${formatMoney(course.financing.installment_amount ?? 0, course.currency)}` : 'No aplica'}</dd></div>
              </dl>
              <div className="text-sm">
                <p className="text-white">{course.financing.notes}</p>
                {course.financing.methods.length > 0 && (
                  <>
                    <p className="label-mono mb-2 mt-4">Medios de pago</p>
                    <ul className="flex flex-wrap gap-1.5">{course.financing.methods.map((m) => <li key={m} className="rounded-md border border-line px-2 py-0.5 text-gray">{m}</li>)}</ul>
                  </>
                )}
              </div>
            </div>
            <p className="mt-3 text-xs text-muted">Precios referenciales informados por la institución. Confírmalos al solicitar información.</p>
          </Section>

          <Section id="institucion" title="Institución">
            <div className="card p-5">
              <div className="flex items-center gap-4">
                <InstitutionLogo institution={course.institution} size={56} />
                <div>
                  <h3 className="text-lg text-white">{course.institution.name}</h3>
                  <p className="text-sm text-muted">{course.institution.type} · {course.institution.city}, {course.institution.country}</p>
                </div>
              </div>
              <p className="mt-4 text-gray">{course.institution.description}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link to={`/institucion/${course.institution.slug}`} className="btn btn-ghost btn-sm">Ver todos sus programas</Link>
                <a href={course.institution.website} target="_blank" rel="noopener noreferrer nofollow" onClick={outbound} className="btn btn-quiet btn-sm">
                  Sitio web <Icon name="external" size={14} />
                </a>
              </div>
            </div>
          </Section>

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
