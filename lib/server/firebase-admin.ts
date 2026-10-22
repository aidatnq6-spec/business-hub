import 'server-only';
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { OWNER_EMAIL } from '../cloud-data';

export function firebaseAdmin() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('firebase_server_project_missing');
  const name = 'business-hub-server';
  let app = getApps().find((app) => app.name === name);
  if (!app) {
    let credential;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      let account: ServiceAccount & { project_id?: string };
      try {
        account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      } catch {
        throw new Error('firebase_server_identity_invalid');
      }
      if ((account.project_id ?? account.projectId) !== projectId)
        throw new Error('firebase_server_project_mismatch');
      credential = cert(account);
    } else {
      if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.FIREBASE_USE_ADC !== 'true')
        throw new Error('firebase_server_identity_missing');
      credential = applicationDefault();
    }
    app = initializeApp({ credential, projectId }, name);
  }
  return { auth: getAuth(app), db: getFirestore(app) };
}

export async function ownerContext() {
  const { auth, db } = firebaseAdmin();
  const uid = process.env.FIREBASE_OWNER_UID;
  const user = uid ? await auth.getUser(uid) : await auth.getUserByEmail(OWNER_EMAIL);
  if (user.disabled || user.email?.toLowerCase() !== OWNER_EMAIL)
    throw new Error('firebase_owner_mismatch');
  return { db, uid: user.uid };
}
