import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
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
    ])
      await assertFails(setDoc(doc(db, 'users/owner/' + path), { approved: true }));
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
