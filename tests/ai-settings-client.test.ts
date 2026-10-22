import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({
  currentUser: { getIdToken: vi.fn() } as { getIdToken: ReturnType<typeof vi.fn> } | null,
}));
vi.mock('@/lib/firebase-client', () => ({ firebaseClient: () => ({ auth }) }));
import { aiSettingsRequest } from '@/lib/ai-settings/client';
const validResponse = {
  credential: {
    provider: 'gemini',
    source: 'app',
    configured: true,
    suffix: 'test',
    revision: 1,
    updatedAt: null,
    check: { state: 'unchecked', checkedAt: null, code: null, scope: null },
  },
  budget: {
    month: '2026-10',
    spent: 0,
    reserved: 0,
    limit: 1000000,
    remaining: 1000000,
    warning: false,
    revision: 0,
  },
  capabilities: [],
  activation: { desired: false, effective: false, reasons: [] },
};
beforeEach(() => {
  auth.currentUser = { getIdToken: vi.fn().mockResolvedValue('id-token') };
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe('AI settings HTTP client', () => {
  it('rejects syntactically valid but incomplete successful metadata instead of crashing the form', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}'));
    await expect(aiSettingsRequest()).rejects.toMatchObject({ code: 'ai_response_invalid' });
  });
  it('authenticates a mutation without persisting the credential', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(validResponse)));
    await aiSettingsRequest('credential', 'PUT', {
      provider: 'gemini',
      key: 'test-key',
      revision: 0,
    });
    expect(fetch).toHaveBeenCalledWith(
      '/api/ai-settings/credential',
      expect.objectContaining({
        method: 'PUT',
        cache: 'no-store',
        headers: expect.objectContaining({ Authorization: 'Bearer id-token' }),
      }),
    );
    expect(storage).not.toHaveBeenCalled();
    storage.mockRestore();
  });
  it.each(['', '<html>Bad gateway</html>', '{', 'null', '[]'])(
    'sanitizes malformed responses: %s',
    async (body) => {
      vi.mocked(fetch).mockResolvedValue(new Response(body, { status: 502 }));
      await expect(aiSettingsRequest()).rejects.toMatchObject({ code: 'ai_response_invalid' });
    },
  );
  it('does not expose unknown server error text or credentials', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'secret-provider-key' }), { status: 500 }),
    );
    await expect(aiSettingsRequest()).rejects.not.toThrow('secret-provider-key');
  });
  it('bounds token acquisition and never dispatches after timeout', async () => {
    vi.useFakeTimers();
    let resolveToken!: (value: string) => void;
    auth.currentUser!.getIdToken.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveToken = resolve;
      }),
    );
    const failure = expect(aiSettingsRequest('credential', 'PUT', {})).rejects.toMatchObject({
      code: 'ai_request_timeout',
    });
    await vi.advanceTimersByTimeAsync(30001);
    await failure;
    resolveToken('late');
    await Promise.resolve();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('bounds a hanging response body', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: () => new Promise(() => {}),
    } as Response);
    const failure = expect(aiSettingsRequest()).rejects.toMatchObject({
      code: 'ai_request_timeout',
    });
    await vi.advanceTimersByTimeAsync(30001);
    await failure;
  });
  it('honors caller cancellation before token or fetch', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(aiSettingsRequest('', 'GET', undefined, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('explains an expired session and revision conflicts', async () => {
    auth.currentUser = null;
    await expect(aiSettingsRequest()).rejects.toThrow(/đăng nhập/i);
    auth.currentUser = { getIdToken: vi.fn().mockResolvedValue('token') };
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'ai_revision_conflict' }), { status: 409 }),
    );
    await expect(aiSettingsRequest()).rejects.toThrow(/tải lại/i);
  });
});
