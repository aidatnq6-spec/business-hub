import { afterEach, describe, expect, it, vi } from 'vitest';
const token = vi.hoisted(() => vi.fn());
vi.mock('@/lib/firebase-client', () => ({
  firebaseClient: () => ({ auth: { currentUser: { getIdToken: token } } }),
}));
import { marketingRequest } from '@/lib/marketing/client';
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe('marketing request deadlines', () => {
  it.each([
    [500, ''],
    [502, '<html>Bad Gateway</html>'],
    [200, ''],
    [200, 'null'],
  ])(
    'handles HTTP %s with a malformed body without leaking a JSON parse error',
    async (status, body) => {
      token.mockResolvedValue('test-token');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status })));
      await expect(marketingRequest('dashboard')).rejects.toMatchObject({
        code: 'marketing_response_invalid',
        status,
      });
    },
  );
  it('preserves the actionable Firebase configuration error from JSON responses', async () => {
    token.mockResolvedValue('test-token');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ error: 'marketing_firebase_admin_missing' }, { status: 503 }),
        ),
    );
    await expect(marketingRequest('dashboard')).rejects.toMatchObject({
      code: 'marketing_firebase_admin_missing',
    });
  });
  it('times out a stalled sign-in token without sending a request', async () => {
    vi.useFakeTimers();
    token.mockImplementation(() => new Promise(() => {}));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const pending = expect(marketingRequest('brand', 'PATCH', {})).rejects.toMatchObject({
      code: 'marketing_request_timeout',
    });
    await vi.advanceTimersByTimeAsync(30000);
    await pending;
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('bounds the response body wait and aborts the network request', async () => {
    vi.useFakeTimers();
    token.mockResolvedValue('test-token');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: () => new Promise(() => {}) });
    vi.stubGlobal('fetch', fetchMock);
    const pending = expect(marketingRequest('dashboard')).rejects.toMatchObject({
      code: 'marketing_request_timeout',
    });
    await vi.advanceTimersByTimeAsync(30000);
    await pending;
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  });
  it('preserves caller cancellation while obtaining a token', async () => {
    token.mockImplementation(() => new Promise(() => {}));
    const controller = new AbortController();
    const pending = expect(
      marketingRequest('dashboard', 'GET', undefined, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await pending;
  });
});
