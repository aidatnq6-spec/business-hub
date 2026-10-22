import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ verify: vi.fn(), owner: vi.fn(), db: {}, google: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/firebase-admin', () => ({
  firebaseAdmin: () => ({ auth: { verifyIdToken: state.verify } }),
  ownerContext: state.owner,
}));
vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    verifyIdToken = state.google;
  },
  GoogleAuth: class {},
}));
import { requireOwner, scheduleAuth } from '@/lib/server/marketing/auth';
import { handleMarketing, errorResponse } from '@/lib/server/marketing/api';
import { marketingConfig } from '@/lib/server/marketing/config';
import { fakeFirestore } from './marketing-fake-store';
beforeEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  state.verify.mockResolvedValue({ uid: 'owner', email: 'aidatnq6@gmail.com' });
  state.owner.mockResolvedValue({ uid: 'owner', db: fakeFirestore().db });
});
describe('marketing server authorization', () => {
  it.each([
    ['firebase_server_identity_missing', 'marketing_firebase_admin_missing'],
    ['firebase_server_identity_invalid', 'marketing_firebase_admin_invalid'],
    ['firebase_server_project_missing', 'marketing_firebase_project_missing'],
    ['firebase_server_project_mismatch', 'marketing_firebase_project_mismatch'],
  ])('reports %s as a specific server configuration error', async (input, expected) => {
    const r = errorResponse(new Error(input));
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: expected });
  });
  it('does not expose unknown credential error details', async () => {
    const r = errorResponse(new Error('private_key=example-sensitive-value'));
    expect(await r.text()).toBe('{"error":"marketing_server_unavailable"}');
  });
  it('rejects missing credentials before Firebase access', async () => {
    const r = await handleMarketing(new Request('https://app.test/api/marketing/dashboard'), [
      'dashboard',
    ]);
    expect(r.status).toBe(401);
    expect(state.verify).not.toHaveBeenCalled();
    expect(state.owner).not.toHaveBeenCalled();
  });
  it('rejects revoked tokens and mismatched owner identity', async () => {
    const req = new Request('https://app.test', { headers: { Authorization: 'Bearer token' } });
    state.verify.mockRejectedValueOnce(new Error('revoked'));
    await expect(requireOwner(req)).rejects.toThrow('marketing_unauthorized');
    state.verify.mockResolvedValueOnce({ uid: 'intruder', email: 'aidatnq6@gmail.com' });
    await expect(requireOwner(req)).rejects.toThrow('marketing_forbidden');
    expect(state.verify).toHaveBeenCalledWith('token', true);
  });
  it('never returns the configured keys in readiness', async () => {
    vi.stubEnv('MARKETING_GEMINI_KEY', 'sensitive-never-return');
    const r = await handleMarketing(
      new Request('https://app.test', { headers: { Authorization: 'Bearer token' } }),
      ['status'],
    );
    expect(r.status).toBe(200);
    expect(await r.text()).not.toContain('sensitive-never-return');
    expect(marketingConfig().enabled).toBe(false);
  });
  it('accepts Google scheduler identity only for exact audience, service account and time slot', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-22T01:00:05Z'));
    vi.stubEnv('MARKETING_ORIGIN', 'https://app.test');
    vi.stubEnv('MARKETING_SCHEDULER_SA', 'scheduler@project.iam.gserviceaccount.com');
    vi.stubEnv('MARKETING_NOTIFY_JOB', 'projects/p/locations/r/jobs/notify');
    state.google.mockResolvedValue({
      getPayload: () => ({
        email: 'scheduler@project.iam.gserviceaccount.com',
        email_verified: true,
        iss: 'https://accounts.google.com',
      }),
    });
    const req = (time = '2026-10-22T01:00:00Z') =>
      new Request('https://app.test', {
        headers: {
          authorization: 'Bearer google',
          'x-cloudscheduler-jobname': 'projects/p/locations/r/jobs/notify',
          'x-cloudscheduler-scheduletime': time,
        },
      });
    try {
      expect((await scheduleAuth(req(), 'notify')).toISOString()).toBe('2026-10-22T01:00:00.000Z');
      expect(state.google).toHaveBeenCalledWith({
        idToken: 'google',
        audience: 'https://app.test/api/marketing/schedule/notify',
      });
      await expect(scheduleAuth(req('2026-10-21T01:00:00Z'), 'notify')).rejects.toThrow(
        'marketing_schedule_expired',
      );
      state.google.mockResolvedValue({
        getPayload: () => ({
          email: 'other@project.iam.gserviceaccount.com',
          email_verified: true,
          iss: 'https://accounts.google.com',
        }),
      });
      await expect(scheduleAuth(req(), 'notify')).rejects.toThrow('marketing_unauthorized');
    } finally {
      vi.useRealTimers();
    }
  });
});
