import { describe, expect, it, vi } from 'vitest';
import { emptyData } from '@/lib/cloud-data';
import {
  runTelegramReport,
  REPORT_LEASE_MS,
  type TelegramJobStore,
  type TelegramRun,
} from '@/lib/telegram-job';
import { claimTelegramRun } from '@/lib/telegram-run-state';
import { telegramSender, TelegramDeliveryError } from '@/lib/telegram-transport';
import { createDemoData } from './fixtures/demo';

class MemoryJobStore implements TelegramJobStore {
  run: TelegramRun | null = null;
  data = emptyData();
  failPrepare = false;
  failAck = false;
  async claim(date: string, attempt: string, destination: string, now: Date) {
    const result = claimTelegramRun(this.run, date, attempt, destination, now);
    if (result.update) this.run = result.update;
    return result.claim;
  }
  async prepareData() {
    if (this.failPrepare) throw new Error('sensitive-sdk-detail');
    return this.data;
  }
  async saveChunks(_date: string, _attempt: string, chunks: string[]) {
    this.run = { ...this.run!, chunks, status: 'sending' };
  }
  async beginPart(_date: string, _attempt: string, index: number) {
    this.run = { ...this.run!, inFlight: index };
  }
  async confirmPart(_date: string, _attempt: string, index: number, messageId: number) {
    if (this.failAck) throw new Error('sensitive-sdk-detail');
    this.run = {
      ...this.run!,
      inFlight: null,
      nextPart: index + 1,
      messageIds: [...this.run!.messageIds, messageId],
      status: index + 1 === this.run!.chunks!.length ? 'sent' : 'sending',
    };
  }
  async fail(
    _date: string,
    _attempt: string,
    errorCode: string,
    uncertain: boolean,
    retryAt: number,
  ) {
    this.run = {
      ...this.run!,
      status: uncertain ? 'uncertain' : 'failed',
      inFlight: uncertain ? this.run!.inFlight : null,
      leaseUntil: 0,
      retryAt,
      errorCode,
    };
  }
}
function context() {
  const store = new MemoryJobStore();
  const send = vi.fn<(text: string) => Promise<number>>().mockResolvedValue(123);
  const clock = () => new Date('2026-10-22T00:00:00Z');
  return {
    store,
    send,
    clock,
    attempt: 'attempt1',
    destination: 'fixed-chat-hash',
    pause: vi.fn(async () => {}),
  };
}
describe('07:00 Vietnam report execution', () => {
  it('does not run before 07:00, including when the UTC date is still yesterday', async () => {
    const ctx = context();
    expect(
      await runTelegramReport({ ...ctx, clock: () => new Date('2026-10-21T23:59:59Z') }),
    ).toEqual({ status: 'not_due', date: '2026-10-22' });
    expect(ctx.store.run).toBeNull();
    expect(ctx.send).not.toHaveBeenCalled();
  });
  it('sends the current month and all required sections exactly at 07:00', async () => {
    const ctx = context();
    ctx.store.data = createDemoData('2026-10-22');
    expect((await runTelegramReport(ctx)).status).toBe('sent');
    const text = ctx.send.mock.calls[0][0];
    for (const section of [
      '2026-10-22',
      'Việc hôm nay',
      'Việc quá hạn',
      'Công nợ cần thu',
      'Doanh thu',
      'Chi phí',
      'Lợi nhuận',
      '23.000.000đ',
    ])
      expect(text).toContain(section);
    expect(ctx.store.run).toMatchObject({
      status: 'sent',
      nextPart: 1,
      inFlight: null,
      messageIds: [123],
    });
  });
  it('sends a clear empty report without substituting sample records', async () => {
    const ctx = context();
    await runTelegramReport(ctx);
    expect(ctx.send.mock.calls[0][0]).toContain('Không có.');
    expect(ctx.send.mock.calls[0][0]).toContain('Doanh thu: 0đ');
  });
  it('skips a repeated cron invocation after successful delivery', async () => {
    const ctx = context();
    await runTelegramReport(ctx);
    expect((await runTelegramReport({ ...ctx, attempt: 'attempt2' })).status).toBe('already_sent');
    expect(ctx.send).toHaveBeenCalledTimes(1);
  });
  it('prevents overlapping workers from sending the same daily report', async () => {
    const ctx = context();
    let release!: (value: number) => void;
    ctx.send.mockImplementation(
      () =>
        new Promise<number>((resolve) => {
          release = resolve;
        }),
    );
    const first = runTelegramReport(ctx);
    await vi.waitFor(() => expect(ctx.send).toHaveBeenCalledTimes(1));
    expect((await runTelegramReport({ ...ctx, attempt: 'attempt2' })).status).toBe('busy');
    release(321);
    expect((await first).status).toBe('sent');
  });
  it('resumes only the remaining saved chunks after a definite rejection', async () => {
    const ctx = context();
    await ctx.store.claim(
      '2026-10-22',
      'old',
      ctx.destination,
      new Date(ctx.clock().getTime() - REPORT_LEASE_MS - 1),
    );
    Object.assign(ctx.store.run!, {
      status: 'failed',
      chunks: ['already delivered', 'remaining part'],
      nextPart: 1,
      messageIds: [9],
      leaseUntil: 0,
    });
    expect((await runTelegramReport(ctx)).sentParts).toBe(2);
    expect(ctx.send.mock.calls.map(([text]) => text)).toEqual(['remaining part']);
  });
  it('honors Telegram retry_after without losing progress or automatically duplicating chunks', async () => {
    const ctx = context();
    ctx.send.mockRejectedValueOnce(new TelegramDeliveryError('telegram_api_429', false, 120));
    expect((await runTelegramReport(ctx)).status).toBe('failed');
    expect(ctx.store.run!.inFlight).toBeNull();
    expect((await runTelegramReport({ ...ctx, attempt: 'attempt2' })).status).toBe('backoff');
    expect(
      (
        await runTelegramReport({
          ...ctx,
          attempt: 'attempt3',
          clock: () => new Date(ctx.clock().getTime() + 121000),
        })
      ).status,
    ).toBe('sent');
    expect(ctx.send).toHaveBeenCalledTimes(2);
  });
  it('does not retry uncertain network delivery', async () => {
    const ctx = context();
    ctx.send.mockRejectedValueOnce(
      new TelegramDeliveryError('telegram_network_delivery_unknown', true),
    );
    expect((await runTelegramReport(ctx)).status).toBe('uncertain');
    expect((await runTelegramReport({ ...ctx, attempt: 'attempt2' })).status).toBe('uncertain');
    expect(ctx.send).toHaveBeenCalledTimes(1);
  });
  it('treats a missing durable acknowledgment as uncertain even when Telegram returned success', async () => {
    const ctx = context();
    ctx.store.failAck = true;
    const result = await runTelegramReport(ctx);
    expect(result.status).toBe('uncertain');
    expect(JSON.stringify(result)).not.toContain('sensitive-sdk-detail');
    expect(ctx.store.run!.inFlight).toBe(0);
    expect((await runTelegramReport({ ...ctx, attempt: 'attempt2' })).status).toBe('uncertain');
  });
  it('marks preparation failures safely without sending fabricated data', async () => {
    const ctx = context();
    ctx.store.failPrepare = true;
    expect(await runTelegramReport(ctx)).toMatchObject({
      status: 'failed',
      errorCode: 'report_preparation_failed',
    });
    expect(ctx.send).not.toHaveBeenCalled();
  });
  it('retains an expired in-flight operation for manual delivery review', async () => {
    const ctx = context();
    await ctx.store.claim(
      '2026-10-22',
      'old',
      ctx.destination,
      new Date(ctx.clock().getTime() - REPORT_LEASE_MS - 1),
    );
    Object.assign(ctx.store.run!, { status: 'sending', inFlight: 0, chunks: ['unsure'] });
    expect((await runTelegramReport(ctx)).status).toBe('uncertain');
    expect(ctx.store.run!.errorCode).toBe('expired_in_flight_delivery_unknown');
    expect(ctx.send).not.toHaveBeenCalled();
  });
  it('refuses to change the destination of an already prepared daily run', async () => {
    const ctx = context();
    await runTelegramReport(ctx);
    await expect(runTelegramReport({ ...ctx, destination: 'other-chat' })).rejects.toThrow(
      'report_destination_mismatch',
    );
    expect(ctx.send).toHaveBeenCalledTimes(1);
  });
});

