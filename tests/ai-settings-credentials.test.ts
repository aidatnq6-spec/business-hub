import { afterEach, it, expect, vi } from 'vitest';
import type { Context } from '../lib/server/marketing/store';
import { fakeFirestore } from './marketing-fake-store';
vi.mock('server-only', () => ({}));
import {
  saveCredential,
  deleteCredential,
  readCredential,
  resolveCredential,
} from '../lib/server/ai-settings/credentials';
afterEach(() => vi.unstubAllEnvs());
it('stores only encrypted keys privately, rejects conflicts and prevents deleted env fallback', async () => {
  vi.stubEnv('AI_SETTINGS_ENCRYPTION_KEY', Buffer.alloc(32, 1).toString('base64'));
  vi.stubEnv('MARKETING_GEMINI_KEY', 'environment-only-test-secret');
  const fake = fakeFirestore(),
    c = { db: fake.db, uid: 'owner' } as unknown as Context;
  expect(await readCredential(c)).toMatchObject({ source: 'environment', revision: 0 });
  const saved = await saveCredential(c, 'new-private-secret', 0);
  expect(saved).toMatchObject({ source: 'app', revision: 1, check: { state: 'unchecked' } });
  expect(JSON.stringify(saved)).not.toContain('new-private');
  expect(JSON.stringify([...fake.docs])).not.toContain('new-private-secret');
  expect([...fake.docs.keys()].every((p) => p.startsWith('privateAi'))).toBe(true);
  expect(await resolveCredential(c, 1)).toMatchObject({ key: 'new-private-secret', revision: 1 });
  await expect(saveCredential(c, 'conflicting-secret', 0)).rejects.toThrow('ai_revision_conflict');
  expect((await resolveCredential(c)).key).toBe('new-private-secret');
  await deleteCredential(c, 1);
  expect(await readCredential(c)).toMatchObject({ configured: false, revision: 2, suffix: null });
  expect(fake.docs.get('privateAiCredentials/owner/providers/gemini')).not.toHaveProperty(
    'envelope',
  );
  await expect(resolveCredential(c)).rejects.toThrow('ai_credential_missing');
});
it('does not overwrite active record when master is missing and binds revision before dispatch', async () => {
  vi.stubEnv('AI_SETTINGS_ENCRYPTION_KEY', Buffer.alloc(32, 1).toString('base64'));
  const fake = fakeFirestore(),
    c = { db: fake.db, uid: 'owner' } as unknown as Context;
  await saveCredential(c, 'new-private-secret', 0);
  await expect(resolveCredential(c, 0)).rejects.toThrow('ai_revision_conflict');
  vi.stubEnv('AI_SETTINGS_ENCRYPTION_KEY', '');
  await expect(saveCredential(c, 'another-secret', 1)).rejects.toThrow('ai_encryption_unavailable');
  expect((await readCredential(c)).revision).toBe(1);
  const audits = [...fake.docs].filter(([p]) => p.startsWith('privateAiAudit'));
  expect(audits).toHaveLength(1);
  expect(JSON.stringify(audits)).not.toContain('suffix');
});
