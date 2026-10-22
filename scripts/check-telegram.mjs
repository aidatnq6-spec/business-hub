import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

for (const relative of ['../.env.local', '../.secrets/telegram.env']) {
  const path = fileURLToPath(new URL(relative, import.meta.url));
  if (existsSync(path)) process.loadEnvFile(path);
}
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
if (!token || !chatId) {
  console.error('Telegram configuration is missing. No message sent.');
  process.exitCode = 1;
} else {
  try {
    const call = async (method, payload = {}) => {
      const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
      const body = await response.json();
      if (!response.ok || !body.ok)
        throw new Error(`telegram_api_${body.error_code ?? response.status}`);
      return body.result;
    };
    const bot = await call('getMe');
    const chat = await call('getChat', { chat_id: chatId });
    const membership = await call('getChatMember', { chat_id: chatId, user_id: bot.id });
    console.log(
      JSON.stringify({
        botVerified: bot.is_bot === true,
        chatVerified: String(chat.id) === chatId,
        chatType: chat.type,
        botMembership: membership.status,
        noMessageSent: true,
      }),
    );
  } catch (error) {
    const safeCode = /^telegram_api_\d+$/.test(error?.message ?? '')
      ? error.message
      : 'telegram_connection_failed';
    console.error(JSON.stringify({ verified: false, error: safeCode, noMessageSent: true }));
    process.exitCode = 1;
  }
}
