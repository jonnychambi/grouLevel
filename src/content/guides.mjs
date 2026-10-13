/**
 * Guías de orientación profesional (contenido editorial original). Cada guía enlaza a carreras, habilidades
 * y programas del catálogo para dar un siguiente paso concreto.
 */
export const GUIDES = [
  {
    slug: 'como-ser-data-analyst',
    title: 'Cómo ser Data Analyst desde cero: guía paso a paso',
    description: 'Guía práctica para convertirte en Data Analyst: qué aprender primero, cuánto tiempo dedicar, cómo armar un portafolio y cómo elegir un curso o programa.',
    h1: 'Cómo ser Data Analyst desde cero',
    intro: 'Data Analyst es una de las puertas de entrada más accesibles al mundo de los datos. Esta guía resume un camino realista para llegar al rol, sin atajos milagrosos.',
    careers: ['data-analyst'],
    skills: ['excel', 'sql', 'power-bi', 'python'],
    sections: [
      { h2: '1. Revisa tu punto de partida', p: ['Si ya usas Excel en tu trabajo y te gusta encontrar respuestas en los números, tienes una base. Si vienes de un área sin contacto con datos, empieza por Excel y conceptos de estadística básica.'] },
      { h2: '2. Aprende en este orden', ol: ['Excel avanzado (tablas dinámicas y Power Query).', 'SQL: es la habilidad que más se repite en las ofertas.', 'Power BI (o Tableau) para construir dashboards.', 'Estadística aplicada.', 'Python con pandas, cuando ya domines lo anterior.'] },
      { h2: '3. Practica con datos reales', p: ['Elige dos o tres conjuntos de datos públicos de temas que te interesen (ventas, salud, transporte) y resuelve preguntas concretas: qué pasó, por qué y qué recomendarías. Publica el resultado con una explicación breve.'] },
      { h2: '4. Elige bien tu formación', ul: ['Prioriza programas con proyecto final y práctica con datos reales.', 'Revisa el temario módulo por módulo: SQL y una herramienta de BI deberían estar presentes.', 'Compara horas totales, modalidad (en vivo o grabado) y docentes, no solo el precio.', 'Lee opiniones de egresados cuando estén disponibles.'] },
      { h2: '5. Prepárate para postular', ul: ['Adapta tu CV destacando proyectos y herramientas.', 'Prepárate para pruebas técnicas de SQL y casos de negocio.', 'Si ya trabajas, busca oportunidades de análisis dentro de tu propia empresa: es una vía muy común de transición.'] }
    ]
  },
  {
    slug: 'que-estudiar-para-trabajar-en-ia',
    title: 'Qué estudiar para trabajar en inteligencia artificial',
    description: 'Qué estudiar para trabajar en IA según tu perfil: rutas para profesionales de negocio, analistas y desarrolladores, habilidades clave y cómo elegir un programa.',
    h1: 'Qué estudiar para trabajar en inteligencia artificial',
    intro: '“Trabajar en IA” puede significar cosas muy distintas: usarla para ser más productivo, liderar su adopción en tu área o construir soluciones técnicas. Lo que conviene estudiar depende de cuál de esos caminos te interesa.',
    careers: ['ai-engineer', 'data-scientist'],
    skills: ['inteligencia-artificial', 'python', 'machine-learning'],
    sections: [
      { h2: 'Tres caminos posibles', table: { head: ['Camino', 'Perfil típico', 'Qué estudiar'], rows: [['Usar IA en tu trabajo', 'Cualquier profesional', 'IA generativa aplicada, prompting, automatización sin código y uso responsable.'], ['Liderar la adopción de IA', 'Jefaturas y gestores', 'Estrategia de IA, casos de uso, gestión del cambio, riesgos y gobierno de datos.'], ['Construir soluciones de IA', 'Perfiles de datos y desarrollo', 'Python, machine learning, modelos de lenguaje, RAG, agentes y despliegue.']] } },
      { h2: 'Habilidades que se repiten', ul: ['Entender qué puede y qué no puede hacer la IA.', 'Formular bien el problema antes de elegir la herramienta.', 'Evaluar resultados con criterio (la IA se equivoca).', 'Cuidar la privacidad y la seguridad de los datos.'] },
      { h2: 'Si quieres el camino técnico', ol: ['Python y manejo de datos.', 'Fundamentos de machine learning.', 'Modelos de lenguaje: prompting, RAG y evaluación.', 'Agentes e integración con herramientas.', 'Despliegue en la nube y monitoreo.'] },
      { h2: 'Cómo elegir un programa de IA', ul: ['Verifica si es aplicado (uso) o técnico (construcción): ambos son válidos, pero no son lo mismo.', 'Busca proyectos prácticos con problemas reales.', 'Revisa la fecha de actualización del temario: el campo cambia muy rápido.', 'Desconfía de promesas de empleo garantizado.'] }
    ]
  },
  {
    slug: 'como-pasar-de-excel-a-python',
    title: 'Cómo pasar de Excel a Python para analizar datos',
    description: 'Guía para dar el salto de Excel a Python: cuándo conviene, equivalencias entre Excel y pandas, ruta de aprendizaje y primeros proyectos.',
    h1: 'Cómo pasar de Excel a Python',
    intro: 'Excel es excelente hasta que los datos crecen, los procesos se repiten todos los días o necesitas análisis más complejos. En ese punto, Python (con la biblioteca pandas) es el siguiente paso natural.',
    skills: ['excel', 'python', 'sql'],
    careers: ['data-analyst', 'data-scientist'],
    sections: [
      { h2: 'Señales de que es momento de dar el salto', ul: ['Tus archivos tardan en abrir o superan el límite de filas.', 'Repites el mismo proceso cada semana copiando y pegando.', 'Combinas muchos archivos a mano.', 'Necesitas análisis estadísticos o modelos que Excel no ofrece con facilidad.'] },
      { h2: 'Equivalencias entre Excel y pandas', table: { head: ['En Excel', 'En Python (pandas)'], rows: [['Abrir un archivo', 'pd.read_excel() o pd.read_csv()'], ['Filtrar filas', 'df[df["columna"] > valor]'], ['Tabla dinámica', 'df.pivot_table() o df.groupby()'], ['BUSCARV / BUSCARX', 'df.merge()'], ['Gráfico', 'df.plot() o bibliotecas de visualización']] } },
      { h2: 'Ruta sugerida', ol: ['Fundamentos de Python (variables, listas, funciones).', 'pandas: leer, filtrar, agrupar y unir datos.', 'Automatiza un reporte que hoy haces a mano.', 'Visualización de datos.', 'SQL, para leer directamente de bases de datos.'] },
      { h2: 'Primer proyecto recomendado', p: ['Toma un reporte que haces cada semana en Excel y reprodúcelo con Python, desde la lectura de archivos hasta el resultado final. Medir el tiempo que ahorras es la mejor motivación para seguir.'] }
    ]
  },
  {
    slug: 'que-estudiar-despues-de-power-bi',
    title: 'Qué estudiar después de Power BI',
    description: 'Si ya dominas Power BI, estas son las rutas para seguir creciendo: SQL, DAX avanzado, Microsoft Fabric, Python o gestión de datos, según el rol que buscas.',
    h1: 'Qué estudiar después de Power BI',
    intro: 'Dominar Power BI es un gran paso. Lo que conviene aprender después depende de hacia dónde quieres llevar tu carrera: más profundidad en BI, ingeniería de datos o ciencia de datos.',
    skills: ['power-bi', 'sql', 'microsoft-fabric', 'python'],
    careers: ['data-analyst', 'data-engineer', 'data-scientist'],
    sections: [
      { h2: 'Elige según el rol que buscas', table: { head: ['Objetivo', 'Qué estudiar', 'Rol'], rows: [['Ser referente de BI', 'DAX avanzado, modelado, gobierno y rendimiento de reportes', 'Analista o desarrollador BI'], ['Preparar tus propios datos', 'SQL avanzado y modelado de datos', 'Data Analyst'], ['Construir la plataforma de datos', 'Microsoft Fabric, pipelines y lakehouse', 'Data Engineer'], ['Predecir y modelar', 'Python, estadística y machine learning', 'Data Scientist']] } },
      { h2: 'La recomendación más común', p: ['Si todavía no manejas SQL con soltura, ese es el siguiente paso con más impacto: te da autonomía para obtener y preparar datos y es la habilidad más pedida en los roles de datos.'] },
      { h2: 'Cómo elegir un programa', ul: ['Evita repetir contenidos que ya dominas: revisa el temario módulo por módulo.', 'Busca programas de nivel intermedio o avanzado.', 'Valora los proyectos con datos reales y la experiencia de los docentes.'] }
    ]
  },
  {
    slug: 'como-elegir-una-maestria',
    title: 'Cómo elegir una maestría en tecnología o datos',
    description: 'Criterios para elegir una maestría en tecnología, datos o IA: objetivos, plan de estudios, docentes, modalidad, acreditación, inversión y preguntas para hacer antes de matricularte.',
    h1: 'Cómo elegir una maestría en tecnología o datos',
    intro: 'Una maestría es una inversión importante de tiempo y dinero. Antes de comparar precios, conviene tener claro qué esperas de ella y revisar con detalle lo que realmente ofrece cada programa.',
    comparisons: ['maestria-vs-especializacion'],
    skills: ['inteligencia-artificial', 'machine-learning'],
    careers: ['data-scientist', 'ai-engineer'],
    sections: [
      { h2: '1. Define tu objetivo', ul: ['¿Buscas un grado académico, un cambio de rol, liderazgo o profundizar en un tema?', 'Si necesitas una habilidad concreta pronto, una especialización puede ser suficiente.'] },
      { h2: '2. Revisa el plan de estudios', ul: ['Proporción entre fundamentos, herramientas y gestión.', 'Cursos electivos y posibilidad de especializarte.', 'Proyectos aplicados y tesis o trabajo final.', 'Fecha de actualización del plan.'] },
      { h2: '3. Evalúa a los docentes y la institución', ul: ['Experiencia profesional y académica de los docentes.', 'Licenciamiento y acreditaciones verificables en fuentes oficiales.', 'Red de egresados y vínculo con empresas.'] },
      { h2: '4. Compara modalidad, tiempo e inversión', table: { head: ['Criterio', 'Qué revisar'], rows: [['Modalidad', 'Presencial, híbrida u online en vivo, y si las clases quedan grabadas.'], ['Duración y horario', 'Compatibilidad con tu trabajo y tu vida personal.'], ['Inversión', 'Precio total, cuotas, financiamiento y costos adicionales (grado, titulación).'], ['Requisitos', 'Bachiller, experiencia, idioma y proceso de admisión.']] } },
      { h2: '5. Preguntas para hacer antes de matricularte', ul: ['¿Qué porcentaje del programa es práctico?', '¿Quiénes son los docentes de los cursos principales?', '¿Qué hacen hoy los egresados de las últimas promociones?', '¿Qué costos no están incluidos en el precio publicado?'] }
    ]
  }
];
