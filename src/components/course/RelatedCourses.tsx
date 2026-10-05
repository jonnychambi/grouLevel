import type { CourseWithInstitution, LeadSource } from '../../types';
import { CourseGrid } from './CourseGrid';

export function RelatedCourses({ title = 'También podrían interesarte', courses, source = 'detalle' }: { title?: string; courses: CourseWithInstitution[]; source?: LeadSource }) {
  if (!courses.length) return null;
  return (
    <section aria-labelledby="related-title" className="mt-16">
      <h2 id="related-title" className="mb-6 text-2xl text-white sm:text-3xl">{title}</h2>
      <CourseGrid courses={courses} columns={courses.length >= 4 ? 4 : 3} source={source} />
    </section>
  );
}
