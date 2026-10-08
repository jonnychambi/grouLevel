# Groulevel

**Encuentra la formación que te lleva al siguiente nivel.**

Groulevel es un marketplace/comparador de programas de formación en tecnología (Perú → Latinoamérica). Ayuda a profesionales a buscar, filtrar, comparar y elegir cursos, bootcamps, diplomados, certificaciones, programas ejecutivos, maestrías y membresías, y genera leads calificados para las instituciones.

**Catálogo real:** 309 programas de 20 instituciones (Perú y LATAM), importados del relevamiento `compara_learning_cursos.xlsx` y administrables desde `/admin`. Los datos que una institución no publica se muestran como “No publicado / Precio a consultar”: nunca se inventan.

Funnel principal: **Descubrir → Buscar → Filtrar → Evaluar → Comparar → Ver detalle → Solicitar información → Lead.**

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · React Router. Sin backend: 100 % estático, desplegable en GitHub Pages.

```bash
npm install
npm run dev        # http://localhost:5173/
npm test           # tests unitarios (búsqueda, filtros, lead scoring)
npm run build      # typecheck + build + pre-render de rutas, sitemap y robots
npm run preview
```

## Rutas

| Ruta | Página |
| --- | --- |
| `/` | Home: hero con buscador, áreas, destacados, teaser del comparador |
| `/programas`, `/programas/:categoria` | Resultados con filtros combinables, orden y paginación (estado en la URL) |
| `/programa/:slug` | Detalle orientado a conversión |
| `/comparar` | Comparador (tabla en desktop, bloques en mobile). Compartible con `?p=slug-a,slug-b` |
| `/instituciones`, `/institucion/:slug` | Directorio e información institucional |
| `/instituciones/partners` | Propuesta B2B y formulario de contacto |
| `/nosotros`, `/favoritos` | Nosotros y favoritos (localStorage) |
| `/interno/metricas` | Panel interno (noindex) con métricas del funnel calculadas desde los eventos locales |
| `/admin` | Módulo de administración (contraseña): programas, instituciones e historial de versiones |

## Arquitectura

```
src/
  config/      site.ts — nombre, URL, tipo de cambio, tamaño de página, máx. comparación
  data/        courses.json · institutions.json · categories.json · leads.json
  types/       modelo de dominio (Course, Institution, Lead, CplEvent, Order, eventos)
  services/    capa de acceso — los componentes nunca leen JSON directamente
    dataSource.ts      DataSource (JsonDataSource | RestDataSource) ← migración a Supabase/Firebase/SQL/API
    catalogService.ts  join + caché + búsqueda/filtros/facetas/relacionados
    leadService.ts     LeadService (LocalLeadService | HttpLeadService)
    analytics.ts       track() con sinks (dataLayer/GTM, GA4, buffer local)
    attribution.ts     UTMs first/last touch + sesión
    monetization.ts    CPL por lead, estructura de comisión por venta
  utils/       lógica pura y testeada: search, filters, leadScoring, related, compare, metrics, schema
  hooks/       useCatalog, useCompare, useFavorites, useRecentlyViewed, useSeo…
  context/     LeadModal (carga diferida) y Toasts
  components/  layout · search · filters · course · compare · institution · lead · ui
  pages/       una por ruta, con code-splitting
```

## Datos: importación desde Excel

Los programas se importan desde **`/admin` → Importar**, subiendo un `.xlsx` con la plantilla (`public/plantilla-programas-groulevel.xlsx`, descargable desde el panel) o con el formato completo del relevamiento (hoja `CURSOS`).

- **Vista previa antes de guardar:** nuevos, actualizaciones (con el detalle de cada campo que cambia), sin cambios, protegidos y descartados (con el motivo). Se puede elegir fila por fila.
- **Programas existentes:** se reconocen por la URL oficial (o institución + nombre). Una celda vacía o «No especificado» nunca borra información existente.
- **Ediciones manuales protegidas:** los programas editados en el panel no se actualizan salvo que se marque la opción.
- **Instituciones nuevas:** se crean automáticamente (y se reconocen por sus nombres alternativos en futuras importaciones).
- **Reglas** (las mismas de la importación inicial): solo extracciones Completo/Parcial, sin duplicados, solo áreas tecnológicas (configurable), «No especificado» = `null`.
- Lógica en `src/utils/excelImport.ts` (pura y testeada). `excelImport.parity.test.ts` comprueba que re-importar el Excel original no cambia nada (`XLSX_PATH=archivo.xlsx npm test`).
- Regenerar la plantilla: `npm run data:template` (requiere `pip install openpyxl`).

