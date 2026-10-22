import { z } from 'zod';
import type { ModelChoice } from './catalog';
const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const credentialInput = z
  .object({ provider: z.literal('gemini'), key: z.string().trim().min(1).max(512), revision })
  .strict();
export const credentialRevisionInput = z
  .object({ provider: z.literal('gemini'), revision })
  .strict();
export const budgetInput = z.object({ monthlyLimit: revision, revision }).strict();
export type CredentialView = {
  provider: 'gemini';
  source: 'app' | 'environment' | 'none';
  configured: boolean;
  suffix: string | null;
  revision: number;
  updatedAt: string | null;
  check: {
    state: 'unchecked' | 'checking' | 'valid' | 'error';
    checkedAt: string | null;
    code: string | null;
    scope: 'metadata' | null;
  };
};
export type SettingsView = {
  credential: CredentialView;
  budget: {
    month: string;
    spent: number;
    reserved: number;
    limit: number;
    remaining: number;
    warning: boolean;
    revision: number;
  };
  capabilities: {
    id: string;
    state: 'missing' | 'unchecked' | 'ready' | 'error';
    reasons: string[];
    selection?: ModelChoice;
  }[];
  activation: { desired: boolean; effective: boolean; reasons: string[] };
};
