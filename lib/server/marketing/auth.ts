import 'server-only';
import { OAuth2Client, GoogleAuth } from 'google-auth-library';
import { firebaseAdmin, ownerContext } from '../firebase-admin';
import { OWNER_EMAIL } from '../../cloud-data';
import { required } from './config';
export async function requireOwner(request: Request) {
  const bearer = request.headers.get('authorization');
  if (!bearer?.startsWith('Bearer ')) throw new Error('marketing_unauthorized');
  const admin = firebaseAdmin();
  let user;
  try {
    user = await admin.auth.verifyIdToken(bearer.slice(7), true);
  } catch {
    throw new Error('marketing_unauthorized');
  }
  if (user.email?.toLowerCase() !== OWNER_EMAIL) throw new Error('marketing_forbidden');
  const owner = await ownerContext();
  if (user.uid !== owner.uid) throw new Error('marketing_forbidden');
  return owner;
}
export async function verifyGoogle(request: Request, email: string, audience: string) {
  const raw = request.headers.get('authorization');
  if (!raw?.startsWith('Bearer ')) throw new Error('marketing_unauthorized');
  try {
    const ticket = await new OAuth2Client().verifyIdToken({ idToken: raw.slice(7), audience });
    const p = ticket.getPayload();
    if (
      !p ||
      p.email !== email ||
      !p.email_verified ||
      !['https://accounts.google.com', 'accounts.google.com'].includes(p.iss)
    )
      throw new Error('invalid');
  } catch {
    throw new Error('marketing_unauthorized');
  }
}
export async function googleToken() {
  const credentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    : undefined;
  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const token = await auth.getAccessToken();
  if (!token) throw new Error('marketing_identity_missing');
  return token;
}
export async function scheduleAuth(request: Request, kind: 'prepare' | 'notify') {
  const audience = new URL(`/api/marketing/schedule/${kind}`, required('MARKETING_ORIGIN')).href;
  await verifyGoogle(request, required('MARKETING_SCHEDULER_SA'), audience);
  const job = request.headers.get('x-cloudscheduler-jobname'),
    time = request.headers.get('x-cloudscheduler-scheduletime');
  const expected = required(kind === 'prepare' ? 'MARKETING_PREPARE_JOB' : 'MARKETING_NOTIFY_JOB');
  const instant = Date.parse(time ?? ''),
    age = Date.now() - instant;
  if (job !== expected || !Number.isFinite(instant) || age < -60000 || age > 3600000)
    throw new Error('marketing_schedule_expired');
  const vn = new Date(instant + 7 * 3600000).toISOString();
  if (vn.slice(11, 16) !== (kind === 'prepare' ? '20:00' : '08:00'))
    throw new Error('marketing_schedule_expired');
  return new Date(instant);
}
