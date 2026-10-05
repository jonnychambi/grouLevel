import type { Teacher } from '../../types';
import { initials } from '../../utils/format';
import { Icon } from '../ui/Icon';

export function TeacherCard({ teacher }: { teacher: Teacher }) {
  return (
    <article className="card flex gap-4 p-5">
      {teacher.photo ? (
        <img src={teacher.photo} alt={`Foto de ${teacher.name}`} width={56} height={56} loading="lazy" className="h-14 w-14 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-line-strong bg-gradient-to-br from-raise to-navy text-lg font-semibold text-white" aria-hidden="true">
          {initials(teacher.name)}
        </span>
      )}
      <div className="min-w-0">
        <h3 className="text-base text-white">{teacher.name}</h3>
        {teacher.profile && <p className="mt-1 text-sm text-gray">{teacher.profile}</p>}
        {teacher.linkedin && (
          <a href={teacher.linkedin} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm text-blue-soft hover:text-white">
            <Icon name="linkedin" size={14} /> LinkedIn
          </a>
        )}
      </div>
    </article>
  );
}
