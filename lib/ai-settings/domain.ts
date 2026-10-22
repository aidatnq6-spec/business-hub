import type { CredentialView } from './types';
export const emptyCheck = (): CredentialView['check'] => ({
  state: 'unchecked',
  checkedAt: null,
  code: null,
  scope: null,
});
export function keySuffix(key: string): string | null {
  return key.length >= 12 ? key.slice(-4) : null;
}
export function budgetView(
  month: string,
  spent: number,
  reserved: number,
  limit: number,
  revision: number,
) {
  return {
    month,
    spent,
    reserved,
    limit,
    remaining: Math.max(0, limit - spent - reserved),
    warning: limit > 0 && spent + reserved >= limit * 0.8,
    revision,
  };
}
