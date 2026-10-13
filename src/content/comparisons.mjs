/**
 * Comparaciones (contenido editorial original). `catalog` define qué se mide con datos reales del catálogo
 * (programas, instituciones, precio y duración medianos): por tipo de programa, por habilidad (expresiones de
 * búsqueda) o por carrera. Solo se publican comparaciones con una pregunta real y utilidad diferenciada.
 */
export const COMPARISONS = [
  {
    slug: 'python-vs-r',
    title: 'Python vs R: cuál aprender para análisis de datos',
    description: 'Diferencias entre Python y R para análisis de datos, estadística y machine learning: curva de aprendizaje, usos, demanda laboral y qué elegir según tu perfil.',
    h1: 'Python vs R: ¿cuál aprender para datos?',
    intro: 'Python y R son los dos lenguajes más usados para analizar datos. Los dos son gratuitos y potentes; la elección depende de qué quieres hacer y del entorno donde vas a trabajar.',
    catalog: [{ label: 'Python', match: ['\\bpython\\b', '\\bpandas\\b'] }, { label: 'R', match: ['lenguaje r\\b', 'programacion en r\\b', 'rstudio', '\\bcon r\\b'] }],
    skills: ['python'],
    careers: ['data-scientist', 'data-analyst'],
    sections: [
      { h2: 'Diferencias principales', table: { head: ['Aspecto', 'Python', 'R'], rows: [['Propósito', 'Lenguaje general: datos, IA, automatización y desarrollo', 'Lenguaje especializado en estadística y análisis'], ['Curva de aprendizaje', 'Sintaxis legible; amigable para empezar a programar', 'Muy directo para estadística; menos intuitivo como lenguaje general'], ['Machine learning e IA', 'Ecosistema dominante (scikit-learn, PyTorch, modelos de lenguaje)', 'Disponible, con menor adopción en la industria'], ['Estadística y visualización', 'Muy completo (pandas, statsmodels, matplotlib)', 'Excelente (tidyverse, ggplot2)'], ['Uso en empresas', 'Muy extendido en datos, tecnología e ingeniería', 'Fuerte en investigación, academia, salud y algunos equipos de riesgo']] } },
      { h2: 'Ventajas y limitaciones', ul: ['Python: sirve para más cosas que el análisis (automatizar, construir aplicaciones, IA), lo que da más opciones laborales; su ecosistema de estadística clásica es algo menos directo que el de R.', 'R: muy productivo para estadística y gráficos de calidad; menos usado para llevar modelos a producción o construir aplicaciones.'] },
      { h2: '¿Cuál te conviene?', ul: ['Elige Python si quieres trabajar en ciencia de datos en empresas, machine learning, IA o automatización.', 'Elige R si tu trabajo es principalmente estadístico o académico, o si tu equipo ya trabaja en R.', 'Si dudas, empieza por Python: la oferta de cursos y de empleo es mayor y lo aprendido se transfiere a R con facilidad.'] }
    ]
  },
  {
    slug: 'power-bi-vs-tableau',
    title: 'Power BI vs Tableau: diferencias y cuál aprender',
    description: 'Comparación entre Power BI y Tableau: costo, curva de aprendizaje, integración, visualización y demanda. Qué herramienta de BI conviene aprender según tu caso.',
    h1: 'Power BI vs Tableau: ¿cuál aprender?',
    intro: 'Power BI (Microsoft) y Tableau (Salesforce) son las dos herramientas de inteligencia de negocios más conocidas. Ambas sirven para construir dashboards; difieren en ecosistema, costo y estilo de trabajo.',
    catalog: [{ label: 'Power BI', match: ['power ?bi', '\\bdax\\b'] }, { label: 'Tableau', match: ['tableau'] }],
    skills: ['power-bi', 'excel'],
    careers: ['data-analyst', 'business-analyst'],
    sections: [
      { h2: 'Diferencias principales', table: { head: ['Aspecto', 'Power BI', 'Tableau'], rows: [['Ecosistema', 'Integrado con Excel, Microsoft 365, Azure y Fabric', 'Independiente; integrado con Salesforce'], ['Preparación de datos', 'Power Query incluido', 'Tableau Prep (producto aparte)'], ['Lenguaje de cálculo', 'DAX', 'Campos calculados y LOD'], ['Visualización', 'Completa y en mejora constante', 'Muy reconocida por su flexibilidad visual'], ['Costo de entrada', 'Versión de escritorio gratuita; licencias por usuario para compartir', 'Licencias por usuario, generalmente de mayor costo']] } },
      { h2: 'Ventajas y limitaciones', ul: ['Power BI: muy adoptado en empresas que ya usan Microsoft y fácil de empezar si vienes de Excel; DAX requiere práctica para dominarse.', 'Tableau: gran libertad visual y comunidad activa; menor presencia en empresas centradas en Microsoft.'] },
      { h2: '¿Cuál te conviene?', ul: ['Si trabajas o quieres trabajar en una empresa con Microsoft 365, empieza por Power BI.', 'Si tu equipo usa Salesforce o ya trabaja con Tableau, apréndelo primero.', 'Los conceptos (modelado, indicadores, diseño de dashboards) son los mismos: pasar de una a otra es rápido.'] }
    ]
  },
  {
    slug: 'data-analyst-vs-data-scientist',
    title: 'Data Analyst vs Data Scientist: diferencias reales',
    description: 'Diferencias entre Data Analyst y Data Scientist: funciones, herramientas, requisitos, formación y cuál elegir según tu perfil y objetivos.',
    h1: 'Data Analyst vs Data Scientist',
    intro: 'Los dos roles trabajan con datos, pero responden preguntas distintas. El Data Analyst explica qué pasó y por qué; el Data Scientist construye modelos para anticipar lo que puede pasar.',
    catalog: [{ label: 'Data Analyst', career: 'data-analyst' }, { label: 'Data Scientist', career: 'data-scientist' }],
    careers: ['data-analyst', 'data-scientist'],
    skills: ['sql', 'power-bi', 'python', 'machine-learning'],
    sections: [
      { h2: 'Diferencias principales', table: { head: ['Aspecto', 'Data Analyst', 'Data Scientist'], rows: [['Pregunta central', '¿Qué pasó y por qué?', '¿Qué va a pasar y qué conviene hacer?'], ['Herramientas típicas', 'SQL, Excel, Power BI o Tableau', 'Python o R, estadística, machine learning'], ['Entregables', 'Dashboards, reportes, análisis', 'Modelos, experimentos, predicciones'], ['Matemática y estadística', 'Descriptiva y aplicada', 'Más profunda (inferencia, modelos)'], ['Puerta de entrada', 'Más accesible para empezar', 'Suele pedir más formación o experiencia previa']] } },
      { h2: '¿Cuál te conviene?', ul: ['Data Analyst si quieres entrar rápido al mundo de los datos, te gusta el contacto con el negocio y comunicar hallazgos.', 'Data Scientist si disfrutas la estadística, la programación y construir modelos, y estás dispuesto a una formación más larga.', 'Un camino frecuente: empezar como Data Analyst y avanzar hacia ciencia de datos sumando Python y machine learning.'] }
    ]
  },
  {
    slug: 'bootcamp-vs-diplomado',
    title: 'Bootcamp vs diplomado: cuál elegir',
    description: 'Diferencias entre un bootcamp y un diplomado: duración, intensidad, enfoque práctico, certificación y costo, con datos reales de los programas del catálogo.',
    h1: 'Bootcamp vs diplomado: ¿cuál elegir?',
    intro: 'Bootcamps y diplomados son formatos intermedios entre un curso corto y una maestría. Se diferencian sobre todo en intensidad, enfoque y tipo de institución que los dicta.',
    catalog: [{ label: 'Bootcamp', type: 'bootcamp' }, { label: 'Diplomado', type: 'diplomado' }],
    sections: [
      { h2: 'Diferencias principales', table: { head: ['Aspecto', 'Bootcamp', 'Diplomado'], rows: [['Enfoque', 'Muy práctico, orientado a empleabilidad en un rol', 'Formativo y estructurado por módulos'], ['Intensidad', 'Alta: muchas horas por semana en poco tiempo', 'Moderada: compatible con un trabajo a tiempo completo'], ['Quién lo dicta', 'Academias y escuelas de tecnología', 'Universidades, escuelas de negocio e institutos'], ['Certificación', 'Certificado de la academia', 'Diploma de la institución (no es un grado académico)'], ['Perfil típico', 'Cambio de carrera o primer empleo tech', 'Profesionales que suman una especialidad a su perfil']] } },
      { h2: 'Ventajas y limitaciones', ul: ['Bootcamp: resultados prácticos rápidos y portafolio; exige mucha dedicación y su reconocimiento depende de la reputación de la academia.', 'Diplomado: respaldo institucional y ritmo sostenible; suele ser menos intensivo en práctica técnica.'] },
      { h2: '¿Cuál te conviene?', ul: ['Bootcamp si buscas cambiar de rol pronto y puedes dedicar muchas horas por semana.', 'Diplomado si quieres especializarte sin dejar tu trabajo y valoras el respaldo de una universidad.', 'Revisa en cada programa el temario, las horas reales, el proyecto final y los docentes: dentro de cada formato hay mucha variación.'] }
    ]
  },
  {
    slug: 'maestria-vs-especializacion',
    title: 'Maestría vs especialización: diferencias y cuál elegir',
    description: 'Diferencias entre maestría y especialización (o programa de especialización): duración, grado académico, inversión y para quién conviene cada una, con datos del catálogo.',
    h1: 'Maestría vs especialización: ¿cuál elegir?',
    intro: 'Una maestría es un grado académico de posgrado; una especialización es un programa más corto y enfocado en un tema. Elegir bien depende de tu objetivo profesional, tu tiempo y tu presupuesto.',
    catalog: [{ label: 'Maestría', type: 'maestria' }, { label: 'Especialización', type: 'especializacion' }],
    guides: ['como-elegir-una-maestria'],
    sections: [
      { h2: 'Diferencias principales', table: { head: ['Aspecto', 'Maestría', 'Especialización'], rows: [['Grado', 'Grado académico de magíster (en universidades)', 'Certificado o diploma; no otorga grado'], ['Duración', 'Generalmente de uno a dos años o más', 'De semanas a algunos meses'], ['Profundidad', 'Amplia, con fundamentos, gestión e investigación', 'Enfocada en una habilidad o herramienta concreta'], ['Requisitos', 'Bachiller o título y proceso de admisión', 'Suelen ser abiertas o con requisitos mínimos'], ['Inversión', 'Mayor', 'Menor']] } },
      { h2: '¿Cuál te conviene?', ul: ['Maestría si buscas un grado académico, roles de liderazgo o una formación integral de largo plazo.', 'Especialización si necesitas una habilidad concreta pronto o quieres probar un área antes de una inversión mayor.', 'Una estrategia común: especializarte primero y, si el área te confirma, cursar la maestría después.'] }
    ]
  }
];
