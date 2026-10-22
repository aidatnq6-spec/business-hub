import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST, HEAD } from '@/app/api/cron/telegram/route';
import { GET as statusGET } from '@/app/api/telegram/status/route';

const state = vi.hoisted(() => ({
  config: {
    projectId: 'test-project',
    token: 'test-private-token',
    chatId: '-123',
    cronSecret: 'a'.repeat(64),
    identity: true,
    enabled: true,
    missing: [] as string[],
  },
  owner: vi.fn(),
  store: vi.fn(),
  send: vi.fn(),
  run: vi.fn(),
}));
vi.mock('@/lib/server/telegram-config', () => ({ telegramConfig: () => state.config }));
vi.mock('@/lib/server/firebase-admin', () => ({ ownerContext: state.owner }));
vi.mock('@/lib/server/telegram-store', () => ({ telegramStore: state.store }));
vi.mock('@/lib/telegram-transport', () => ({ telegramSender: state.send }));
vi.mock('@/lib/telegram-job', async (original) => ({
  ...(await original<typeof import('@/lib/telegram-job')>()),
  runTelegramReport: state.run,
}));
beforeEach(() => {
  state.config.enabled = true;
  state.config.missing = [];
  state.config.cronSecret = 'a'.repeat(64);
  state.owner.mockReset().mockResolvedValue({ db: 'fixed-db', uid: 'fixed-owner' });
  state.store.mockReset().mockReturnValue('fixed-store');
  state.send.mockReset().mockReturnValue('fixed-sender');
  state.run.mockReset().mockResolvedValue({ status: 'sent', date: '2026-10-22', sentParts: 1 });
});
function request(secret = state.config.cronSecret) {
  return new Request('http://localhost/api/cron/telegram?uid=attacker&chat_id=attacker', {
    headers: { Authorization: `Bearer ${secret}` },
  });
}
describe('protected cron endpoint', () => {
  it('refuses unauthorized invocations before initializing Firebase or sending', async () => {
    expect((await GET(request('wrong-secret'))).status).toBe(401);
    expect(state.owner).not.toHaveBeenCalled();
    expect(state.run).not.toHaveBeenCalled();
  });
  it('requires server configuration and an explicit enable flag', async () => {
    state.config.enabled = false;
    expect((await GET(request())).status).toBe(503);
    state.config.enabled = true;
    state.config.missing = ['Danh tính Firebase máy chủ'];
    expect((await GET(request())).status).toBe(503);
    expect(state.run).not.toHaveBeenCalled();
  });
  it('uses only the configured owner/chat and disables response caching', async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(state.store).toHaveBeenCalledWith('fixed-db', 'fixed-owner');
    expect(state.send).toHaveBeenCalledWith('test-private-token', '-123');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const text = await response.text();
    expect(text).not.toContain('test-private-token');
    expect(text).not.toContain('fixed-owner');
  });
  it('never invokes the job for HEAD health checks', async () => {
    expect(HEAD().status).toBe(204);
    expect(state.run).not.toHaveBeenCalled();
  });
  it('sanitizes server errors without returning credentials or payloads', async () => {
    state.owner.mockRejectedValueOnce(new Error('test-private-token-sensitive-data'));
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.text()).toBe('{"error":"telegram_report_failed"}');
  });
  it.each([
    ['uncertain', 409],
    ['failed', 502],
    ['backoff', 503],
    ['busy', 503],
    ['already_sent', 200],
  ])('maps %s to an observable result', async (status, http) => {
    state.run.mockResolvedValueOnce({ status, date: '2026-10-22' });
    expect((await GET(request())).status).toBe(http);
  });
  it('public status exposes readiness without secrets or falsely verifying the scheduler', async () => {
    const response = statusGET();
    const text = await response.text();
    expect(JSON.parse(text)).toMatchObject({
      sendsEnabled: true,
      schedulerVerified: false,
      time: '07:00',
      timeZone: 'Asia/Ho_Chi_Minh',
      cronUtc: '0 0 * * *',
    });
    expect(text).not.toContain('test-private-token');
    expect(text).not.toContain(state.config.cronSecret);
  });
});
