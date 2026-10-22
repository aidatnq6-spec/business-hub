import 'server-only';

export function telegramConfig() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const cronSecret = process.env.CRON_SECRET;
  const identity = !!(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.FIREBASE_USE_ADC === 'true'
  );
  const missing: string[] = [];
  if (!projectId) missing.push('Firebase project');
  if (!identity) missing.push('Danh tính Firebase máy chủ');
  if (!token) missing.push('Telegram bot token');
  if (!chatId || !/^-?\d+$/.test(chatId)) missing.push('Telegram chat ID');
  if (!cronSecret || cronSecret.length < 32) missing.push('Cron secret');
  return {
    projectId,
    token,
    chatId,
    cronSecret,
    identity,
    missing,
    enabled: process.env.TELEGRAM_REPORT_ENABLED === 'true',
  };
}
