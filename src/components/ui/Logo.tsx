import { useId } from 'react';

/**
 * Logo Groulevel: G propietaria (arco 315° Intelligent Revenue Loop + tres puntos
 * Signal → Processing → Growth) + "roulevel" en Geist Semibold, tracking −4%.
 */
export function GMark({ size = 24, className = '' }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`g-${id}`} x1="30" y1="4" x2="40" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7657FF" />
          <stop offset=".55" stopColor="#246BFE" />
          <stop offset="1" stopColor="#00E7FF" />
        </linearGradient>
      </defs>
      <path d="M36.02 11.98 A17 17 0 1 0 41 24" fill="none" stroke={`url(#g-${id})`} strokeWidth="6.2" />
      <circle cx="23.5" cy="24" r="1.9" fill="#7657FF" />
      <circle cx="31" cy="24" r="2.7" fill="#246BFE" />
      <circle cx="41" cy="24" r="4.1" fill="#00E7FF" />
    </svg>
  );
}

export function Logo({ size = 22, className = '' }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center font-semibold leading-none text-white ${className}`} style={{ fontSize: size, letterSpacing: '-0.04em' }}>
      <GMark size={Math.round(size * 0.98)} className="mr-[0.02em] translate-y-[0.01em]" />
      roulevel
    </span>
  );
}
