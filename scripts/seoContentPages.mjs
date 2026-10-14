/**
 * Páginas SEO de orientación y transaccionales generadas a partir del contenido editorial (src/content) y del
 * catálogo vigente: carreras, habilidades, cursos por habilidad, tipo × área, comparaciones, guías y la
 * landing del analizador de perfil. Las usan api/seo.ts (Vercel) y el prerender del build (GitHub Pages).
 * Solo se generan páginas con contenido propio u oferta suficiente (ver MIN en seoModel.mjs).
 */
import {
  CAREERS, COMPARISONS, CONTENT_UPDATED, GUIDES, SKILLS, TYPE_PATHS, TYPE_PLURAL, careerBySlug, careerPath, comparisonPath, comparisonStats,
  HUB_META, TYPE_SINGULAR, coursesHubDescription, coursesForCareer, coursesForSkill, coursesPath, faqFor, fitTitle, skillLandingMeta, typeAreaMeta, typeHubMeta, guidePath, skillBySlug, skillLandings, skillPath, stats, typeAreaLandings, typeAreaPath
} from '../src/content/seoModel.mjs';
import { ANALYZER_SECTIONS } from '../src/content/analyzer.mjs';
import { typeHubCopy } from '../src/content/meta.mjs';

export { ANALYZER_SECTIONS };

const escHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const soles = (n) => `S/ ${Math.round(Number(n)).toLocaleString('en-US')}`;

