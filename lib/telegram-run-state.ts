import { REPORT_LEASE_MS, type ReportClaim, type TelegramRun } from './telegram-job';

export function claimTelegramRun(
  current: TelegramRun | null,
  date: string,
  attempt: string,
  destination: string,
  now: Date,
): { claim: ReportClaim; update: TelegramRun | null } {
  if (current) {
    if (current.date !== date || current.destination !== destination)
      throw new Error('report_destination_mismatch');
    if (current.status === 'sent')
      return { claim: { acquired: false, reason: 'sent' }, update: null };
    if (current.status === 'uncertain')
      return { claim: { acquired: false, reason: 'uncertain' }, update: null };
    if (current.leaseUntil > now.getTime())
      return { claim: { acquired: false, reason: 'busy' }, update: null };
    if (current.inFlight !== null) {
      const update = {
        ...current,
        status: 'uncertain' as const,
        errorCode: 'expired_in_flight_delivery_unknown',
        updatedAt: now.toISOString(),
      };
      return { claim: { acquired: false, reason: 'uncertain' }, update };
    }
    if (current.retryAt > now.getTime())
      return { claim: { acquired: false, reason: 'backoff' }, update: null };
  }
  const run: TelegramRun = {
    date,
    attempt,
    destination,
    status: current?.chunks ? 'sending' : 'preparing',
    chunks: current?.chunks ?? null,
    nextPart: current?.nextPart ?? 0,
    messageIds: current?.messageIds ?? [],
    inFlight: null,
    leaseUntil: now.getTime() + REPORT_LEASE_MS,
    retryAt: 0,
    updatedAt: now.toISOString(),
    errorCode: null,
  };
  return { claim: { acquired: true, run }, update: run };
}
