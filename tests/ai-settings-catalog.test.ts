import { it, expect } from 'vitest';
import { selectModel, usable, MODEL_CATALOG, type ModelChoice } from '../lib/ai-settings/catalog';
it('blocks unverified, expired, ambiguous and mismatched catalog entries', () => {
  const choice: ModelChoice = {
    provider: 'gemini',
    model: 'test-only',
    capability: 'text',
    verifiedAt: '2026-10-01',
    validUntil: '2026-11-01',
    source: 'https://ai.google.dev/gemini-api/docs/pricing',
    priceVersion: 'test',
    prices: { inputUsdPerMillion: 1 },
  };
  const now = Date.parse('2026-10-22');
  expect(selectModel('text', now, [])).toBeNull();
  expect(selectModel('text', now, MODEL_CATALOG)?.model).toBe('gemini-3.1-flash-lite');
  expect(selectModel('image', now, [choice])).toBeNull();
  expect(selectModel('text', now, [choice, choice])).toBeNull();
  expect(usable({ ...choice, validUntil: '2026-10-01' }, now)).toBe(false);
  expect(usable({ ...choice, verifiedAt: '' }, now)).toBe(false);
  expect(usable({ ...choice, prices: {} }, now)).toBe(false);
  expect(selectModel('text', now, [choice])?.model).toBe('test-only');
});
