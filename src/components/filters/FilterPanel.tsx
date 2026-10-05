import { useId, useState } from 'react';
import type { Currency } from '../../types';
import { FILTER_GROUPS, activeFilterCount, type FacetKey, type FilterContext, type FilterState } from '../../utils/filters';
import { Icon } from '../ui/Icon';

interface Props {
  state: FilterState;
  context: FilterContext;
  facets: Record<FacetKey, Record<string, number>>;
  onToggle: (key: FacetKey, value: string) => void;
  onCurrency: (c: Currency) => void;
  onClear: () => void;
  /** Opciones bloqueadas (p. ej. categoría fijada por la URL /programas/:categoria). */
  locked?: Partial<Record<FacetKey, string[]>>;
}

const COLLAPSED_LIMIT = 6;

/** Contenido de filtros compartido entre FilterSidebar (desktop) y FilterDrawer (mobile). */
export function FilterPanel({ state, context, facets, onToggle, onCurrency, onClear, locked }: Props) {
  const base = useId();
  const [open, setOpen] = useState<Set<FacetKey>>(() => new Set(FILTER_GROUPS.filter((g) => g.defaultOpen || (state[g.key] as string[]).length).map((g) => g.key)));
  const [showAll, setShowAll] = useState<Set<FacetKey>>(new Set());
  const total = activeFilterCount(state);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-white">Filtros {total > 0 && <span className="tnum text-cyan">({total})</span>}</p>
        {total > 0 && <button onClick={onClear} className="text-sm text-blue-soft hover:text-white">Limpiar filtros</button>}
      </div>

      {FILTER_GROUPS.map((g) => {
        const options = g.options(context);
        const selected = state[g.key] as string[];
        const isOpen = open.has(g.key);
        const expanded = showAll.has(g.key);
        // Ocultar opciones sin resultados (salvo si están seleccionadas) para no mostrar callejones sin salida.
        const visible = options.filter((o) => (facets[g.key]?.[o.value] ?? 0) > 0 || selected.includes(o.value));
        const list = expanded ? visible : visible.slice(0, COLLAPSED_LIMIT);
        const panelId = `${base}-${g.key}`;

        return (
          <fieldset key={g.key} className="border-t border-line py-3">
            <legend className="contents">
              <button
                type="button"
                className="flex w-full items-center justify-between py-1.5 text-left text-[15px] font-medium text-white"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen((s) => { const n = new Set(s); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n; })}
              >
                <span>
                  {g.label}
                  {selected.length > 0 && <span className="ml-2 font-mono text-xs text-cyan">{selected.length}</span>}
                </span>
                <Icon name="chevron-down" size={16} className={`text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
            </legend>

            <div id={panelId} hidden={!isOpen} className="pt-1.5">
              {g.key === 'price' && (
                <div className="mb-2 inline-flex rounded-full border border-line-strong p-0.5 text-xs" role="radiogroup" aria-label="Moneda de los rangos de precio">
                  {(['PEN', 'USD'] as Currency[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={state.currency === c}
                      onClick={() => onCurrency(c)}
                      className={`rounded-full px-3 py-1 font-mono ${state.currency === c ? 'bg-white text-navy' : 'text-gray hover:text-white'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
              <ul className="space-y-0.5">
                {list.map((o) => {
                  const checked = selected.includes(o.value);
                  const isLocked = locked?.[g.key]?.includes(o.value);
                  const count = facets[g.key]?.[o.value] ?? 0;
                  const id = `${panelId}-${o.value}`;
                  return (
                    <li key={o.value}>
                      <label htmlFor={id} className={`flex items-center gap-3 rounded-lg px-1.5 py-1.5 text-sm ${isLocked ? 'opacity-70' : 'cursor-pointer hover:bg-raise/60'}`}>
                        <input id={id} type="checkbox" checked={checked} disabled={isLocked} onChange={() => onToggle(g.key, o.value)} className="peer sr-only" />
                        <span aria-hidden="true" className={`grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border peer-focus-visible:ring-2 peer-focus-visible:ring-cyan ${checked ? 'border-cyan bg-cyan text-navy' : 'border-gray/50 bg-navy'}`}>
                          {checked && <Icon name="check" size={11} strokeWidth={3.5} />}
                        </span>
                        <span className={`flex-1 ${checked ? 'text-white' : 'text-gray'}`}>{o.label}</span>
                        <span className="tnum font-mono text-xs text-muted">{count}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {visible.length > COLLAPSED_LIMIT && (
                <button type="button" onClick={() => setShowAll((s) => { const n = new Set(s); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n; })} className="mt-1 px-1.5 text-sm text-blue-soft hover:text-white">
                  {expanded ? 'Ver menos' : `Ver ${visible.length - COLLAPSED_LIMIT} más`}
                </button>
              )}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
