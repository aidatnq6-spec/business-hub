import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import type { Job } from '@/lib/marketing/types';
import { fakeFirestore } from './marketing-fake-store';
const mocks = vi.hoisted(() => ({ resolve: vi.fn(), model: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/ai-settings/credentials', () => ({ resolveCredential: mocks.resolve }));
vi.mock('@/lib/ai-settings/catalog', () => ({ selectModel: mocks.model }));
import { prepareExecution, executionKey } from '@/lib/server/ai-settings/execution';
beforeEach(() => {
  vi.resetAllMocks();
  mocks.resolve.mockResolvedValue({ key: 'private-test-key', revision: 2, source: 'app' });
  mocks.model.mockImplementation((capability: string) => ({
    capability,
    provider: 'gemini',
    model: 'validated-model',
    priceVersion: 'price-v1',
    prices: { inputUsdPerMillion: 0.25, outputUsdPerMillion: 1.5 },
  }));
});
function setup(stage = 'draft') {
  const fake = fakeFirestore(),
    c = { db: fake.db as unknown as Firestore, uid: 'owner' };
  const job = { id: 'job', stage } as Job;
  fake.docs.set('users/owner/marketingJobs/job', { ...job });
  return { ...fake, c, job };
}
describe('Marketing execution settings snapshots', () => {
  it('records model and credential revisions without persisting plaintext', async () => {
    const { c, job, docs } = setup();
    const selection = await prepareExecution(c, job);
    expect(selection).toMatchObject({
      credentialRevision: 2,
      model: 'validated-model',
      priceVersion: 'price-v1',
    });
    expect(JSON.stringify([...docs.values()])).not.toContain('private-test-key');
    expect(await executionKey(c, selection)).toBe('private-test-key');
    expect(mocks.resolve).toHaveBeenLastCalledWith(c, 2);
  });
  it('rejects changed credentials rather than silently switching a queued execution', async () => {
    const { c, job, docs } = setup();
    docs.set('users/owner/marketingJobs/job', {
      ...job,
      execution: {
        capability: 'text',
        credentialRevision: 1,
        model: 'validated-model',
        priceVersion: 'price-v1',
      },
    });
    await expect(prepareExecution(c, job)).rejects.toThrow('marketing_credential_changed');
  });
  it('rejects models without verified prices', async () => {
    const { c, job } = setup();
    mocks.model.mockReturnValue(null);
    await expect(prepareExecution(c, job)).rejects.toThrow('marketing_price_unknown');
    expect(mocks.resolve).not.toHaveBeenCalled();
  });
  it.each(['render', 'export', 'probe'])(
    'does not resolve a Gemini credential for %s',
    async (stage) => {
      const { c, job } = setup(stage);
      expect(await prepareExecution(c, job)).toBeNull();
      expect(mocks.resolve).not.toHaveBeenCalled();
    },
  );
  it('does not resolve a Gemini key for speech', async () => {
    const { c, job } = setup('speech');
    const selection = await prepareExecution(c, job);
    expect(selection?.capability).toBe('speech');
    expect(mocks.resolve).not.toHaveBeenCalled();
  });
});
