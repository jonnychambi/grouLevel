import { Icon } from './Icon';

export function Rating({ value, count, compact = false }: { value: number; count?: number; compact?: boolean }) {
  return (
    <span className="tnum inline-flex items-center gap-1 text-sm text-gray" aria-label={`Valoración ${value} de 5${count ? `, ${count} reseñas` : ''}`}>
      <Icon name="star" size={14} filled className="text-warn" />
      <span className="font-medium text-white">{value.toFixed(1)}</span>
      {count != null && !compact && <span className="text-muted">({count.toLocaleString('es-PE')})</span>}
    </span>
  );
}
