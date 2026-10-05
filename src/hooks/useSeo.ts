import { useEffect } from 'react';
import { SITE } from '../config/site';

export interface SeoOptions {
  title?: string;
  description?: string;
  /** Ruta relativa a la app (sin base). Ej: "/programa/x". */
  path?: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
  noindex?: boolean;
  jsonLd?: object | object[];
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

export function absoluteUrl(path = '/') {
  return `${SITE.url}${path === '/' ? '/' : path}`;
}

/** Title dinámico, meta description, canonical, Open Graph, Twitter y Schema.org JSON-LD. */
export function useSeo({ title, description = SITE.description, path, image, type = 'website', noindex, jsonLd }: SeoOptions) {
  const ld = jsonLd ? JSON.stringify(jsonLd) : '';
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE.name}` : `${SITE.name} · Compara programas de tecnología`;
    document.title = fullTitle;
    const url = absoluteUrl(path ?? window.location.pathname.replace(import.meta.env.BASE_URL.replace(/\/$/, ''), '') ?? '/');
    const img = image ?? `${SITE.url}/og-image.png`;

    setMeta('name', 'description', description);
    setMeta('name', 'robots', noindex ? 'noindex, follow' : 'index, follow');
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', img);
    setMeta('property', 'og:site_name', SITE.name);
    setMeta('property', 'og:locale', SITE.locale);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', description);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = url;

    document.head.querySelectorAll('script[data-seo-jsonld]').forEach((s) => s.remove());
    if (ld) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.dataset.seoJsonld = 'true';
      script.textContent = ld;
      document.head.appendChild(script);
    }
  }, [title, description, path, image, type, noindex, ld]);
}