## Módulo de administración (`/admin`)

Menú lateral por grupos: **Catálogo** (Programas, Agregar programas, Actualizaciones, Instituciones), **Demanda** (Leads, Perfiles, Reseñas) y **Datos** (Importar Excel, Versiones, Base de datos), con contadores de pendientes. La sección activa queda en la URL (`/admin?seccion=agregar`).

- **Acceso:** contraseña única (`ADMIN_PASSWORD`, variable sensible en Vercel). Sesión firmada con HMAC (`ADMIN_SESSION_SECRET`), válida 12 h, guardada solo en la pestaña.
- **Programas:** búsqueda y filtros (institución, categoría, estado, datos incompletos, sin precio, sin inicio), indicador de completitud, edición de todos los campos (precio y cuotas, duración, modalidad, inicio, certificación, temario por módulos, docentes, herramientas, “incluye”…), crear, duplicar, eliminar y cambiar estado en lote (**Publicado / Borrador / Oculto**).
- **Instituciones:** crear y editar (nombre, tipo, país, web, descripción, color o logo).
- **Importar:** carga masiva desde Excel con vista previa (ver arriba).
- **Versiones:** cada guardado crea una versión inmutable; se conservan 50 y se puede restaurar cualquiera. Exportar a JSON y restablecer desde el catálogo del build.
- **Arquitectura:** Vercel Functions (`api/admin.ts`, `api/catalog.ts`) + **Supabase** (tablas del catálogo y `catalog_versions`). El servidor valida el catálogo (`api/_lib/validate.ts`) y evita pisar cambios de otra sesión (409).
- **Publicación:** el sitio lee `/api/catalog` (caché de 60 s en el CDN), así que los cambios se ven en ~1 minuto sin redeploy. El pre-render SEO (títulos, sitemap) usa la última versión publicada en cada despliegue. Si la API no está disponible (GitHub Pages, desarrollo local) el sitio usa los JSON del build.

Variables en Vercel: `POSTGRES_URL` y demás de Supabase (las crea la integración), `BLOB_READ_WRITE_TOKEN` (CV; la crea el Blob store), `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`.

### Migrar de JSON a un backend
- **Catálogo:** define `VITE_DATA_API_URL` (usa `RestDataSource`) o crea otra implementación de `DataSource` (p. ej. Supabase) y devuélvela en `getDataSource()`.
- **Leads:** define `VITE_LEAD_API_URL` (usa `HttpLeadService`, POST del lead completo) o implementa `LeadService`.
- La búsqueda (`utils/search.ts`) es pura: puede moverse a un servidor o reemplazarse por Algolia/Typesense/Postgres FTS manteniendo la interfaz de `queryPrograms`.

### Agregar categorías o filtros
- Nueva categoría: añadir una entrada en `categories.json` (con `keywords` para el buscador). Rutas, filtros, sitemap y páginas pre-renderizadas se generan solos.
- Nuevo filtro: añadir un objeto a `FILTER_GROUPS` en `utils/filters.ts` (label, parámetro de URL, opciones y predicado).

## Buscador inteligente
Interpreta lenguaje natural (`"maestría de inteligencia artificial"`, `"curso de Python barato"`, `"data analytics online"`): detecta tipo de programa, modalidad, nivel, gratis/barato; expande sinónimos (IA ⇄ inteligencia artificial, ML, BI…); pondera nombre, herramientas, categoría, institución, habilidades y temario; tolera errores de tipeo. Las intenciones se aplican como filtro solo si dejan resultados, y se muestran al usuario (“Interpretamos tu búsqueda como…”). Autocompletado con categorías, herramientas, programas e instituciones (combobox ARIA).

## Groulevel Reviews — reputación de instituciones y programas

