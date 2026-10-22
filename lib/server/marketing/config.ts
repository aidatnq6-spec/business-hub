import 'server-only';
import type { Context } from './store';
import { readCredential, resolveCredential } from '../ai-settings/credentials';
import { selectModel } from '../../ai-settings/catalog';
export function marketingConfig() {
  const env = process.env;
  const missing: string[] = [];
  if (
    !env.FIREBASE_SERVICE_ACCOUNT_JSON &&
    !env.GOOGLE_APPLICATION_CREDENTIALS &&
    env.FIREBASE_USE_ADC !== 'true'
  )
    missing.push('Danh tính Firebase máy chủ');
  if (!env.MARKETING_GEMINI_KEY) missing.push('API Gemini');
  if (!env.MARKETING_TEXT_MODEL || !env.MARKETING_IMAGE_MODEL) missing.push('Model văn bản và ảnh');
  if (!env.MARKETING_BUCKET) missing.push('Kho tài sản riêng tư');
  if (!env.MARKETING_QUEUE || !env.MARKETING_WORKER_URL || !env.MARKETING_TASK_SA)
    missing.push('Hàng đợi và worker');
  if (!env.MARKETING_SCHEDULER_SA || !env.MARKETING_ORIGIN)
    missing.push('Danh tính và địa chỉ Scheduler');
  if (!env.MARKETING_TTS_VOICE) missing.push('Giọng đọc tiếng Việt đã duyệt');
  if (
    !env.MARKETING_PRICES_VALID_UNTIL ||
    Date.parse(env.MARKETING_PRICES_VALID_UNTIL) <= Date.now()
  )
    missing.push('Bảng giá đang hiệu lực');
  return {
    missing,
    enabled: env.MARKETING_ENABLED === 'true',
    generationEnabled: env.MARKETING_GENERATION_ENABLED === 'true',
    scheduleEnabled: env.MARKETING_SCHEDULE_ENABLED === 'true',
    telegramEnabled: env.MARKETING_TELEGRAM_ENABLED === 'true',
  };
}
export async function marketingReadiness(
  context: Context,
  stage: import('../../marketing/types').Stage | 'all' = 'all',
) {
  const flags = marketingConfig(),
    env = process.env,
    missing: string[] = [];
  const gemini = ['all', 'plan', 'draft', 'image'].includes(stage);
  const paid = ['all', 'plan', 'draft', 'image', 'speech'].includes(stage);
  if (!env.MARKETING_QUEUE || !env.MARKETING_WORKER_URL || !env.MARKETING_TASK_SA)
    missing.push('Hàng đợi và worker');
  if (
    ['all', 'image', 'speech', 'render', 'export', 'probe'].includes(stage) &&
    !env.MARKETING_BUCKET
  )
    missing.push('Kho tài sản riêng tư');
  if (paid) {
    if (env.AI_SETTINGS_ACTIVATION_APPROVED !== 'true')
      missing.push('Chưa duyệt kích hoạt AI trả phí');
    const reviewedUntil = Date.parse(env.MARKETING_PRICES_VALID_UNTIL ?? '');
    if (!Number.isFinite(reviewedUntil) || reviewedUntil <= Date.now())
      missing.push('Chưa duyệt chi phí để kích hoạt');
    const capabilities =
      stage === 'all'
        ? (['text', 'image', 'speech'] as const)
        : ([stage === 'image' ? 'image' : stage === 'speech' ? 'speech' : 'text'] as const);
    if (capabilities.some((capability) => !selectModel(capability)))
      missing.push('Bảng giá/model đã hết hạn hoặc chưa xác minh');
  }
  if (gemini) {
    const credential = await readCredential(context);
    if (!credential.configured) missing.push('API Gemini');
    else {
      if (credential.check.state !== 'valid') missing.push('Chưa kiểm tra kết nối Gemini');
      try {
        await resolveCredential(context, credential.revision);
      } catch {
        missing.push('Chưa giải mã được khóa Gemini');
      }
    }
  }
  if (
    ['all', 'speech'].includes(stage) &&
    (!env.MARKETING_TTS_VOICE || env.MARKETING_TTS_VOICE_APPROVED !== 'true')
  )
    missing.push('Chưa duyệt giọng đọc');
  return {
    ...flags,
    missing,
    generationEnabled: flags.generationEnabled && env.AI_SETTINGS_ACTIVATION_APPROVED === 'true',
  };
}
export async function requireGeneration(
  context: Context,
  stage: import('../../marketing/types').Stage | 'all' = 'all',
) {
  const c = await marketingReadiness(context, stage);
  const paid = ['all', 'plan', 'draft', 'image', 'speech'].includes(stage);
  if (!c.enabled || (paid && !c.generationEnabled) || c.missing.length)
    throw new Error('marketing_not_ready');
}
export function required(name: string) {
  const v = process.env[name];
  if (!v) throw new Error('marketing_config_missing');
  return v;
}
