import nextEnv from '@next/env';
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const names = [
  'FIREBASE_SERVICE_ACCOUNT_JSON',
  'AI_SETTINGS_ENCRYPTION_KEY',
  'MARKETING_BUCKET',
  'MARKETING_QUEUE',
  'MARKETING_WORKER_URL',
  'MARKETING_TASK_SA',
  'MARKETING_SCHEDULER_SA',
  'MARKETING_PREPARE_JOB',
  'MARKETING_NOTIFY_JOB',
  'MARKETING_ORIGIN',
  'MARKETING_TTS_VOICE',
  'MARKETING_PRICES_VALID_UNTIL',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
];
const missing = names.filter((n) => !process.env[n]);
if (process.env.FIREBASE_USE_ADC === 'true' || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const i = missing.indexOf('FIREBASE_SERVICE_ACCOUNT_JSON');
  if (i !== -1) missing.splice(i, 1);
}
console.log(
  JSON.stringify(
    {
      mode: 'local-presence-check-only-no-network',
      credentialCheck: 'not-queried-use-ai-settings-screen',
      legacyEnvironmentCredentialPresent: !!process.env.MARKETING_GEMINI_KEY,
      missing,
      enabled: {
        feature: process.env.MARKETING_ENABLED === 'true',
        generation: process.env.MARKETING_GENERATION_ENABLED === 'true',
        schedule: process.env.MARKETING_SCHEDULE_ENABLED === 'true',
        telegram: process.env.MARKETING_TELEGRAM_ENABLED === 'true',
      },
      cloudIdentityVerified: false,
      schedulerRunVerified: false,
      paidApiCalled: false,
    },
    null,
    2,
  ),
);
