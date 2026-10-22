import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { fakeFirestore } from './marketing-fake-store';
vi.mock('server-only', () => ({}));
import { checkCredential } from '@/lib/server/ai-settings/check';
import {
  saveCredential,
  deleteCredential,
  readCredential,
} from '@/lib/server/ai-settings/credentials';
beforeEach(() => {
  vi.stubEnv('AI_SETTINGS_METADATA_CHECK_VERIFIED', 'true');
  vi.stubEnv('AI_SETTINGS_ENCRYPTION_KEY', Buffer.alloc(32, 2).toString('base64'));
  vi.stubEnv('MARKETING_GEMINI_KEY', '');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function setup() {
  const fake = fakeFirestore();
  return { ...fake, c: { db: fake.db as unknown as Firestore, uid: 'owner' } };
}
it('checks only model metadata without sending a prompt or key in a URL', async () => {
  const { c } = setup();
  await saveCredential(c, 'unit-test-private-key', 0);
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      Response.json({
        name: 'models/gemini-3.1-flash-lite',
        supportedGenerationMethods: ['generateContent'],
      }),
    );
  vi.stubGlobal('fetch', fetchMock);
  await checkCredential(c, 1);
  expect(fetchMock.mock.calls[0][0]).not.toContain('unit-test-private-key');
  expect(fetchMock.mock.calls[0][0]).not.toContain('generateContent');
  expect(fetchMock.mock.calls[0][1]).toMatchObject({
    method: 'GET',
    headers: { 'x-goog-api-key': 'unit-test-private-key' },
    redirect: 'error',
  });
  expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
  expect((await readCredential(c)).check).toMatchObject({ state: 'valid', scope: 'metadata' });
});
it('does not allow a late check to validate a replaced credential', async () => {
  const { c } = setup();
  await saveCredential(c, 'original-test-private-key', 0);
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async () => {
      await saveCredential(c, 'replacement-test-private-key', 1);
      return Response.json({
        name: 'models/gemini-3.1-flash-lite',
        supportedGenerationMethods: ['generateContent'],
      });
    }),
  );
  await expect(checkCredential(c, 1)).rejects.toThrow('ai_revision_conflict');
  expect((await readCredential(c)).check.state).toBe('unchecked');
});
it('does not fetch after deletion or expose provider response bodies', async () => {
  const { c } = setup();
  await saveCredential(c, 'unit-test-private-key', 0);
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response('secret-reflected-provider-body', { status: 403 }));
  vi.stubGlobal('fetch', fetchMock);
  await expect(checkCredential(c, 1)).rejects.toThrow('ai_provider_rejected');
  expect(JSON.stringify(await readCredential(c))).not.toContain('secret-reflected');
  await deleteCredential(c, 1);
  fetchMock.mockClear();
  await expect(checkCredential(c, 2)).rejects.toThrow('ai_credential_missing');
  expect(fetchMock).not.toHaveBeenCalled();
});
it('sends no requests until the metadata check has been reviewed', async () => {
  const { c } = setup();
  await saveCredential(c, 'unit-test-key', 0);
  vi.stubEnv('AI_SETTINGS_METADATA_CHECK_VERIFIED', 'false');
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  await expect(checkCredential(c, 1)).rejects.toThrow('ai_check_needs_confirmation');
  expect(fetchMock).not.toHaveBeenCalled();
});
