import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCatalog } from '../../hooks/useCatalog';
import { useCompare } from '../../hooks/useCompare';
import { InstitutionLogo } from '../institution/InstitutionLogo';
import { Icon } from '../ui/Icon';

/** Barra flotante de comparación: incentiva comparar sin pedir registro. */
export function CompareTray() {
  const { ids, count, max, remove, clear } = useCompare();
  const { catalog } = useCatalog();
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);

  if (count === 0 || location.pathname.startsWith('/comparar') || !catalog) return null;
  const courses = ids.map((id) => catalog.byId.get(id)).filter((c): c is NonNullable<typeof c> => !!c);

  const message = count === 1 ? 'Agrega otro programa para comparar.' : count < max ? 'Ya puedes comparar estos programas.' : 'Máximo alcanzado: compara ahora.';
  const canCompare = count >= 2;

  return (
    <aside aria-label="Programas seleccionados para comparar" className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:px-6 sm:pb-5">
      <div className="mx-auto max-w-4xl animate-slide-up rounded-2xl border border-line-strong bg-raise/95 shadow-[0_-10px_60px_-15px_rgba(0,0,0,.7)] backdrop-blur-xl">
        {expanded && (
          <ul className="grid gap-2 border-b border-line p-3 sm:grid-cols-3">
            {courses.map((c) => (
              <li key={c.id} className="flex items-center gap-2.5 rounded-xl bg-midnight p-2.5">
                <InstitutionLogo institution={c.institution} size={32} />
                <span className="min-w-0 flex-1 truncate text-sm text-white">{c.name}</span>
                <button onClick={() => remove(c.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-raise hover:text-white" aria-label={`Quitar ${c.name}`}>
                  <Icon name="x" size={14} />
                </button>
              </li>
            ))}
            {Array.from({ length: max - count }, (_, i) => (
              <li key={`empty-${i}`} className="hidden items-center justify-center rounded-xl border border-dashed border-line-strong p-2.5 text-sm text-muted sm:flex">
                <Link to="/programas" className="hover:text-white">+ Agregar programa</Link>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-3 p-3 sm:px-4">
          <div className="hidden -space-x-2 sm:flex" aria-hidden="true">
            {courses.map((c) => <InstitutionLogo key={c.id} institution={c.institution} size={34} className="ring-2 ring-raise" />)}
          </div>
          <button onClick={() => setExpanded((v) => !v)} className="min-w-0 flex-1 text-left" aria-expanded={expanded}>
            <p className="flex items-center gap-1.5 text-sm font-medium text-white">
              <span className="tnum">{count === 1 ? `1 de ${max} programas seleccionados` : `${count} programas seleccionados`}</span>
              <Icon name={expanded ? 'chevron-down' : 'chevron-up'} size={14} className="text-muted" />
            </p>
            <p className="truncate text-xs text-gray" aria-live="polite">{message}</p>
          </button>
          <button onClick={clear} className="btn btn-quiet btn-sm hidden sm:inline-flex">Limpiar</button>
          {canCompare ? (
            <Link to="/comparar" className="btn btn-accent btn-sm shrink-0">Comparar ahora</Link>
          ) : (
            <Link to="/programas" className="btn btn-ghost btn-sm shrink-0">Agregar otro</Link>
          )}
        </div>
      </div>
    </aside>
  );
}
