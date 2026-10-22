import 'server-only';
import { businessDay } from '../../marketing/domain';
import { MONTHLY_LIMIT } from '../../marketing/pricing';
import { collection, type Context } from '../marketing/store';

export async function readBudget(c: Context) {
  const month = businessDay().slice(0, 7);
  return c.db.runTransaction(async (tx) => {
    const [settings, ledger] = await Promise.all([
      tx.get(collection(c, 'marketingSettings').doc('ai')),
      tx.get(collection(c, 'marketingBudget').doc(month)),
    ]);
    const config = settings.data(),
      value = ledger.data();
    const spent = value?.spent ?? 0,
      reserved = value?.reserved ?? 0;
    const limit = value?.limit ?? config?.monthlyLimit ?? MONTHLY_LIMIT;
    return {
      month,
      spent,
      reserved,
      limit,
      remaining: Math.max(0, limit - spent - reserved),
      warning: limit > 0 && spent + reserved >= limit * 0.8,
      revision: config?.revision ?? 0,
    };
  });
}

export async function updateBudget(c: Context, monthlyLimit: number, revision: number) {
  if (
    !Number.isSafeInteger(monthlyLimit) ||
    monthlyLimit < 0 ||
    !Number.isSafeInteger(revision) ||
    revision < 0
  )
    throw new Error('ai_input_invalid');
  const month = businessDay().slice(0, 7),
    configRef = collection(c, 'marketingSettings').doc('ai'),
    ledgerRef = collection(c, 'marketingBudget').doc(month);
  await c.db.runTransaction(async (tx) => {
    const [settings, ledger] = await Promise.all([tx.get(configRef), tx.get(ledgerRef)]);
    const config = settings.data(),
      value = ledger.data() ?? { spent: 0, reserved: 0 };
    if ((config?.revision ?? 0) !== revision) throw new Error('marketing_revision_conflict');
    if (monthlyLimit < value.spent + value.reserved) throw new Error('ai_budget_below_committed');
    const updatedAt = new Date().toISOString();
    tx.set(configRef, { ...config, monthlyLimit, revision: revision + 1, updatedAt });
    tx.set(ledgerRef, { ...value, limit: monthlyLimit, updatedAt });
  });
  return readBudget(c);
}
