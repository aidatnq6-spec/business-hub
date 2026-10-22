import { describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { telegramStore } from '@/lib/server/telegram-store';
import { REPORT_LEASE_MS } from '@/lib/telegram-job';

vi.mock('server-only', () => ({}));
function database() {
  const records = new Map<string, Record<string, unknown>>();
  const writes: string[] = [];
  interface TestSnapshot {
    exists: boolean;
    id: string;
    ref: TestDocument;
    data: () => Record<string, unknown> | undefined;
  }
  interface TestDocument {
    path: string;
    id: string;
    collection: (name: string) => TestCollection;
    get: () => Promise<TestSnapshot>;
  }
  interface TestCollection {
    doc: (id: string) => TestDocument;
    get: () => Promise<{ docs: TestSnapshot[] }>;
  }
  function document(path: string): TestDocument {
    return {
      path,
      id: path.split('/').at(-1)!,
      collection: (name: string) => collection(`${path}/${name}`),
      get: async () => ({
        exists: records.has(path),
        id: path.split('/').at(-1)!,
        ref: document(path),
        data: () => records.get(path),
      }),
    };
  }
  function collection(path: string): TestCollection {
    return {
      doc: (id: string) => document(`${path}/${id}`),
      get: async () => ({
        docs: await Promise.all(
          [...records.keys()]
            .filter(
              (key) => key.startsWith(path + '/') && !key.slice(path.length + 1).includes('/'),
            )
            .map((key) => document(key).get()),
        ),
      }),
    };
  }
  const db = {
    collection,
    runTransaction: async <T>(
      work: (tx: {
        get: (ref: ReturnType<typeof document>) => ReturnType<ReturnType<typeof document>['get']>;
        set: (ref: ReturnType<typeof document>, data: Record<string, unknown>) => void;
      }) => Promise<T>,
    ) => {
      const pending: (() => void)[] = [];
      const result = await work({
        get: (ref) => ref.get(),
        set: (ref, data) => {
          pending.push(() => {
            records.set(ref.path, data);
            writes.push(ref.path);
          });
        },
      });
      pending.forEach((save) => save());
      return result;
    },
  };
  return { db: db as unknown as Firestore, records, writes };
}
describe('Firestore Telegram journal and report data', () => {
  it('persists the daily lease, chunks, part acknowledgment and completed state', async () => {
    const fake = database();
    const store = telegramStore(fake.db, 'owner');
    const now = new Date('2026-10-22T00:00:00Z');
    expect((await store.claim('2026-10-22', 'a1', 'destination', now)).acquired).toBe(true);
    expect(await store.claim('2026-10-22', 'a2', 'destination', now)).toEqual({
      acquired: false,
      reason: 'busy',
    });
    await store.saveChunks('2026-10-22', 'a1', ['message'], now);
    await store.beginPart('2026-10-22', 'a1', 0, now);
    await store.confirmPart('2026-10-22', 'a1', 0, 42, now);
    expect(fake.records.get('users/owner/telegramReports/2026-10-22')).toMatchObject({
      status: 'sent',
      messageIds: [42],
      inFlight: null,
      nextPart: 1,
    });
    expect(await store.claim('2026-10-22', 'a3', 'destination', now)).toEqual({
      acquired: false,
      reason: 'sent',
    });
    expect(fake.writes.every((path) => path.startsWith('users/owner/'))).toBe(true);
  });
  it('fences a stale worker after its uncommitted lease has been taken over', async () => {
    const fake = database();
    const store = telegramStore(fake.db, 'owner');
    const now = new Date('2026-10-22T00:00:00Z');
    await store.claim('2026-10-22', 'old', 'destination', now);
    await store.claim(
      '2026-10-22',
      'new',
      'destination',
      new Date(now.getTime() + REPORT_LEASE_MS + 1),
    );
    await expect(store.saveChunks('2026-10-22', 'old', ['stale'], now)).rejects.toThrow(
      'report_lease_lost',
    );
  });
  it('retains uncertain stale deliveries instead of reclaiming them', async () => {
    const fake = database();
    const store = telegramStore(fake.db, 'owner');
    const now = new Date('2026-10-22T00:00:00Z');
    await store.claim('2026-10-22', 'old', 'destination', now);
    await store.saveChunks('2026-10-22', 'old', ['pending'], now);
    await store.beginPart('2026-10-22', 'old', 0, now);
    expect(
      await store.claim(
        '2026-10-22',
        'new',
        'destination',
        new Date(now.getTime() + REPORT_LEASE_MS + 1),
      ),
    ).toEqual({ acquired: false, reason: 'uncertain' });
    expect(fake.records.get('users/owner/telegramReports/2026-10-22')!.status).toBe('uncertain');
  });
  it('creates due recurring work once before loading real collections', async () => {
    const fake = database();
    fake.records.set('users/owner/recurringTasks/rt1', {
      taskText: 'Việc từ cloud',
      type: 'monthly',
      dayOfMonth: 22,
    });
    fake.records.set('users/owner/transactions/tx1', {
      desc: 'Thu thật',
      date: '2026-10-22',
      type: 'THU',
      amount: 123000,
    });
    fake.records.set('users/other/transactions/secret', {
      desc: 'Other account',
      date: '2026-10-22',
      thu: 999,
    });
    const store = telegramStore(fake.db, 'owner');
    const data = await store.prepareData('2026-10-22');
    expect(data.transactions).toHaveLength(1);
    expect(data.transactions[0].id).toBe('tx1');
    expect(data.todos).toMatchObject([{ id: 'recur_rt1_2026-10-22', text: 'Việc từ cloud' }]);
    expect(data.recurringRuns).toHaveLength(1);
    const writes = fake.writes.length;
    await store.prepareData('2026-10-22');
    expect(fake.writes).toHaveLength(writes);
    expect(fake.writes.every((path) => path.startsWith('users/owner/'))).toBe(true);
  });
  it('refuses malformed cloud data rather than falling back to fixtures', async () => {
    const fake = database();
    fake.records.set('users/owner/transactions/bad', { date: 'not-a-date' });
    await expect(telegramStore(fake.db, 'owner').prepareData('2026-10-22')).rejects.toThrow('bad');
  });
});