describe('Telegram transport', () => {
  it('uses only sendMessage to the configured chat with phone notifications enabled', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ ok: true, result: { message_id: 42 } }));
    expect(await telegramSender('fake-token', '-123', request)('<b>literal text</b>')).toBe(42);
    expect(request.mock.calls[0][0]).toBe('https://api.telegram.org/botfake-token/sendMessage');
    const options = request.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(options.body))).toEqual({
      chat_id: '-123',
      text: '<b>literal text</b>',
      disable_notification: false,
      link_preview_options: { is_disabled: true },
    });
  });
  it('classifies API 429 as a definite rejection with retry timing', async () => {
    const request = vi.fn(async () =>
      Response.json(
        { ok: false, error_code: 429, parameters: { retry_after: 75 } },
        { status: 429 },
      ),
    );
    await expect(telegramSender('fake-token', '-123', request)('test')).rejects.toMatchObject({
      uncertain: false,
      retryAfterSeconds: 75,
    });
  });
  it('sanitizes network errors so the bot token cannot appear in error logs', async () => {
    const request = vi.fn(async () => {
      throw new Error('https://api.telegram.org/botfake-token/sendMessage');
    });
    await expect(telegramSender('fake-token', '-123', request)('test')).rejects.toMatchObject({
      message: 'telegram_network_delivery_unknown',
      uncertain: true,
    });
  });
  it.each([403, 500])('classifies HTTP %i correctly', async (code) => {
    const request = vi.fn(async () =>
      Response.json({ ok: false, error_code: code }, { status: code }),
    );
    await expect(telegramSender('fake-token', '-123', request)('test')).rejects.toMatchObject({
      uncertain: code >= 500,
    });
  });
  it('treats a malformed response as unknown delivery', async () => {
    const request = vi.fn(async () => new Response('not-json'));
    await expect(telegramSender('fake-token', '-123', request)('test')).rejects.toMatchObject({
      uncertain: true,
    });
  });
});
