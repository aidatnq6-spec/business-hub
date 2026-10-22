import { beforeEach, describe, it, expect, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { fakeFirestore } from './marketing-fake-store';
const send = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/marketing/config', () => ({
  marketingConfig: () => ({ telegramEnabled: true }),
  required: (name: string) =>
    ({
      MARKETING_ORIGIN: 'https://app.test',
      TELEGRAM_BOT_TOKEN: 'fixture-token',
      TELEGRAM_CHAT_ID: '-123',
    })[name],
}));
vi.mock('@/lib/telegram-transport', async (original) => ({
  ...(await original<object>()),
  telegramSender: () => send,
}));
import { sendDailyNotification } from '@/lib/server/marketing/daily';
import { TelegramDeliveryError } from '@/lib/telegram-transport';
beforeEach(() => {
  send.mockReset();
  send.mockResolvedValue(42);
});
describe('Marketing Telegram notification', () => {
  it('sends at most one message on concurrent duplicate invocations', async () => {
    const fake = fakeFirestore(),
      c = { db: fake.db as unknown as Firestore, uid: 'owner' };
    await Promise.all([
      sendDailyNotification(c, '2026-10-22'),
      sendDailyNotification(c, '2026-10-22'),
    ]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(expect.stringContaining('Chưa có nội dung'));
    expect(fake.docs.get('users/owner/marketingNotifications/2026-10-22')?.messageId).toBe(42);
  });
  it('does not send again after uncertain Telegram delivery', async () => {
    const fake = fakeFirestore(),
      c = { db: fake.db as unknown as Firestore, uid: 'owner' };
    send.mockRejectedValue(new TelegramDeliveryError('telegram_network_delivery_unknown', true));
    await expect(sendDailyNotification(c, '2026-10-22')).rejects.toThrow(
      'marketing_delivery_uncertain',
    );
    await sendDailyNotification(c, '2026-10-22');
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('respects retry-after on a definite rate limit', async () => {
    const fake = fakeFirestore(),
      c = { db: fake.db as unknown as Firestore, uid: 'owner' };
    send.mockRejectedValue(new TelegramDeliveryError('telegram_api_429', false, 120));
    await expect(sendDailyNotification(c, '2026-10-22')).rejects.toThrow(
      'marketing_delivery_failed',
    );
    await expect(sendDailyNotification(c, '2026-10-22')).rejects.toThrow(
      'marketing_delivery_rate_limited',
    );
    expect(send).toHaveBeenCalledTimes(1);
  });
});
