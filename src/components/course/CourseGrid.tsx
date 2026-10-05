import type { CourseWithInstitution, LeadSource } from '../../types';
import { CourseCard, CourseCardSkeleton } from './CourseCard';

interface Props { courses: CourseWithInstitution[]; loading?: boolean; source?: LeadSource; columns?: 2 | 3 | 4; skeletons?: number }

export function CourseGrid({ courses, loading = false, source, columns = 3, skeletons = 6 }: Props) {
  const cols = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 xl:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }[columns];
  return (
    <ul className={`grid grid-cols-1 gap-4 sm:gap-5 ${cols}`} aria-busy={loading}>
      {loading
        ? Array.from({ length: skeletons }, (_, i) => <li key={i}><CourseCardSkeleton /></li>)
        : courses.map((c) => (
            <li key={c.id} className="animate-fade-in">
              <CourseCard course={c} source={source} />
            </li>
          ))}
    </ul>
  );
}