export function sectionsHtml(sections = []) {
  return sections.map((s) => [
    `<h2>${escHtml(s.h2)}</h2>`,
    ...(s.p ?? []).map((t) => `<p>${escHtml(t)}</p>`),
    s.ul ? `<ul>${s.ul.map((t) => `<li>${escHtml(t)}</li>`).join('')}</ul>` : '',
    s.ol ? `<ol>${s.ol.map((t) => `<li>${escHtml(t)}</li>`).join('')}</ol>` : '',
    s.table ? `<table><thead><tr>${s.table.head.map((h) => `<th>${escHtml(h)}</th>`).join('')}</tr></thead><tbody>${s.table.rows.map((r) => `<tr>${r.map((c) => `<td>${escHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '',
    s.note ? `<p><em>${escHtml(s.note)}</em></p>` : ''
  ].join('')).join('\n');
}

const faqHtml = (faq) => (faq.length ? `<h2>Preguntas frecuentes</h2>${faq.map((f) => `<h3>${escHtml(f.q)}</h3><p>${escHtml(f.a)}</p>`).join('')}` : '');

/**
 * @param {object} ctx  helpers y datos de buildRoutes: courses, categories, instById, abs, href, breadcrumb, itemList, courseItem, lastmod, siteUrl
 */
export function buildContentRoutes(ctx) {
  const { courses, categories, instById, abs, href, breadcrumb, itemList, courseItem, lastmod } = ctx;
  const routes = [];
  const link = (path, text) => `<a href="${href(path)}">${escHtml(text)}</a>`;
  const article = (path, headline, description) => ({
    '@context': 'https://schema.org', '@type': 'Article', headline, description, inLanguage: 'es', dateModified: CONTENT_UPDATED, mainEntityOfPage: abs(path),
    author: { '@type': 'Organization', name: 'Groulevel', url: abs('/') }, publisher: { '@type': 'Organization', name: 'Groulevel', logo: { '@type': 'ImageObject', url: `${ctx.siteUrl}/favicon.svg` } }
  });
  const landings = skillLandings(courses);
  const landingBySkill = new Map(landings.map((l) => [l.skill.slug, l]));
  const typeAreas = typeAreaLandings(courses, categories);
  const instNames = (list) => [...new Set(list.map((c) => instById.get(c.institution_id)?.name).filter(Boolean))];
  const programList = (list, limit = 1000) => {
    const live = list.filter((c) => c.modality !== 'grabado').slice(0, limit);
    const rec = list.filter((c) => c.modality === 'grabado').slice(0, limit);
    return `${live.length ? `<ul>${live.map(courseItem).join('')}</ul>` : ''}${rec.length ? `<h3>Cursos grabados (a tu ritmo)</h3><ul>${rec.map(courseItem).join('')}</ul>` : ''}`;
  };
  const statsLine = (st) => [
    `${st.count} programas de ${st.institutions} instituciones`,
    st.pricePEN ? `precios publicados desde ${soles(st.pricePEN.min)}` : null,
    st.live ? `${st.live} con clases en vivo o presenciales` : null
  ].filter(Boolean).join(', ') + '.';
  const skillLinks = (slugs = []) => slugs.map((s) => skillBySlug.get(s)).filter(Boolean)
    .map((s) => `<li>${link(skillPath(s.slug), s.name)}${landingBySkill.has(s.slug) ? ` · ${link(coursesPath(s.slug), `cursos de ${s.name}`)}` : ''}</li>`).join('');
  const careerLinks = (slugs = []) => slugs.map((s) => careerBySlug.get(s)).filter(Boolean).map((c) => `<li>${link(careerPath(c.slug), c.h1)}</li>`).join('');
  const analyzerCta = (text, objective) => `<p>${link(`/analizar-perfil${objective ? `?objetivo=${encodeURIComponent(objective)}` : ''}`, text)} · ${link('/comparar', 'Comparar programas')}</p>`;

  /* ---------------------------- Carreras ---------------------------- */
  const bcCareers = breadcrumb([{ name: 'Inicio', path: '/' }, { name: 'Carreras', path: '/carreras' }]);
  routes.push({
    path: '/carreras', kind: 'content', lastmod: CONTENT_UPDATED,
    ...HUB_META.carreras,
    jsonLd: [bcCareers.ld],
    body: `${bcCareers.html}<h1>Carreras tecnológicas</h1><p>Conoce qué hace cada rol, qué habilidades pide y una ruta de aprendizaje para llegar. Después, analiza tu perfil para descubrir qué te falta.</p>
<ul>${CAREERS.map((c) => `<li>${link(careerPath(c.slug), c.h1)} — ${escHtml(c.description)}</li>`).join('')}</ul>${analyzerCta('Analiza tu perfil gratis')}`
  });
  for (const c of CAREERS) {
    const path = careerPath(c.slug);
    const related = coursesForCareer(c, courses).slice(0, 12);
    const bc = breadcrumb([{ name: 'Inicio', path: '/' }, { name: 'Carreras', path: '/carreras' }, { name: c.name, path }]);
    const comps = COMPARISONS.filter((x) => x.careers?.includes(c.slug));
    const guides = GUIDES.filter((x) => x.careers?.includes(c.slug));
    routes.push({
      path, kind: 'content', lastmod: CONTENT_UPDATED, title: fitTitle(c.title), description: c.description,
      jsonLd: [bc.ld, article(path, c.title, c.description), ...(related.length ? [itemList(related)] : [])],
      body: `${bc.html}<h1>${escHtml(c.h1)}</h1><p>${escHtml(c.intro)}</p>
${sectionsHtml(c.sections)}
<h2>Habilidades clave</h2><ul>${skillLinks(c.skills)}</ul>
${related.length ? `<h2>Programas relacionados</h2>${programList(related)}` : ''}
${comps.length || guides.length ? `<h2>Sigue leyendo</h2><ul>${[...comps.map((x) => `<li>${link(comparisonPath(x.slug), x.h1)}</li>`), ...guides.map((x) => `<li>${link(guidePath(x.slug), x.h1)}</li>`)].join('')}</ul>` : ''}
<h2>Descubre qué te falta para alcanzar este rol</h2>${analyzerCta('Analiza tu perfil gratis', `Quiero ser ${c.name}`)}<p><small>Contenido actualizado: ${CONTENT_UPDATED}.</small></p>`
    });
  }

  /* --------------------------- Habilidades --------------------------- */
  const bcSkills = breadcrumb([{ name: 'Inicio', path: '/' }, { name: 'Habilidades', path: '/habilidades' }]);
  routes.push({
    path: '/habilidades', kind: 'content', lastmod: CONTENT_UPDATED,
    ...HUB_META.habilidades,
    jsonLd: [bcSkills.ld],
    body: `${bcSkills.html}<h1>Habilidades tecnológicas</h1><p>Qué es cada habilidad, para qué sirve, qué perfiles la usan y dónde aprenderla.</p>
<ul>${SKILLS.map((s) => `<li>${link(skillPath(s.slug), s.h1)} — ${escHtml(s.description)}</li>`).join('')}</ul>`
  });
  for (const s of SKILLS) {
    const path = skillPath(s.slug);
    const list = coursesForSkill(s, courses);
    const bc = breadcrumb([{ name: 'Inicio', path: '/' }, { name: 'Habilidades', path: '/habilidades' }, { name: s.name, path }]);
    routes.push({
      path, kind: 'content', lastmod: CONTENT_UPDATED, title: fitTitle(s.title), description: s.description,
      jsonLd: [bc.ld, article(path, s.title, s.description)],
      body: `${bc.html}<h1>${escHtml(s.h1)}</h1><p>${escHtml(s.intro)}</p>
${sectionsHtml(s.sections)}
<h2>Perfiles que usan ${escHtml(s.name)}</h2><ul>${careerLinks(s.careers)}</ul>
${list.length ? `<h2>Programas para aprender ${escHtml(s.name)}</h2><p>${escHtml(statsLine(stats(list)))}</p>${programList(list.slice(0, 12))}${landingBySkill.has(s.slug) ? `<p>${link(coursesPath(s.slug), `Ver y comparar todos los cursos de ${s.name}`)}</p>` : ''}` : `<p>Por ahora hay poca oferta específica de ${escHtml(s.name)} en el catálogo.</p>`}
${s.related?.length ? `<h2>Habilidades relacionadas</h2><ul>${skillLinks(s.related)}</ul>` : ''}`
    });
  }

  /* ------------------------ Cursos por habilidad ------------------------ */
  const bcCursos = breadcrumb([{ name: 'Inicio', path: '/' }, { name: 'Cursos', path: '/cursos' }]);
  routes.push({
    path: '/cursos', kind: 'content', lastmod,
    title: HUB_META.cursos.title, description: coursesHubDescription(landings),
    jsonLd: [bcCursos.ld],
    body: `${bcCursos.html}<h1>Cursos de tecnología por habilidad</h1><p>Elige la habilidad que quieres aprender y compara los programas que la enseñan: precio, duración, modalidad, institución y contenido. Solo listamos habilidades con oferta suficiente para comparar.</p><ul>${landings.map((l) => `<li>${link(coursesPath(l.skill.slug), `Cursos de ${l.skill.name}`)} (${l.courses.length})</li>`).join('')}</ul>
<p>${link('/programas', 'Ver todos los programas')}</p>`
  });
  for (const { skill: s, courses: list } of landings) {
    const path = coursesPath(s.slug);
    const st = stats(list);
    const bc = breadcrumb([{ name: 'Inicio', path: '/' }, { name: 'Cursos', path: '/cursos' }, { name: s.name, path }]);
    routes.push({
      path, kind: 'catalog', lastmod: ctx.lastmodOf(list),
      ...skillLandingMeta(s, st),
      jsonLd: [bc.ld, itemList(list)],
      body: `${bc.html}<h1>Cursos de ${escHtml(s.name)}</h1><p>${escHtml(s.courseIntro)}</p><p>${escHtml(statsLine(st))}</p>
${programList(list)}
${faqHtml(faqFor(s.name, st, instNames(list)))}
<h2>Antes de elegir</h2><ul><li>${link(skillPath(s.slug), `Qué es ${s.name} y cómo aprenderlo`)}</li>${careerLinks(s.careers)}</ul>
${analyzerCta('Analiza tu perfil y descubre qué te falta')}`
    });
  }

  /* --------------------------- Tipo × área --------------------------- */
  for (const [type, seg] of Object.entries(TYPE_PATHS)) {
    const mine = typeAreas.filter((l) => l.type === type);
    const all = courses.filter((c) => (c.status ?? 'publicado') === 'publicado' && c.program_type === type);
    if (all.length < 3) continue;
    const bcHub = breadcrumb([{ name: 'Inicio', path: '/' }, { name: TYPE_PLURAL[type], path: `/${seg}` }]);
    const st = stats(all);
    routes.push({
      path: `/${seg}`, kind: 'catalog', lastmod: ctx.lastmodOf(all),
      ...typeHubMeta(type, st),
      jsonLd: [bcHub.ld, itemList(all)],
      body: `${bcHub.html}<h1>${escHtml(typeHubCopy(type).h1)}</h1><p>${escHtml(typeHubCopy(type).subtitle)}</p><p>${escHtml(statsLine(st))}</p><p><small>${escHtml(typeHubCopy(type).note)}</small></p>
${mine.length ? `<h2>Por área</h2><ul>${mine.map((l) => `<li>${link(typeAreaPath(type, l.category.slug), `${TYPE_PLURAL[type]} en ${l.category.name}`)} (${l.courses.length})</li>`).join('')}</ul>` : ''}
<h2>Todos los ${TYPE_PLURAL[type].toLowerCase()}</h2>${programList(all)}
${faqHtml(faqFor(TYPE_SINGULAR[type], st, instNames(all)))}`
    });
    for (const l of mine) {
      const path = typeAreaPath(type, l.category.slug);
      const st2 = stats(l.courses);
      const { label, ...meta } = typeAreaMeta(type, l.category, st2);
      const bc = breadcrumb([{ name: 'Inicio', path: '/' }, { name: TYPE_PLURAL[type], path: `/${seg}` }, { name: l.category.name, path }]);
      routes.push({
        path, kind: 'catalog', lastmod: ctx.lastmodOf(l.courses),
        ...meta,
        jsonLd: [bc.ld, itemList(l.courses)],
        body: `${bc.html}<h1>${escHtml(label)}</h1><p>${escHtml(l.category.description ?? '')}</p><p>${escHtml(statsLine(st2))}</p>
${programList(l.courses)}
${faqHtml(faqFor(`${TYPE_SINGULAR[type]} de ${l.category.name}`, st2, instNames(l.courses)))}
<p>${link(`/programas/${l.category.slug}`, `Todos los programas de ${l.category.name}`)} · ${link(`/${seg}`, `Todos los ${TYPE_PLURAL[type].toLowerCase()}`)}</p>
${analyzerCta('Analiza tu perfil gratis')}`
      });
    }
  }

  /* --------------------------- Comparaciones --------------------------- */
  for (const cmp of COMPARISONS) {
    const path = comparisonPath(cmp.slug);
    const rows = comparisonStats(cmp, courses);
    const bc = breadcrumb([{ name: 'Inicio', path: '/' }, { name: 'Guías', path: '/guias' }, { name: cmp.h1, path }]);
    const dataTable = rows.length ? `<h2>Lo que muestra el catálogo de Groulevel</h2><table><thead><tr><th></th><th>Programas</th><th>Instituciones</th><th>Precio mediano (S/)</th><th>Horas (mediana)</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${escHtml(r.label)}</td><td>${r.count}</td><td>${r.institutions}</td><td>${r.pricePEN ? soles(r.pricePEN.median) : 'Sin datos'}</td><td>${r.hours ? r.hours.median : 'Sin datos'}</td></tr>`).join('')}</tbody></table><p><small>Datos calculados con los programas publicados en Groulevel (${lastmod ?? CONTENT_UPDATED}). Solo se consideran precios publicados en soles.</small></p>` : '';
    routes.push({
      path, kind: 'content', lastmod: CONTENT_UPDATED, title: fitTitle(cmp.title), description: cmp.description,
      jsonLd: [bc.ld, article(path, cmp.title, cmp.description)],
      body: `${bc.html}<h1>${escHtml(cmp.h1)}</h1><p>${escHtml(cmp.intro)}</p>${sectionsHtml(cmp.sections)}${dataTable}
${cmp.skills?.length ? `<h2>Habilidades relacionadas</h2><ul>${skillLinks(cmp.skills)}</ul>` : ''}${cmp.careers?.length ? `<h2>Carreras relacionadas</h2><ul>${careerLinks(cmp.careers)}</ul>` : ''}
<h2>Encuentra el programa que mejor encaja contigo</h2>${analyzerCta('Analiza tu perfil gratis')}`
    });
  }

  /* ------------------------------ Guías ------------------------------ */
  const bcGuides = breadcrumb([{ name: 'Inicio', path: '/' }, { name: 'Guías', path: '/guias' }]);
  routes.push({
    path: '/guias', kind: 'content', lastmod: CONTENT_UPDATED,
    ...HUB_META.guias,
    jsonLd: [bcGuides.ld],
    body: `${bcGuides.html}<h1>Guías para decidir qué estudiar</h1>
<h2>Guías</h2><ul>${GUIDES.map((g) => `<li>${link(guidePath(g.slug), g.h1)} — ${escHtml(g.description)}</li>`).join('')}</ul>
<h2>Comparaciones</h2><ul>${COMPARISONS.map((c) => `<li>${link(comparisonPath(c.slug), c.h1)}</li>`).join('')}</ul>`
  });
  for (const g of GUIDES) {
    const path = guidePath(g.slug);
    const bc = breadcrumb([{ name: 'Inicio', path: '/' }, { name: 'Guías', path: '/guias' }, { name: g.h1, path }]);
    routes.push({
      path, kind: 'content', lastmod: CONTENT_UPDATED, title: fitTitle(g.title), description: g.description,
      jsonLd: [bc.ld, article(path, g.title, g.description)],
      body: `${bc.html}<h1>${escHtml(g.h1)}</h1><p>${escHtml(g.intro)}</p>${sectionsHtml(g.sections)}
${g.careers?.length ? `<h2>Carreras relacionadas</h2><ul>${careerLinks(g.careers)}</ul>` : ''}${g.skills?.length ? `<h2>Habilidades relacionadas</h2><ul>${skillLinks(g.skills)}</ul>` : ''}
${g.comparisons?.length ? `<h2>Comparaciones</h2><ul>${g.comparisons.map((s) => COMPARISONS.find((x) => x.slug === s)).filter(Boolean).map((x) => `<li>${link(comparisonPath(x.slug), x.h1)}</li>`).join('')}</ul>` : ''}
${analyzerCta('Analiza tu perfil gratis')}<p><small>Contenido actualizado: ${CONTENT_UPDATED}.</small></p>`
    });
  }

  /* ---------------------- Landing del analizador ---------------------- */
  const bcAn = breadcrumb([{ name: 'Inicio', path: '/' }, { name: 'Analizar perfil', path: '/analizar-perfil' }]);
  routes.push({
    path: '/analizar-perfil', kind: 'content', lastmod: CONTENT_UPDATED,
    ...HUB_META.analizar,
    jsonLd: [bcAn.ld],
    body: `${bcAn.html}<h1>Descubre qué habilidades necesitas para alcanzar tu próximo objetivo profesional</h1>
<p>Analiza tu experiencia, identifica tus brechas de habilidades y encuentra programas de formación alineados con tu carrera.</p>
<p>${link('/mi-ruta', 'Analizar mi perfil gratis')}</p>
<p>Sin registro y sin costo. El diagnóstico es privado: solo lo ves tú con tu enlace.</p>
${sectionsHtml(ANALYZER_SECTIONS)}`
  });

  return routes;
}
