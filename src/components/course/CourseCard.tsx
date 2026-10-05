import { Link } from 'react-router-dom';
import type { CourseWithInstitution } from '../../types';
import { durationLabel, startLabel } from '../../utils/format';
import { LEVEL_LABELS, MODALITY_LABELS, MODALITY_SHORT, PROGRAM_TYPE_LABELS } from '../../utils/labels';
import { useLeadModal } from '../../context/LeadModalContext';
import type { LeadSource } from '../../types';
import { InstitutionLogo } from '../institution/InstitutionLogo';
import { Badge } from '../ui/Badge';
import { Icon, type IconName } from '../ui/Icon';
import { PriceDisplay } from '../ui/PriceDisplay';
import { Rating } from '../ui/Rating';
import { CompareButton } from './CompareButton';
import { FavoriteButton } from './FavoriteButton';

const MODALITY_ICON: Record<string, IconName> = { 'en-vivo': 'live', grabado: 'play', hibrido: 'layers', presencial: 'building' };

function Fact({ icon, label, value, title }: { icon: IconName; label: string; value: string; title?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2" title={title}>
      <Icon name={icon} size={16} className="shrink-0 text-muted" />
      <span className="sr-only">{label}: </span>
      <span className="truncate text-sm text-gray">{value}</span>
    </div>
  );
}

/** Card de programa: permite evaluar una alternativa en segundos. */
export function CourseCard({ course, source = 'listado' }: { course: CourseWithInstitution; source?: LeadSource }) {
  const openLead = useLeadModal();
  const href = `/programa/${course.slug}`;

  return (
    <article className="card group relative flex h-full flex-col p-5 transition-colors hover:border-line-strong" aria-labelledby={`c-${course.id}`}>
      <header className="flex items-start gap-3">
        <InstitutionLogo institution={course.institution} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-gray">{course.institution.name}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge tone="type" mono>{PROGRAM_TYPE_LABELS[course.program_type]}</Badge>
            {course.featured && (
              <Badge tone="featured" mono>
                <span title="Listing destacado por la institución">Destacado</span>
              </Badge>
            )}
          </div>
        </div>
        <FavoriteButton course={course} className="-mr-2 -mt-1" />
      </header>

      <h3 id={`c-${course.id}`} className="mt-4 text-lg leading-snug text-white">
        <Link to={href} className="hover:text-cyan focus-visible:text-cyan">{course.name}</Link>
      </h3>
      <p className="mt-1.5 line-clamp-2 text-sm text-muted">{course.short_description}</p>

      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2.5">
        <Fact icon={course.modality ? MODALITY_ICON[course.modality] : 'live'} label="Modalidad" value={course.modality ? MODALITY_SHORT[course.modality] : 'No publicada'} title={course.modality ? MODALITY_LABELS[course.modality] : undefined} />
        <Fact icon="clock" label="Duración" value={durationLabel(course)} title={course.duration_text ?? undefined} />
        <Fact icon="level" label="Nivel" value={course.level ? LEVEL_LABELS[course.level] : 'Nivel no indicado'} />
        <Fact icon="calendar" label="Inicio" value={startLabel(course)} title={course.start_text ?? undefined} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
        <PriceDisplay course={course} size="md" />
        {course.rating != null && <Rating value={course.rating} count={course.reviews_count ?? undefined} compact />}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link to={href} className="btn btn-primary btn-sm flex-1">Ver programa</Link>
        <CompareButton course={course} source={source} className="flex-1" />
      </div>
      <button type="button" onClick={() => openLead(course, source)} className="mt-3 inline-flex items-center justify-center gap-1.5 self-center text-sm font-medium text-blue-soft hover:text-white">
        Solicitar información <Icon name="arrow-right" size={14} />
      </button>
    </article>
  );
}

export function CourseCardSkeleton() {
  return (
    <div className="card p-5" aria-hidden="true">
      <div className="flex gap-3"><div className="skeleton h-10 w-10" /><div className="flex-1 space-y-2"><div className="skeleton h-3 w-2/3" /><div className="skeleton h-4 w-20" /></div></div>
      <div className="skeleton mt-5 h-5 w-4/5" />
      <div className="skeleton mt-2 h-3 w-full" />
      <div className="mt-5 grid grid-cols-2 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-4" />)}</div>
      <div className="skeleton mt-6 h-7 w-28" />
      <div className="mt-5 flex gap-2"><div className="skeleton h-9 flex-1 rounded-full" /><div className="skeleton h-9 flex-1 rounded-full" /></div>
    </div>
  );
}
