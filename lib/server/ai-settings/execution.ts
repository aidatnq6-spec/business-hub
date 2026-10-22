import 'server-only';
import { selectModel, type Capability } from '../../ai-settings/catalog';
import type { Job } from '../../marketing/types';
import { collection, type Context } from '../marketing/store';
import { resolveCredential } from './credentials';

export type ExecutionSelection = {
  capability: Capability;
  model: string;
  priceVersion: string;
  credentialRevision?: number;
};
export class ProviderPreDispatchError extends Error {}
const capabilityFor = (stage: Job['stage']): Capability | null =>
  stage === 'plan' || stage === 'draft'
    ? 'text'
    : stage === 'image'
      ? 'image'
      : stage === 'speech'
        ? 'speech'
        : null;

export async function prepareExecution(c: Context, job: Job): Promise<ExecutionSelection | null> {
  const capability = capabilityFor(job.stage);
  if (!capability) return null;
  const choice = selectModel(capability);
  if (!choice) throw new Error('marketing_price_unknown');
  const credential =
    capability === 'text' || capability === 'image' ? await resolveCredential(c) : null;
  const next: ExecutionSelection = {
    capability,
    model: choice.model,
    priceVersion: choice.priceVersion,
    ...(credential ? { credentialRevision: credential.revision } : {}),
  };
  const ref = collection(c, 'marketingJobs').doc(job.id);
  return c.db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.data()?.execution as ExecutionSelection | undefined;
    if (
      existing &&
      (existing.credentialRevision !== next.credentialRevision ||
        existing.model !== next.model ||
        existing.priceVersion !== next.priceVersion)
    )
      throw new Error('marketing_credential_changed');
    tx.update(ref, { execution: next });
    return next;
  });
}

export async function executionKey(c: Context, selection: ExecutionSelection | null) {
  if (!selection || selection.credentialRevision === undefined)
    throw new ProviderPreDispatchError('marketing_credential_missing');
  const choice = selectModel(selection.capability);
  if (!choice || choice.model !== selection.model || choice.priceVersion !== selection.priceVersion)
    throw new ProviderPreDispatchError('marketing_price_unknown');
  try {
    return (await resolveCredential(c, selection.credentialRevision)).key;
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    throw new ProviderPreDispatchError(
      code === 'ai_revision_conflict'
        ? 'marketing_credential_changed'
        : 'marketing_credential_missing',
    );
  }
}
