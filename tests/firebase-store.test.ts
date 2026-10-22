import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { firebaseGateway } from '@/lib/firebase-store';
import { cloudRecord, COLLECTIONS, emptyData, OWNER_EMAIL } from '@/lib/cloud-data';
import { applyChange } from '@/lib/domain';

const store = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  listeners: new Map<
    string,
    { next: (snapshot: unknown) => void; error: (error: unknown) => void }
  >(),
  currentUser: { uid: 'owner-id', email: 'aidatnq6@gmail.com' } as {
    uid: string;
    email: string;
  } | null,
  batches: 0,
  failBatch: 0,
  writes: [] as string[],
  authNext: null as ((user: unknown) => void) | null,
  authLogin: vi.fn(),
  authLogout: vi.fn(),
}));
vi.mock('@/lib/firebase-client', () => ({ firebaseClient: () => ({ auth: store, db: {} }) }));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, next: (user: unknown) => void) => {
    store.authNext = next;
    return () => {
      store.authNext = null;
    };
  },
  signInWithEmailAndPassword: store.authLogin,
  signOut: store.authLogout,
}));
vi.mock('firebase/firestore', async (original) => {
  const actual = await original<typeof import('firebase/firestore')>();
  const snapshot = (path: string) => ({
    id: path.split('/').at(-1),
    exists: () => store.docs.has(path),
    data: () => store.docs.get(path),
  });
  const apply = (path: string, row: Record<string, unknown>, options?: { merge: boolean }) => {
    store.docs.set(path, options?.merge ? { ...store.docs.get(path), ...row } : row);
    store.writes.push(path);
  };
  return {
    Timestamp: actual.Timestamp,
    doc: (_db: unknown, ...segments: string[]) => segments.join('/'),
    collection: (_db: unknown, ...segments: string[]) => segments.join('/'),
    onSnapshot: (
      path: string,
      _options: unknown,
      next: (snapshot: unknown) => void,
      error: (error: unknown) => void,
    ) => {
      store.listeners.set(path, { next, error });
      return () => {
        store.listeners.delete(path);
      };
    },
    runTransaction: async (_db: unknown, callback: (tx: unknown) => Promise<void>) => {
      const operations: (() => void)[] = [];
      await callback({
        get: async (path: string) => snapshot(path),
        set: (path: string, row: Record<string, unknown>, options?: { merge: boolean }) =>
          operations.push(() => apply(path, row, options)),
        delete: (path: string) =>
          operations.push(() => {
            store.docs.delete(path);
            store.writes.push(path);
          }),
      });
      operations.forEach((operation) => operation());
    },
    writeBatch: () => {
      const operations: (() => void)[] = [];
      return {
        set: (path: string, row: Record<string, unknown>, options?: { merge: boolean }) =>
          operations.push(() => apply(path, row, options)),
        commit: async () => {
          store.batches++;
          if (store.batches === store.failBatch) throw new Error('connection lost');
          operations.forEach((operation) => operation());
        },
      };
    },
  };
});

beforeEach(() => {
  store.docs.clear();
  store.listeners.clear();
  store.writes = [];
  store.currentUser = { uid: 'owner-id', email: OWNER_EMAIL };
  store.batches = 0;
  store.failBatch = 0;
  store.authLogin.mockReset().mockResolvedValue(undefined);
  store.authLogout.mockReset().mockResolvedValue(undefined);
});

