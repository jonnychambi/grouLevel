/** Tipos del modelo SEO compartido (ver seoModel.mjs). */
export interface ContentSection { h2: string; p?: string[]; ul?: string[]; ol?: string[]; table?: { head: string[]; rows: string[][] }; note?: string }
interface ContentBase { slug: string; title: string; description: string; h1: string; intro: string; sections: ContentSection[]; skills?: string[]; careers?: string[]; comparisons?: string[]; guides?: string[] }
export interface Career extends ContentBase { name: string; categories?: string[] }
export interface Skill extends ContentBase { name: string; match: string[]; categories?: string[]; related?: string[]; courseIntro: string }
export interface Comparison extends ContentBase { catalog?: { label: string; type?: string; career?: string; match?: string[] }[] }
export interface Guide extends ContentBase {}
type C = { id: string; name: string; slug: string; institution_id: string; category: string; program_type: string; modality: string | null; status?: string; featured?: boolean; completeness?: number; price: number | null; discount_price: number | null; currency: string; duration_hours: number | null; start_date: string | null; tools?: string[]; keywords?: string[]; subcategory?: string | null; published_type?: string | null };
export interface Stats {
  count: number; institutions: number; live: number; noPrice: number;
  pricePEN: { min: number; max: number; median: number; n: number } | null;
  hours: { min: number; max: number; median: number; n: number } | null;
  modalities: Record<string, number>; types: Record<string, number>; nextStart: string | null;
}
export const CAREERS: Career[];
export const SKILLS: Skill[];
export const COMPARISONS: Comparison[];
export const GUIDES: Guide[];
export const MIN: { skill: number; typeArea: number; institutions: number };
export const CONTENT_UPDATED: string;
export const TYPE_PATHS: Record<'diplomado' | 'bootcamp' | 'maestria' | 'especializacion', string>;
export const TYPE_BY_PATH: Record<string, string>;
export function careerPath(slug: string): string;
export function skillPath(slug: string): string;
export function coursesPath(slug: string): string;
export function comparisonPath(slug: string): string;
export function guidePath(slug: string): string;
export function typeAreaPath(type: string, areaSlug: string): string;
export const careerBySlug: Map<string, Career>;
export const skillBySlug: Map<string, Skill>;
export const comparisonBySlug: Map<string, Comparison>;
export const guideBySlug: Map<string, Guide>;
export function isContentPath(path: string): boolean;
export function normalize(s: string): string;
export function rankCourses<T extends C>(list: T[]): T[];
export function matchesPatterns(patterns: string[], course: C): boolean;
export function matchesSkill(skill: Skill, course: C): boolean;
export function coursesForSkill<T extends C>(skill: Skill, courses: T[]): T[];
export function coursesForCareer<T extends C>(career: Career, courses: T[]): T[];
export function skillLandings<T extends C>(courses: T[]): { skill: Skill; courses: T[] }[];
export function typeAreaLandings<T extends C, K extends { id: string; slug: string; name: string }>(courses: T[], categories: K[]): { type: string; category: K; courses: T[] }[];
export function stats(list: C[], today?: string): Stats;
export function faqFor(label: string, st: Stats, institutionNames?: string[]): { q: string; a: string }[];
export function comparisonStats(comparison: Comparison, courses: C[]): (Stats & { label: string })[];
type Meta = { title: string; description: string };
export const HUB_META: { carreras: Meta; habilidades: Meta; cursos: { title: string }; guias: Meta; analizar: Meta };
export function coursesHubDescription(landings: { skill: Skill }[]): string;
export function skillLandingMeta(skill: Skill, st: Stats): Meta;
export { TYPE_PLURAL, TYPE_SINGULAR, fitTitle, typeHubMeta, typeAreaMeta } from './meta.mjs';
