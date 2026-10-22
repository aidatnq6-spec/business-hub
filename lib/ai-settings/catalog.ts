export type Capability = 'text' | 'image' | 'speech' | 'render';
export type ModelChoice = Readonly<{
  provider: 'gemini' | 'google-tts' | 'template';
  model: string;
  capability: Capability;
  verifiedAt: string;
  validUntil: string;
  priceVersion: string;
  source: string;
  prices: Readonly<Record<string, number>>;
}>;
// Standard on-demand rates verified against the linked official pages on 2026-10-22.
// VND conversion is a conservative budget assumption, not a live exchange quote.
export const ESTIMATE_VND_PER_USD = 30000;
export const ESTIMATE_BUFFER = 1.2;
const verified = {
  verifiedAt: '2026-10-22T00:00:00Z',
  validUntil: '2026-11-21T00:00:00Z',
  priceVersion: '2026-10-22-standard-v2',
};
const choices: ModelChoice[] = [
  {
    ...verified,
    provider: 'gemini',
    model: 'gemini-3.1-flash-lite',
    capability: 'text',
    source: 'https://ai.google.dev/gemini-api/docs/pricing',
    prices: { inputUsdPerMillion: 0.25, outputUsdPerMillion: 1.5 },
  },
  {
    ...verified,
    provider: 'gemini',
    model: 'gemini-3.1-flash-lite-image',
    capability: 'image',
    source: 'https://ai.google.dev/gemini-api/docs/pricing',
    prices: { inputUsdPerMillion: 0.25, outputUsdPerMillion: 1.5, imageUsdPerMillion: 30 },
  },
  {
    ...verified,
    provider: 'google-tts',
    model: 'Neural2',
    capability: 'speech',
    source: 'https://cloud.google.com/text-to-speech/pricing',
    prices: { charactersUsdPerMillion: 16 },
  },
  {
    ...verified,
    provider: 'template',
    model: 'business-hub-template-v1',
    capability: 'render',
    source: 'https://ffmpeg.org/',
    prices: { aiGeneration: 0 },
  },
];
export const MODEL_CATALOG: readonly ModelChoice[] = Object.freeze(
  choices.map((c) => Object.freeze({ ...c, prices: Object.freeze(c.prices) })),
);
export const FALLBACK_MODELS: readonly ModelChoice[] = Object.freeze([]);
export function usable(choice: ModelChoice, now = Date.now()): boolean {
  const verified = Date.parse(choice.verifiedAt),
    expiry = Date.parse(choice.validUntil);
  return (
    Number.isFinite(verified) &&
    verified <= now &&
    Number.isFinite(expiry) &&
    expiry > now &&
    !!choice.priceVersion &&
    /^https:\/\//.test(choice.source) &&
    Object.keys(choice.prices).length > 0 &&
    Object.values(choice.prices).every((p) => Number.isFinite(p) && p >= 0)
  );
}
export function selectModel(
  capability: Capability,
  now = Date.now(),
  choices = MODEL_CATALOG,
): ModelChoice | null {
  const matching = choices.filter((c) => c.capability === capability && usable(c, now));
  return matching.length === 1 ? matching[0] : null;
}
