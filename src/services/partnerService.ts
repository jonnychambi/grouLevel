/** Leads B2B (instituciones interesadas). Misma estrategia que LeadService: local hoy, API mañana. */
import { STORAGE_KEYS, storage } from './storage';
import { getAttribution } from './attribution';
import { uid } from '../utils/format';

export interface PartnerRequest {
  institution: string;
  contact_name: string;
  email: string;
  phone: string;
  institution_type: string;
  programs_count: string;
  intent: 'publicar' | 'reunion';
  message: string;
}

export async function submitPartnerRequest(req: PartnerRequest) {
  const endpoint = import.meta.env.VITE_PARTNER_API_URL as string | undefined;
  const record = { ...req, id: uid('partner'), created_at: new Date().toISOString(), ...getAttribution() };
  if (endpoint) {
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record) });
    if (!res.ok) throw new Error('No pudimos enviar tu solicitud.');
  } else {
    await new Promise((r) => setTimeout(r, 600));
    const key = `${STORAGE_KEYS.leads}:partners`;
    storage.set(key, [...storage.get<unknown[]>(key, []), record]);
  }
  return record;
}
