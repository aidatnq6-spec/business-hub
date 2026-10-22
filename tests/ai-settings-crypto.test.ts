import { afterEach, describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { encryptCredential, decryptCredential } from '../lib/server/ai-settings/crypto';
afterEach(() => vi.unstubAllEnvs());
describe('credential encryption', () => {
  it('authenticates nonce, ciphertext, AAD and owner without deterministic ciphertext', () => {
    vi.stubEnv('AI_SETTINGS_ENCRYPTION_KEY', Buffer.alloc(32, 1).toString('base64'));
    const first = encryptCredential('private-test-key', 'owner', 1),
      second = encryptCredential('private-test-key', 'owner', 1);
    expect(first.nonce).not.toBe(second.nonce);
    expect(decryptCredential(first, 'owner', 1)).toBe('private-test-key');
    for (const value of [
      { ...first, ciphertext: 'AAAA' },
      { ...first, tag: Buffer.alloc(16).toString('base64') },
      { ...first, nonce: Buffer.alloc(12).toString('base64') },
    ])
      expect(() => decryptCredential(value, 'owner', 1)).toThrow('ai_credential_unreadable');
    expect(() => decryptCredential(first, 'other', 1)).toThrow('ai_credential_unreadable');
    expect(() => decryptCredential(first, 'owner', 2)).toThrow('ai_credential_unreadable');
    vi.stubEnv('AI_SETTINGS_ENCRYPTION_KEY', Buffer.alloc(32, 2).toString('base64'));
    expect(() => decryptCredential(first, 'owner', 1)).toThrow('ai_credential_unreadable');
  });
  it('never invents missing master keys or accepts noncanonical encodings', () => {
    for (const value of [
      '',
      'invalid',
      Buffer.alloc(31).toString('base64'),
      Buffer.alloc(32).toString('base64').slice(0, -1),
    ]) {
      vi.stubEnv('AI_SETTINGS_ENCRYPTION_KEY', value);
      expect(() => encryptCredential('private-test-key', 'owner', 1)).toThrow(
        'ai_encryption_unavailable',
      );
    }
  });
});
