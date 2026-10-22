import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import type { Job } from '@/lib/marketing/types';
import { fakeFirestore } from './marketing-fake-store';
vi.mock('server-only', () => ({}));
import { readBudget, updateBudget } from '@/lib/server/ai-settings/budget';
import { reserve, settle } from '@/lib/server/marketing/store';
const job = (id: string) => ({ id, stage: 'draft' }) as Job;
function setup() {
  const fake = fakeFirestore();
  return { ...fake, c: { db: fake.db as unknown as Firestore, uid: 'owner' } };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-22T10:00:00Z'));
});
import { afterEach } from 'vitest';
afterEach(() => vi.useRealTimers());
describe('server-authoritative AI budget settings', () => {
  it('persists a user limit across reservations and defaults the next month to it', async () => {
    const { c, docs } = setup();
    expect((await readBudget(c)).limit).toBe(1000000);
    await updateBudget(c, 20000, 0);
    await reserve(c, job('one'));
    expect(await readBudget(c)).toMatchObject({
      limit: 20000,
      reserved: 15000,
      remaining: 5000,
      revision: 1,
    });
    await expect(reserve(c, job('two'))).rejects.toThrow('marketing_budget_exceeded');
    vi.setSystemTime(new Date('2026-11-01T02:00:00Z'));
    expect(await readBudget(c)).toMatchObject({ month: '2026-11', limit: 20000, reserved: 0 });
    await reserve(c, job('november'));
    expect(docs.get('users/owner/marketingBudget/2026-11')?.limit).toBe(20000);
  });
  it('never lowers a limit below committed costs or accepts an outdated revision', async () => {
    const { c } = setup();
    await reserve(c, job('one'));
    await expect(updateBudget(c, 14999, 0)).rejects.toThrow('ai_budget_below_committed');
    await updateBudget(c, 15000, 0);
    await expect(updateBudget(c, 20000, 0)).rejects.toThrow('marketing_revision_conflict');
    await settle(c, job('one'), 4000);
    await expect(updateBudget(c, 3999, 1)).rejects.toThrow('ai_budget_below_committed');
    await updateBudget(c, 4000, 1);
    expect(await readBudget(c)).toMatchObject({ spent: 4000, remaining: 0, warning: true });
  });
  it('zero blocks all paid reservations and unknown costs remain held', async () => {
    const { c } = setup();
    await updateBudget(c, 0, 0);
    await expect(reserve(c, job('blocked'))).rejects.toThrow('marketing_budget_exceeded');
    await updateBudget(c, 20000, 1);
    await reserve(c, job('unknown'));
    await settle(c, job('unknown'), null);
    expect((await readBudget(c)).reserved).toBe(15000);
    await expect(updateBudget(c, 0, 2)).rejects.toThrow('ai_budget_below_committed');
  });
  it('serializes a concurrent limit update and reservation without exceeding either limit', async () => {
    const { c } = setup();
    const results = await Promise.allSettled([
      updateBudget(c, 10000, 0),
      reserve(c, job('racing')),
    ]);
    const budget = await readBudget(c);
    expect(budget.spent + budget.reserved).toBeLessThanOrEqual(budget.limit);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });
  it('does not move an old uncertain charge into the new month or reset the configured cap', async () => {
    const { c } = setup();
    await updateBudget(c, 20000, 0);
    await reserve(c, job('old'));
    vi.setSystemTime(new Date('2026-11-01T02:00:00Z'));
    await settle(c, job('old'), 5000);
    expect(await readBudget(c)).toMatchObject({ spent: 0, reserved: 0, limit: 20000 });
    vi.setSystemTime(new Date('2026-10-22T10:00:00Z'));
    expect(await readBudget(c)).toMatchObject({ spent: 5000, reserved: 0, limit: 20000 });
  });
});
