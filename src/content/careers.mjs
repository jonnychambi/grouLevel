/**
 * Carreras tecnológicas (contenido editorial original de Groulevel).
 * Sin datos salariales: solo se publicarán con una fuente verificable (país, periodo, moneda y metodología).
 * Las certificaciones son referencias del mercado; su vigencia se confirma con cada emisor.
 */
export const CAREERS = [
  {
    slug: 'data-analyst',
    name: 'Data Analyst',
    title: 'Cómo ser Data Analyst: habilidades y ruta de aprendizaje',
    description: 'Qué hace un Data Analyst, herramientas que usa (SQL, Excel, Power BI, Python), habilidades, requisitos y una ruta de aprendizaje por niveles con programas para estudiar en Perú.',
    h1: 'Cómo ser Data Analyst',
    intro: 'El Data Analyst convierte datos del negocio en respuestas: qué pasó, por qué pasó y qué conviene hacer. Es uno de los roles de entrada más comunes al mundo de los datos, porque combina herramientas accesibles con mucho contacto con las áreas de negocio.',
    skills: ['sql', 'excel', 'power-bi', 'python'],
    categories: ['data-analytics', 'business-analytics'],
    sections: [
      { h2: 'Qué hace un Data Analyst', p: ['Recoge datos de distintas fuentes, los limpia y los organiza para analizarlos. Con ese material construye reportes y tableros, responde preguntas de negocio (ventas, operaciones, clientes, marketing) y comunica hallazgos a personas que no son técnicas.'] },
      { h2: 'Responsabilidades habituales', ul: ['Extraer datos con consultas SQL desde bases de datos y sistemas de la empresa.', 'Limpiar y transformar datos (duplicados, formatos, valores faltantes).', 'Construir dashboards e indicadores (KPI) en Power BI, Tableau o Looker Studio.', 'Analizar tendencias, segmentos y variaciones y explicar sus causas.', 'Presentar conclusiones y recomendaciones a jefaturas y equipos de negocio.', 'Automatizar reportes recurrentes.'] },
      { h2: 'Herramientas y tecnologías', ul: ['SQL (consultas, uniones, agregaciones, funciones de ventana).', 'Excel avanzado (tablas dinámicas, Power Query, fórmulas).', 'Power BI o Tableau para visualización y modelado.', 'Python (pandas) para análisis más grandes o repetibles.', 'Nociones de estadística descriptiva e inferencial.'] },
      { h2: 'Habilidades técnicas y blandas', table: { head: ['Técnicas', 'Blandas'], rows: [['Consultas SQL y modelado de datos', 'Pensamiento analítico y curiosidad'], ['Visualización y diseño de dashboards', 'Comunicación clara con áreas no técnicas'], ['Estadística aplicada', 'Entender el negocio y sus indicadores'], ['Limpieza y transformación de datos', 'Orden y rigor con la calidad del dato']] } },
      { h2: 'Requisitos habituales', p: ['Muchas ofertas piden formación universitaria o técnica en ingeniería, economía, administración, estadística o afines, aunque cada vez pesa más un portafolio con proyectos reales. Lo más valorado: SQL y una herramienta de BI demostrables, más Excel sólido.'] },
      { h2: 'Ruta de aprendizaje sugerida', ol: ['Excel avanzado: tablas dinámicas, Power Query y buenas prácticas de datos.', 'SQL: consultas, uniones y agregaciones sobre una base de datos real.', 'Power BI: modelado, medidas DAX y un dashboard publicado.', 'Estadística aplicada para interpretar resultados con criterio.', 'Python con pandas para automatizar y analizar volúmenes mayores.', 'Portafolio: 2 o 3 proyectos con datos públicos explicados de principio a fin.'] },
      { h2: 'Niveles: inicial, intermedio y avanzado', table: { head: ['Nivel', 'Qué se espera'], rows: [['Inicial', 'Reportes y dashboards a partir de datos ya preparados; consultas SQL básicas.'], ['Intermedio', 'Modela datos, automatiza reportes y propone análisis por iniciativa propia.'], ['Avanzado', 'Define indicadores con el negocio, diseña experimentos y lidera análisis de impacto.']] } },
      { h2: 'Certificaciones de referencia', ul: ['Microsoft Certified: Power BI Data Analyst Associate (examen PL-300).', 'Certificados profesionales de análisis de datos de plataformas como Google o IBM.', 'Certificaciones de SQL de proveedores de bases de datos.'], note: 'Confirma la vigencia y el contenido de cada certificación con su emisor.' }
    ]
  },
  {
    slug: 'data-engineer',
    name: 'Data Engineer',
    title: 'Cómo convertirse en Data Engineer: habilidades y ruta',
    description: 'Qué hace un Data Engineer: pipelines, ETL, data warehouse y cloud. Herramientas (SQL, Python, Spark, Databricks, AWS, Azure), requisitos, niveles y ruta de aprendizaje.',
    h1: 'Cómo convertirse en Data Engineer',
    intro: 'El Data Engineer construye y mantiene la infraestructura que hace posible el análisis: mueve datos desde los sistemas de origen hasta almacenes confiables, a tiempo y con calidad. Sin su trabajo, analistas y científicos de datos no tienen con qué trabajar.',
    skills: ['sql', 'python', 'cloud-computing', 'microsoft-fabric'],
    categories: ['data-engineering', 'cloud-computing'],
    sections: [
      { h2: 'Qué hace un Data Engineer', p: ['Diseña pipelines que extraen, transforman y cargan datos (ETL/ELT), modela almacenes de datos (data warehouse, data lake o lakehouse) y se asegura de que los datos lleguen completos, consistentes y a tiempo para reportes, modelos y aplicaciones.'] },
      { h2: 'Responsabilidades habituales', ul: ['Construir y orquestar pipelines de datos batch y, cuando aplica, en tiempo real.', 'Modelar tablas y capas de datos para análisis.', 'Monitorear calidad, costos y rendimiento de los procesos.', 'Administrar servicios de datos en la nube (AWS, Azure o Google Cloud).', 'Trabajar con analistas y científicos de datos para entender qué necesitan.'] },
      { h2: 'Herramientas y tecnologías', ul: ['SQL avanzado y modelado dimensional.', 'Python para transformaciones y automatización.', 'Spark y plataformas como Databricks o Microsoft Fabric.', 'Orquestadores como Airflow.', 'Servicios cloud de almacenamiento y procesamiento.', 'Control de versiones con Git.'] },
      { h2: 'Habilidades técnicas y blandas', table: { head: ['Técnicas', 'Blandas'], rows: [['SQL y modelado de datos', 'Pensamiento sistémico'], ['Programación en Python', 'Documentación y orden'], ['Cloud y procesamiento distribuido', 'Trabajo con equipos de negocio y analítica'], ['Calidad y gobierno de datos', 'Resolución de problemas bajo presión']] } },
      { h2: 'Requisitos habituales', p: ['Suele pedirse formación en ingeniería de sistemas, informática, computación o afines, o experiencia previa como analista o desarrollador. SQL sólido y un lenguaje de programación son la base; la experiencia con una nube es cada vez más frecuente en las ofertas.'] },
      { h2: 'Ruta de aprendizaje sugerida', ol: ['SQL avanzado y modelado de datos.', 'Python orientado a datos (archivos, APIs, pandas).', 'Fundamentos de cloud en un proveedor (AWS, Azure o Google Cloud).', 'Procesamiento distribuido con Spark o Databricks.', 'Orquestación de pipelines y buenas prácticas (pruebas, versionado, monitoreo).', 'Proyecto integrador: un pipeline completo de la fuente al dashboard.'] },
      { h2: 'Niveles: inicial, intermedio y avanzado', table: { head: ['Nivel', 'Qué se espera'], rows: [['Inicial', 'Mantiene pipelines existentes y escribe transformaciones con supervisión.'], ['Intermedio', 'Diseña pipelines completos, optimiza costos y define modelos de datos.'], ['Avanzado', 'Define la arquitectura de datos, estándares de calidad y gobierno.']] } },
      { h2: 'Certificaciones de referencia', ul: ['AWS Certified Data Engineer – Associate.', 'Microsoft Certified: Fabric Data Engineer Associate (examen DP-700).', 'Google Cloud Professional Data Engineer.', 'Databricks Certified Data Engineer Associate.'], note: 'Confirma la vigencia y el contenido de cada certificación con su emisor.' }
    ]
  },
  {
    slug: 'data-scientist',
    name: 'Data Scientist',
    title: 'Qué estudiar para ser Data Scientist: ruta y habilidades',
    description: 'Qué hace un Data Scientist, estadística, Python y machine learning que necesita, requisitos, niveles y una ruta de aprendizaje con programas para estudiar.',
    h1: 'Qué estudiar para ser Data Scientist',
    intro: 'El Data Scientist usa estadística, programación y machine learning para predecir, clasificar u optimizar. Su trabajo va más allá de describir lo que pasó: construye modelos que ayudan a anticipar lo que puede pasar y a decidir mejor.',
    skills: ['python', 'machine-learning', 'sql', 'inteligencia-artificial'],
    categories: ['data-science', 'machine-learning'],
    sections: [
      { h2: 'Qué hace un Data Scientist', p: ['Formula preguntas que se pueden responder con datos, explora y prepara la información, entrena y evalúa modelos (por ejemplo, de demanda, abandono de clientes o riesgo) y comunica qué tan confiables son sus resultados para que el negocio los use.'] },
      { h2: 'Responsabilidades habituales', ul: ['Explorar datos y formular hipótesis.', 'Construir variables (feature engineering) y entrenar modelos.', 'Evaluar modelos con métricas adecuadas y validarlos con datos nuevos.', 'Diseñar experimentos y pruebas A/B.', 'Explicar resultados y limitaciones a equipos de negocio.', 'Colaborar con ingeniería para llevar modelos a producción.'] },
      { h2: 'Herramientas y tecnologías', ul: ['Python (pandas, scikit-learn) o R.', 'Estadística y probabilidad.', 'SQL para obtener y preparar datos.', 'Notebooks (Jupyter) y control de versiones.', 'Fundamentos de deep learning e IA generativa, según el puesto.'] },
      { h2: 'Habilidades técnicas y blandas', table: { head: ['Técnicas', 'Blandas'], rows: [['Estadística e inferencia', 'Pensamiento crítico y escepticismo sano'], ['Machine learning supervisado y no supervisado', 'Comunicación de incertidumbre'], ['Programación y manejo de datos', 'Entender el problema de negocio'], ['Evaluación y validación de modelos', 'Ética en el uso de datos']] } },
      { h2: 'Requisitos habituales', p: ['Es frecuente que se pida formación en estadística, matemática, economía, ingeniería o computación, y en muchos casos posgrado. Más que el título, se valora demostrar proyectos con modelos bien evaluados y explicados.'] },
      { h2: 'Ruta de aprendizaje sugerida', ol: ['Estadística y probabilidad aplicadas.', 'Python para datos (pandas, visualización).', 'SQL para extraer y preparar datos.', 'Machine learning: regresión, clasificación, validación y métricas.', 'Proyectos de punta a punta con datos reales.', 'Profundización: deep learning, series de tiempo o IA generativa según tu objetivo.'] },
      { h2: 'Niveles: inicial, intermedio y avanzado', table: { head: ['Nivel', 'Qué se espera'], rows: [['Inicial', 'Análisis exploratorio y modelos estándar con guía.'], ['Intermedio', 'Lleva un caso completo: datos, modelo, evaluación y comunicación.'], ['Avanzado', 'Define la estrategia analítica, prioriza casos de uso y asegura el impacto.']] } },
      { h2: 'Certificaciones de referencia', ul: ['Certificaciones de machine learning de proveedores cloud (por ejemplo, AWS o Google Cloud).', 'Certificados profesionales de ciencia de datos de plataformas educativas reconocidas.'], note: 'En ciencia de datos suele pesar más el portafolio que la certificación. Confirma la vigencia de cada credencial con su emisor.' }
    ]
  },
  {
    slug: 'ai-engineer',
    name: 'AI Engineer',
    title: 'Habilidades de un AI Engineer y cómo empezar',
    description: 'Qué hace un AI Engineer: aplicaciones con modelos de lenguaje (LLM), RAG, APIs de IA y MLOps. Herramientas, habilidades, requisitos y ruta de aprendizaje.',
    h1: 'Habilidades de un AI Engineer',
    intro: 'El AI Engineer integra modelos de inteligencia artificial en productos y procesos reales: asistentes, búsqueda inteligente, automatización de documentos o agentes. Su foco no es inventar modelos desde cero, sino hacer que funcionen bien, de forma segura y medible, dentro de una aplicación.',
    skills: ['python', 'inteligencia-artificial', 'machine-learning', 'cloud-computing'],
    categories: ['ia-generativa', 'inteligencia-artificial', 'machine-learning'],
    sections: [
      { h2: 'Qué hace un AI Engineer', p: ['Diseña y construye soluciones que usan modelos de lenguaje y otros modelos de IA: elige el modelo adecuado, conecta la información de la empresa (por ejemplo, con RAG), define cómo evaluar la calidad de las respuestas y despliega la solución con controles de costo, privacidad y seguridad.'] },
      { h2: 'Responsabilidades habituales', ul: ['Integrar modelos mediante APIs y SDK.', 'Diseñar prompts, flujos y herramientas para agentes.', 'Conectar fuentes de datos con técnicas de recuperación (RAG).', 'Evaluar la calidad, el costo y los riesgos de las respuestas.', 'Desplegar y monitorear soluciones en producción.'] },
      { h2: 'Herramientas y tecnologías', ul: ['Python y, a menudo, TypeScript.', 'APIs de modelos de lenguaje y bases de datos vectoriales.', 'Frameworks de orquestación de LLM.', 'Servicios de IA en la nube.', 'Prácticas de MLOps: versionado, pruebas y monitoreo.'] },
      { h2: 'Habilidades técnicas y blandas', table: { head: ['Técnicas', 'Blandas'], rows: [['Programación y APIs', 'Criterio para evaluar riesgos y límites de la IA'], ['Fundamentos de machine learning', 'Comunicación con usuarios y negocio'], ['Diseño de evaluaciones', 'Aprendizaje continuo (el campo cambia rápido)'], ['Seguridad y privacidad de datos', 'Pensamiento de producto']] } },
      { h2: 'Requisitos habituales', p: ['Suele venir de desarrollo de software, ciencia de datos o ingeniería de datos. Programar con soltura es la base; después se suman los fundamentos de machine learning y la práctica con modelos de lenguaje.'] },
      { h2: 'Ruta de aprendizaje sugerida', ol: ['Python y consumo de APIs.', 'Fundamentos de machine learning y de cómo funcionan los modelos de lenguaje.', 'Prompting, RAG y evaluación de respuestas.', 'Agentes y uso de herramientas.', 'Despliegue en la nube, costos y monitoreo.', 'Proyecto: un asistente con datos propios, evaluado y desplegado.'] },
      { h2: 'Niveles: inicial, intermedio y avanzado', table: { head: ['Nivel', 'Qué se espera'], rows: [['Inicial', 'Integra modelos vía API en prototipos.'], ['Intermedio', 'Construye soluciones con RAG y evaluación, listas para producción.'], ['Avanzado', 'Define la arquitectura de IA, la gobernanza y la estrategia de evaluación.']] } },
      { h2: 'Certificaciones de referencia', ul: ['Microsoft Certified: Azure AI Engineer Associate (examen AI-102).', 'AWS Certified Machine Learning Engineer – Associate.', 'Certificaciones de IA generativa de proveedores cloud.'], note: 'Confirma la vigencia y el contenido de cada certificación con su emisor.' }
    ]
  },
  {
    slug: 'software-developer',
    name: 'Software Developer',
    title: 'Cómo ser Software Developer: tecnologías y ruta',
    description: 'Qué hace un desarrollador de software (frontend, backend o full stack), lenguajes y herramientas, requisitos, niveles y una ruta de aprendizaje con programas para estudiar.',
    h1: 'Cómo ser Software Developer',
    intro: 'El desarrollador de software construye aplicaciones web, móviles o de negocio. Puede especializarse en la interfaz (frontend), en la lógica y los datos (backend) o en ambos (full stack).',
    skills: ['sql', 'python', 'cloud-computing'],
    categories: ['desarrollo-de-software', 'devops'],
    sections: [
      { h2: 'Qué hace un Software Developer', p: ['Traduce necesidades en funcionalidades: diseña, programa, prueba y mantiene software. Trabaja en equipo con producto, diseño y otros desarrolladores, normalmente con metodologías ágiles.'] },
      { h2: 'Responsabilidades habituales', ul: ['Programar nuevas funcionalidades y corregir errores.', 'Escribir pruebas automatizadas.', 'Revisar código de otras personas.', 'Diseñar APIs y modelos de datos.', 'Desplegar y monitorear aplicaciones.'] },
      { h2: 'Herramientas y tecnologías', ul: ['Frontend: HTML, CSS, JavaScript/TypeScript y frameworks como React.', 'Backend: Node.js, Python, Java o C#, y bases de datos SQL.', 'Git y plataformas de colaboración.', 'Contenedores (Docker) y nociones de cloud.'] },
      { h2: 'Habilidades técnicas y blandas', table: { head: ['Técnicas', 'Blandas'], rows: [['Lógica y estructuras de datos', 'Trabajo en equipo'], ['Un stack de desarrollo completo', 'Comunicación escrita (código, documentación)'], ['Pruebas y buenas prácticas', 'Autonomía para aprender'], ['Bases de datos y APIs', 'Atención al detalle']] } },
      { h2: 'Requisitos habituales', p: ['Muchas empresas aceptan perfiles formados en bootcamps o de forma autodidacta si demuestran proyectos. En roles corporativos o de mayor responsabilidad es común que se pida formación universitaria o técnica en computación o sistemas.'] },
      { h2: 'Ruta de aprendizaje sugerida', ol: ['Fundamentos de programación y lógica.', 'Desarrollo web: HTML, CSS y JavaScript.', 'Un framework de frontend o un lenguaje de backend.', 'Bases de datos SQL y diseño de APIs.', 'Git, pruebas y despliegue.', 'Portafolio con 2 o 3 aplicaciones publicadas.'] },
      { h2: 'Niveles: inicial, intermedio y avanzado', table: { head: ['Nivel', 'Qué se espera'], rows: [['Inicial', 'Implementa tareas acotadas con revisión de pares.'], ['Intermedio', 'Desarrolla funcionalidades completas de forma autónoma.'], ['Avanzado', 'Diseña la arquitectura, mentorea y define estándares.']] } },
      { h2: 'Certificaciones de referencia', ul: ['AWS Certified Developer – Associate.', 'Certificaciones de lenguajes (por ejemplo, Java de Oracle).', 'Certificaciones de Kubernetes y contenedores para perfiles backend o DevOps.'], note: 'En desarrollo suele pesar más el portafolio que la certificación.' }
    ]
  },
  {
    slug: 'cybersecurity-analyst',
    name: 'Cybersecurity Analyst',
    title: 'Cómo ser analista de ciberseguridad: habilidades y ruta',
    description: 'Qué hace un analista de ciberseguridad, herramientas (SIEM, redes, sistemas operativos), habilidades, requisitos, niveles y certificaciones de referencia.',
    h1: 'Cómo ser analista de ciberseguridad',
    intro: 'El analista de ciberseguridad protege los sistemas y la información de una organización: vigila, detecta y responde a incidentes, y ayuda a reducir riesgos antes de que se conviertan en problemas.',
    skills: ['cloud-computing'],
    categories: ['ciberseguridad', 'gestion-de-ti'],
    sections: [
      { h2: 'Qué hace un analista de ciberseguridad', p: ['Monitorea alertas de seguridad, investiga eventos sospechosos, coordina la respuesta ante incidentes y propone controles para reducir vulnerabilidades en redes, sistemas, aplicaciones y servicios en la nube.'] },
      { h2: 'Responsabilidades habituales', ul: ['Monitorear eventos en un SIEM y clasificar alertas.', 'Investigar incidentes y documentar hallazgos.', 'Gestionar vulnerabilidades y su corrección.', 'Aplicar políticas y controles de seguridad.', 'Concientizar a los colaboradores sobre buenas prácticas.'] },
      { h2: 'Herramientas y tecnologías', ul: ['Redes (TCP/IP), sistemas operativos Windows y Linux.', 'SIEM y herramientas de monitoreo.', 'Escáneres de vulnerabilidades.', 'Seguridad en la nube e identidades.', 'Marcos de referencia como ISO 27001 o NIST.'] },
      { h2: 'Habilidades técnicas y blandas', table: { head: ['Técnicas', 'Blandas'], rows: [['Redes y sistemas operativos', 'Calma y método ante incidentes'], ['Análisis de logs y eventos', 'Ética y confidencialidad'], ['Gestión de vulnerabilidades', 'Comunicación de riesgos'], ['Seguridad en la nube', 'Curiosidad y aprendizaje continuo']] } },
      { h2: 'Requisitos habituales', p: ['Se suele pedir formación en sistemas, redes o computación, o experiencia previa en soporte o infraestructura. Las certificaciones tienen mucho peso en este campo para demostrar conocimientos.'] },
      { h2: 'Ruta de aprendizaje sugerida', ol: ['Fundamentos de redes y sistemas operativos.', 'Fundamentos de seguridad: amenazas, controles y marcos de referencia.', 'Monitoreo, SIEM y respuesta a incidentes.', 'Seguridad en la nube e identidades.', 'Prácticas en laboratorios y una certificación de entrada.'] },
      { h2: 'Niveles: inicial, intermedio y avanzado', table: { head: ['Nivel', 'Qué se espera'], rows: [['Inicial', 'Monitorea y clasifica alertas siguiendo procedimientos.'], ['Intermedio', 'Investiga y responde incidentes; gestiona vulnerabilidades.'], ['Avanzado', 'Diseña la estrategia de seguridad y lidera la respuesta a incidentes.']] } },
      { h2: 'Certificaciones de referencia', ul: ['CompTIA Security+.', 'ISC2 Certified in Cybersecurity (CC).', 'Certified Ethical Hacker (CEH) para perfiles ofensivos.', 'ISO/IEC 27001 (implementador o auditor) para perfiles de gestión.'], note: 'Confirma la vigencia y el contenido de cada certificación con su emisor.' }
    ]
  },
  {
    slug: 'business-analyst',
    name: 'Business Analyst',
    title: 'Cómo ser Business Analyst: habilidades y ruta',
    description: 'Qué hace un Business Analyst, cómo se diferencia del Data Analyst, herramientas (Excel, SQL, Power BI, modelado de procesos), requisitos y ruta de aprendizaje.',
    h1: 'Cómo ser Business Analyst',
    intro: 'El Business Analyst es el puente entre el negocio y la tecnología: entiende cómo funciona un proceso, detecta qué mejorar y traduce esas necesidades en requerimientos claros para los equipos que construyen las soluciones.',
    skills: ['excel', 'sql', 'power-bi'],
    categories: ['business-analytics', 'gestion-de-proyectos'],
    sections: [
      { h2: 'Qué hace un Business Analyst', p: ['Levanta información con las áreas usuarias, modela procesos, analiza datos para dimensionar problemas y oportunidades, y documenta requerimientos que los equipos de tecnología pueden implementar. A diferencia del Data Analyst, su foco principal son los procesos y las necesidades, no solo los datos.'] },
      { h2: 'Responsabilidades habituales', ul: ['Levantar y priorizar requerimientos con usuarios.', 'Modelar procesos actuales y propuestos (por ejemplo, con BPMN).', 'Escribir historias de usuario y criterios de aceptación.', 'Analizar datos para sustentar decisiones.', 'Acompañar las pruebas y la adopción de las soluciones.'] },
      { h2: 'Herramientas y tecnologías', ul: ['Excel avanzado y nociones de SQL.', 'Power BI u otra herramienta de BI.', 'Modelado de procesos (BPMN).', 'Herramientas de gestión ágil (tableros, backlog).'] },
      { h2: 'Habilidades técnicas y blandas', table: { head: ['Técnicas', 'Blandas'], rows: [['Análisis y modelado de procesos', 'Escucha activa y entrevistas'], ['Documentación de requerimientos', 'Negociación y facilitación'], ['Análisis de datos', 'Pensamiento sistémico'], ['Metodologías ágiles', 'Comunicación clara y escrita']] } },
      { h2: 'Requisitos habituales', p: ['Es común en perfiles de ingeniería industrial, administración, economía o sistemas. Se valora la experiencia en el sector (banca, retail, seguros, etc.) y el manejo de datos.'] },
      { h2: 'Ruta de aprendizaje sugerida', ol: ['Excel avanzado y análisis de datos.', 'Modelado de procesos y levantamiento de requerimientos.', 'SQL y Power BI para sustentar decisiones con datos.', 'Metodologías ágiles (Scrum) y gestión de producto.', 'Un caso práctico documentado de punta a punta.'] },
      { h2: 'Niveles: inicial, intermedio y avanzado', table: { head: ['Nivel', 'Qué se espera'], rows: [['Inicial', 'Documenta requerimientos y procesos con guía.'], ['Intermedio', 'Lidera el análisis de una iniciativa completa.'], ['Avanzado', 'Define la estrategia de procesos y prioriza el portafolio de iniciativas.']] } },
      { h2: 'Certificaciones de referencia', ul: ['IIBA: ECBA (inicial) y CBAP (avanzada).', 'Certificaciones ágiles como Professional Scrum Master (PSM I) o Professional Scrum Product Owner.', 'Microsoft PL-300 para el componente de datos.'], note: 'Confirma la vigencia y el contenido de cada certificación con su emisor.' }
    ]
  }
];
