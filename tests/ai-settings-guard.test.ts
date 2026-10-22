import { afterEach, it, expect, vi } from 'vitest';
import type { Context } from '../lib/server/marketing/store';
import { fakeFirestore } from './marketing-fake-store';
vi.mock('server-only', () => ({}));
import { requireOrigin, readBody, rateLimit } from '../lib/server/ai-settings/guard';
afterEach(() => vi.unstubAllEnvs());
it('requires a configured origin independent of attacker host headers', () => {
  vi.stubEnv('AI_SETTINGS_ORIGIN', 'https://app.example');
  expect(() =>
    requireOrigin(
      new Request('https://evil.example', { headers: { origin: 'https://app.example' } }),
    ),
  ).not.toThrow();
  for (const headers of [
    {} as Record<string, string>,
    { origin: 'https://evil.example', host: 'app.example' },
  ])
    expect(() => requireOrigin(new Request('https://app.example', { headers }))).toThrow(
      'ai_origin_forbidden',
    );
});
it('enforces byte limit while streaming and rejects malformed JSON', async () => {
  await expect(
    readBody(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'x'.repeat(8193),
      }),
    ),
  ).rejects.toThrow('ai_body_too_large');
  await expect(
    readBody(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{',
      }),
    ),
  ).rejects.toThrow('ai_input_invalid');
  await expect(
    readBody(new Request('http://localhost', { method: 'POST', body: '{}' })),
  ).rejects.toThrow('ai_content_type_invalid');
});
it('shares transaction throttles across requests and resets only on new window', async () => {
  const fake = fakeFirestore(),
    c = { db: fake.db, uid: 'owner' } as unknown as Context;
  await Promise.all(Array.from({ length: 5 }, () => rateLimit(c, 'check', 1000)));
  await expect(rateLimit(c, 'check', 59999)).rejects.toThrow('ai_rate_limited');
  await expect(rateLimit(c, 'check', 61000)).resolves.toBeUndefined();
  await expect(rateLimit({ ...c, uid: 'other' }, 'check', 1000)).resolves.toBeUndefined();
});
