export const REWARDS: { review: number; referral: number; maxPerProgram: number };
export const REWARDS_META: { title: string; description: string };
export const REWARDS_HERO: { eyebrow: string; h1: string; subtitle: string };
export const REWARDS_STEPS: { title: string; text: string }[];
export const REWARDS_RULES: string[];
export const REWARDS_FAQ: { q: string; a: string }[];
export function simulateRewards(reviews: number, referrals: number): { total: number; programs: number[] };
