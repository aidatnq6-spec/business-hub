import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { fakeFirestore } from './marketing-fake-store';
vi.mock('server-only', () => ({}));
import { requireGeneration } from '@/lib/server/marketing/config';
import { saveCredential, credentialRef } from '@/lib/server/ai-settings/credentials';
import { settingsView } from '@/lib/server/ai-settings/api';
beforeEach(() => {
  for (const name of [
    'MARKETING_ENABLED',
    'MARKETING_GENERATION_ENABLED',
    'AI_SETTINGS_ACTIVATION_APPROVED',
  ])
    vi.stubEnv(name, 'true');
  for (const name of [
    'MARKETING_QUEUE',
    'MARKETING_WORKER_URL',
    'MARKETING_TASK_SA',
    'MARKETING_BUCKET',
  ])
    vi.stubEnv(name, 'configured');
  vi.stubEnv('MARKETING_PRICES_VALID_UNTIL', '2026-11-20');
  vi.stubEnv('MARKETING_TTS_VOICE', 'vi-VN-Neural2-A');
  vi.stubEnv('MARKETING_TTS_VOICE_APPROVED', 'true');
  vi.stubEnv('AI_SETTINGS_ENCRYPTION_KEY', Buffer.alloc(32, 3).toString('base64'));
  vi.stubEnv('MARKETING_GEMINI_KEY', '');
});
afterEach(() => vi.unstubAllEnvs());
function setup() {
  const f = fakeFirestore();
  return { ...f, c: { db: f.db as unknown as Firestore, uid: 'owner' } };
}
it('requires a checked, decryptable key for paid Gemini tasks', async () => {
  const { c } = setup();
  await saveCredential(c, 'unit-private-key', 0);
  await expect(requireGeneration(c, 'draft')).rejects.toThrow('marketing_not_ready');
  await credentialRef(c).update({
    check: { state: 'valid', checkedAt: '2026-10-22', scope: 'metadata', code: null },
  });
  await expect(requireGeneration(c, 'draft')).resolves.toBeUndefined();
  vi.stubEnv('AI_SETTINGS_ENCRYPTION_KEY', Buffer.alloc(32, 4).toString('base64'));
  await expect(requireGeneration(c, 'draft')).rejects.toThrow('marketing_not_ready');
});
it('does not require a Gemini key for non-Gemini worker stages', async () => {
  const { c } = setup();
  for (const stage of ['render', 'export', 'probe'] as const)
    await expect(requireGeneration(c, stage)).resolves.toBeUndefined();
  await expect(requireGeneration(c, 'draft')).rejects.toThrow('marketing_not_ready');
});
it('keeps UI effective activation consistent with the shared runtime approval gate', async () => {
  const { c } = setup();
  await saveCredential(c, 'unit-private-key', 0);
  await credentialRef(c).update({
    check: { state: 'valid', checkedAt: '2026-10-22', scope: 'metadata', code: null },
  });
  expect((await settingsView(c)).activation.effective).toBe(true);
  vi.stubEnv('AI_SETTINGS_ACTIVATION_APPROVED', 'false');
  expect((await settingsView(c)).activation.effective).toBe(false);
  await expect(requireGeneration(c, 'draft')).rejects.toThrow('marketing_not_ready');
});
