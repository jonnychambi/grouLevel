import type { CourseWithInstitution } from '../../types';
import { useCompare } from '../../hooks/useCompare';
import { useToast } from '../../context/ToastContext';
import { courseContext, track } from '../../services/analytics';
import { Icon } from '../ui/Icon';

interface Props { course: CourseWithInstitution; source: string; variant?: 'chip' | 'button'; className?: string }

export function CompareButton({ course, source, variant = 'chip', className = '' }: Props) {
  const { has, toggle, count, max } = useCompare();
  const notify = useToast();
  const selected = has(course.id);

  const onClick = () => {
    const result = toggle(course.id);
    if (result === 'full') {
      notify(`Puedes comparar hasta ${max} programas. Quita uno para agregar este.`, { tone: 'warning', action: { label: 'Ver comparación', to: '/comparar' } });
      return;
    }
    if (result === 'added') track('compare_added', { ...courseContext(course), compare_count: count + 1, source });
    else track('compare_removed', { course_id: course.id, compare_count: count - 1 });
  };

  const label = selected ? 'En comparación' : variant === 'button' ? 'Agregar a comparación' : 'Comparar';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`${selected ? 'Quitar de' : 'Agregar a'} comparación: ${course.name}`}
      className={`btn ${variant === 'button' ? '' : 'btn-sm'} ${selected ? 'border border-cyan/60 bg-cyan/10 text-cyan hover:bg-cyan/15' : 'btn-ghost'} ${className}`}
    >
      <span className={`grid h-4 w-4 place-items-center rounded-[5px] border ${selected ? 'border-cyan bg-cyan text-navy' : 'border-gray/60'}`}>
        {selected && <Icon name="check" size={12} strokeWidth={3} />}
      </span>
      {label}
    </button>
  );
}
