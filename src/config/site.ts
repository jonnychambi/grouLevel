/** Configuración global del sitio. Cambia aquí sin tocar componentes. */
export const SITE = {
  name: 'Groulevel',
  tagline: 'Encuentra la formación que te lleva al siguiente nivel.',
  description:
    'Compara cursos, bootcamps, diplomados y maestrías en tecnología de las principales instituciones. Precios, duración y modalidad en un solo lugar.',
  /** URL pública absoluta (sin "/" final). Se inyecta en build con VITE_SITE_URL. */
  url: ((import.meta.env.VITE_SITE_URL as string | undefined) ?? 'https://www.groulevel.com').replace(/\/$/, ''),
  locale: 'es_PE',
  country: 'Perú',
  contactEmail: 'partners@groulevel.example',
  /** Tipo de cambio referencial para comparar precios en una sola moneda. */
  exchangeRate: { USD_PEN: 3.75 },
  pageSize: 12,
  maxCompare: 3
} as const;

/** Prefijo de rutas (coincide con `base` de Vite). */
export const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, '');
