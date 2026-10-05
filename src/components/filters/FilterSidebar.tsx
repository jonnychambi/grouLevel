import type { ComponentProps } from 'react';
import { FilterPanel } from './FilterPanel';

/** Filtros en sidebar (desktop ≥ lg). */
export function FilterSidebar(props: ComponentProps<typeof FilterPanel>) {
  return (
    <aside aria-label="Filtros" className="sticky top-24 hidden max-h-[calc(100dvh-7rem)] w-72 shrink-0 overflow-y-auto pr-2 scrollbar-none lg:block">
      <FilterPanel {...props} />
    </aside>
  );
}
