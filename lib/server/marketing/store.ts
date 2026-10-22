import 'server-only';
import { createHash } from 'node:crypto';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { caps, PRICE_VERSION, reserveAmount, MONTHLY_LIMIT } from '../../marketing/pricing';
import { businessDay } from '../../marketing/domain';
import type { Job, Stage, Budget } from '../../marketing/types';
export interface Context {
  db: Firestore;
  uid: string;
}
export function collection(c: Context, name: string) {
  if (!/^marketing[A-Za-z]+$/.test(name)) throw new Error('marketing_collection_invalid');
  return c.db.collection('users').doc(c.uid).collection(name);
}
export const key = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 40);
export async function list<T>(c: Context, name: string, limit = 90): Promise<T[]> {
  return (await collection(c, name).orderBy('updatedAt', 'desc').limit(limit).get()).docs.map(
    (x) => ({ ...x.data(), id: x.id }) as T,
  );
}
export async function read<T>(c: Context, name: string, id: string): Promise<T | null> {
  const doc = await collection(c, name).doc(id).get();
  return doc.exists ? ({ ...doc.data(), id: doc.id } as T) : null;
}
export async function revise<T extends { revision: number }>(
  c: Context,
  name: string,
  id: string,
  expected: number,
  change: (value: T) => Partial<T>,
) {
  const ref = collection(c, name).doc(id);
  return c.db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) throw new Error('marketing_not_found');
    const v = snapshot.data() as T;
    if (v.revision !== expected) throw new Error('marketing_revision_conflict');
    const next = { ...v, ...change(v), updatedAt: new Date().toISOString() };
    tx.set(ref, next);
    return next;
  });
}
export function jobId(bundleId: string, revision: number, stage: Stage) {
  return key(`${bundleId}:${revision}:${stage}`);
}
export function putJob(
  tx: Transaction,
  c: Context,
  bundleId: string,
  revision: number,
  stage: Stage,
) {
  const id = jobId(bundleId, revision, stage),
    now = new Date().toISOString();
  const job: Job = {
    id,
    bundleId,
    revision,
    stage,
    state: 'queued',
    attempts: 0,
    leaseUntil: 0,
    sideEffect: false,
    error: '',
    createdAt: now,
  };
  tx.create(collection(c, 'marketingJobs').doc(id), { ...job, updatedAt: now });
  tx.create(collection(c, 'marketingOutbox').doc(id), {
    id,
    state: 'pending',
    createdAt: now,
    updatedAt: now,
  });
  return job;
}
export async function reserve(c: Context, job: Job) {
  const month = businessDay().slice(0, 7),
    budgetRef = collection(c, 'marketingBudget').doc(month),
    costRef = collection(c, 'marketingCosts').doc(job.id);
  return c.db.runTransaction(async (tx) => {
    const [b, r] = await Promise.all([tx.get(budgetRef), tx.get(costRef)]);
    const v = (b.data() ?? { spent: 0, reserved: 0, limit: MONTHLY_LIMIT }) as Budget;
    const maximum = caps[job.stage];
    if (r.exists) {
      const cost = r.data()!;
      if (maximum === 0) return;
      if (
        cost.state !== 'reserved' ||
        cost.priceVersion !== PRICE_VERSION ||
        cost.maximum !== maximum
      )
        throw new Error('marketing_cost_already_used');
      if (cost.month === month) return;
      const oldRef = collection(c, 'marketingBudget').doc(cost.month),
        old = await tx.get(oldRef);
      const reserved = reserveAmount(v, maximum);
      tx.set(budgetRef, {
        ...v,
        reserved,
        limit: MONTHLY_LIMIT,
        updatedAt: new Date().toISOString(),
      });
      tx.update(oldRef, {
        reserved: Math.max(0, (old.data()?.reserved ?? 0) - maximum),
        updatedAt: new Date().toISOString(),
      });
      tx.update(costRef, { month, previousMonth: cost.month, updatedAt: new Date().toISOString() });
      return;
    }
    const reserved = reserveAmount(v, maximum);
    tx.set(budgetRef, {
      ...v,
      reserved,
      limit: MONTHLY_LIMIT,
      updatedAt: new Date().toISOString(),
    });
    tx.create(costRef, {
      month,
      maximum,
      state: 'reserved',
      priceVersion: PRICE_VERSION,
      updatedAt: new Date().toISOString(),
    });
  });
}
export async function settle(c: Context, job: Job, amount: number | null) {
  const costRef = collection(c, 'marketingCosts').doc(job.id);
  return c.db.runTransaction(async (tx) => {
    const cost = await tx.get(costRef);
    if (!cost.exists) return;
    const v = cost.data()!;
    if (v.state === 'settled' || v.state === 'released') return;
    const budgetRef = collection(c, 'marketingBudget').doc(v.month),
      snap = await tx.get(budgetRef),
      budget = snap.data()!;
    if (amount === null) {
      tx.update(costRef, { state: 'uncertain' });
      return;
    }
    if (!Number.isFinite(amount) || amount < 0 || amount > v.maximum) {
      tx.update(costRef, { state: 'uncertain' });
      return;
    }
    tx.update(budgetRef, {
      spent: budget.spent + Math.ceil(amount),
      reserved: Math.max(0, budget.reserved - v.maximum),
      updatedAt: new Date().toISOString(),
    });
    tx.update(costRef, {
      state: 'settled',
      actual: Math.ceil(amount),
      updatedAt: new Date().toISOString(),
    });
  });
}
