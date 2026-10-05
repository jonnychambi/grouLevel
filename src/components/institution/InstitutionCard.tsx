import { Link } from 'react-router-dom';
import type { Institution } from '../../types';
import { Stars } from '../reviews/Stars';
import { Icon } from '../ui/Icon';
import { InstitutionLogo } from './InstitutionLogo';

export function InstitutionCard({ institution, programs }: { institution: Institution; programs: number }) {
  const href = `/institucion/${institution.slug}`;
  return (
    <article className="card flex h-full flex-col p-6 transition-colors hover:border-line-strong">
      <div className="flex items-start gap-4">
        <InstitutionLogo institution={institution} size={52} />
        <div className="min-w-0">
          <h3 className="text-lg leading-snug text-white"><Link to={href} className="hover:text-cyan">{institution.name}</Link></h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted"><Icon name="map-pin" size={14} />{institution.city && institution.city !== institution.country ? `${institution.city}, ${institution.country}` : institution.country}</p>
        </div>
      </div>
      {institution.rating != null && (institution.reviews_count ?? 0) > 0 ? (
        <p className="mt-3 flex items-center gap-1.5 text-sm"><Stars value={institution.rating} size={14} /><span className="tnum font-medium text-white">{institution.rating.toFixed(1)}</span><span className="tnum text-muted">({institution.reviews_count} {institution.reviews_count === 1 ? 'reseña' : 'reseñas'})</span></p>
      ) : (
        <p className="mt-3 text-sm text-muted">Sin reseñas aún</p>
      )}
      <p className="mt-3 line-clamp-3 flex-1 text-sm text-gray">{institution.description}</p>
      <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
        <span className="text-sm text-gray"><span className="tnum font-semibold text-white">{programs}</span> {programs === 1 ? 'programa' : 'programas'}</span>
        <Link to={href} className="btn btn-ghost btn-sm">Ver programas</Link>
      </div>
    </article>
  );
}
