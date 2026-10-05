import { Icon } from './Icon';

interface Props { page: number; pageCount: number; onChange: (page: number) => void }

function pages(page: number, count: number): (number | '…')[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const set = new Set([1, count, page - 1, page, page + 1].filter((p) => p >= 1 && p <= count));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
}

export function Pagination({ page, pageCount, onChange }: Props) {
  if (pageCount <= 1) return null;
  const btn = 'grid h-10 min-w-10 place-items-center rounded-full px-3 text-sm tnum transition-colors';
  return (
    <nav aria-label="Paginación" className="mt-10 flex items-center justify-center gap-1.5">
      <button className={`${btn} text-gray hover:bg-raise hover:text-white disabled:opacity-40`} onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="Página anterior">
        <Icon name="chevron-left" />
      </button>
      {pages(page, pageCount).map((p, i) =>
        p === '…' ? (
          <span key={`e${i}`} className="px-1 text-dim">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={`${btn} ${p === page ? 'bg-white font-semibold text-navy' : 'text-gray hover:bg-raise hover:text-white'}`}
          >
            {p}
          </button>
        )
      )}
      <button className={`${btn} text-gray hover:bg-raise hover:text-white disabled:opacity-40`} onClick={() => onChange(page + 1)} disabled={page === pageCount} aria-label="Página siguiente">
        <Icon name="chevron-right" />
      </button>
    </nav>
  );
}