- **Modelo**: la institución es la reputación principal (calidad académica, docentes, experiencia educativa, cumplimiento, relación calidad-precio); el programa cursado es complementario (contenido, metodología, herramientas, docente). Se muestran por separado; un programa sin reseñas muestra la reputación de su institución, identificada como tal (fichas, tarjetas y listado).
- **Formulario** (`/opinar`, con `?institucion=&programa=`): acceso con correo validado (código o enlace de Supabase Auth, vía `/api/reviews?action=auth-start|auth-verify`), institución + programa opcional, estrellas por dimensión, ¿qué fue lo mejor?, ¿qué debería mejorar?, ¿la recomiendas?, año y estado (estudiante/egresado), constancia opcional (Blob privado, nunca pública) y solicitud de incentivo.
- **Transparencia**: insignia "Reseña verificada" solo con constancia aprobada; nombre abreviado, fecha y antigüedad; reseñas incentivadas identificadas; reportes de reseñas sospechosas (`?action=report`); moderación con criterios objetivos (se publican opiniones positivas y críticas).
- **Incentivos**: S/ 50 por reseña institucional verificada + S/ 50 por evaluación detallada del programa; no dependen de la calificación; uno por persona e institución/programa (índice único); señales antifraude (constancia o texto repetidos, cuenta de pago compartida, muchas reseñas en 24 h, bloqueo de personas).
- **Admin → Demanda → Reseñas**: pendientes/publicadas/rechazadas, verificación de constancias, duplicados, criterios, respuesta pública, reportes e incentivos (aprobar → pagar).
- **SEO**: `/institucion/:slug/opiniones` y `/programa/:slug/opiniones` servidas por `api/seo.ts` con contenido real y JSON-LD (`aggregateRating` + `Review`); indexables solo con reseñas propias; incluidas en el sitemap.
- Migración 007 (`reviewers`, `review_reports`, `review_incentives`, columnas nuevas en `reviews`, vistas con dimensiones). Las reseñas anteriores siguen contando.
- **Configuración en Supabase** (Authentication): Site URL `https://www.groulevel.com`, Redirect URL `https://www.groulevel.com/**`; para el código, agregar `{{ .Token }}` a la plantilla "Magic Link"; SMTP propio recomendado (el de Supabase tiene un límite bajo de correos por hora).

## Analiza mi perfil — diagnóstico y estudios (`/mi-ruta`)

- Acceso destacado: botón **"Analiza mi perfil"** en el header (y menú móvil) y tarjeta bajo el buscador del home.
- La persona **sube su CV** (PDF, Word .docx o TXT, máx. 4 MB) **o describe** su perfil, escribe su **objetivo**, el **rol objetivo** y el **salario mensual que espera** en ese rol (más modalidad, presupuesto y horas por semana, opcionales).
- **Resultado, en este orden:**
  1. **Diagnóstico**: resumen del perfil; principales habilidades técnicas y blandas con **escala exigente** (1–39 básico · 40–64 intermedio · 65–84 avanzado; nunca "experto" a partir de un CV, ni con IA); **puestos a los que puede postular hoy** con salario referencial; **brecha con el rol objetivo** (preparación %, materias, herramientas, habilidades blandas y años de experiencia requeridos vs. actuales, tiempo estimado, salario referencial del rol vs. salario esperado).
  2. **Qué estudiar**: hasta 5 opciones de **corto plazo** (cursos, diplomados, bootcamps, especializaciones, certificaciones; respetan el presupuesto) y hasta 5 de **largo plazo** (maestrías) del catálogo.
  3. Plan por etapas, conocimientos por materia y datos del CV.
- **Privacidad**: la página y la API pública no exponen correo, teléfono ni LinkedIn; esos datos solo los ve el administrador.
- **Salarios**: rangos referenciales mensuales brutos para Lima por familia de puestos y nivel (`src/utils/profileAnalysis.ts`); con IA, Claude los estima para el país de la persona. Se muestran siempre como referenciales.
- **Motor**: con `ANTHROPIC_API_KEY` (si la key no pertenece a un workspace de Anthropic, agregar también `ANTHROPIC_WORKSPACE_ID`), Claude (`claude-opus-5-5`, salida JSON estructurada; el PDF se le envía como documento). Sin clave, o si falla, el motor por reglas. El resultado siempre se sanea en el servidor (topes de puntaje, niveles, solo programas existentes y del tipo correcto).
- **Base de datos** (todo se guarda): `profiles` (datos extraídos, rol objetivo, salario esperado, preparación, rango salarial, preferencias, diagnóstico y estudios en jsonb, texto del CV), `profile_education`, `profile_experience`, `profile_scores`, `profile_route_courses`, `profile_suggested_roles`, `profile_gap_items` y `profile_studies`. El CV original va a Vercel Blob.
- En `/admin` → **Perfiles**: rol objetivo, preparación, salario esperado, puestos sugeridos, estudios, descarga del CV, CSV, estado y borrado.
- Límite: 6 diagnósticos por hora por IP. Evento GA: `generate_route`.

