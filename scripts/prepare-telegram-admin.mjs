import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cert, initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const envPath = fileURLToPath(new URL('../.env.local', import.meta.url));
const credentialPath = fileURLToPath(
  new URL('../.secrets/firebase-service-account.json', import.meta.url),
);
if (existsSync(envPath)) process.loadEnvFile(envPath);
let app;
try {
  if (!existsSync(credentialPath)) throw new Error('service_account_file_missing');
  const account = JSON.parse(readFileSync(credentialPath, 'utf8').replace(/^\uFEFF/, ''));
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId || account.project_id !== projectId) throw new Error('firebase_project_mismatch');
  app = initializeApp({ credential: cert(account), projectId }, 'business-hub-setup-check');
  const owner = await getAuth(app).getUserByEmail('aidatnq6@gmail.com');
  if (owner.disabled) throw new Error('firebase_owner_disabled');
  const settings = {
    GOOGLE_APPLICATION_CREDENTIALS: credentialPath.replaceAll('\\', '/'),
    FIREBASE_PROJECT_ID: projectId,
    FIREBASE_OWNER_UID: owner.uid,
  };
  let content = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
  for (const [name, value] of Object.entries(settings)) {
    const line = `${name}=${JSON.stringify(value)}`;
    const pattern = new RegExp(`^${name}=.*$`, 'm');
    content = pattern.test(content)
      ? content.replace(pattern, () => line)
      : content.trimEnd() + '\n' + line + '\n';
  }
  writeFileSync(envPath, content, 'utf8');
  console.log(
    JSON.stringify({
      serverIdentityVerified: true,
      ownerVerified: true,
      localEnvPrepared: true,
      scheduleActivated: false,
      noMessageSent: true,
    }),
  );
} catch (error) {
  const known = [
    'service_account_file_missing',
    'firebase_project_mismatch',
    'firebase_owner_disabled',
  ];
  console.error(
    JSON.stringify({
      ready: false,
      error: known.includes(error?.message) ? error.message : 'firebase_admin_verification_failed',
      noMessageSent: true,
    }),
  );
  process.exitCode = 1;
} finally {
  if (app) await deleteApp(app);
}
