export type InstitutionGroupId = 'universidades' | 'especializadas';
export function institutionGroup(i: { type?: string | null; name?: string | null }): InstitutionGroupId;
export const INSTITUTION_GROUPS: { id: InstitutionGroupId; title: string; description: string }[];
