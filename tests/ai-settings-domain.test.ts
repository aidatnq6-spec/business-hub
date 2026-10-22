import { describe, it, expect } from 'vitest';
import { credentialInput, budgetInput } from '../lib/ai-settings/types';
import { budgetView, keySuffix } from '../lib/ai-settings/domain';
describe('AI settings contracts', () => {
  it('rejects external endpoints, wrong providers and unsafe budgets', () => {
    expect(
      credentialInput.safeParse({ provider: 'openrouter', key: 'key', revision: 0 }).success,
    ).toBe(false);
    expect(
      credentialInput.safeParse({
        provider: 'gemini',
        key: 'key',
        revision: 0,
        url: 'https://attacker.test',
      }).success,
    ).toBe(false);
    expect(credentialInput.safeParse({ provider: 'gemini', key: ' ', revision: 0 }).success).toBe(
      false,
    );
    expect(
      budgetInput.safeParse({ monthlyLimit: Number.MAX_SAFE_INTEGER + 1, revision: 0 }).success,
    ).toBe(false);
    expect(budgetInput.parse({ monthlyLimit: 0, revision: 0 }).monthlyLimit).toBe(0);
  });
  it('counts holds in remaining and warning without exposing short secrets', () => {
    expect(budgetView('2026-10', 600, 200, 1000, 1)).toMatchObject({
      remaining: 200,
      warning: true,
    });
    expect(budgetView('2026-10', 0, 0, 0, 1)).toMatchObject({ remaining: 0, warning: false });
    expect(keySuffix('short')).toBeNull();
  });
});
