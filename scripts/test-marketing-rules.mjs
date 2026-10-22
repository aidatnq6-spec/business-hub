import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, readdir, access, readFile } from 'node:fs/promises';
import { openSync, closeSync } from 'node:fs';
import { join, resolve } from 'node:path';
const require = createRequire(import.meta.url),
  base = resolve('.firebase');
await mkdir(base, { recursive: true });
const env = {
  ...process.env,
  XDG_CONFIG_HOME: join(base, 'emulator-config'),
  FIREBASE_EMULATORS_PATH: join(base, 'emulator-cache'),
  CI: 'true',
};
delete env.FIREBASE_TOKEN;
delete env.GOOGLE_APPLICATION_CREDENTIALS;
try {
  for (const entry of await readdir(join(base, 'tools/java21'))) {
    const bin = join(base, 'tools/java21', entry, 'bin');
    try {
      await access(join(bin, process.platform === 'win32' ? 'java.exe' : 'java'));
      env.PATH = bin + (process.platform === 'win32' ? ';' : ':') + env.PATH;
      break;
    } catch {}
  }
} catch {}
const log = join(base, 'marketing-rules.log'),
  fd = openSync(log, 'w');
const code = await new Promise((done, reject) => {
  const child = spawn(
    process.execPath,
    [
      require.resolve('firebase-tools/lib/bin/firebase.js'),
      'emulators:exec',
      '--config',
      'firebase.emulator.json',
      '--project',
      'demo-business-hub-marketing',
      '--only',
      'firestore',
      'vitest run --config vitest.rules.config.ts --reporter=json --outputFile=.firebase/marketing-rules-result.json',
    ],
    { env, stdio: ['ignore', fd, fd], windowsHide: true, shell: false },
  );
  child.once('error', reject);
  child.once('close', done);
});
closeSync(fd);
if (code !== 0) {
  console.error(
    'Firestore emulator rules check failed; see .firebase/marketing-rules.log (Java 21 required).',
  );
  process.exitCode = 1;
} else {
  const report = JSON.parse(await readFile(join(base, 'marketing-rules-result.json'), 'utf8'));
  console.log(
    JSON.stringify({
      passed: report.numPassedTests,
      total: report.numTotalTests,
      productionDataAccessed: false,
      log,
    }),
  );
}
