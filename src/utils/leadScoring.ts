/**
 * Lead scoring — Signal Score™ (0–100).
 *
 * Totalmente desacoplado de la UI: la configuración (pesos y umbrales) vive en
 * DEFAULT_SCORING_CONFIG y puede reemplazarse (p. ej. cargándola desde un backend)
 * sin modificar componentes. `scoreLead` es una función pura.
 *
 * Señales:
 *  - Urgencia (¿cuándo quieres empezar?)        → hasta 40 pts
 *  - Objetivo declarado                          → hasta 25 pts
 *  - Comportamiento (comparó, vio varios programas, origen) → hasta 20 pts
 *  - Calidad de contacto (WhatsApp válido, email corporativo) → hasta 15 pts
 *
 * Tiers (brand system): HIGH INTENT 80–100 · WARM 60–79 · NURTURE 40–59 · LOW 0–39.
 * Segmento CRM: HIGH INTENT → hot · WARM → warm · NURTURE/LOW → cold.
 */
import type { LeadFormInput, LeadObjective, LeadScoreResult, LeadSegment, LeadSignals, LeadSource, SignalTier, StartTimeline } from '../types';

export interface ScoringConfig {
  timeline: Record<StartTimeline, number>;
  objective: Record<LeadObjective, number>;
  behavior: {
    comparedTwoOrMore: number;
    viewedThreeOrMore: number;
    source: Partial<Record<LeadSource, number>>;
    max: number;
  };
  contact: { whatsapp: number; corporateEmail: number; max: number };
  tiers: { tier: SignalTier; min: number; segment: LeadSegment }[];
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  timeline: { inmediato: 40, '30-dias': 30, '1-3-meses': 20, comparando: 5 },
  objective: {
    'cambiar-carrera': 25,
    'cambiar-trabajo': 22,
    'primer-empleo-tech': 20,
    'mejorar-trabajo-actual': 18,
    'actualizar-conocimientos': 12,
    emprender: 12
  },
  behavior: {
    comparedTwoOrMore: 10,
    viewedThreeOrMore: 5,
    source: { comparador: 5, ruta: 5, detalle: 3 },
    max: 20
  },
  contact: { whatsapp: 10, corporateEmail: 5, max: 15 },
  tiers: [
    { tier: 'HIGH_INTENT', min: 80, segment: 'hot' },
    { tier: 'WARM', min: 60, segment: 'warm' },
    { tier: 'NURTURE', min: 40, segment: 'cold' },
    { tier: 'LOW', min: 0, segment: 'cold' }
  ]
};

export const TIMELINE_OPTIONS: { value: StartTimeline; label: string }[] = [
  { value: 'inmediato', label: 'Inmediatamente' },
  { value: '30-dias', label: 'Durante los próximos 30 días' },
  { value: '1-3-meses', label: 'Entre 1 y 3 meses' },
  { value: 'comparando', label: 'Solo estoy comparando opciones' }
];

export const OBJECTIVE_OPTIONS: { value: LeadObjective; label: string }[] = [
  { value: 'mejorar-trabajo-actual', label: 'Mejorar en mi trabajo actual' },
  { value: 'cambiar-trabajo', label: 'Cambiar de trabajo' },
  { value: 'cambiar-carrera', label: 'Cambiar de carrera' },
  { value: 'primer-empleo-tech', label: 'Conseguir mi primer empleo en tecnología' },
  { value: 'emprender', label: 'Emprender' },
  { value: 'actualizar-conocimientos', label: 'Actualizar mis conocimientos' }
];

export const TIER_LABELS: Record<SignalTier, string> = {
  HIGH_INTENT: 'High intent',
  WARM: 'Warm',
  NURTURE: 'Nurture',
  LOW: 'Low'
};

const FREE_EMAIL = /@(gmail|hotmail|outlook|yahoo|live|icloud|proton(mail)?)\./i;

export function scoreLead(
  input: Pick<LeadFormInput, 'start_timeline' | 'objective' | 'whatsapp' | 'email'>,
  signals: LeadSignals,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG
): LeadScoreResult {
  const breakdown: LeadScoreResult['breakdown'] = [];

  const timeline = config.timeline[input.start_timeline] ?? 0;
  breakdown.push({ label: 'Urgencia de inicio', points: timeline });

  const objective = config.objective[input.objective] ?? 0;
  breakdown.push({ label: 'Objetivo declarado', points: objective });

  let behavior = 0;
  if (signals.compared_programs >= 2) behavior += config.behavior.comparedTwoOrMore;
  if (signals.viewed_programs >= 3) behavior += config.behavior.viewedThreeOrMore;
  behavior += config.behavior.source[signals.source] ?? 0;
  behavior = Math.min(behavior, config.behavior.max);
  breakdown.push({ label: 'Señales de comportamiento', points: behavior });

  let contact = 0;
  if (input.whatsapp.replace(/\D/g, '').length >= 9) contact += config.contact.whatsapp;
  if (input.email.includes('@') && !FREE_EMAIL.test(input.email)) contact += config.contact.corporateEmail;
  contact = Math.min(contact, config.contact.max);
  breakdown.push({ label: 'Calidad de contacto', points: contact });

  const score = Math.max(0, Math.min(100, Math.round(timeline + objective + behavior + contact)));
  const { tier, segment } = classify(score, config);
  return { score, tier, segment, breakdown };
}

export function classify(score: number, config: ScoringConfig = DEFAULT_SCORING_CONFIG): { tier: SignalTier; segment: LeadSegment } {
  const match = [...config.tiers].sort((a, b) => b.min - a.min).find((t) => score >= t.min) ?? config.tiers[config.tiers.length - 1];
  return { tier: match.tier, segment: match.segment };
}
