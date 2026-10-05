import { Link } from 'react-router-dom';
import { useCatalog } from '../../hooks/useCatalog';
import { useRecentlyViewed } from '../../hooks/useRecentlyViewed';
import { InstitutionLogo } from '../institution/InstitutionLogo';
import { PriceDisplay } from '../ui/PriceDisplay';

/** "Programas que viste recientemente" (localStorage). */
export function RecentlyViewed({ excludeId, className = '' }: { excludeId?: string; className?: string }) {
  const { ids, clear } = useRecentlyViewed();
  const { catalog } = useCatalog();
  if (!catalog) return null;
  const items = ids.filter((id) => id !== excludeId).map((id) => catalog.byId.get(id)).filter((c): c is NonNullable<typeof c> => !!c).slice(0, 6);
  if (!items.length) return null;

  return (
    <section aria-labelledby="recent-title" className={className}>
      <div className="mb-5 flex items-end justify-between gap-4">
        <h2 id="recent-title" className="text-xl text-white sm:text-2xl">Programas que viste recientemente</h2>
        <button onClick={clear} className="btn btn-quiet btn-sm">Borrar historial</button>
      </div>
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
        {items.map((c) => (
          <li key={c.id} className="w-[78%] shrink-0 snap-start sm:w-auto">
            <Link to={`/programa/${c.slug}`} className="card flex h-full items-center gap-3 p-4 transition-colors hover:border-line-strong">
              <InstitutionLogo institution={c.institution} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{c.name}</p>
                <p className="truncate text-xs text-muted">{c.institution.short_name}</p>
              </div>
              <PriceDisplay course={c} size="sm" showFrom={false} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
