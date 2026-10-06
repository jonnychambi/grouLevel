/**
 * "Mi ruta" — diagnóstico de perfil y ruta de formación.
 *
 *   POST /api/profile   multipart/form-data: cv (PDF/DOCX/TXT, opcional) | description, objective,
 *                       modality, budget_pen, hours_per_week, consent, contact_ok, website (trampa)
 *                       → 201 { profile }
 *   GET  /api/profile?id=prf_…  → { profile }   (enlace privado para volver a ver el resultado)
 *
 * Guarda el CV y los datos extraídos en Blob privado. Con ANTHROPIC_API_KEY el análisis lo hace Claude;
 * sin ella (o si falla) se usa el motor por reglas.
 */
import { json } from './_lib/http.js';
import { rateLimited } from './_lib/guard.js';
import { isStoreConfigured } from './_lib/store.js';
import { detectCvType, extractCvText } from './_lib/cvText.js';
import { newProfileId, readProfile, runAnalysis, saveProfile, toPublic, validateSubmission, type ProfileSubmission } from './_lib/profiles.js';
import { PROFILE_LIMITS } from '../src/utils/profileAnalysis.js';
import { mirror } from './_lib/db.js';
import { upsertProfile } from './_lib/dbSync.js';

export async function POST(request: Request): Promise<Response> {
  if (!isStoreConfigured()) return json(503, { error: 'store_not_configured', message: 'El diagnóstico no está disponible en este momento.' });
  if (rateLimited(request, 'profile', 6, 60 * 60_000)) return json(429, { error: 'rate_limited', message: 'Alcanzaste el límite de diagnósticos por hora. Inténtalo más tarde.' });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, { error: 'bad_request', message: 'Solicitud inválida.' });
  }
  const fields: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string') fields[k] = v;
  if (fields.website?.trim()) return json(201, { profile: null }); // bot

  const valid = validateSubmission(fields);
  const errors = valid.ok ? [] : [...valid.errors];

  let file: ProfileSubmission['file'] = null;
  let text = '';
  const upload = form.get('cv');
  if (upload && typeof upload !== 'string' && upload.size > 0) {
    if (upload.size > PROFILE_LIMITS.fileMaxBytes) errors.push('El CV supera los 4 MB.');
    else {
      const bytes = new Uint8Array(await upload.arrayBuffer());
      const type = detectCvType(bytes, upload.name);
      if (!type) errors.push('Formato no admitido. Sube tu CV en PDF, Word (.docx) o TXT.');
      else {
        try {
          text = (await extractCvText(bytes, type)).slice(0, PROFILE_LIMITS.textMax);
        } catch {
          if (type !== 'pdf') errors.push('No pudimos leer el archivo. Prueba con otro formato.');
        }
        file = { bytes, name: upload.name, type };
        // Un PDF escaneado (solo imagen) no tiene texto: lo puede leer la IA, pero no el motor por reglas.
        if (type !== 'pdf' && text.trim().length < 80) errors.push('El archivo no tiene texto suficiente.');
      }
    }
  }
  const description = (fields.description ?? '').trim();
  if (!file && description.length < PROFILE_LIMITS.descriptionMin) errors.push(`Sube tu CV o describe tu posición y formación (mínimo ${PROFILE_LIMITS.descriptionMin} caracteres).`);
  if (errors.length || !valid.ok) return json(422, { error: 'invalid', message: 'Revisa los datos del formulario.', errors });

  const submission: ProfileSubmission = {
    ...valid.value,
    source: file ? 'cv' : 'texto',
    // Si sube CV y además escribe contexto, ambos se analizan.
    text: [text, file && description ? `\nInformación adicional del usuario:\n${description}` : description && !file ? description : ''].filter(Boolean).join('\n'),
    file
  };
  const analysis = await runAnalysis(submission);
  const record = await saveProfile(newProfileId(), analysis, file);
  await mirror('profile', (sql) => upsertProfile(sql, record));
  return json(201, { profile: toPublic(record) });
}

export async function GET(request: Request): Promise<Response> {
  if (!isStoreConfigured()) return json(503, { error: 'store_not_configured' });
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!id) return json(400, { error: 'bad_request', message: 'Falta el id.' });
  if (rateLimited(request, 'profile-read', 60)) return json(429, { error: 'rate_limited' });
  const profile = await readProfile(id);
  return profile ? json(200, { profile: toPublic(profile) }) : json(404, { error: 'not_found', message: 'No encontramos este diagnóstico.' });
}
