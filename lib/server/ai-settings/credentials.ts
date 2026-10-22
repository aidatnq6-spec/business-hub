import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Context } from '../marketing/store';
import type { CredentialView } from '../../ai-settings/types';
import { emptyCheck, keySuffix } from '../../ai-settings/domain';
import { decryptCredential, encryptCredential, type Envelope } from './crypto';
type RecordValue = {
  revision: number;
  deleted: boolean;
  updatedAt: string;
  suffix: string | null;
  envelope?: Envelope;
  check: CredentialView['check'];
};
export const credentialRef = (c: Context) =>
  c.db.collection('privateAiCredentials').doc(c.uid).collection('providers').doc('gemini');
function view(value?: RecordValue): CredentialView {
  const env = !value && process.env.MARKETING_GEMINI_KEY;
  return {
    provider: 'gemini',
    source: value ? 'app' : env ? 'environment' : 'none',
    configured: value ? !value.deleted : !!env,
    suffix: value?.deleted ? null : (value?.suffix ?? (env ? keySuffix(env) : null)),
    revision: value?.revision ?? 0,
    updatedAt: value?.updatedAt ?? null,
    check: value
      ? {
          state: value.check.state,
          checkedAt: value.check.checkedAt,
          code: value.check.code,
          scope: value.check.scope,
        }
      : emptyCheck(),
  };
}
export async function readCredential(c: Context): Promise<CredentialView> {
  return view((await credentialRef(c).get()).data() as RecordValue | undefined);
}
export const credentialView = readCredential;
export async function saveCredential(c: Context, key: string, revision: number) {
  const envelope = encryptCredential(key, c.uid, revision + 1);
  return mutate(c, revision, { envelope, deleted: false, suffix: keySuffix(key) }, 'replace');
}
export async function deleteCredential(c: Context, revision: number) {
  return mutate(c, revision, { deleted: true, suffix: null }, 'delete');
}
async function mutate(
  c: Context,
  revision: number,
  fields: { deleted: boolean; suffix: string | null; envelope?: Envelope },
  action: string,
) {
  return c.db.runTransaction(async (tx) => {
    const ref = credentialRef(c),
      old = (await tx.get(ref)).data();
    if ((old?.revision ?? 0) !== revision) throw new Error('ai_revision_conflict');
    const value: RecordValue = {
      ...fields,
      revision: revision + 1,
      updatedAt: new Date().toISOString(),
      check: emptyCheck(),
    };
    tx.set(ref, value);
    tx.set(c.db.collection('privateAiAudit').doc(c.uid).collection('events').doc(randomUUID()), {
      action,
      provider: 'gemini',
      revision: value.revision,
      uid: c.uid,
      time: value.updatedAt,
      result: 'success',
      code: null,
    });
    return view(value);
  });
}
export async function resolveCredential(
  c: Context,
  expectedRevision?: number,
): Promise<{ key: string; revision: number; source: 'app' | 'environment' }> {
  const value = (await credentialRef(c).get()).data() as RecordValue | undefined;
  const revision = value?.revision ?? 0;
  if (expectedRevision !== undefined && expectedRevision !== revision)
    throw new Error('ai_revision_conflict');
  if (value) {
    if (value.deleted || !value.envelope) throw new Error('ai_credential_missing');
    return { key: decryptCredential(value.envelope, c.uid, revision), revision, source: 'app' };
  }
  const key = process.env.MARKETING_GEMINI_KEY;
  if (!key) throw new Error('ai_credential_missing');
  return { key, revision: 0, source: 'environment' };
}
