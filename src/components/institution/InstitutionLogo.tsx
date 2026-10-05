import type { Institution } from '../../types';

/**
 * Logo de institución. Si existe `logo` (URL) se usa la imagen con lazy-loading;
 * si no, se genera un monograma con el color de marca (sin peticiones de red).
 */
export function InstitutionLogo({ institution, size = 40, className = '' }: { institution: Institution; size?: number; className?: string }) {
  if (institution.logo) {
    return <img src={institution.logo} alt={`Logo de ${institution.name}`} width={size} height={size} loading="lazy" decoding="async" className={`rounded-xl bg-white object-contain ${className}`} />;
  }
  const letters = institution.short_name.replace(/[^A-Za-zÁÉÍÓÚÑ ]/g, '').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || institution.short_name.slice(0, 2);
  const text = institution.short_name.length <= 3 ? institution.short_name : letters.length === 1 ? institution.short_name.slice(0, 2) : letters;
  return (
    <span
      role="img"
      aria-label={`Logo de ${institution.name}`}
      className={`grid shrink-0 place-items-center rounded-xl font-semibold tracking-tight text-white ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(145deg, ${institution.brand_color}, ${institution.brand_color}99)`,
        boxShadow: `inset 0 0 0 1px rgb(255 255 255 / .12)`
      }}
    >
      {text}
    </span>
  );
}
