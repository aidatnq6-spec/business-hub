// Vercel's runtime can disable require(ESM), unlike the local Node default.
import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('loads Firebase Admin Auth when require(ESM) is disabled on the server', () => {
  const output = execFileSync(
    process.execPath,
    [
      '--no-experimental-require-module',
      '-e',
      "const {getAuth} = require('firebase-admin/auth'); console.log(typeof getAuth)",
    ],
    { encoding: 'utf8' },
  );
  expect(output.trim()).toBe('function');
});
