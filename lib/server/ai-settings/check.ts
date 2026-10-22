import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Context } from '../marketing/store';
import { selectModel } from '../../ai-settings/catalog';
import { credentialRef, readCredential, resolveCredential } from './credentials';
// A metadata GET only; no prompt, generateContent, TTS, tools or paid probe.
// Validates metadata access, not successful text/image generation.
export async function checkCredential(c: Context, revision: number) {
  const value = await readCredential(c);
  if (value.revision !== revision) throw new Error('ai_revision_conflict');
  if (!value.configured) throw new Error('ai_credential_missing');
  // Operator verification is required before enabling even metadata traffic.
  if (process.env.AI_SETTINGS_METADATA_CHECK_VERIFIED !== 'true')
    throw new Error('ai_check_needs_confirmation');
  if (value.source !== 'app') throw new Error('ai_environment_check_requires_app_key');
  const choice = selectModel('text');
  if (!choice) throw new Error('ai_catalog_unverified');
  const { key } = await resolveCredential(c, revision),
    ref = credentialRef(c),
    attempt = randomUUID();
  await c.db.runTransaction(async (tx) => {
    const record = (await tx.get(ref)).data();
    if (!record || record.deleted || record.revision !== revision)
      throw new Error('ai_revision_conflict');
    tx.update(ref, {
      checkAttempt: attempt,
      check: { state: 'checking', checkedAt: new Date().toISOString(), code: null, scope: null },
    });
  });
  let code: string | null = null;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(choice.model)}`,
      {
        method: 'GET',
        headers: { 'x-goog-api-key': key },
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(
        response.status >= 500 || response.status === 429
          ? 'ai_provider_unavailable'
          : 'ai_provider_rejected',
      );
    }
    const data = await response.json();
    if (
      data?.name !== `models/${choice.model}` ||
      !Array.isArray(data.supportedGenerationMethods) ||
      !data.supportedGenerationMethods.includes('generateContent')
    )
      throw new Error('ai_metadata_invalid');
  } catch (error) {
    const raw = error instanceof Error ? error.message : '';
    code = ['ai_provider_unavailable', 'ai_provider_rejected', 'ai_metadata_invalid'].includes(raw)
      ? raw
      : error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)
        ? 'ai_check_timeout'
        : 'ai_provider_unavailable';
  }
  await c.db.runTransaction(async (tx) => {
    const record = (await tx.get(ref)).data();
    if (
      !record ||
      record.deleted ||
      record.revision !== revision ||
      record.checkAttempt !== attempt
    )
      throw new Error('ai_revision_conflict');
    tx.update(ref, {
      check: {
        state: code ? 'error' : 'valid',
        checkedAt: new Date().toISOString(),
        code,
        scope: 'metadata',
      },
    });
  });
  if (code) throw new Error(code);
}
