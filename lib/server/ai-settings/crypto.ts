import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
export type Envelope = {
  algorithm: 'aes-256-gcm';
  keyVersion: 1;
  nonce: string;
  ciphertext: string;
  tag: string;
};
function master() {
  const raw = process.env.AI_SETTINGS_ENCRYPTION_KEY ?? '';
  const key = Buffer.from(raw, 'base64');
  if (!/^[A-Za-z0-9+/]{43}=$/.test(raw) || key.length !== 32 || key.toString('base64') !== raw)
    throw new Error('ai_encryption_unavailable');
  return key;
}
const aad = (uid: string, revision: number) =>
  Buffer.from(JSON.stringify(['business-hub-ai-v1', uid, 'gemini', revision]));
export function encryptionReady(): boolean {
  try {
    master();
    return true;
  } catch {
    return false;
  }
}
export function encryptCredential(key: string, uid: string, revision: number): Envelope {
  const nonce = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', master(), nonce);
  cipher.setAAD(aad(uid, revision));
  const ciphertext = Buffer.concat([cipher.update(key, 'utf8'), cipher.final()]);
  return {
    algorithm: 'aes-256-gcm',
    keyVersion: 1,
    nonce: nonce.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}
export function decryptCredential(value: Envelope, uid: string, revision: number): string {
  const key = master();
  try {
    if (value.algorithm !== 'aes-256-gcm' || value.keyVersion !== 1) throw new Error();
    const nonce = Buffer.from(value.nonce, 'base64'),
      tag = Buffer.from(value.tag, 'base64');
    if (nonce.length !== 12 || tag.length !== 16) throw new Error();
    const decipher = createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAAD(aad(uid, revision));
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(Buffer.from(value.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new Error('ai_credential_unreadable');
  }
}
