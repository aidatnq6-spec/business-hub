export const MONTHLY_LIMIT = 1_000_000;
export const PRICE_VERSION = '2026-10-22-candidate-v1';
// Conservative per-stage caps; provider usage settles below the reservation.
export const caps = {
  plan: 15000,
  draft: 15000,
  image: 10000,
  speech: 10000,
  render: 0,
  export: 0,
  probe: 0,
} as const;
export function reserveAmount(
  b: { spent: number; reserved: number },
  amount: number,
  limit = MONTHLY_LIMIT,
) {
  if (
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    b.spent < 0 ||
    b.reserved < 0 ||
    b.spent + b.reserved + amount > limit
  )
    throw new Error('marketing_budget_exceeded');
  return b.reserved + amount;
}