function emit(
  name: string,
  rows: { id: string; value: Record<string, unknown> }[] = [],
  fromCache = false,
) {
  store.listeners.get(`users/owner-id/${name}`)!.next({
    docs: rows.map((row) => ({ id: row.id, data: () => row.value })),
    metadata: { fromCache, hasPendingWrites: false },
  });
}
describe('Firebase adapter reads', () => {
  it('reads all 11 owner collections without seeding and waits for server snapshots', () => {
    const next = vi.fn(),
      error = vi.fn();
    const stop = firebaseGateway.listenData('owner-id', next, error);
    expect(store.listeners.size).toBe(11);
    for (const name of COLLECTIONS) emit(name, [], true);
    expect(next.mock.lastCall?.[0].complete).toBe(false);
    for (const name of COLLECTIONS) emit(name);
    expect(next.mock.lastCall?.[0]).toEqual({
      data: emptyData(),
      complete: true,
      fromCache: false,
    });
    expect(store.writes).toHaveLength(0);
    stop();
    expect(store.listeners.size).toBe(0);
  });
  it('retains records without createdAt, trusts document IDs, normalizes real Timestamp', () => {
    const next = vi.fn();
    firebaseGateway.listenData('owner-id', next, vi.fn());
    emit('deals', [
      {
        id: 'real-id',
        value: {
          id: 'spoofed',
          ten: 'Khách thật',
          createdAt: new Timestamp(123, 456),
          custom: 'keep',
        },
      },
      { id: 'old-id', value: { ten: 'Bản ghi cũ' } },
    ]);
    const rows = next.mock.lastCall?.[0].data.deals;
    expect(rows[0]).toMatchObject({
      id: 'real-id',
      createdAt: { seconds: 123, nanoseconds: 456 },
      custom: 'keep',
    });
    expect(rows[1].id).toBe('old-id');
  });
  it('surfaces invalid records and permission errors instead of reporting empty success', () => {
    const error = vi.fn();
    firebaseGateway.listenData('owner-id', vi.fn(), error);
    emit('transactions', [{ id: 'bad', value: { date: 'broken' } }]);
    expect(error.mock.calls[0][0].message).toContain('bad');
    store.listeners.get('users/owner-id/debts')!.error({ code: 'permission-denied' });
    expect(error).toHaveBeenCalledTimes(2);
  });
  it('normalizes old grouped rent values without changing cloud data', () => {
    expect(
      cloudRecord('apartments', 'apt1', {
        address: 'A1',
        price: '12.000.000',
        payDay: '',
        deposit: '',
      }),
    ).toMatchObject({ price: 12000000, deposit: 0, payDay: 1 });
    expect(
      cloudRecord('transactions', 'tx1', {
        desc: 'Thu cũ',
        date: '2026-10-01',
        type: 'THU',
        amount: '1500000',
      }),
    ).toMatchObject({ type: 'THU', amount: 1500000 });
  });
  it('rejects a different signed-in account before subscribing or signing in', async () => {
    store.currentUser = { uid: 'other', email: 'other@example.com' };
    expect(() => firebaseGateway.listenData('owner-id', vi.fn(), vi.fn())).toThrow(
      /Phiên đăng nhập/,
    );
    await expect(firebaseGateway.signIn('other@example.com', 'password')).rejects.toThrow(
      /chủ sở hữu/,
    );
    expect(store.authLogin).not.toHaveBeenCalled();
    expect(store.listeners.size).toBe(0);
  });
  it('rejects foreign restored auth sessions and supports observer cleanup', () => {
    const next = vi.fn(),
      error = vi.fn();
    const stop = firebaseGateway.listenAuth(next, error);
    store.authNext!({ uid: 'foreign', email: 'other@example.com' });
    expect(next).toHaveBeenCalledWith(null);
    expect(error).toHaveBeenCalled();
    expect(store.authLogout).toHaveBeenCalled();
    stop();
    expect(store.authNext).toBeNull();
  });
});

