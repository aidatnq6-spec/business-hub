import 'server-only';
import { ZodError } from 'zod';
import { requireOwner } from '../marketing/auth';
import type { Context } from '../marketing/store';
import {
  credentialInput,
  credentialRevisionInput,
  budgetInput,
  type SettingsView,
} from '../../ai-settings/types';
import { readCredential, saveCredential, deleteCredential } from './credentials';
import { readBudget, updateBudget } from './budget';
import { requireOrigin, readBody, rateLimit } from './guard';
import { checkCredential } from './check';
import { encryptionReady } from './crypto';
import { selectModel, type Capability } from '../../ai-settings/catalog';
import { marketingReadiness } from '../marketing/config';
const statuses: Record<string, number> = {
  marketing_unauthorized: 401,
  marketing_forbidden: 403,
  ai_origin_forbidden: 403,
  ai_input_invalid: 422,
  ai_content_type_invalid: 415,
  ai_body_too_large: 413,
  ai_rate_limited: 429,
  ai_revision_conflict: 409,
  marketing_revision_conflict: 409,
  ai_budget_below_committed: 409,
  ai_credential_missing: 409,
  ai_encryption_unavailable: 503,
  ai_credential_unreadable: 503,
  ai_check_needs_confirmation: 503,
  ai_environment_check_requires_app_key: 409,
  ai_catalog_unverified: 503,
  ai_provider_unavailable: 503,
  ai_provider_rejected: 422,
  ai_metadata_invalid: 502,
  ai_check_timeout: 504,
  ai_not_found: 404,
};
const response = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
export async function settingsView(c: Context): Promise<SettingsView> {
  const [credential, budget, runtime] = await Promise.all([
    readCredential(c),
    readBudget(c),
    marketingReadiness(c),
  ]);
  const capabilities: SettingsView['capabilities'] = (
    ['text', 'image', 'speech', 'render'] as Capability[]
  ).map((id) => {
    const selection = selectModel(id),
      reasons: string[] = [];
    if (!selection) reasons.push('ai_catalog_unverified');
    if (id === 'text' || id === 'image') {
      if (!credential.configured) reasons.push('ai_credential_missing');
      if (credential.source === 'app' && !encryptionReady())
        reasons.push('ai_encryption_unavailable');
      if (credential.check.state !== 'valid') reasons.push('ai_connection_unchecked');
      if (process.env.AI_SETTINGS_METADATA_CHECK_VERIFIED !== 'true')
        reasons.push('ai_check_needs_confirmation');
      if (id === 'image') reasons.push('ai_image_generation_unchecked');
    }
    if (
      id === 'speech' &&
      (!process.env.MARKETING_TTS_VOICE || process.env.MARKETING_TTS_VOICE_APPROVED !== 'true')
    )
      reasons.push('ai_voice_not_approved');
    if (
      id === 'render' &&
      (!process.env.MARKETING_WORKER_URL ||
        !process.env.MARKETING_BUCKET ||
        !process.env.MARKETING_QUEUE ||
        !process.env.MARKETING_TASK_SA)
    )
      reasons.push('ai_worker_required');
    return {
      id,
      state: reasons.includes('ai_credential_missing')
        ? 'missing'
        : reasons.length
          ? 'unchecked'
          : 'ready',
      reasons,
      ...(selection ? { selection } : {}),
    };
  });
  return {
    credential,
    budget,
    capabilities,
    activation: {
      desired: process.env.MARKETING_GENERATION_ENABLED === 'true',
      effective: runtime.enabled && runtime.generationEnabled && runtime.missing.length === 0,
      reasons: [
        ...(!encryptionReady() ? ['ai_encryption_unavailable'] : []),
        ...(!runtime.enabled || !runtime.generationEnabled
          ? ['ai_activation_requires_approval']
          : []),
        ...runtime.missing,
        ...capabilities.flatMap((capability) => capability.reasons),
      ],
    },
  };
}
export async function handleAiSettings(request: Request, path: string[] = []): Promise<Response> {
  try {
    const c = await requireOwner(request),
      method = request.method,
      route = path.join('/');
    if (method === 'GET' && !route) return response(await settingsView(c));
    const supported =
      (route === 'credential' && ['PUT', 'DELETE'].includes(method)) ||
      (route === 'credential/check' && method === 'POST') ||
      (route === 'budget' && method === 'PATCH');
    if (!supported) throw new Error('ai_not_found');
    requireOrigin(request);
    await rateLimit(c, route === 'credential/check' ? 'check' : 'mutation');
    const body = await readBody(request);
    if (route === 'credential' && method === 'PUT') {
      const v = credentialInput.parse(body);
      await saveCredential(c, v.key, v.revision);
    } else if (route === 'credential' && method === 'DELETE') {
      const v = credentialRevisionInput.parse(body);
      await deleteCredential(c, v.revision);
    } else if (route === 'credential/check') {
      const v = credentialRevisionInput.parse(body);
      await checkCredential(c, v.revision);
    } else {
      const v = budgetInput.parse(body);
      await updateBudget(c, v.monthlyLimit, v.revision);
    }
    return response(await settingsView(c));
  } catch (error) {
    const code =
      error instanceof ZodError
        ? 'ai_input_invalid'
        : error instanceof Error && statuses[error.message]
          ? error.message
          : 'ai_server_unavailable';
    return response({ error: code }, statuses[code] ?? 503);
  }
}
