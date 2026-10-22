import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { fakeFirestore } from './marketing-fake-store';
vi.mock('server-only', () => ({}));
const auth = vi.hoisted(() => vi.fn());
vi.mock('../lib/server/marketing/auth', () => ({ requireOwner: auth }));
import { handleAiSettings } from '../lib/server/ai-settings/api';
beforeEach(() => {
  const fake = fakeFirestore();
  auth.mockReset();
  auth.mockResolvedValue({ db: fake.db, uid: 'owner' });
  vi.stubEnv('AI_SETTINGS_ORIGIN', 'https://app.example');
  vi.stubEnv('MARKETING_GEMINI_KEY', '');
  vi.stubEnv('AI_SETTINGS_ENCRYPTION_KEY', Buffer.alloc(32, 1).toString('base64'));
  vi.stubEnv('AI_SETTINGS_METADATA_CHECK_VERIFIED','true');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ name: 'models/gemini-3.1-flash-lite', supportedGenerationMethods: ['generateContent'] })));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const req = (method = 'GET', body?: unknown, origin = 'https://app.example') =>
  new Request('https://app.example/api/ai-settings', {
    method,
    headers: { origin, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
it('returns safe canonical DTO across key revisions and delete', async () => {
  const initial = await (await handleAiSettings(req())).json();
  expect(initial.credential.configured).toBe(false);
  const saved = await (
    await handleAiSettings(
      req('PUT', { provider: 'gemini', key: 'fake-private-key-value', revision: 0 }),
      ['credential'],
    )
  ).json();
  expect(saved.credential).toMatchObject({ configured: true, revision: 1 });
  expect(saved.budget).toHaveProperty('remaining');
  expect(JSON.stringify(saved)).not.toContain('fake-private-key-value');
  expect(saved.activation.effective).toBe(false);
  const conflict = await handleAiSettings(
    req('PUT', { provider: 'gemini', key: 'fake-private-key-value', revision: 0 }),
    ['credential'],
  );
  expect(conflict.status).toBe(409);
  const check = await handleAiSettings(req('POST', { provider: 'gemini', revision: 1 }), [
    'credential',
    'check',
  ]);
  expect(check.status).toBe(200);
  expect((await check.json()).credential.check).toMatchObject({ state: 'valid', scope: 'metadata' });
  const deleted = await (
    await handleAiSettings(req('DELETE', { provider: 'gemini', revision: 1 }), ['credential'])
  ).json();
  expect(deleted.credential.configured).toBe(false);
});
it('sanitizes errors, rejects origin and extra input and never exposes provider details', async () => {
  expect(
    (
      await handleAiSettings(
        req('PUT', { provider: 'gemini', key: 'key', revision: 0 }, 'https://evil.example'),
        ['credential'],
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await handleAiSettings(
        req('PUT', { provider: 'gemini', key: 'key', revision: 0, endpoint: 'evil' }),
        ['credential'],
      )
    ).status,
  ).toBe(422);
  auth.mockRejectedValue(new Error('raw private-secret database error'));
  const result = await handleAiSettings(req());
  expect(result.status).toBe(503);
  expect(await result.json()).toEqual({ error: 'ai_server_unavailable' });
  auth.mockRejectedValue(new Error('marketing_unauthorized'));
  expect((await handleAiSettings(req())).status).toBe(401);
  auth.mockRejectedValue(new Error('marketing_forbidden'));
  expect((await handleAiSettings(req())).status).toBe(403);
});
it('surfaces missing encryption configuration and missing credential without external requests', async () => {
  vi.stubEnv('AI_SETTINGS_ENCRYPTION_KEY', '');
  const initial = await (await handleAiSettings(req())).json();
  expect(initial.activation.reasons).toContain('ai_encryption_unavailable');
  const save = await handleAiSettings(
    req('PUT', { provider: 'gemini', key: 'fake-key', revision: 0 }),
    ['credential'],
  );
  expect(save.status).toBe(503);
  expect(await save.json()).toEqual({ error: 'ai_encryption_unavailable' });
  const check = await handleAiSettings(req('POST', { provider: 'gemini', revision: 0 }), [
    'credential',
    'check',
  ]);
  expect(check.status).toBe(409);
  expect(await check.json()).toEqual({ error: 'ai_credential_missing' });
});
it('returns canonical updated budget and rejects limits below committed spend', async () => {
  const result = await handleAiSettings(req('PATCH', { monthlyLimit: 0, revision: 0 }), ['budget']);
  expect(result.status).toBe(200);
  const value = await result.json();
  expect(value.budget).toMatchObject({ limit: 0, remaining: 0, revision: 1 });
  expect(value.credential).toBeDefined();
  const stale = await handleAiSettings(req('PATCH', { monthlyLimit: 1, revision: 0 }), ['budget']);
  expect(stale.status).toBe(409);
});