describe('Firestore writes stay compatible with the legacy app', () => {
  it('commits an edit with timestamps and unknown fields, and safely undoes it', async () => {
    const path = 'users/owner-id/deals/deal1';
    store.docs.set(path, {
      ten: 'Tên trước',
      createdAt: new Timestamp(12, 34),
      unknown: { keep: true },
    });
    const before = cloudRecord('deals', 'deal1', store.docs.get(path)!);
    const data = { ...emptyData(), deals: [before] };
    const change = applyChange(data, 'deals', 'deal1', { ...before, ten: 'Tên mới' }).change;
    const result = await firebaseGateway.commit('owner-id', change);
    expect(store.docs.get(path)).toMatchObject({ ten: 'Tên mới', unknown: { keep: true } });
    expect(store.docs.get(path)!.createdAt).toBeInstanceOf(Timestamp);
    await firebaseGateway.commit('owner-id', {
      ...result,
      before: result.after,
      after: result.before,
    });
    expect(store.docs.get(path)!.ten).toBe('Tên trước');
  });
  it('rejects stale edits/deletes without overwriting another client', async () => {
    const before = cloudRecord('deals', 'deal1', { ten: 'Cũ' });
    store.docs.set('users/owner-id/deals/deal1', { ten: 'Đã sửa ở bản cũ' });
    const change = applyChange({ ...emptyData(), deals: [before] }, 'deals', 'deal1', null).change;
    await expect(firebaseGateway.commit('owner-id', change)).rejects.toThrow(/đã thay đổi/);
    expect(store.writes).toHaveLength(0);
  });
  it('creates with a Firestore Timestamp and can undo the acknowledged creation', async () => {
    const change = applyChange(emptyData(), 'deals', 'new1', { ten: 'Khách mới' }).change;
    const result = await firebaseGateway.commit('owner-id', change);
    expect(store.docs.get('users/owner-id/deals/new1')!.createdAt).toBeInstanceOf(Timestamp);
    await firebaseGateway.commit('owner-id', { ...result, before: result.after, after: null });
    expect(store.docs.has('users/owner-id/deals/new1')).toBe(false);
  });
  it('uses the existing unpadded rent-payment ID and toggles current cloud state', async () => {
    const path = 'users/owner-id/rentPayments/2026_1_apt1';
    store.docs.set(path, { apartmentId: 'apt1', year: 2026, month: 1, paid: true, custom: 'keep' });
    await firebaseGateway.toggleRent('owner-id', 'apt1', '2026-01');
    expect(store.docs.get(path)).toMatchObject({ paid: false, custom: 'keep' });
    expect(store.docs.size).toBe(1);
  });
  it('creates recurring work atomically once and respects schedules disabled on cloud', async () => {
    const task = cloudRecord('recurringTasks', 'rt1', {
      taskText: 'Việc thật',
      type: 'monthly',
      dayOfMonth: 22,
    }) as AppDataTask;
    store.docs.set('users/owner-id/recurringTasks/rt1', { ...task });
    await firebaseGateway.runRecurring('owner-id', [task], '2026-10-22');
    await firebaseGateway.runRecurring('owner-id', [task], '2026-10-22');
    expect(store.writes).toEqual([
      'users/owner-id/todos/recur_rt1_2026-10-22',
      'users/owner-id/recurringRuns/recur_rt1_2026-10-22',
    ]);
    store.docs.set('users/owner-id/recurringTasks/rt1', { ...task, active: false });
    await firebaseGateway.runRecurring('owner-id', [task], '2026-11-22');
    expect(store.writes).toHaveLength(2);
  });
  it('validates all backup records before writes and reports partially committed batches', async () => {
    const invalid = { ...emptyData(), deals: [{ id: '../bad', ten: 'invalid' }] };
    await expect(
      firebaseGateway.importData('owner-id', invalid as never, vi.fn()),
    ).rejects.toThrow();
    expect(store.writes).toHaveLength(0);
    const data = {
      ...emptyData(),
      deals: Array.from({ length: 201 }, (_, i) =>
        cloudRecord('deals', `d${i}`, { ten: `Khách ${i}` }),
      ),
    };
    store.failBatch = 2;
    const progress = vi.fn();
    await expect(firebaseGateway.importData('owner-id', data as never, progress)).rejects.toThrow(
      '200/201',
    );
    expect(progress).toHaveBeenCalledWith(200, 201);
    expect(store.writes).toHaveLength(200);
  });
  it('rejects a malformed late timestamp before committing any import batch', async () => {
    const data = {
      ...emptyData(),
      deals: Array.from({ length: 201 }, (_, i) =>
        cloudRecord('deals', `d${i}`, { ten: `Khách ${i}` }),
      ),
    };
    data.deals[200].createdAt = 'invalid timestamp';
    await expect(firebaseGateway.importData('owner-id', data, vi.fn())).rejects.toThrow();
    expect(store.writes).toHaveLength(0);
  });
});

type AppDataTask = import('@/lib/types').RecurringTask;