## Base de datos (Supabase / PostgreSQL) — fuente principal

- Proyecto Supabase **supabase-groulevel** (región São Paulo, `gru1`), conectado a Vercel desde el Marketplace (`POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `SUPABASE_*`). Las funciones de Vercel corren en la misma región (`regions: ["gru1"]` en `vercel.json`) para que cada consulta tarde milisegundos.
- **Todo dato vive en la base**: catálogo vigente (`categories`, `institutions`, `courses`), versiones publicadas con su contenido (`catalog_versions.data`) y el historial por registro (`catalog_changes`); `leads`; `reviews` (+ vistas `course_ratings` / `institution_ratings`); diagnósticos de Mi ruta (`profiles` + `profile_education`, `profile_experience`, `profile_scores`, `profile_route_courses`). Cada tabla principal guarda además el registro original en `raw` (jsonb).
- **Vercel Blob** solo guarda los CV originales (`profiles-files/`) y conserva, en solo lectura, los datos de antes de la migración (las versiones antiguas del catálogo se pueden restaurar desde /admin).
- **Migraciones**: `db/migrations/*.sql`, aplicadas por `npm run db:migrate` y automáticamente en cada build de **producción** (en preview, con `MIGRATE=1`). Para cambios de esquema, agregar `db/migrations/00N_<nombre>.sql`.
- **Seguridad**: RLS activado sin políticas en todas las tablas → las claves públicas de Supabase no pueden leer nada; solo el servidor (conexión `postgres`) accede.
- **/admin → Base de datos**: estado, conteos e **importación de datos antiguos de Blob** (no destructiva: solo agrega lo que falte).
- `GET /api/health` → `{ ok, db, blob, migrations }`.
- Pruebas del API contra PostgreSQL real embebido (PGlite).

## Rendimiento y origen de la demanda (`/admin` → Demanda → Rendimiento)

- Conteo propio y anónimo (`POST /api/track`, tabla `demand_daily`, migración 006): vistas, comparaciones, favoritos, clics al sitio de la institución, formularios abiertos y fichas de institución, por programa/institución y día. Las solicitudes (leads) se cuentan en el servidor al guardarse. No guarda IP, sesión ni datos personales, por eso no depende del banner de cookies; ignora bots.
- Origen: canal (búsqueda orgánica, pago, redes sociales, email, referido, asistentes de IA, directo) a partir de UTM y referrer; fuente y campaña; país y ciudad aproximados (headers de geolocalización de Vercel); dispositivo.
- Panel: período (7/30/90 días), filtros por canal, país y área; totales y conversión; vistas por día; rankings de programas e instituciones ordenables y exportables a CSV.
- GA4 recibe además el nombre del programa (`item_name`) y de la institución (`item_brand`).

## Agregar programas desde links (`/admin` → Agregar programas)

1. Se pegan los links de los programas (uno por línea, hasta 200) y, opcionalmente, la institución; si no, se detecta por el dominio.
2. Se descartan duplicados y links que ya están en el catálogo. Cada link se lee (HTML o PDF) y `claude-haiku-5-5` arma un borrador con salida estructurada: nombre, tipo, área, descripción, precio, duración, inicio, horario, modalidad, certificado, objetivos, temario, herramientas, requisitos y financiamiento. Solo datos que la página muestra; los faltantes quedan marcados.
3. El administrador revisa y corrige los datos clave, y publica (o agrega como borrador oculto). Se crea una versión nueva del catálogo con ids y slugs únicos; desde ahí el programa entra en la actualización automática.
4. Las páginas que bloquean lecturas o se cargan con JavaScript quedan en "No se pudieron leer", con opción de reintentar o agregar a mano.

El panel procesa la cola en tandas mientras está abierto; la tarea diaria procesa lo que quede pendiente. Tabla `program_drafts` (migración 005).

## Actualización automática de programas (`/admin` → Actualizaciones)

Revisa el link oficial de cada programa y propone cambios; **nada se publica sin que el administrador lo apruebe**.

- **Frecuencia**: diario, semanal (el catálogo se reparte en 7 días) o desactivado. Vercel Cron llama a `/api/cron` todos los días a las 4:00 a. m. (Lima) y solo revisa los programas que tocan. Requiere la variable `CRON_SECRET`.
- **Por programa**: "Revisar link" lee la página en ese momento (siempre consulta la IA); "Editar" abre el editor para cambios manuales. "Revisar lote ahora" ejecuta un lote completo.
- **Ahorro de fichas**: la página se reduce al texto relevante (precio, inicio, duración, modalidad, horario, cuotas, inscripciones; máx. ~5 000 caracteres) y se calcula una huella. Si la huella no cambió, no se llama al modelo. Cuando cambia, `claude-haiku-5-5` (configurable con `REFRESH_AI_MODEL`) extrae los datos con salida estructurada, sin razonamiento extendido y un límite bajo de salida (~1–2 mil fichas por consulta). La comparación la hace el código: un dato que la página no muestra nunca borra el actual, las fechas pasadas se ignoran.
- **Propuestas**: muestran valor actual vs. página; se aplican todas o por campo (publica una nueva versión del catálogo, con historial) o se descartan. Sin `ANTHROPIC_API_KEY` solo se avisa que la página cambió, para revisarla a mano.
- Tablas: `program_checks`, `program_updates`, `refresh_runs`, `app_settings` (migración 004). Las páginas que se cargan solo con JavaScript o bloquean robots aparecen como "Sin contenido" / "Error".

## Lead scoring — Signal Score™ (0–100)
`utils/leadScoring.ts`, configuración desacoplada (`DEFAULT_SCORING_CONFIG`):

| Señal | Puntos |
| --- | --- |
| Inicio: inmediatamente / 30 días / 1–3 meses / solo comparando | 40 / 30 / 20 / 5 |
| Objetivo (cambio de carrera 25 … actualizar conocimientos 12) | hasta 25 |
| Comportamiento: comparó ≥2, vio ≥3 programas, origen comparador/detalle | hasta 20 |
| Contacto: WhatsApp válido, email corporativo | hasta 15 |

Tiers: **HIGH INTENT 80–100 → Hot · WARM 60–79 → Warm · NURTURE 40–59 / LOW 0–39 → Cold**.

Cada lead registra programa, institución, URL, fecha, fuente, campaña y UTMs (source/medium/campaign/term/content), y genera un `CplEvent` (`institution_id, course_id, lead_id, lead_score, timestamp, source`).

## Monetización
- **CPL:** `monetization.ts` registra un evento facturable por lead (tarifa por institución, multiplicador por calidad).
- **Featured listings:** campo `featured`; se posicionan primero en relevancia y se etiquetan “Destacado”.
- **Comisión por venta:** tipo `Order` (`order_id, course_id, institution_id, sale_amount, commission_percentage, commission_amount`) y `buildOrder()` listos para el checkout.

## Analítica (Google Analytics 4)

- Se activa con la variable **`VITE_GA_MEASUREMENT_ID`** (`G-XXXXXXX`) en Vercel → Settings → Environment Variables (Production) y un nuevo despliegue. Sin ella, no se carga nada de Google.
- **Consent Mode v2:** las cookies analíticas están denegadas hasta que la persona acepta en el aviso; la elección se recuerda y se puede cambiar en el pie (“Preferencias de cookies”). Sin cookies publicitarias.
- Page views en cada cambio de ruta (SPA) con el título correcto. No se mide `/admin`.
- Eventos → GA4: `search` (búsqueda), `view_item` (ficha), `add_to_compare`, `view_comparison`, `begin_lead_form`, **`generate_lead`** (con valor, moneda, tier y Signal Score), `add_to_wishlist`, `share`, `click_institution_site`. Nunca se envían nombre, email ni teléfono.
- En GA4 marca **`generate_lead`** como evento clave (conversión). Para ver `lead_tier`, `lead_score` o `lead_source` en los informes, regístralos como dimensiones/métricas personalizadas.
- Los mismos eventos se envían a `window.dataLayer` con prefijo `gl_` por si más adelante se usa Google Tag Manager.
- **Depuración:** abre el sitio con `?ga_debug=1` (acepta las cookies) y los eventos aparecen al instante en GA4 → Administrar → **DebugView**; también se listan en la consola del navegador. `?ga_debug=0` lo apaga.
- Los eventos nuevos tardan hasta 24 h en aparecer en Administrar → Eventos (pestaña *Eventos recientes*); los enviados sin consentimiento no se muestran en informes.
- `/interno/metricas` sigue calculando el funnel con los eventos del navegador (útil para pruebas).

## Leads

- El formulario “Solicitar información” envía a **`POST /api/leads`**, que valida los datos, verifica que el programa exista, **recalcula el Signal Score en el servidor** y guarda el lead en la tabla `leads`. No se guarda la IP.
- Anti-spam: campo trampa invisible y límite de envíos por IP.
- **`/admin` → Leads:** totales, filtros (estado, intención, institución, periodo, búsqueda), detalle con enlaces directos a WhatsApp y email, estado de seguimiento (*Nuevo, Contactado, Enviado a la institución, Matriculado, Descartado*), notas internas, **exportación a CSV** (abre directo en Excel) y eliminación (p. ej. si alguien pide borrar sus datos).
- Opcional: **`LEAD_WEBHOOK_URL`** reenvía cada lead a un webhook (Zapier/Make → Google Sheets, HubSpot, email…).
- Donde no hay API (GitHub Pages, desarrollo local) los leads se guardan en el navegador, como antes.

## SEO (Google)
- **Páginas del catálogo siempre al día**: en Vercel, `/`, `/programas`, `/programas/:area`, `/programa/:slug`, `/instituciones` e `/institucion/:slug` las sirve `api/seo.ts` desde la base (caché CDN 10 min). Google recibe HTML con contenido real (detalle, temario, precio, inicio, programas similares, enlaces internos), title/description/canonical/Open Graph y JSON-LD. Un programa nuevo o editado en /admin se indexa sin redesplegar; un slug inexistente devuelve 404 real con `noindex`.
- **Datos estructurados**: Organization + WebSite (SearchAction), Course (provider, offers, hasCourseInstance con courseMode y courseWorkload, aggregateRating con las reseñas aprobadas), BreadcrumbList, ItemList y EducationalOrganization. La app reemplaza estos JSON-LD al navegar (`data-seo-jsonld`).
- **Sitemap dinámico** en `/sitemap.xml` con `lastmod` por programa; `robots.txt` lo declara.
- Plantillas compartidas en `scripts/seoPages.mjs` (las usa también el build estático de GitHub Pages).
- **Search Console**: verificar el dominio (registro DNS TXT) o definir `GOOGLE_SITE_VERIFICATION` en Vercel con el código del meta tag; luego enviar `https://www.groulevel.com/sitemap.xml`.

## Despliegue

### Producción — Vercel (www.groulevel.com)
- Proyecto de Vercel conectado a este repositorio: cada push a `main` despliega a producción y cada rama/PR genera un preview.
- `vercel.json` define build (`npm run build` → `dist/`), URLs limpias, caché inmutable para `/assets/*`, cabeceras de seguridad y la redirección `groulevel.com → www.groulevel.com`.
- Defaults del build: `BASE_PATH=/` y `VITE_SITE_URL=https://www.groulevel.com` (canonical, Open Graph, sitemap y robots).
- DNS: `www` → CNAME al valor que indica Vercel; dominio raíz → registro A que indica Vercel (se redirige a `www`).

### Espejo — GitHub Pages
`.github/workflows/deploy.yml` corre los tests y publica en `https://<usuario>.github.io/<repo>/` (con `BASE_PATH=/<repo>/`). Su canonical apunta a www.groulevel.com para no duplicar contenido en buscadores. Si ya no lo necesitas, desactiva Pages o elimina el job `deploy`.

## Marca
Sistema “Dark Intelligence”: Deep Navy `#050816`, Midnight `#091225`, Violet `#7657FF`, Blue `#246BFE`, Cyan `#00E7FF`, Cool Gray `#9DAABD`; tipografía Geist / Geist Mono; G propietaria (arco 315° + puntos Signal → Processing → Growth). Tokens en `src/index.css`.

## Accesibilidad y performance
HTML semántico, skip link, foco visible, combobox/accordion/dialog con ARIA, focus trap y Escape en modales, labels y mensajes de error asociados, `prefers-reduced-motion`. Code-splitting por ruta, catálogo en chunk propio precargado en paralelo, modal de leads diferido, logos como monogramas SVG/CSS (sin imágenes), sin dependencias de UI externas.
