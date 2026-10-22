import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firebaseAdmin, ownerContext } from '@/lib/server/firebase-admin';
import { telegramConfig } from '@/lib/server/telegram-config';
import { OWNER_EMAIL } from '@/lib/cloud-data';

const state = vi.hoisted(() => ({
  apps: vi.fn(),
  initialize: vi.fn(),
  cert: vi.fn(),
  adc: vi.fn(),
  getUser: vi.fn(),
  getUserByEmail: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('firebase-admin/app', () => ({
  getApps: state.apps,
  initializeApp: state.initialize,
  cert: state.cert,
  applicationDefault: state.adc,
}));
vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ getUser: state.getUser, getUserByEmail: state.getUserByEmail }),
}));
vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => 'server-db' }));
beforeEach(() => {
  for (const key of [
    'FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'FIREBASE_SERVICE_ACCOUNT_JSON',
    'GOOGLE_APPLICATION_CREDENTIALS',
    'FIREBASE_USE_ADC',
    'FIREBASE_OWNER_UID',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_CHAT_ID',
    'CRON_SECRET',
    'TELEGRAM_REPORT_ENABLED',
  ])
    vi.stubEnv(key, '');
  state.apps.mockReset().mockReturnValue([]);
  state.initialize.mockReset().mockReturnValue('server-app');
  state.cert.mockReset().mockReturnValue('certificate');
  state.adc.mockReset().mockReturnValue('adc');
  state.getUserByEmail
    .mockReset()
    .mockResolvedValue({ uid: 'fixed-owner', email: OWNER_EMAIL, disabled: false });
  state.getUser
    .mockReset()
    .mockResolvedValue({ uid: 'fixed-owner', email: OWNER_EMAIL, disabled: false });
});
afterEach(() => vi.unstubAllEnvs());
function identity() {
  vi.stubEnv('FIREBASE_PROJECT_ID', 'expected-project');
  vi.stubEnv(
    'FIREBASE_SERVICE_ACCOUNT_JSON',
    JSON.stringify({
      project_id: 'expected-project',
      client_email: 'service@example.com',
      private_key: 'test-key',
    }),
  );
}
describe('server identity and report readiness', () => {
  it('does not treat public Firebase configuration as a server credential', () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'expected-project');
    expect(() => firebaseAdmin()).toThrow('firebase_server_identity_missing');
    expect(telegramConfig().missing).toContain('Danh tính Firebase máy chủ');
    expect(state.initialize).not.toHaveBeenCalled();
  });
  it('rejects malformed credentials or a different project before initialization', () => {
    vi.stubEnv('FIREBASE_PROJECT_ID', 'expected-project');
    vi.stubEnv('FIREBASE_SERVICE_ACCOUNT_JSON', 'invalid-json-private-value');
    expect(() => firebaseAdmin()).toThrow('firebase_server_identity_invalid');
    vi.stubEnv('FIREBASE_SERVICE_ACCOUNT_JSON', JSON.stringify({ project_id: 'other-project' }));
    expect(() => firebaseAdmin()).toThrow('firebase_server_project_mismatch');
    expect(state.initialize).not.toHaveBeenCalled();
  });
  it('resolves the existing owner on the server rather than accepting a request UID', async () => {
    identity();
    expect(await ownerContext()).toEqual({ uid: 'fixed-owner', db: 'server-db' });
    expect(state.getUserByEmail).toHaveBeenCalledWith(OWNER_EMAIL);
  });
  it('validates explicitly configured UIDs against the owner email', async () => {
    identity();
    vi.stubEnv('FIREBASE_OWNER_UID', 'wrong-owner');
    state.getUser.mockResolvedValueOnce({
      uid: 'wrong-owner',
      email: 'other@example.com',
      disabled: false,
    });
    await expect(ownerContext()).rejects.toThrow('firebase_owner_mismatch');
  });
  it('rejects disabled owners', async () => {
    identity();
    state.getUserByEmail.mockResolvedValueOnce({
      uid: 'fixed-owner',
      email: OWNER_EMAIL,
      disabled: true,
    });
    await expect(ownerContext()).rejects.toThrow('firebase_owner_mismatch');
  });
  it('requires valid server configuration and explicit enablement for sending', () => {
    identity();
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
    vi.stubEnv('TELEGRAM_CHAT_ID', '-123');
    vi.stubEnv('CRON_SECRET', 'x'.repeat(64));
    expect(telegramConfig().missing).toEqual([]);
    expect(telegramConfig().enabled).toBe(false);
    vi.stubEnv('TELEGRAM_REPORT_ENABLED', 'true');
    expect(telegramConfig().enabled).toBe(true);
  });
});
