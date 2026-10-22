import 'server-only';
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
export function requireGeneration() {
  const c = marketingConfig();
  if (!c.enabled || !c.generationEnabled || c.missing.length)
    throw new Error('marketing_not_ready');
}
export function required(name: string) {
  const v = process.env[name];
  if (!v) throw new Error('marketing_config_missing');
  return v;
}
