import { Link } from 'react-router-dom';
import { Icon } from './Icon';

export interface Crumb { label: string; to?: string }

export function Breadcrumbs({ items, className = '' }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Ruta de navegación" className={className}>
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
        {items.map((c, i) => (
          <li key={i} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <Icon name="chevron-right" size={14} className="shrink-0 text-dim" />}
            {c.to && i < items.length - 1 ? (
              <Link to={c.to} className="hover:text-white">{c.label}</Link>
            ) : (
              <span aria-current="page" className="truncate text-gray">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
