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

`scripts/import_xlsx.py` convierte la hoja **CURSOS** al modelo de Groulevel (`src/data/*.json`):

```bash
pip install openpyxl
npm run data:import -- ruta/compara_learning_cursos.xlsx
```

Criterios: solo registros con extracción *Completo/Parcial* (se descartan URLs caídas), sin duplicados, dentro del foco tecnológico (se excluyen finanzas, energía, derecho, MBA…), y solo las columnas necesarias (las de control de la extracción no se publican). “No especificado” se guarda como `null`. Los IDs son estables (`crs-<ID_ORIGEN>`), así que re-importar no rompe URLs, favoritos ni leads. Se añadieron las categorías *Marketing Digital*, *Gestión de Proyectos y Agilidad* y *Gestión y Gobierno de TI*.

## Módulo de administración (`/admin`)

- **Acceso:** contraseña única (`ADMIN_PASSWORD`, variable sensible en Vercel). Sesión firmada con HMAC (`ADMIN_SESSION_SECRET`), válida 12 h, guardada solo en la pestaña.
- **Programas:** búsqueda y filtros (institución, categoría, estado, datos incompletos, sin precio, sin inicio), indicador de completitud, edición de todos los campos (precio y cuotas, duración, modalidad, inicio, certificación, temario por módulos, docentes, herramientas, “incluye”…), crear, duplicar, eliminar y cambiar estado en lote (**Publicado / Borrador / Oculto**).
- **Instituciones:** crear y editar (nombre, tipo, país, web, descripción, color o logo).
- **Versiones:** cada guardado crea una versión inmutable; se conservan 50 y se puede restaurar cualquiera. Exportar a JSON y restablecer desde el catálogo del build.
- **Arquitectura:** Vercel Functions (`api/admin.ts`, `api/catalog.ts`) + **Vercel Blob privado** (`catalog/versions/*.json`). El servidor valida el catálogo (`api/_lib/validate.ts`) y evita pisar cambios de otra sesión (409).
- **Publicación:** el sitio lee `/api/catalog` (caché de 60 s en el CDN), así que los cambios se ven en ~1 minuto sin redeploy. El pre-render SEO (títulos, sitemap) usa la última versión publicada en cada despliegue. Si la API no está disponible (GitHub Pages, desarrollo local) el sitio usa los JSON del build.

Variables en Vercel: `BLOB_READ_WRITE_TOKEN` (la crea el Blob store), `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`.

### Migrar de JSON a un backend
- **Catálogo:** define `VITE_DATA_API_URL` (usa `RestDataSource`) o crea otra implementación de `DataSource` (p. ej. Supabase) y devuélvela en `getDataSource()`.
- **Leads:** define `VITE_LEAD_API_URL` (usa `HttpLeadService`, POST del lead completo) o implementa `LeadService`.
- La búsqueda (`utils/search.ts`) es pura: puede moverse a un servidor o reemplazarse por Algolia/Typesense/Postgres FTS manteniendo la interfaz de `queryPrograms`.

### Agregar categorías o filtros
- Nueva categoría: añadir una entrada en `categories.json` (con `keywords` para el buscador). Rutas, filtros, sitemap y páginas pre-renderizadas se generan solos.
- Nuevo filtro: añadir un objeto a `FILTER_GROUPS` en `utils/filters.ts` (label, parámetro de URL, opciones y predicado).

## Buscador inteligente
Interpreta lenguaje natural (`"maestría de inteligencia artificial"`, `"curso de Python barato"`, `"data analytics online"`): detecta tipo de programa, modalidad, nivel, gratis/barato; expande sinónimos (IA ⇄ inteligencia artificial, ML, BI…); pondera nombre, herramientas, categoría, institución, habilidades y temario; tolera errores de tipeo. Las intenciones se aplican como filtro solo si dejan resultados, y se muestran al usuario (“Interpretamos tu búsqueda como…”). Autocompletado con categorías, herramientas, programas e instituciones (combobox ARIA).

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

## Analítica
Eventos tipados: `search_performed`, `filter_applied`, `course_viewed`, `compare_added`, `comparison_viewed`, `lead_form_opened`, `lead_submitted`, `institution_viewed`, `outbound_click`, `favorite_added` (+ `compare_removed`, `favorite_removed`, `share_clicked`). Cada evento lleva contexto (course_id, institution_id, category, price, source…), sesión y UTMs, y se envía a `window.dataLayer` (GTM), `gtag` si existe y un buffer local. `utils/metrics.ts` calcula Search→View, View→Lead, Comparison→Lead, leads por institución/programa/categoría/fuente/campaña, CPL, revenue y Signal Score promedio.

## SEO
Title/description/canonical/Open Graph/Twitter dinámicos, JSON-LD (WebSite + SearchAction, Course, EducationalOrganization, BreadcrumbList, ItemList), breadcrumbs, URLs semánticas. En el build, `scripts/postbuild.mjs` genera un `index.html` por ruta conocida (62) con su meta y contenido básico, más `sitemap.xml`, `robots.txt` y `404.html` (fallback SPA).

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
