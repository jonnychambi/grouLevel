/**
 * Páginas para buscadores (Google): HTML con contenido real, metadatos y datos estructurados (Schema.org).
 *
 * Lo usan:
 *  · scripts/postbuild.mjs → genera los HTML estáticos (GitHub Pages y páginas sin catálogo).
 *  · api/seo.ts            → en Vercel sirve las páginas del catálogo desde la base (siempre al día,
 *                            incluidos programas nuevos), cacheadas en el CDN.
 * React reemplaza el contenido al montar; los JSON-LD llevan data-seo-jsonld para que la app los actualice.
 */

const TYPE = { curso: 'Curso', especializacion: 'Especialización', certificacion: 'Certificación', bootcamp: 'Bootcamp', diplomado: 'Diplomado', 'programa-ejecutivo': 'Programa ejecutivo', maestria: 'Maestría', membresia: 'Membresía' };
const MODALITY = { 'en-vivo': 'Online en vivo', grabado: 'Online a tu ritmo', hibrido: 'Híbrido', presencial: 'Presencial' };
const COURSE_MODE = { 'en-vivo': 'online', grabado: 'online', hibrido: 'blended', presencial: 'onsite' };
const LEVEL = { basico: 'Básico', intermedio: 'Intermedio', avanzado: 'Avanzado' };
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (s, n) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : `${t.slice(0, n - 1).replace(/\s+\S*$/, '')}…`;
};
const money = (amount, currency) => (amount === 0 ? 'Gratis' : `${currency === 'USD' ? 'US$' : 'S/'} ${Number(amount).toLocaleString('en-US', Number.isInteger(Number(amount)) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const priceOf = (c) => (c.price == null ? null : c.discount_price ?? c.price);
const priceText = (c) => (priceOf(c) == null ? 'Precio a consultar' : money(priceOf(c), c.currency));
const dateText = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return m ? `${Number(m[3])} de ${MONTHS[Number(m[2]) - 1]} de ${m[1]}` : null;
};
const duration = (c) => c.duration_text || (c.duration_hours ? `${c.duration_hours} horas` : null);
const facts = (c) => [TYPE[c.program_type], MODALITY[c.modality], duration(c), priceText(c)].filter(Boolean).join(' · ');

/** Páginas que dependen del catálogo (en Vercel las sirve api/seo.ts). */
export const isCatalogPath = (path) => path === '/' || path === '/programas' || path === '/instituciones' || /^\/(programas|programa|institucion)\/[^/]+$/.test(path);

/**
 * Construye todas las páginas indexables.
 * @param {{courses: any[], institutions: any[], categories: any[]}} catalog
 * @param {{siteUrl: string, base?: string, ratings?: Map<string, {avg: number, count: number}>}} opts
 */
export function buildRoutes(catalog, { siteUrl, base = '', ratings = new Map() }) {
  const abs = (path) => `${siteUrl}${path === '/' ? '/' : path}`;
  const href = (path) => `${base}${path}`;
  const courses = catalog.courses.filter((c) => (c.status ?? 'publicado') === 'publicado');
  const instById = new Map(catalog.institutions.map((i) => [i.id, i]));
  const used = new Set(courses.map((c) => c.category));
  const categories = catalog.categories.filter((c) => used.has(c.id));
  const catById = new Map(catalog.categories.map((c) => [c.id, c]));
  const institutions = catalog.institutions.filter((i) => courses.some((c) => c.institution_id === i.id));
  const lastmodOf = (list) => list.map((c) => c.updated_at).filter(Boolean).sort().at(-1) ?? null;
  const siteLastmod = lastmodOf(courses);

  const breadcrumb = (items) => ({
    html: `<nav aria-label="Ruta"><ol>${items.map((it, i) => (i < items.length - 1 ? `<li><a href="${href(it.path)}">${esc(it.name)}</a></li>` : `<li aria-current="page">${esc(it.name)}</li>`)).join('')}</ol></nav>`,
    ld: { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.path) })) }
  });
  const itemList = (list) => ({ '@context': 'https://schema.org', '@type': 'ItemList', numberOfItems: list.length, itemListElement: list.map((c, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(`/programa/${c.slug}`), name: c.name })) });
  const courseItem = (c) => {
    const inst = instById.get(c.institution_id);
    return `<li><a href="${href(`/programa/${c.slug}`)}">${esc(c.name)}</a> — ${esc(inst?.name ?? '')}. ${esc(facts(c))}</li>`;
  };
  const organization = { '@context': 'https://schema.org', '@type': 'Organization', name: 'Groulevel', url: abs('/'), logo: `${siteUrl}/favicon.svg` };

  const routes = [];

  routes.push({
    path: '/', kind: 'catalog', lastmod: siteLastmod,
    title: 'Groulevel · Compara cursos, bootcamps y maestrías de tecnología en Perú',
    description: `Compara ${courses.length} programas de tecnología, datos e IA de ${institutions.length} instituciones: precios, duración, modalidad, fechas de inicio y opiniones. Analiza tu perfil gratis.`,
    jsonLd: [
      organization,
      { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Groulevel', url: abs('/'), inLanguage: 'es-PE', potentialAction: { '@type': 'SearchAction', target: `${abs('/programas')}?q={search_term_string}`, 'query-input': 'required name=search_term_string' } }
    ],
    body: `<h1>Encuentra la formación que te lleva al siguiente nivel</h1>
<p>Compara ${courses.length} cursos, bootcamps, diplomados y maestrías en tecnología de ${institutions.length} instituciones: precios, duración, modalidad y fechas de inicio en un solo lugar.</p>
<p><a href="${href('/programas')}">Ver todos los programas</a> · <a href="${href('/mi-ruta')}">Analiza mi perfil</a> · <a href="${href('/comparar')}">Comparar programas</a></p>
<h2>Áreas</h2><ul>${categories.map((c) => `<li><a href="${href(`/programas/${c.slug}`)}">Cursos de ${esc(c.name)}</a> (${courses.filter((x) => x.category === c.id).length})</li>`).join('')}</ul>
<h2>Instituciones</h2><ul>${institutions.map((i) => `<li><a href="${href(`/institucion/${i.slug}`)}">${esc(i.name)}</a></li>`).join('')}</ul>`
  });

  const bcPrograms = breadcrumb([{ name: 'Inicio', path: '/' }, { name: 'Programas', path: '/programas' }]);
  routes.push({
    path: '/programas', kind: 'catalog', lastmod: siteLastmod,
    title: 'Programas de tecnología, datos e IA: compara precios y duración | Groulevel',
    description: `Explora ${courses.length} programas de Data, IA, desarrollo de software, cloud, ciberseguridad, producto y negocios digitales. Filtra por precio, modalidad, duración y nivel.`,
    jsonLd: [bcPrograms.ld, itemList(courses.slice(0, 100))],
    body: `${bcPrograms.html}<h1>Programas de tecnología</h1>
<h2>Por área</h2><ul>${categories.map((c) => `<li><a href="${href(`/programas/${c.slug}`)}">${esc(c.name)}</a></li>`).join('')}</ul>
<h2>Todos los programas</h2><ul>${courses.map(courseItem).join('')}</ul>`
  });

  const bcInst = breadcrumb([{ name: 'Inicio', path: '/' }, { name: 'Instituciones', path: '/instituciones' }]);
  routes.push({
    path: '/instituciones', kind: 'catalog', lastmod: siteLastmod,
    title: 'Universidades, escuelas y bootcamps de tecnología | Groulevel',
    description: `Conoce ${institutions.length} universidades, escuelas de negocio, institutos y bootcamps con programas de tecnología, y compara su oferta.`,
    jsonLd: [bcInst.ld],
    body: `${bcInst.html}<h1>Instituciones</h1><ul>${institutions.map((i) => `<li><a href="${href(`/institucion/${i.slug}`)}">${esc(i.name)}</a> — ${courses.filter((c) => c.institution_id === i.id).length} programas</li>`).join('')}</ul>`
  });

  for (const cat of categories) {
    const list = courses.filter((c) => c.category === cat.id);
    const bc = breadcrumb([{ name: 'Inicio', path: '/' }, { name: 'Programas', path: '/programas' }, { name: cat.name, path: `/programas/${cat.slug}` }]);
    const prices = list.map(priceOf).filter((p) => p != null && p > 0);
    routes.push({
      path: `/programas/${cat.slug}`, kind: 'catalog', lastmod: lastmodOf(list),
      title: `Cursos de ${cat.name} en Perú: ${list.length} programas comparados | Groulevel`,
      description: clip(`Compara ${list.length} cursos, bootcamps, diplomados y maestrías de ${cat.name}: precios, duración, modalidad, inicio y certificación. ${cat.description ?? ''}`, 300),
      jsonLd: [bc.ld, itemList(list)],
      body: `${bc.html}<h1>Cursos y programas de ${esc(cat.name)}</h1><p>${esc(cat.description ?? '')}</p>
<p>${list.length} programas de ${new Set(list.map((c) => c.institution_id)).size} instituciones${prices.length ? `, desde ${esc(money(Math.min(...prices), 'PEN'))}` : ''}.</p>
<ul>${list.map(courseItem).join('')}</ul>
<h2>Otras áreas</h2><ul>${categories.filter((c) => c.id !== cat.id).map((c) => `<li><a href="${href(`/programas/${c.slug}`)}">${esc(c.name)}</a></li>`).join('')}</ul>`
    });
  }

  for (const c of courses) {
    const inst = instById.get(c.institution_id);
    const cat = catById.get(c.category);
    const items = [{ name: 'Inicio', path: '/' }, { name: 'Programas', path: '/programas' }];
    if (cat) items.push({ name: cat.name, path: `/programas/${cat.slug}` });
    items.push({ name: c.name, path: `/programa/${c.slug}` });
    const bc = breadcrumb(items);
    const price = priceOf(c);
    const rating = ratings.get(c.id) ?? (c.rating != null && c.reviews_count ? { avg: c.rating, count: c.reviews_count } : null);
    const start = dateText(c.start_date) ?? c.start_text;
    const details = [
      ['Institución', inst ? `<a href="${href(`/institucion/${inst.slug}`)}">${esc(inst.name)}</a>` : null],
      ['Tipo', esc(TYPE[c.program_type] ?? c.published_type ?? '')],
      ['Modalidad', esc(MODALITY[c.modality] ?? '')],
      ['Duración', esc(duration(c) ?? '')],
      ['Inicio', esc(start ?? '')],
      ['Horario', esc(c.schedule ?? '')],
      ['Precio', esc(priceText(c)) + (c.discount_price != null && c.price != null && c.discount_price < c.price ? ` (precio regular ${esc(money(c.price, c.currency))})` : '')],
      ['Financiamiento', c.financing?.installments ? esc(`Hasta ${c.financing.installments} cuotas${c.financing.installment_amount ? ` de ${money(c.financing.installment_amount, c.currency)}` : ''}`) : null],
      ['Certificado', esc(c.certificate?.description ?? '')],
      ['Nivel', esc(LEVEL[c.level] ?? '')]
    ].filter(([, v]) => v);
    const related = courses.filter((x) => x.category === c.category && x.id !== c.id).slice(0, 6);
    const instance = {
      '@type': 'CourseInstance',
      courseMode: COURSE_MODE[c.modality] ?? 'online',
      ...(c.duration_hours ? { courseWorkload: `PT${c.duration_hours}H` } : { courseWorkload: 'PT1H' }),
      ...(c.schedule ? { courseSchedule: { '@type': 'Schedule', description: c.schedule, ...(c.duration_weeks ? { duration: `P${c.duration_weeks}W` } : {}) } } : {}),
      ...(c.start_date ? { startDate: c.start_date } : {}),
      ...(c.teachers?.length ? { instructor: c.teachers.map((t) => ({ '@type': 'Person', name: t.name })) } : {})
    };
    routes.push({
      path: `/programa/${c.slug}`, kind: 'catalog', lastmod: c.updated_at ?? null,
      title: clip(`${c.name} · ${inst?.short_name ?? inst?.name ?? ''}`, 58) + ' | Groulevel',
      description: clip(`${c.name} de ${inst?.name ?? ''}: ${[MODALITY[c.modality], duration(c), priceText(c), start ? `inicio ${start}` : null].filter(Boolean).join(', ')}. ${c.short_description ?? ''}`, 300),
      image: c.image || null,
      jsonLd: [
        bc.ld,
        {
          '@context': 'https://schema.org',
          '@type': 'Course',
          name: c.name,
          description: clip(c.short_description || c.description, 500),
          url: abs(`/programa/${c.slug}`),
          inLanguage: c.language === 'Inglés' ? 'en' : 'es',
          ...(c.level && LEVEL[c.level] ? { educationalLevel: LEVEL[c.level] } : {}),
          ...(c.objectives?.length || c.skills?.length ? { teaches: (c.objectives?.length ? c.objectives : c.skills).slice(0, 10) } : {}),
          ...(c.certificate?.description ? { educationalCredentialAwarded: c.certificate.description } : {}),
          provider: { '@type': 'EducationalOrganization', name: inst?.name ?? '', ...(inst?.website ? { sameAs: inst.website } : {}) },
          offers: price != null
            ? { '@type': 'Offer', category: price === 0 ? 'Free' : 'Paid', price, priceCurrency: c.currency || 'PEN', url: abs(`/programa/${c.slug}`), availability: c.features?.enrollment_open === false ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock' }
            : { '@type': 'Offer', category: 'Paid', url: abs(`/programa/${c.slug}`) },
          hasCourseInstance: [instance],
          ...(rating ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: Number(rating.avg), reviewCount: rating.count, bestRating: 5, worstRating: 1 } } : {})
        }
      ],
      body: `${bc.html}<h1>${esc(c.name)}</h1>
<p>${esc(inst?.name ?? '')} · ${esc(facts(c))}</p>
${rating ? `<p>Valoración: ${Number(rating.avg).toFixed(1)} de 5 (${rating.count} ${rating.count === 1 ? 'reseña' : 'reseñas'})</p>` : ''}
<dl>${details.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
<p>${esc(c.description)}</p>
${c.target_audience ? `<h2>¿Para quién es?</h2><p>${esc(c.target_audience)}</p>` : ''}
${c.objectives?.length ? `<h2>Lo que aprenderás</h2><ul>${c.objectives.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}
${c.syllabus?.length ? `<h2>Temario</h2><ol>${c.syllabus.map((m) => `<li>${esc(m.title)}${m.hours ? ` (${m.hours} h)` : ''}</li>`).join('')}</ol>` : ''}
${c.tools?.length ? `<h2>Herramientas</h2><p>${c.tools.map(esc).join(', ')}</p>` : ''}
${c.requirements?.length ? `<h2>Requisitos</h2><ul>${c.requirements.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
${related.length ? `<h2>Programas similares de ${esc(cat?.name ?? '')}</h2><ul>${related.map(courseItem).join('')}</ul>` : ''}`
    });
  }

  for (const i of institutions) {
    const list = courses.filter((c) => c.institution_id === i.id);
    const bc = breadcrumb([{ name: 'Inicio', path: '/' }, { name: 'Instituciones', path: '/instituciones' }, { name: i.name, path: `/institucion/${i.slug}` }]);
    routes.push({
      path: `/institucion/${i.slug}`, kind: 'catalog', lastmod: lastmodOf(list),
      title: clip(`${i.name}: ${list.length} cursos y programas`, 58) + ' | Groulevel',
      description: clip(`Programas de ${i.name} en tecnología y negocios: precios, duración, modalidad y fechas de inicio. ${i.description ?? ''}`, 300),
      jsonLd: [
        bc.ld,
        { '@context': 'https://schema.org', '@type': 'EducationalOrganization', name: i.name, ...(i.website ? { url: i.website, sameAs: i.website } : {}), ...(i.city || i.country ? { address: { '@type': 'PostalAddress', ...(i.city ? { addressLocality: i.city } : {}), ...(i.country ? { addressCountry: i.country } : {}) } } : {}), ...(i.founded ? { foundingDate: String(i.founded) } : {}), description: clip(i.description, 500) },
        itemList(list)
      ],
      body: `${bc.html}<h1>${esc(i.name)}</h1><p>${esc(i.description)}</p><h2>Programas (${list.length})</h2><ul>${list.map(courseItem).join('')}</ul>`
    });
  }

  return routes;
}

/** Páginas fijas (no dependen del catálogo). */
export function staticRoutes(base = '') {
  return [
    { path: '/comparar', title: 'Comparador de programas de tecnología | Groulevel', description: 'Compara hasta 3 programas de tecnología lado a lado: precio, duración, modalidad, certificación, docentes y financiamiento.', body: `<h1>Comparador de programas</h1><p>Elige hasta 3 programas y compáralos lado a lado.</p><p><a href="${base}/programas">Explorar programas</a></p>` },
    { path: '/instituciones/partners', title: 'Para instituciones: publica tus programas | Groulevel', description: 'Publica tus programas de tecnología en Groulevel y recibe leads calificados con Signal Score™, visibilidad destacada y métricas de interés.', body: '<h1>Conecta tus programas con profesionales que están buscando dónde estudiar</h1>' },
    { path: '/nosotros', title: 'Nosotros | Groulevel', description: 'Elegir dónde aprender tecnología no debería ser complicado. Groulevel hace más transparente y eficiente la decisión de formación profesional.', body: `<h1>Elegir dónde aprender tecnología no debería ser complicado</h1><p><a href="${base}/programas">Ver programas</a></p>` },
    { path: '/mi-ruta', title: 'Analiza tu perfil gratis: brecha, salario y qué estudiar | Groulevel', description: 'Sube tu CV, indica el rol al que quieres llegar y recibe un diagnóstico exigente: habilidades, puestos sugeridos, brecha, salario referencial y qué estudiar.', body: `<h1>Analiza tu perfil, descubre tu brecha</h1><p>Sube tu CV o describe tu perfil y el rol al que quieres llegar.</p><p><a href="${base}/programas">Ver programas</a></p>` },
    { path: '/favoritos', index: false, title: 'Mis favoritos | Groulevel', description: 'Tus programas guardados.', body: '<h1>Mis favoritos</h1>' }
  ];
}

/** Inserta título, metadatos, canonical, JSON-LD y contenido en la plantilla de la app. */
export function renderPage(template, route, siteUrl) {
  const url = `${siteUrl}${route.path === '/' ? '/' : route.path}`;
  const image = route.image && /^https?:\/\//.test(route.image) ? route.image : `${siteUrl}/og-image.png`;
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(route.title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(route.description)}" />`)
    .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(route.title)}" />`)
    .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(route.description)}" />`)
    .replace(/<meta name="robots"[^>]*>\s*/g, '');
  const ld = (route.jsonLd ?? []).map((o) => `<script type="application/ld+json" data-seo-jsonld="true">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`);
  const extra = [
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta name="twitter:title" content="${esc(route.title)}" />`,
    `<meta name="twitter:description" content="${esc(route.description)}" />`,
    route.index === false ? '<meta name="robots" content="noindex, follow" />' : '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />',
    ...ld
  ].join('\n    ');
  html = html.replace('</head>', `    ${extra}\n  </head>`);
  // Contenido para buscadores y para quien llega antes de que cargue la app; React lo reemplaza al montar.
  return html.replace(/<div id="root">[\s\S]*?<\/div>\s*(?=<noscript|<script)/, `<div id="root"><main style="max-width:960px;margin:0 auto;padding:48px 16px;font-family:system-ui;color:#9DAABD;line-height:1.5">${route.body}</main></div>\n    `);
}

export function sitemapXml(routes, siteUrl) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .filter((r) => r.index !== false)
  .map((r) => `  <url><loc>${siteUrl}${r.path === '/' ? '/' : r.path}</loc>${r.lastmod ? `<lastmod>${String(r.lastmod).slice(0, 10)}</lastmod>` : ''}</url>`)
  .join('\n')}
</urlset>
`;
}
