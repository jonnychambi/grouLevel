/**
 * Contenido de la landing /analizar-perfil (compartido por el HTML del servidor y la app). Debe reflejar
 * exactamente cómo funciona el analizador: si cambia el flujo, la retención o el motor, actualizar aquí.
 */
export const ANALYZER_SECTIONS = [
  { h2: 'Cómo funciona', ol: ['Sube tu CV (PDF, Word o TXT) o describe tu experiencia en texto.', 'Cuéntanos a qué rol o meta quieres llegar y tus preferencias (modalidad, presupuesto y horas por semana).', 'Recibe un diagnóstico con tus habilidades, la brecha frente a tu objetivo y una ruta de formación con programas del catálogo.'] },
  { h2: 'Qué información necesita', ul: ['Tu experiencia y formación (CV o descripción).', 'Tu objetivo profesional.', 'Preferencias opcionales para filtrar la ruta (modalidad, presupuesto, tiempo disponible).'] },
  { h2: 'Qué obtienes', ul: ['Una evaluación por áreas tecnológicas con puntajes de 0 a 100 basados en la evidencia de tu perfil.', 'Tus fortalezas y las brechas frente al rol que buscas.', 'Una ruta de aprendizaje por etapas con programas reales que puedes comparar.'] },
  { h2: 'Cómo se generan las recomendaciones', p: ['El análisis lo realiza un modelo de inteligencia artificial con instrucciones específicas y, si no está disponible, un motor de reglas propio. Las recomendaciones se eligen solo entre programas publicados en el catálogo de Groulevel y se filtran con tus preferencias. El diagnóstico de habilidades y la brecha no dependen de patrocinios; entre programas con afinidad similar, los destacados (patrocinados) pueden recibir una ligera prioridad.'] },
  { h2: 'Cómo protegemos tu información', ul: ['Tu CV se guarda de forma privada y se elimina automáticamente a los 180 días.', 'Tu resultado se abre solo con un enlace privado y no se indexa en buscadores.', 'Tu correo y tu teléfono no se muestran en el resultado ni se envían a herramientas de analítica.', 'No compartimos tus datos con instituciones sin tu autorización expresa.'] },
  { h2: 'Limitaciones del diagnóstico', p: ['Los puntajes y porcentajes son estimaciones orientativas basadas en la información que compartes: no son una evaluación certificada ni una probabilidad de contratación. Úsalos como punto de partida para decidir qué estudiar y confírmalos con tu experiencia y con el mercado.'] }
];
