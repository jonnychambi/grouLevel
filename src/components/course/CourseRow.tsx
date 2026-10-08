import { Link } from 'react-router-dom';
import type { CourseWithInstitution, LeadSource } from '../../types';
import { durationLabel, startLabel } from '../../utils/format';
import { MODALITY_LABELS, MODALITY_SHORT } from '../../utils/labels';
import { useLeadModal } from '../../context/LeadModalContext';
import { InstitutionLogo } from '../institution/InstitutionLogo';
import { Badge } from '../ui/Badge';
import { PriceDisplay } from '../ui/PriceDisplay';
import { Stars } from '../reviews/Stars';
import { CompareButton } from './CompareButton';
import { FavoriteButton } from './FavoriteButton';
import { TypeAccent, TypeBadge } from './TypeBadge';

/** Columnas compartidas por la fila y la cabecera del listado (desde lg). */
export const ROW_COLS = 'lg:grid-cols-[minmax(0,2.8fr)_minmax(0,0.9fr)_minmax(0,0.75fr)_minmax(0,0.85fr)_minmax(0,1.1fr)_10.5rem]';

function Cell({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="min-w-0" title={title}>
      <span className="block text-[11px] uppercase tracking-wider text-dim lg:sr-only">{label}</span>
      <span className="block truncate text-sm text-gray">{value}</span>
    </div>
  );
}

/** Programa en formato de fila: todos los datos clave alineados en columnas para comparar de un vistazo. */
export function CourseRow({ course, source = 'listado' }: { course: CourseWithInstitution; source?: LeadSource }) {
  const openLead = useLeadModal();
  const href = `/programa/${course.slug}`;
  return (
    <article className={`card relative grid grid-cols-2 items-center gap-x-4 gap-y-3 py-3.5 pl-5 pr-3 transition-colors hover:border-line-strong sm:grid-cols-3 ${ROW_COLS}`} aria-labelledby={`r-${course.id}`}>
      <TypeAccent type={course.program_type} />
      <div className="col-span-2 flex min-w-0 items-start gap-3 sm:col-span-3 lg:col-span-1">
        <InstitutionLogo institution={course.institution} size={36} />
        <div className="min-w-0 flex-1">
          <h3 id={`r-${course.id}`} className="text-[15px] font-medium leading-snug text-white">
            <Link to={href} className="line-clamp-2 hover:text-cyan focus-visible:text-cyan">{course.name}</Link>
          </h3>
          <p className="mt-0.5 truncate text-xs text-gray">{course.institution.name}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <TypeBadge type={course.program_type} />
            {course.featured && <Badge tone="featured" mono>Destacado</Badge>}
            {course.rating != null && course.reviews_count ? (
              <Link to={`${href}#resenas`} className="inline-flex items-center gap-1 text-xs" aria-label={`Valoración ${course.rating.toFixed(1)} de 5, ${course.reviews_count} reseñas`}>
                <Stars value={course.rating} size={12} /><span className="tnum text-white">{course.rating.toFixed(1)}</span><span className="tnum text-muted">({course.reviews_count})</span>
              </Link>
            ) : null}
          </div>
        </div>
        <span className="-mr-1 -mt-1 lg:hidden"><FavoriteButton course={course} /></span>
      </div>
      <Cell label="Modalidad" value={course.modality ? MODALITY_SHORT[course.modality] : 'No publicada'} title={course.modality ? MODALITY_LABELS[course.modality] : undefined} />
      <Cell label="Duración" value={durationLabel(course)} title={course.duration_text ?? undefined} />
      <Cell label="Inicio" value={startLabel(course)} title={course.start_text ?? undefined} />
      <div className="min-w-0">
        <span className="block text-[11px] uppercase tracking-wider text-dim lg:sr-only">Precio</span>
        <PriceDisplay course={course} size="sm" className="whitespace-nowrap" />
      </div>
      <div className="col-span-2 flex items-center gap-2 sm:col-span-2 lg:col-span-1 lg:flex-col lg:items-stretch lg:gap-1.5">
        <div className="flex flex-1 items-center gap-2">
          <Link to={href} className="btn btn-primary btn-sm flex-1 whitespace-nowrap lg:hidden">Ver programa</Link>
          <CompareButton course={course} source={source} className="flex-1 whitespace-nowrap" />
          <span className="hidden lg:block"><FavoriteButton course={course} /></span>
        </div>
        <div className="hidden items-center justify-between px-1 text-xs font-medium lg:flex">
          <Link to={href} className="text-white hover:text-cyan">Ver programa</Link>
          <button type="button" onClick={() => openLead(course, source)} className="text-blue-soft hover:text-white">Solicitar info</button>
        </div>
      </div>
    </article>
  );
}

/** Cabecera de columnas del listado (solo pantallas anchas). */
export function CourseRowHeader() {
  return (
    <div className={`hidden gap-x-4 px-5 pb-1 text-[11px] uppercase tracking-wider text-dim lg:grid ${ROW_COLS}`} aria-hidden="true">
      <span>Programa</span><span>Modalidad</span><span>Duración</span><span>Inicio</span><span>Precio</span><span />
    </div>
  );
}

export function CourseRowSkeleton() {
  return (
    <div className="card flex items-center gap-4 p-4" aria-hidden="true">
      <div className="skeleton h-9 w-9" />
      <div className="flex-1 space-y-2"><div className="skeleton h-4 w-3/5" /><div className="skeleton h-3 w-1/3" /></div>
      <div className="skeleton hidden h-4 w-20 lg:block" /><div className="skeleton hidden h-4 w-16 lg:block" /><div className="skeleton hidden h-4 w-20 lg:block" />
      <div className="skeleton h-6 w-24" />
    </div>
  );
}
