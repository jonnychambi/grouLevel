/** Constructores de Schema.org (JSON-LD). */
import { SITE } from '../config/site';
import type { CourseWithInstitution, Institution } from '../types';
import { effectivePrice } from './format';
import { MODALITY_LABELS } from './labels';

const abs = (path: string) => `${SITE.url}${path}`;

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.name,
    url: abs('/'),
    potentialAction: {
      '@type': 'SearchAction',
      target: `${abs('/programas')}?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.path) }))
  };
}

export function courseSchema(c: CourseWithInstitution) {
  const modeMap = { 'en-vivo': 'online', grabado: 'online', hibrido: 'blended', presencial: 'onsite' } as const;
  const price = effectivePrice(c);
  const hours = c.duration_hours;
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: c.name,
    description: c.short_description,
    url: abs(`/programa/${c.slug}`),
    inLanguage: c.language === 'Inglés' ? 'en' : 'es',
    ...(c.level ? { educationalLevel: c.level } : {}),
    ...(c.objectives.length || c.skills.length ? { teaches: c.objectives.length ? c.objectives : c.skills } : {}),
    ...(hours ? { timeRequired: `PT${hours}H` } : {}),
    provider: { '@type': 'EducationalOrganization', name: c.institution.name, sameAs: c.institution.website },
    ...(price != null
      ? { offers: { '@type': 'Offer', category: price === 0 ? 'Free' : 'Paid', price, priceCurrency: c.currency, url: c.url } }
      : {}),
    hasCourseInstance: {
      '@type': 'CourseInstance',
      ...(c.modality ? { courseMode: modeMap[c.modality], description: MODALITY_LABELS[c.modality] } : {}),
      ...(c.schedule ? { courseSchedule: { '@type': 'Schedule', description: c.schedule } } : {}),
      ...(c.start_date ? { startDate: c.start_date } : {}),
      ...(c.teachers.length ? { instructor: c.teachers.map((t) => ({ '@type': 'Person', name: t.name })) } : {})
    },
    ...(c.rating != null && c.reviews_count ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: c.rating, reviewCount: c.reviews_count } } : {})
  };
}

export function organizationSchema(i: Institution) {
  return {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: i.name,
    url: i.website,
    address: { '@type': 'PostalAddress', addressLocality: i.city, addressCountry: i.country },
    foundingDate: String(i.founded),
    description: i.description
  };
}

export function itemListSchema(courses: CourseWithInstitution[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: courses.map((c, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(`/programa/${c.slug}`), name: c.name }))
  };
}
