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
  const modeMap = { 'en-vivo': 'online', grabado: 'online', hibrido: 'blended' } as const;
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: c.name,
    description: c.short_description,
    url: abs(`/programa/${c.slug}`),
    inLanguage: 'es',
    educationalLevel: c.level,
    teaches: c.skills,
    timeRequired: `PT${c.duration_hours}H`,
    provider: { '@type': 'EducationalOrganization', name: c.institution.name, sameAs: c.institution.website },
    offers: {
      '@type': 'Offer',
      category: effectivePrice(c) === 0 ? 'Free' : 'Paid',
      price: effectivePrice(c),
      priceCurrency: c.currency,
      availability: 'https://schema.org/InStock'
    },
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: modeMap[c.modality],
      courseSchedule: { '@type': 'Schedule', description: c.schedule },
      ...(c.start_date ? { startDate: c.start_date } : {}),
      description: MODALITY_LABELS[c.modality],
      instructor: c.teachers.map((t) => ({ '@type': 'Person', name: t.name, jobTitle: t.role }))
    },
    aggregateRating: { '@type': 'AggregateRating', ratingValue: c.rating, reviewCount: c.reviews_count }
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
