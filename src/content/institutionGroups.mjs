/**
 * Grupos del listado de instituciones (/instituciones), compartidos por el HTML del servidor y la app.
 * Universidades: universidades y sus escuelas de posgrado o de negocios. Instituciones especializadas: institutos,
 * academias, bootcamps, centros de capacitación y educación ejecutiva independiente.
 */
const UNIVERSITY = /universi|posgrado|postgrado|escuela de negocios|business school/i;

/** @param {{ type?: string | null, name?: string | null }} i */
export const institutionGroup = (i) => (UNIVERSITY.test(`${i.type ?? ''} ${i.name ?? ''}`) ? 'universidades' : 'especializadas');

export const INSTITUTION_GROUPS = [
  { id: 'universidades', title: 'Universidades', description: 'Universidades y sus escuelas de posgrado y de negocios: maestrías, diplomados, especializaciones y cursos de extensión.' },
  { id: 'especializadas', title: 'Instituciones especializadas', description: 'Institutos, academias, bootcamps y centros de capacitación enfocados en tecnología, datos y negocios digitales.' }
];
