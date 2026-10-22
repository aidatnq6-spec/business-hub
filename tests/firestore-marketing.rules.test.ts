import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import {
  initializeApp as initializeAdminApp,
  deleteApp as deleteAdminApp,
} from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { updateBudget, readBudget } from '../lib/server/ai-settings/budget';
import { reserve } from '../lib/server/marketing/store';
import type { Job } from '../lib/marketing/types';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc } from 'firebase/firestore';
let env: RulesTestEnvironment;
beforeAll(async () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (host !== '127.0.0.1:8088') throw new Error('Only the local Marketing emulator is allowed');
  env = await initializeTestEnvironment({
    projectId: 'demo-business-hub-marketing',
    firestore: { host: '127.0.0.1', port: 8088, rules: readFileSync('firestore.rules', 'utf8') },
  });
});
beforeEach(async () => env.clearFirestore());
afterAll(async () => env?.cleanup());
describe('Marketing server-owned namespace', () => {
  it('enforces the configured cap under real concurrent Firestore transactions', async () => {
    const app = initializeAdminApp(
      { projectId: 'demo-business-hub-marketing' },
      'ai-settings-budget-test',
    );
    const db = getAdminFirestore(app),
      c = { db, uid: 'budget-concurrency' };
    try {
      await updateBudget(c, 30000, 0);
      const results = await Promise.allSettled(
        Array.from({ length: 8 }, (_, i) =>
          reserve(c, { id: 'emulator-job-' + i, stage: 'draft' } as Job),
        ),
      );
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
      const budget = await readBudget(c);
      expect(budget).toMatchObject({ limit: 30000, reserved: 30000 });
      await expect(updateBudget(c, 29999, 1)).rejects.toThrow('ai_budget_below_committed');
    } finally {
      await db.terminate();
      await deleteAdminApp(app);
    }
  });
  it('allows legacy owner writes, including nested paths', async () => {
    const db = env.authenticatedContext('owner', { email: 'aidatnq6@gmail.com' }).firestore();
    await assertSucceeds(setDoc(doc(db, 'users/owner/customers/customer'), { name: 'real owner' }));
    await assertSucceeds(
      setDoc(doc(db, 'users/owner/customers/customer/notes/note'), { text: 'legacy note' }),
    );
  });
  it('denies direct client writes to approvals, budget, jobs and nested Marketing documents', async () => {
    const db = env.authenticatedContext('owner', { email: 'aidatnq6@gmail.com' }).firestore();
    for (const path of [
      'marketingBrand/profile',
      'marketingApprovals/approval',
      'marketingBudget/month',
      'marketingJobs/job',
      'marketingJobs/job/notes/note',
      'marketingSettings/ai',
    ])
      await assertFails(setDoc(doc(db, 'users/owner/' + path), { approved: true }));
  });
  it('denies all client access to credential, audit and rate-limit roots', async () => {
    for (const db of [
      env.authenticatedContext('owner', { email: 'aidatnq6@gmail.com' }).firestore(),
      env.unauthenticatedContext().firestore(),
    ]) {
      for (const path of [
        'privateAiCredentials/owner/providers/gemini',
        'privateAiAudit/owner/events/event',
        'privateAiRateLimits/limit',
      ]) {
        await assertFails(setDoc(doc(db, path), { ciphertext: 'test' }));
        await assertFails(getDoc(doc(db, path)));
      }
    }
  });
  it('allows the owner to read server data while denying other users', async () => {
    await env.withSecurityRulesDisabled(async (c) =>
      setDoc(doc(c.firestore(), 'users/owner/marketingBudget/month'), { limit: 1000000 }),
    );
    await assertSucceeds(
      getDoc(
        doc(
          env.authenticatedContext('owner', { email: 'aidatnq6@gmail.com' }).firestore(),
          'users/owner/marketingBudget/month',
        ),
      ),
    );
    await assertFails(
      getDoc(
        doc(
          env.authenticatedContext('other', { email: 'other@example.test' }).firestore(),
          'users/owner/marketingBudget/month',
        ),
      ),
    );
    await assertFails(
      getDoc(doc(env.unauthenticatedContext().firestore(), 'users/owner/marketingBudget/month')),
    );
  });
});
