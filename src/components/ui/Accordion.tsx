import { useId, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

export interface AccordionItem { id: string; title: ReactNode; meta?: ReactNode; content: ReactNode }

/** Accordion accesible (WAI-ARIA): botones con aria-expanded / aria-controls. */
export function Accordion({ items, defaultOpen = [] }: { items: AccordionItem[]; defaultOpen?: string[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set(defaultOpen));
  const base = useId();
  const toggle = (id: string) => setOpen((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allOpen = open.size === items.length;

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button className="btn btn-quiet btn-sm" onClick={() => setOpen(allOpen ? new Set() : new Set(items.map((i) => i.id)))}>
          {allOpen ? 'Contraer todo' : 'Expandir todo'}
        </button>
      </div>
      <div className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-midnight">
        {items.map((item) => {
          const isOpen = open.has(item.id);
          const panelId = `${base}-${item.id}`;
          return (
            <div key={item.id}>
              <h3 className="text-base font-medium tracking-tight">
                <button
                  className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-surface"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggle(item.id)}
                >
                  <span className="flex-1">{item.title}</span>
                  {item.meta && <span className="hidden shrink-0 text-sm text-muted sm:inline">{item.meta}</span>}
                  <Icon name="chevron-down" className={`shrink-0 text-gray transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
              </h3>
              <div id={panelId} role="region" hidden={!isOpen} className="px-5 pb-5 text-gray">
                {item.content}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
