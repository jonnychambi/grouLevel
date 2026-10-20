/**
 * Groulevel Rewards: textos de la landing /rewards, compartidos por el HTML del servidor (staticRoutes) y la app.
 * Las reglas reflejan exactamente cómo funcionan los créditos en api/_lib/reviews.ts (CREDITS en
 * src/utils/reviews.ts; una prueba verifica que los montos coincidan). Si cambian las reglas, cambiar aquí.
 */
export const REWARDS = { review: 100, referral: 100, maxPerProgram: 300 };

export const REWARDS_META = {
  title: 'Groulevel Rewards: Gana S/ 100 por tu Reseña | Groulevel',
  description: `Opina sobre la institución donde estudiaste y gana S/ ${REWARDS.review} de descuento adicional para tu próximo programa. Invita a otros y gana S/ ${REWARDS.referral} por cada reseña aprobada. Hasta S/ ${REWARDS.maxPerProgram} por programa.`
};

export const REWARDS_HERO = {
  eyebrow: 'Groulevel Rewards · Campaña de lanzamiento',
  h1: `Tu experiencia vale S/ ${REWARDS.review}.`,
  subtitle: `Opina sobre la institución donde estudiaste y gana S/ ${REWARDS.review} de descuento adicional para tu próximo programa. Invita a otras personas y gana S/ ${REWARDS.referral} más por cada una que publique su reseña.`
};

export const REWARDS_STEPS = [
  { title: 'Valida tu correo', text: 'Te enviamos un código para confirmar que eres una persona real. No publicamos tu correo.' },
  { title: 'Escribe tu reseña', text: 'Cuenta qué fue lo mejor y qué debería mejorar. Marca la opción de crédito y adjunta tu constancia de estudios (certificado, constancia de matrícula o boleta).' },
  { title: 'La revisamos', text: 'Cuando la reseña se publica y la constancia se verifica, tus S/ 100 pasan de “por activar” a “disponibles”.' },
  { title: 'Úsalo como descuento', text: `Elige el programa que quieres estudiar y aplica tu saldo: hasta S/ ${REWARDS.maxPerProgram} por programa. Recibes un código GL- para presentarlo al matricularte.` }
];

export const REWARDS_RULES = [
  `S/ ${REWARDS.review} por cada reseña aprobada: publicada por moderación y con constancia de estudios verificada. Una reseña por persona, institución y programa.`,
  `S/ ${REWARDS.referral} por cada persona que publique su primera reseña con tu enlace, cuando esa reseña se aprueba y su constancia se verifica. Tu referido también puede ganar sus propios S/ ${REWARDS.review}.`,
  'El crédito no depende de tu calificación: valoramos igual las opiniones positivas y las críticas.',
  'Las reseñas con crédito se identifican públicamente como “Incentivada”.',
  `El saldo se usa como descuento adicional en el programa que elijas, en montos de S/ ${REWARDS.review} y hasta S/ ${REWARDS.maxPerProgram} por programa. No es canjeable por dinero.`,
  'Al aplicar tu saldo recibes un código GL-. Preséntalo a la institución al matricularte o escríbenos y coordinamos el descuento.',
  'No se otorgan créditos por reseñas falsas, duplicadas, publicitarias o enviadas desde cuentas creadas para obtener referidos. Groulevel puede anular créditos obtenidos de forma irregular.'
];

export const REWARDS_FAQ = [
  { q: '¿Tengo que dar una buena calificación para ganar el crédito?', a: 'No. El crédito es por tu tiempo, no por tu opinión. Publicamos reseñas positivas y críticas; solo rechazamos contenido falso, ofensivo, publicitario o con datos personales.' },
  { q: '¿Cuándo puedo usar mis S/ 100?', a: 'Cuando tu reseña se publica y verificamos tu constancia de estudios. Mientras tanto aparecen como “por activar” en Mis créditos.' },
  { q: '¿Qué constancia sirve?', a: 'Un certificado, una constancia de matrícula o una boleta de pago del programa, en PDF o imagen (máx. 8 MB). Solo la ve el equipo de Groulevel y nunca se publica.' },
  { q: '¿Cómo gano por invitar?', a: `Comparte tu enlace personal. Cuando alguien escribe su primera reseña con ese enlace y se aprueba, ganas S/ ${REWARDS.referral}. No hay límite de referidos.` },
  { q: '¿Puedo juntar créditos de varias reseñas?', a: `Sí. Se acumulan sin límite, pero en un mismo programa puedes aplicar hasta S/ ${REWARDS.maxPerProgram}. Si acumulas más, úsalos en otro programa.` },
  { q: '¿Cómo se aplica el descuento?', a: 'Desde Mis créditos eliges el programa y el monto. Recibes un código GL- que presentas a la institución al matricularte; si necesitas ayuda, escríbenos y coordinamos el descuento.' },
  { q: '¿Puedo opinar sobre más de una institución?', a: 'Sí, una reseña por cada institución y programa donde hayas estudiado. Cada reseña aprobada suma su propio crédito.' }
];

/** Simulación: total acumulado y cómo se reparte entre programas (máximo por programa). */
export function simulateRewards(reviews, referrals) {
  const total = Math.max(0, reviews) * REWARDS.review + Math.max(0, referrals) * REWARDS.referral;
  const programs = [];
  for (let left = total; left > 0; left -= REWARDS.maxPerProgram) programs.push(Math.min(left, REWARDS.maxPerProgram));
  return { total, programs };
}
