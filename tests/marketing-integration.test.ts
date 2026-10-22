import { beforeEach, describe, it, expect, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import type { Bundle, Job } from '@/lib/marketing/types';
import { fakeFirestore } from './marketing-fake-store';
import { calendarSlots, initialBrand } from '@/lib/marketing/domain';
const mocks = vi.hoisted(() => ({
  context: undefined as unknown,
  flush: vi.fn(),
  draft: vi.fn(),
  image: vi.fn(),
  speak: vi.fn(),
  save: vi.fn(),
  assetData: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/marketing/auth', () => ({ requireOwner: async () => mocks.context }));
vi.mock('@/lib/server/marketing/tasks', () => ({ flushOutbox: mocks.flush }));
vi.mock('@/lib/server/marketing/config', () => ({
  requireGeneration: () => {},
  marketingConfig: () => ({ enabled: true, missing: [] }),
}));
vi.mock('@/lib/server/marketing/providers', () => ({
  draftContent: mocks.draft,
  createImage: mocks.image,
  speak: mocks.speak,
  proposePlan: vi.fn(),
}));
vi.mock('@/lib/server/marketing/assets', () => ({
  saveAsset: mocks.save,
  assetData: mocks.assetData,
  assetUrl: vi.fn(),
}));
import { createDailyBundle, handleMarketing } from '@/lib/server/marketing/api';
import { runJob } from '@/lib/server/marketing/runner';
import { reserve, read, jobId } from '@/lib/server/marketing/store';
const renderer = vi.fn(),
  probe = vi.fn();
function setup() {
  const fake = fakeFirestore(),
    c = { db: fake.db as unknown as Firestore, uid: 'owner' };
  mocks.context = c;
  return { ...fake, c };
}
const req = (body: unknown) =>
  new Request('https://app.test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.flush.mockResolvedValue({ enqueued: 1 });
  renderer.mockResolvedValue({
    video: Buffer.from('verified-mp4-fixture'),
    srt: '1\n00:00:00,000 --> 00:00:10,000\nTest',
  });
});
describe('server Marketing workflow without paid services', () => {
  it('can load and save a persisted brand repeatedly without sending storage metadata', async () => {
    const { docs } = setup();
    const original = { ...initialBrand(), approved: true, revision: 3 };
    docs.set('users/owner/marketingBrand/profile', { ...original, updatedAt: '2026-10-22' });
    const loaded = await (await handleMarketing(new Request('https://app.test'), ['brand'])).json();
    expect(loaded).toEqual(original);
    const save = (body: unknown) =>
      handleMarketing(
        new Request('https://app.test', {
          method: 'PATCH',
          body: JSON.stringify(body),
        }),
        ['brand'],
      );
    const first = await save(loaded);
    expect(first.status).toBe(200);
    const saved = await first.json();
    expect(saved.brand.revision).toBe(4);
    expect((await save(saved.brand)).status).toBe(200);
    expect(docs.get('users/owner/marketingBrand/profile')?.revision).toBe(5);
    expect((await save(loaded)).status).toBe(409);
    expect((await save({ ...saved.brand, id: 'profile' })).status).toBe(422);
  });
  it('moves an unspent reservation into the actual charge month without bypassing its limit', async () => {
    const { c, docs } = setup(),
      job = {
        id: 'rollover',
        bundleId: 'b',
        stage: 'draft',
        revision: 0,
        state: 'queued',
        attempts: 0,
        leaseUntil: 0,
        sideEffect: false,
        error: '',
        createdAt: '',
      } as Job;
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-10-31T16:59:00Z'));
      await reserve(c, job);
      vi.setSystemTime(new Date('2026-10-31T17:01:00Z'));
      await reserve(c, job);
      expect(docs.get('users/owner/marketingBudget/2026-10')?.reserved).toBe(0);
      expect(docs.get('users/owner/marketingBudget/2026-11')?.reserved).toBe(15000);
      expect(docs.get('users/owner/marketingCosts/rollover')?.month).toBe('2026-11');
    } finally {
      vi.useRealTimers();
    }
  });
  it('approves selected plan items without approving missing titles elsewhere', async () => {
    const { c, docs } = setup(),
      items = calendarSlots('2026-10');
    items[0].title = 'Kiểm tra chữ ký số';
    docs.set('users/owner/marketingBrand/profile', { ...initialBrand(), approved: true });
    docs.set('users/owner/marketingPlans/2026-10', {
      id: '2026-10',
      month: '2026-10',
      revision: 0,
      approved: false,
      items,
    });
    const result = await handleMarketing(req({ revision: 0, itemIds: [items[0].id] }), [
      'plans',
      '2026-10',
      'approve',
    ]);
    expect(result.status).toBe(200);
    const plan = await read<import('@/lib/marketing/types').Plan>(c, 'marketingPlans', '2026-10');
    expect(plan?.items.filter((i) => i.approved)).toHaveLength(1);
    expect([...docs.keys()].filter((k) => k.includes('marketingApprovals/'))).toHaveLength(1);
  });
  it('discards a generated result when the plan was revised during the provider request', async () => {
    const { c, docs } = setup(),
      items = calendarSlots('2026-10'),
      item = items[0],
      plan = { id: '2026-10', month: '2026-10', revision: 1, approved: true, items };
    docs.set('users/owner/marketingBrand/profile', { ...initialBrand(), approved: true });
    docs.set('users/owner/marketingPlans/2026-10', plan);
    mocks.draft.mockImplementation(async () => {
      docs.set('users/owner/marketingPlans/2026-10', { ...plan, revision: 2 });
      return { draft: { title: 'result', claims: [] }, cost: 100 };
    });
    await createDailyBundle(c, item, plan);
    expect(await runJob(c, jobId(item.id, 0, 'draft'), renderer, probe)).toEqual({
      state: 'stale',
    });
    expect((await read<Bundle>(c, 'marketingBundles', item.id))?.state).toBe('stale');
    expect(docs.has('users/owner/marketingJobs/' + jobId(item.id, 0, 'image'))).toBe(false);
  });
  it('quarantines an interrupted paid stage instead of invoking the provider again', async () => {
    const { c, docs } = setup(),
      items = calendarSlots('2026-10'),
      item = items[0],
      plan = { id: '2026-10', month: '2026-10', revision: 1, approved: true, items };
    docs.set('users/owner/marketingPlans/2026-10', plan);
    await createDailyBundle(c, item, plan);
    const id = jobId(item.id, 0, 'draft'),
      path = 'users/owner/marketingJobs/' + id;
    docs.set(path, {
      ...docs.get(path),
      state: 'running',
      sideEffect: true,
      leaseUntil: Date.now() - 10000,
    });
    await runJob(c, id, renderer, probe);
    expect(docs.get(path)?.state).toBe('uncertain');
    expect((await read<Bundle>(c, 'marketingBundles', item.id))?.state).toBe('uncertain');
    expect(mocks.draft).not.toHaveBeenCalled();
  });
  it('runs a bundle through script and final approvals before ZIP export', async () => {
    const { c, docs } = setup(),
      items = calendarSlots('2026-10'),
      item = items[0],
      plan = { id: '2026-10', month: '2026-10', revision: 1, approved: true, items };
    docs.set('users/owner/marketingBrand/profile', { ...initialBrand(), approved: true });
    docs.set('users/owner/marketingPlans/2026-10', plan);
    mocks.draft.mockResolvedValue({
      draft: {
        title: 'Kiến thức thực tế',
        captions: {
          facebook: 'Bài FB',
          zalo: 'Bài Zalo',
          tiktok: 'Mô tả TikTok',
          youtube: 'Mô tả YouTube',
        },
        imagePrompt: 'illustration',
        script: 'Lời đọc',
        scenes: [{ text: 'Lời đọc' }],
        claims: [],
        style: 'knowledge',
      },
      cost: 100,
    });
    mocks.image.mockResolvedValue({
      buffer: Buffer.from('png'),
      contentType: 'image/png',
      cost: 1500,
    });
    mocks.speak.mockResolvedValue(Buffer.from('wave'));
    const assets = new Map<
      string,
      { data: Buffer; asset: { bundleId: string; contentType: string } }
    >();
    let n = 0;
    mocks.save.mockImplementation(async (_c, id, _kind, type, bytes) => {
      const assetId = 'asset-' + ++n;
      assets.set(assetId, { data: bytes, asset: { bundleId: id, contentType: type } });
      return assetId;
    });
    mocks.assetData.mockImplementation(async (_c, id) => assets.get(id));
    await createDailyBundle(c, item, plan);
    await createDailyBundle(c, item, plan);
    expect([...docs.keys()].filter((k) => k.includes('/marketingJobs/'))).toHaveLength(1);
    await runJob(c, jobId(item.id, 0, 'draft'), renderer, probe);
    await runJob(c, jobId(item.id, 0, 'image'), renderer, probe);
    let b = (await read<Bundle>(c, 'marketingBundles', item.id))!;
    expect(b.imageId).toBeTruthy();
    expect(b.videoId).toBeNull();
    expect(
      (await handleMarketing(req({ revision: 0 }), ['bundles', item.id, 'approve'])).status,
    ).toBe(503);
    expect(
      (await handleMarketing(req({ revision: 0 }), ['bundles', item.id, 'approve-script'])).status,
    ).toBe(202);
    await runJob(c, jobId(item.id, 1, 'speech'), renderer, probe);
    await runJob(c, jobId(item.id, 1, 'render'), renderer, probe);
    b = (await read<Bundle>(c, 'marketingBundles', item.id))!;
    expect(b.videoId).toBeTruthy();
    expect(b.approvedRevision).toBeNull();
    expect(
      (await handleMarketing(req({ revision: 1 }), ['bundles', item.id, 'approve'])).status,
    ).toBe(200);
    expect(
      (await handleMarketing(req({ revision: 1 }), ['bundles', item.id, 'export'])).status,
    ).toBe(202);
    await runJob(c, jobId(item.id, 1, 'export'), renderer, probe);
    b = (await read<Bundle>(c, 'marketingBundles', item.id))!;
    expect(b.exportId).toBeTruthy();
    const zip = assets.get(b.exportId!)!.data;
    expect(zip.includes(Buffer.from('facebook.txt'))).toBe(true);
    expect(zip.includes(Buffer.from('video.mp4'))).toBe(true);
    expect(zip.includes(Buffer.from('subtitles.srt'))).toBe(true);
    await runJob(c, jobId(item.id, 0, 'draft'), renderer, probe);
    expect(mocks.draft).toHaveBeenCalledTimes(1);
  });
  it('serializes reservations so concurrent jobs cannot exceed the monthly cap', async () => {
    const { c } = setup();
    const job = (id: string) =>
      ({
        id,
        bundleId: 'b',
        revision: 0,
        stage: 'draft',
        state: 'queued',
        attempts: 0,
        leaseUntil: 0,
        sideEffect: false,
        error: '',
        createdAt: '',
      }) as Job;
    const results = await Promise.allSettled(
      Array.from({ length: 70 }, (_, i) => reserve(c, job('job' + i))),
    );
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(66);
    expect(results.filter((x) => x.status === 'rejected')).toHaveLength(4);
    await reserve(c, job('job0')); // Same request never holds the money twice.
  });
  it('does not reissue a paid request after an uncertain response', async () => {
    const { c, docs } = setup(),
      items = calendarSlots('2026-10'),
      item = items[1],
      plan = { id: '2026-10', month: '2026-10', revision: 1, approved: true, items };
    docs.set('users/owner/marketingBrand/profile', { ...initialBrand(), approved: true });
    docs.set('users/owner/marketingPlans/2026-10', plan);
    mocks.draft.mockRejectedValue(new Error('marketing_provider_uncertain'));
    await createDailyBundle(c, item, plan);
    const id = jobId(item.id, 0, 'draft');
    expect(await runJob(c, id, renderer, probe)).toEqual({ state: 'uncertain' });
    await runJob(c, id, renderer, probe);
    expect(mocks.draft).toHaveBeenCalledTimes(1);
    expect(docs.get('users/owner/marketingCosts/' + id)?.state).toBe('uncertain');
  });
});
