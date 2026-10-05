import { useId } from 'react';
import { SORT_OPTIONS, type SortKey } from '../../utils/filters';
import { Icon } from '../ui/Icon';

export function SortSelector({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="hidden text-sm text-muted sm:block">Ordenar por</label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value as SortKey)}
          className="h-10 cursor-pointer appearance-none rounded-full border border-line-strong bg-midnight pl-4 pr-9 text-sm text-white hover:border-gray/40 focus:border-blue focus:outline-none"
        >
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <Icon name="chevron-down" size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
      </div>
    </div>
  );
}
