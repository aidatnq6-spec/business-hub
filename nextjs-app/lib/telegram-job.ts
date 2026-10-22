import { businessDate, telegramReport } from './domain';
import type { AppData } from './types';
import { TelegramDeliveryError } from './telegram-transport';

export const REPORT_TIMEZONE = 'Asia/Ho_Chi_Minh';
export const REPORT_CRON_UTC = '0 0 * * *';
export const REPORT_LEASE_MS = 10 * 60 * 1000;
export interface TelegramRun {
  date: string;
  destination: string;
  attempt: string;
  status: 'preparing' | 'sending' | 'sent' | 'failed' | 'uncertain';
  chunks: string[] | null;
  nextPart: number;
  inFlight: number | null;
  messageIds: number[];
  leaseUntil: number;
  retryAt: number;
  updatedAt: string;
  errorCode: string | null;
}
export type ReportClaim = { acquired: true; run: TelegramRun } | { acquired: false; reason: 'sent' | 'busy' | 'uncertain' | 'backoff' };
export interface TelegramJobStore {
  claim: (date: string, attempt: string, destination: string, now: Date) => Promise<ReportClaim>;
  prepareData: (date: string) => Promise<AppData>;
  saveChunks: (date: string, attempt: string, chunks: string[], now: Date) => Promise<void>;
  beginPart: (date: string, attempt: string, index: number, now: Date) => Promise<void>;
  confirmPart: (date: string, attempt: string, index: number, messageId: number, now: Date) => Promise<void>;
  fail: (date: string, attempt: string, code: string, uncertain: boolean, retryAt: number, now: Date) => Promise<void>;
}
export interface TelegramJobResult {
  status: 'not_due' | 'sent' | 'busy' | 'uncertain' | 'backoff' | 'failed' | 'already_sent';
  date: string;
  sentParts?: number;
  errorCode?: string;
}
export async function runTelegramReport(options: {
  store: TelegramJobStore;
  send: (text: string) => Promise<number>;
  destination: string;
  attempt: string;
  clock?: () => Date;
  pause?: (milliseconds: number) => Promise<void>;
}): Promise<TelegramJobResult> {
  const clock = options.clock ?? (() => new Date());
  const pause = options.pause ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const started = clock();
  const date = businessDate(started);
  if (started.getTime() < Date.parse(`${date}T07:00:00+07:00`)) return { status: 'not_due', date };
  const claim = await options.store.claim(date, options.attempt, options.destination, started);
  if (!claim.acquired) return { status: claim.reason === 'sent' ? 'already_sent' : claim.reason, date };
  const run = claim.run;
  let inFlight = false;
  let sentParts = run.nextPart;
  try {
    let chunks = run.chunks;
    if (!chunks) {
      const data = await options.store.prepareData(date);
      chunks = telegramReport(data, date);
      if (!chunks.length || chunks.length > 100) throw new Error('report_size_limit');
      await options.store.saveChunks(date, options.attempt, chunks, clock());
    }
    for (let index = run.nextPart; index < chunks.length; index++) {
      if (clock().getTime() - started.getTime() > 240000) throw new Error('report_time_budget');
      if (index > run.nextPart) await pause(1100);
      await options.store.beginPart(date, options.attempt, index, clock());
      inFlight = true;
      const messageId = await options.send(chunks[index]);
      // Keep inFlight true until the acknowledgment is durably saved.
      await options.store.confirmPart(date, options.attempt, index, messageId, clock());
      inFlight = false;
      sentParts++;
    }
    return { status: 'sent', date, sentParts };
  } catch (error) {
    const telegramError = error instanceof TelegramDeliveryError ? error : null;
    const uncertain = telegramError ? telegramError.uncertain : inFlight;
    // Do not persist arbitrary SDK messages: they can contain credentials or payloads.
    const errorCode = telegramError?.code ?? (uncertain ? 'delivery_acknowledgment_unknown' : 'report_preparation_failed');
    const retryAt = clock().getTime() + Math.max(60, telegramError?.retryAfterSeconds ?? 0) * 1000;
    await options.store.fail(date, options.attempt, errorCode, uncertain, retryAt, clock());
    return { status: uncertain ? 'uncertain' : 'failed', date, sentParts, errorCode };
  }
}
