/**
 * Habilidades tecnológicas (contenido editorial original de Groulevel).
 * `match`: expresiones (sobre texto normalizado: minúsculas, sin tildes) para encontrar en el catálogo los
 * programas que enseñan la habilidad (nombre, herramientas, palabras clave y subárea).
 * `categories`: áreas del catálogo que cuentan por completo para la habilidad.
 * `courseIntro`: introducción de la página transaccional /cursos/:slug.
 */
export const SKILLS = [
  {
    slug: 'sql',
    name: 'SQL',
    match: ['\\bsql\\b', 'postgres', 'mysql', 'sql server', 't-sql', 'bases? de datos'],
    careers: ['data-analyst', 'data-engineer', 'data-scientist', 'business-analyst', 'software-developer'],
    related: ['python', 'power-bi', 'excel'],
    title: 'Aprender SQL: qué necesitas saber y dónde estudiar',
    description: 'Qué es SQL, para qué sirve, qué roles lo usan, niveles de dominio y una ruta para aprenderlo, con cursos y programas comparados en Perú.',
    h1: 'Aprender SQL',
    intro: 'SQL es el lenguaje estándar para consultar y gestionar datos en bases de datos relacionales. Es probablemente la habilidad técnica más pedida en los roles de datos: casi toda empresa guarda su información en bases de datos que se consultan con SQL.',
    courseIntro: 'SQL es la base de casi cualquier rol de datos. Aquí puedes comparar cursos y programas que lo enseñan, desde consultas básicas hasta modelado y optimización.',
    sections: [
      { h2: 'Para qué sirve', ul: ['Extraer exactamente los datos que necesitas de una base de datos.', 'Unir información de distintas tablas (clientes, ventas, productos).', 'Resumir y agrupar datos para reportes.', 'Preparar datos para dashboards, análisis o modelos.'] },
      { h2: 'Conocimientos previos', p: ['No necesitas saber programar. Ayuda manejar Excel y entender cómo se organiza la información en tablas.'] },
      { h2: 'Niveles de dominio', table: { head: ['Nivel', 'Qué puedes hacer'], rows: [['Básico', 'SELECT, filtros, ordenamiento y agregaciones (SUM, COUNT, GROUP BY).'], ['Intermedio', 'JOIN entre tablas, subconsultas, CTE y funciones de ventana.'], ['Avanzado', 'Modelado de datos, optimización de consultas e índices, procedimientos.']] } },
      { h2: 'Ruta recomendada', ol: ['Consultas básicas sobre una sola tabla.', 'Uniones (JOIN) y agregaciones.', 'Subconsultas, CTE y funciones de ventana.', 'Modelado de datos y buenas prácticas.', 'Práctica con un caso real conectado a Power BI o Python.'] },
      { h2: 'Competencias que desarrolla', ul: ['Pensamiento lógico y estructurado.', 'Autonomía para obtener datos sin depender de terceros.', 'Base para BI, ciencia de datos e ingeniería de datos.'] }
    ]
  },
  {
    slug: 'python',
    name: 'Python',
    match: ['\\bpython\\b', '\\bpandas\\b', '\\bnumpy\\b', 'django', 'flask'],
    careers: ['data-scientist', 'data-engineer', 'ai-engineer', 'data-analyst', 'software-developer'],
    related: ['sql', 'machine-learning', 'inteligencia-artificial'],
    title: 'Aprender Python: para qué sirve y dónde estudiarlo',
    description: 'Qué es Python, para qué se usa en datos, IA y desarrollo, conocimientos previos, niveles y ruta de aprendizaje, con cursos comparados en Perú.',
    h1: 'Aprender Python',
    intro: 'Python es un lenguaje de programación de uso general, conocido por su sintaxis legible. Es el lenguaje más usado en ciencia de datos, machine learning e inteligencia artificial, y también se usa en automatización y desarrollo web.',
    courseIntro: 'Python abre la puerta a la ciencia de datos, la automatización y la inteligencia artificial. Compara cursos y programas que lo enseñan según tu objetivo y nivel.',
    sections: [
      { h2: 'Para qué sirve', ul: ['Analizar y transformar datos con pandas.', 'Automatizar tareas repetitivas (archivos, reportes, correos).', 'Entrenar modelos de machine learning.', 'Construir aplicaciones con modelos de inteligencia artificial.', 'Desarrollar APIs y aplicaciones web.'] },
      { h2: 'Conocimientos previos', p: ['Ninguno obligatorio. Si vienes de Excel o SQL, tendrás ventaja para entender las estructuras de datos.'] },
      { h2: 'Niveles de dominio', table: { head: ['Nivel', 'Qué puedes hacer'], rows: [['Básico', 'Variables, condicionales, bucles, funciones y estructuras de datos.'], ['Intermedio', 'Análisis con pandas, visualización, consumo de APIs y automatización.'], ['Avanzado', 'Programación orientada a objetos, pruebas, paquetes y despliegue.']] } },
      { h2: 'Ruta recomendada', ol: ['Fundamentos del lenguaje.', 'Manejo de datos con pandas y visualización.', 'Automatización y consumo de APIs.', 'Según tu objetivo: machine learning, ingeniería de datos o desarrollo web.', 'Proyecto propio publicado en un repositorio.'] },
      { h2: 'Competencias que desarrolla', ul: ['Pensamiento computacional.', 'Capacidad de automatizar tu propio trabajo.', 'Base para roles de datos e IA.'] }
    ]
  },
  {
    slug: 'power-bi',
    name: 'Power BI',
    match: ['power ?bi', '\\bdax\\b', 'power query'],
    careers: ['data-analyst', 'business-analyst'],
    related: ['excel', 'sql', 'microsoft-fabric'],
    title: 'Aprender Power BI: qué es, niveles y dónde estudiar',
    description: 'Qué es Power BI, para qué sirve, qué perfiles lo usan, niveles (Power Query, modelado, DAX) y ruta de aprendizaje, con cursos de Power BI comparados en Perú.',
    h1: 'Aprender Power BI',
    intro: 'Power BI es la herramienta de inteligencia de negocios de Microsoft para conectar datos, modelarlos y construir reportes y dashboards interactivos. Es muy usada en empresas que ya trabajan con Excel y el ecosistema Microsoft.',
    courseIntro: 'Power BI es una de las herramientas más pedidas para reportes y dashboards. Compara cursos y programas por precio, duración, modalidad e institución.',
    sections: [
      { h2: 'Para qué sirve', ul: ['Conectar datos de Excel, bases de datos y sistemas en un solo modelo.', 'Limpiar y transformar datos con Power Query.', 'Calcular indicadores con DAX.', 'Publicar y compartir dashboards con actualización automática.'] },
      { h2: 'Conocimientos previos', p: ['Excel intermedio ayuda mucho. Saber SQL es un plus para conectar y preparar datos.'] },
      { h2: 'Niveles de dominio', table: { head: ['Nivel', 'Qué puedes hacer'], rows: [['Básico', 'Importar datos, crear visualizaciones y reportes simples.'], ['Intermedio', 'Power Query, modelo estrella, relaciones y medidas DAX.'], ['Avanzado', 'DAX avanzado, seguridad por filas, rendimiento y gobierno de reportes.']] } },
      { h2: 'Ruta recomendada', ol: ['Interfaz y primeras visualizaciones.', 'Power Query para limpiar datos.', 'Modelado de datos (modelo estrella).', 'DAX: medidas, contexto y funciones de tiempo.', 'Publicación, actualización y buenas prácticas de diseño.', 'Opcional: certificación PL-300 de Microsoft.'] },
      { h2: 'Competencias que desarrolla', ul: ['Comunicación con datos.', 'Definición de indicadores de negocio.', 'Autonomía para construir reportes propios.'] }
    ]
  },
  {
    slug: 'excel',
    name: 'Excel',
    match: ['\\bexcel\\b', 'tablas dinamicas', '\\bvba\\b', 'macros'],
    careers: ['data-analyst', 'business-analyst'],
    related: ['power-bi', 'sql', 'python'],
    title: 'Aprender Excel avanzado: niveles y dónde estudiar',
    description: 'Excel para el trabajo: niveles básico, intermedio y avanzado (tablas dinámicas, Power Query, macros), ruta de aprendizaje y cursos de Excel comparados en Perú.',
    h1: 'Aprender Excel para el trabajo',
    intro: 'Excel sigue siendo la herramienta de análisis más usada en las empresas. Dominarlo bien (no solo fórmulas básicas) acelera el trabajo diario y es el primer paso natural hacia Power BI, SQL o Python.',
    courseIntro: 'Excel es la puerta de entrada al análisis de datos. Compara cursos de Excel básico, intermedio y avanzado por precio, duración y modalidad.',
    sections: [
      { h2: 'Para qué sirve', ul: ['Organizar y analizar datos del día a día.', 'Resumir información con tablas dinámicas.', 'Automatizar tareas con Power Query y macros.', 'Construir modelos financieros y reportes.'] },
      { h2: 'Conocimientos previos', p: ['Ninguno para el nivel básico. Para el avanzado conviene manejar fórmulas y referencias con soltura.'] },
      { h2: 'Niveles de dominio', table: { head: ['Nivel', 'Qué puedes hacer'], rows: [['Básico', 'Formatos, fórmulas simples, ordenar y filtrar.'], ['Intermedio', 'Funciones de búsqueda (BUSCARX), tablas dinámicas y gráficos.'], ['Avanzado', 'Power Query, Power Pivot, macros/VBA y modelos complejos.']] } },
      { h2: 'Ruta recomendada', ol: ['Fundamentos y buenas prácticas de datos en tablas.', 'Funciones lógicas y de búsqueda.', 'Tablas dinámicas y gráficos.', 'Power Query para preparar datos.', 'Macros/VBA o, como siguiente paso, Power BI.'] },
      { h2: 'Competencias que desarrolla', ul: ['Orden y rigor con los datos.', 'Productividad en tareas repetitivas.', 'Base para herramientas de BI.'] }
    ]
  },
  {
    slug: 'machine-learning',
    name: 'Machine Learning',
    match: ['machine learning', 'aprendizaje automatico', 'scikit', 'modelos predictivos', 'deep learning'],
    categories: ['machine-learning'],
    careers: ['data-scientist', 'ai-engineer'],
    related: ['python', 'inteligencia-artificial', 'sql'],
    title: 'Aprender Machine Learning: requisitos y ruta',
    description: 'Qué es el machine learning, para qué se usa, qué necesitas saber antes (Python, estadística), niveles y ruta de aprendizaje, con programas comparados.',
    h1: 'Aprender Machine Learning',
    intro: 'El machine learning (aprendizaje automático) es la rama de la inteligencia artificial que permite que los sistemas aprendan patrones a partir de datos para predecir o clasificar, sin programar cada regla a mano.',
    courseIntro: 'Compara cursos, especializaciones y maestrías de machine learning: contenido, duración, modalidad y precio.',
    sections: [
      { h2: 'Para qué sirve', ul: ['Predecir demanda, ventas o abandono de clientes.', 'Clasificar documentos, imágenes o transacciones (por ejemplo, fraude).', 'Recomendar productos o contenidos.', 'Segmentar clientes.'] },
      { h2: 'Conocimientos previos', p: ['Python para manejar datos y estadística básica (promedios, distribuciones, correlación). Álgebra lineal y cálculo ayudan para profundizar, pero no son indispensables para empezar.'] },
      { h2: 'Niveles de dominio', table: { head: ['Nivel', 'Qué puedes hacer'], rows: [['Básico', 'Entrenar modelos estándar (regresión, árboles) con bibliotecas.'], ['Intermedio', 'Preparar variables, validar correctamente y elegir métricas.'], ['Avanzado', 'Deep learning, despliegue de modelos y monitoreo en producción.']] } },
      { h2: 'Ruta recomendada', ol: ['Python y pandas.', 'Estadística aplicada.', 'Modelos supervisados y validación.', 'Modelos no supervisados.', 'Proyecto de punta a punta y, según el objetivo, deep learning o MLOps.'] },
      { h2: 'Competencias que desarrolla', ul: ['Pensamiento cuantitativo.', 'Criterio para evaluar resultados y sus límites.', 'Base para ciencia de datos e IA.'] }
    ]
  },
  {
    slug: 'inteligencia-artificial',
    name: 'Inteligencia Artificial',
    match: ['inteligencia artificial', '\\bia\\b', 'ia generativa', 'generative ai', 'genai', 'chatgpt', '\\bllms?\\b', 'prompt'],
    categories: ['inteligencia-artificial', 'ia-generativa'],
    careers: ['ai-engineer', 'data-scientist'],
    related: ['python', 'machine-learning'],
    title: 'Aprender inteligencia artificial: por dónde empezar',
    description: 'Qué es la inteligencia artificial y la IA generativa, cómo se aplica en el trabajo, qué estudiar según tu perfil (usuario o técnico) y programas de IA comparados en Perú.',
    h1: 'Aprender inteligencia artificial',
    intro: 'La inteligencia artificial agrupa técnicas para que los sistemas realicen tareas que antes requerían criterio humano: entender texto, reconocer imágenes, predecir o generar contenido. La IA generativa (modelos como los asistentes de chat) la ha vuelto accesible para casi cualquier profesional.',
    courseIntro: 'Hay programas de IA para usarla mejor en tu trabajo y otros para construir soluciones técnicas. Compáralos por contenido, duración, modalidad y precio.',
    sections: [
      { h2: 'Dos caminos distintos', table: { head: ['Camino', 'Para quién', 'Qué se aprende'], rows: [['IA aplicada al trabajo', 'Profesionales de cualquier área', 'Uso de asistentes, prompting, automatización sin código y criterios de uso responsable.'], ['IA técnica', 'Perfiles de datos y desarrollo', 'Python, machine learning, modelos de lenguaje, RAG, agentes y despliegue.']] } },
      { h2: 'Para qué sirve', ul: ['Acelerar tareas de redacción, análisis y resumen.', 'Automatizar procesos con documentos y datos.', 'Construir asistentes y agentes para clientes o equipos internos.', 'Mejorar decisiones con modelos predictivos.'] },
      { h2: 'Conocimientos previos', p: ['Para el camino aplicado no se necesita programar. Para el técnico conviene empezar por Python y los fundamentos de machine learning.'] },
      { h2: 'Niveles de dominio', table: { head: ['Nivel', 'Qué puedes hacer'], rows: [['Básico', 'Usar asistentes de IA con buenos prompts y criterio.'], ['Intermedio', 'Automatizar flujos e integrar IA en procesos y herramientas.'], ['Avanzado', 'Diseñar, evaluar y desplegar soluciones de IA a medida.']] } },
      { h2: 'Ruta recomendada', ol: ['Fundamentos y usos responsables de la IA generativa.', 'Prompting y automatización en tu área.', 'Si buscas el camino técnico: Python y machine learning.', 'Modelos de lenguaje, RAG y agentes.', 'Proyecto aplicado a un problema real.'] },
      { h2: 'Competencias que desarrolla', ul: ['Productividad y nuevas formas de trabajar.', 'Pensamiento crítico frente a resultados automáticos.', 'Capacidad de liderar la adopción de IA en tu equipo.'] }
    ]
  },
  {
    slug: 'microsoft-fabric',
    name: 'Microsoft Fabric',
    match: ['microsoft fabric', '\\bfabric\\b'],
    careers: ['data-engineer', 'data-analyst'],
    related: ['power-bi', 'sql', 'cloud-computing'],
    title: 'Microsoft Fabric: qué es y cómo aprenderlo',
    description: 'Qué es Microsoft Fabric, cómo se relaciona con Power BI, qué perfiles lo usan, conocimientos previos y ruta de aprendizaje.',
    h1: 'Microsoft Fabric',
    intro: 'Microsoft Fabric es la plataforma de datos de Microsoft que reúne en un solo servicio la integración, la ingeniería de datos, el almacenamiento (lakehouse y warehouse), la ciencia de datos y Power BI.',
    courseIntro: 'Compara los programas que incluyen Microsoft Fabric en su contenido.',
    sections: [
      { h2: 'Para qué sirve', ul: ['Centralizar datos de la empresa en un lakehouse (OneLake).', 'Construir pipelines de datos sin salir del ecosistema Microsoft.', 'Conectar directamente los datos con reportes de Power BI.', 'Unificar el trabajo de ingenieros, analistas y científicos de datos.'] },
      { h2: 'Conocimientos previos', p: ['SQL y Power BI son la mejor base. Para la parte de ingeniería de datos ayuda conocer Python o Spark.'] },
      { h2: 'Niveles de dominio', table: { head: ['Nivel', 'Qué puedes hacer'], rows: [['Básico', 'Entender los componentes y conectar Power BI a un lakehouse.'], ['Intermedio', 'Construir pipelines, notebooks y modelos de datos.'], ['Avanzado', 'Diseñar la arquitectura, la seguridad y el gobierno de la plataforma.']] } },
      { h2: 'Ruta recomendada', ol: ['SQL y Power BI.', 'Conceptos de lakehouse y data warehouse.', 'Pipelines y transformaciones en Fabric.', 'Notebooks con Spark.', 'Opcional: certificaciones de Microsoft para Fabric (por ejemplo, DP-700 o DP-600).'] },
      { h2: 'Competencias que desarrolla', ul: ['Visión de punta a punta del ciclo de datos.', 'Base para roles de ingeniería y analítica en empresas Microsoft.'] }
    ]
  },
  {
    slug: 'cloud-computing',
    name: 'Cloud Computing',
    match: ['\\baws\\b', 'amazon web services', '\\bazure\\b', 'google cloud', '\\bgcp\\b', '\\bcloud\\b', 'nube'],
    categories: ['cloud-computing'],
    careers: ['data-engineer', 'software-developer', 'ai-engineer', 'cybersecurity-analyst'],
    related: ['python', 'sql', 'microsoft-fabric'],
    title: 'Aprender cloud computing: AWS, Azure y Google Cloud',
    description: 'Qué es el cloud computing, diferencias entre AWS, Azure y Google Cloud, qué perfiles lo usan, niveles y ruta de aprendizaje con programas comparados.',
    h1: 'Aprender cloud computing',
    intro: 'El cloud computing es el uso de servidores, almacenamiento, bases de datos y otros servicios a través de internet, pagando por uso. Los tres proveedores principales son Amazon Web Services (AWS), Microsoft Azure y Google Cloud.',
    courseIntro: 'Compara cursos, certificaciones y programas de cloud computing (AWS, Azure y Google Cloud) por contenido, duración, modalidad y precio.',
    sections: [
      { h2: 'Para qué sirve', ul: ['Desplegar aplicaciones sin administrar servidores propios.', 'Almacenar y procesar grandes volúmenes de datos.', 'Escalar según la demanda y pagar por uso.', 'Usar servicios de IA y analítica gestionados.'] },
      { h2: 'Conocimientos previos', p: ['Nociones de redes, sistemas operativos y algo de programación o scripting ayudan. Los cursos de fundamentos parten desde cero.'] },
      { h2: 'Niveles de dominio', table: { head: ['Nivel', 'Qué puedes hacer'], rows: [['Básico', 'Conocer los servicios principales, costos y modelo de responsabilidad compartida.'], ['Intermedio', 'Desplegar soluciones con redes, seguridad y bases de datos gestionadas.'], ['Avanzado', 'Diseñar arquitecturas robustas, automatizadas y optimizadas en costos.']] } },
      { h2: 'Ruta recomendada', ol: ['Fundamentos de un proveedor (por ejemplo, certificaciones de nivel inicial de AWS o Azure).', 'Redes, identidades y seguridad en la nube.', 'Servicios de cómputo, almacenamiento y bases de datos.', 'Infraestructura como código y automatización.', 'Especialización según tu rol: datos, desarrollo, IA o seguridad.'] },
      { h2: 'Competencias que desarrolla', ul: ['Visión de arquitectura y costos.', 'Base transversal para casi todos los roles técnicos.'] }
    ]
  }
];
