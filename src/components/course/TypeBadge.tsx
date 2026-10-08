import type { ProgramType } from '../../types';
import { PROGRAM_TYPE_ACCENT, PROGRAM_TYPE_LABELS } from '../../utils/labels';

/** Etiqueta del tipo de programa con su color de acento (diferenciación sutil). */
export function TypeBadge({ type, className = '' }: { type: ProgramType; className?: string }) {
  const accent = PROGRAM_TYPE_ACCENT[type];
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] ${className}`}
      style={{ color: accent, borderColor: `color-mix(in srgb, ${accent} 40%, transparent)`, background: `color-mix(in srgb, ${accent} 9%, transparent)` }}
    >
      {PROGRAM_TYPE_LABELS[type]}
    </span>
  );
}

/** Franja lateral de acento por tipo (va dentro de un contenedor `relative`). */
export function TypeAccent({ type }: { type: ProgramType }) {
  return <span aria-hidden="true" className="pointer-events-none absolute inset-y-4 left-0 w-[3px] rounded-r-full opacity-70" style={{ background: PROGRAM_TYPE_ACCENT[type] }} />;
}
