import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { fakeFirestore } from './marketing-fake-store';
vi.mock('server-only', () => ({}));
import { createImage } from '@/lib/server/marketing/providers';
import { prepareExecution } from '@/lib/server/ai-settings/execution';
import { saveCredential, deleteCredential } from '@/lib/server/ai-settings/credentials';
import type { Job } from '@/lib/marketing/types';
beforeEach(() => {
  vi.stubEnv('AI_SETTINGS_ENCRYPTION_KEY', Buffer.alloc(32, 8).toString('base64'));
  vi.stubEnv('MARKETING_GEMINI_KEY', 'legacy-env-key');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
async function setup() {
  const fake = fakeFirestore(),
    c = { db: fake.db as unknown as Firestore, uid: 'owner' };
  await saveCredential(c, 'new-private-app-key', 0);
  const job = { id: 'image-job', stage: 'image' } as Job;
  fake.docs.set('users/owner/marketingJobs/image-job', { ...job });
  const selection = await prepareExecution(c, job);
  return { c, selection };
}
it('uses the encrypted application credential and validated model instead of the old env key', async () => {
  const { c, selection } = await setup();
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      Response.json({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    data: Buffer.from('unit-image').toString('base64'),
                    mimeType: 'image/png',
                  },
                },
              ],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokensDetails: [{ modality: 'IMAGE', tokenCount: 1120 }],
        },
      }),
    );
  vi.stubGlobal('fetch', fetchMock);
  const result = await createImage('test image', c, selection);
  expect(fetchMock.mock.calls[0][0]).toContain('gemini-3.1-flash-lite-image');
  expect(fetchMock.mock.calls[0][1].headers['x-goog-api-key']).toBe('new-private-app-key');
  expect(result.cost).toBeGreaterThan(0);
});
it('does not issue a request or fall back to env after the key was deleted', async () => {
  const { c, selection } = await setup();
  await deleteCredential(c, 1);
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  await expect(createImage('test image', c, selection)).rejects.toThrow(
    'marketing_credential_changed',
  );
  expect(fetchMock).not.toHaveBeenCalled();
});
