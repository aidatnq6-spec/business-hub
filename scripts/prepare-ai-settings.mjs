// Explicit local operator setup, never called by the application or deployment build.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const path = resolve(import.meta.dirname, '../.env.local');
let text = existsSync(path) ? readFileSync(path, 'utf8') : '';
const match = text.match(/^AI_SETTINGS_ENCRYPTION_KEY=(.*)$/m);
const existing = match?.[1].trim().replace(/^(['"])(.*)\1$/, '$2');
if (existing) {
  const key = Buffer.from(existing, 'base64');
  if (key.length !== 32 || key.toString('base64') !== existing)
    throw new Error('Existing encryption key is invalid; not overwritten.');
} else {
  const line = 'AI_SETTINGS_ENCRYPTION_KEY=' + randomBytes(32).toString('base64');
  text = match
    ? text.replace(/^AI_SETTINGS_ENCRYPTION_KEY=.*$/m, line)
    : text.trimEnd() + '\n' + line + '\n';
  writeFileSync(path, text, { mode: 0o600 });
}
console.log(
  JSON.stringify({
    localEncryptionReady: true,
    existingKeyPreserved: !!existing,
    secretPrinted: false,
    productionConfigured: false,
    paidApiCalled: false,
  }),
);
