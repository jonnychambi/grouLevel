import type { CourseWithInstitution } from '../../types';
import { useFavorites } from '../../hooks/useFavorites';
import { useToast } from '../../context/ToastContext';
import { courseContext, track } from '../../services/analytics';
import { Icon } from '../ui/Icon';

export function FavoriteButton({ course, className = '', withLabel = false }: { course: CourseWithInstitution; className?: string; withLabel?: boolean }) {
  const { has, toggle } = useFavorites();
  const notify = useToast();
  const active = has(course.id);

  const onClick = () => {
    const added = toggle(course.id);
    if (added) {
      track('favorite_added', courseContext(course));
      notify('Guardado en favoritos', { tone: 'success', action: { label: 'Ver favoritos', to: '/favoritos' } });
    } else track('favorite_removed', { course_id: course.id });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? `Quitar ${course.name} de favoritos` : `Guardar ${course.name} en favoritos`}
      className={`inline-flex items-center gap-2 rounded-full transition-colors ${withLabel ? 'btn btn-ghost' : 'grid h-10 w-10 place-items-center hover:bg-raise'} ${active ? 'text-neg' : 'text-gray hover:text-white'} ${className}`}
    >
      <Icon name="heart" filled={active} size={20} />
      {withLabel && (active ? 'Guardado' : 'Guardar')}
    </button>
  );
}
