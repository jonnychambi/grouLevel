import courses from '../../data/courses.json';
import institutions from '../../data/institutions.json';
import categories from '../../data/categories.json';
import type { Category, Course, CourseWithInstitution, Institution } from '../../types';

const inst = new Map((institutions as Institution[]).map((i) => [i.id, i]));
export const CATALOG: CourseWithInstitution[] = (courses as Course[]).map((c) => ({ ...c, institution: inst.get(c.institution_id)! }));
export const CATEGORIES = categories as Category[];
export const INSTITUTIONS = institutions as Institution[];
