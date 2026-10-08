import type { CourseWithInstitution, LeadSource } from '../../types';
import { CourseRow, CourseRowHeader, CourseRowSkeleton } from './CourseRow';

/** Listado horizontal de programas con cabecera de columnas. */
export function CourseList({ courses, loading = false, source, skeletons = 8 }: { courses: CourseWithInstitution[]; loading?: boolean; source?: LeadSource; skeletons?: number }) {
  return (
    <div>
      <CourseRowHeader />
      <ul className="space-y-2.5" aria-busy={loading}>
        {loading
          ? Array.from({ length: skeletons }, (_, i) => <li key={i}><CourseRowSkeleton /></li>)
          : courses.map((c) => (
              <li key={c.id} className="animate-fade-in">
                <CourseRow course={c} source={source} />
              </li>
            ))}
      </ul>
    </div>
  );
}
