import type { CertificateType, Level, Modality, ProgramType } from '../types';

/** Color de acento por tipo de programa (diferenciación sutil en tarjetas y listados). */
export const PROGRAM_TYPE_ACCENT: Record<ProgramType, string> = {
  curso: 'var(--color-gray)',
  especializacion: 'var(--color-blue)',
  certificacion: 'var(--color-cyan)',
  bootcamp: 'var(--color-violet)',
  diplomado: 'var(--color-blue-soft)',
  'programa-ejecutivo': 'var(--color-warn)',
  maestria: 'var(--color-violet-soft)',
  membresia: 'var(--color-pos)'
};

export const PROGRAM_TYPE_LABELS: Record<ProgramType, string> = {
  curso: 'Curso',
  especializacion: 'Especialización',
  certificacion: 'Certificación',
  bootcamp: 'Bootcamp',
  diplomado: 'Diplomado',
  'programa-ejecutivo': 'Programa ejecutivo',
  maestria: 'Maestría',
  membresia: 'Membresía'
};

export const MODALITY_LABELS: Record<Modality, string> = {
  'en-vivo': 'Online en vivo',
  grabado: 'Grabado · a tu ritmo',
  hibrido: 'Híbrido',
  presencial: 'Presencial'
};

/** Etiquetas cortas para espacios reducidos (cards). */
export const MODALITY_SHORT: Record<Modality, string> = {
  'en-vivo': 'En vivo',
  grabado: 'Grabado',
  hibrido: 'Híbrido',
  presencial: 'Presencial'
};

export const MODALITY_EXPLANATIONS: Record<Modality, string> = {
  'en-vivo': 'Clases sincrónicas por videoconferencia con horario fijo. Puedes preguntar en tiempo real y las sesiones suelen quedar grabadas.',
  grabado: 'Contenido asincrónico disponible para avanzar a tu ritmo, en el horario que prefieras.',
  hibrido: 'Combina contenido grabado o sesiones presenciales con sesiones en vivo para práctica y resolución de dudas.',
  presencial: 'Clases en las instalaciones de la institución, con horario fijo.'
};

export const NOT_PUBLISHED = 'No publicado';

export const LEVEL_LABELS: Record<Level, string> = {
  basico: 'Básico',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado'
};

export const CERTIFICATE_LABELS: Record<CertificateType, string> = {
  incluye: 'Incluye certificado',
  internacional: 'Certificación internacional',
  preparacion: 'Preparación para certificación'
};
