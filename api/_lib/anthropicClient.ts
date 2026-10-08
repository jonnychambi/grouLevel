/**
 * Cliente de Claude compartido. Si la API key no pertenece a un workspace de Anthropic, la API exige el
 * header anthropic-workspace-id: se toma de ANTHROPIC_WORKSPACE_ID (opcional).
 */
import Anthropic from '@anthropic-ai/sdk';

export function anthropicClient(opts: { timeout: number; maxRetries: number }): Anthropic {
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  return new Anthropic({ ...opts, ...(workspace ? { defaultHeaders: { 'anthropic-workspace-id': workspace } } : {}) });
}

/** Mensaje entendible para el administrador a partir de un error de la API. */
export function aiErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/anthropic-workspace-id|not scoped to a workspace/i.test(msg)) {
    return 'La API key de Anthropic no pertenece a un workspace. Crea la key dentro de un workspace en console.anthropic.com, o agrega en Vercel la variable ANTHROPIC_WORKSPACE_ID con el ID del workspace, y vuelve a publicar.';
  }
  if (/401|invalid x-api-key|authentication/i.test(msg)) return 'La API key de Anthropic no es válida. Revísala en Vercel (ANTHROPIC_API_KEY).';
  if (/credit balance|billing/i.test(msg)) return 'La cuenta de Anthropic no tiene saldo. Recarga créditos en console.anthropic.com.';
  if (/429|rate limit/i.test(msg)) return 'Se alcanzó el límite de uso de la API. Reintenta en unos minutos.';
  if (/model/i.test(msg) && /not.?found|404/i.test(msg)) return 'El modelo configurado no está disponible para esta cuenta.';
  return msg.length > 300 ? `${msg.slice(0, 300)}…` : msg;
}
