export class TelegramDeliveryError extends Error {
  constructor(public code: string, public uncertain: boolean, public retryAfterSeconds = 0) {
    super(code);
    this.name = 'TelegramDeliveryError';
  }
}

export function telegramSender(token: string, chatId: string, request: typeof fetch = fetch) {
  if (!token || !/^-?\d+$/.test(chatId)) throw new Error('Cấu hình Telegram chưa hợp lệ.');
  return async (text: string): Promise<number> => {
    let response: Response;
    try {
      response = await request(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, disable_notification: false, link_preview_options: { is_disabled: true } }),
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      // Never log the request URL: Telegram puts the bot token in the URL.
      throw new TelegramDeliveryError('telegram_network_delivery_unknown', true);
    }
    let body: { ok?: boolean; error_code?: number; parameters?: { retry_after?: number }; result?: { message_id?: number } };
    try { body = await response.json(); }
    catch { throw new TelegramDeliveryError('telegram_invalid_response_delivery_unknown', true); }
    if (response.ok && body.ok === true && Number.isInteger(body.result?.message_id)) return body.result!.message_id!;
    const code = body.error_code ?? response.status;
    const retryAfter = code === 429 && Number.isFinite(body.parameters?.retry_after)
      ? Math.max(1, Number(body.parameters!.retry_after)) : 0;
    // A server error or malformed success can occur after Telegram accepted the message.
    throw new TelegramDeliveryError(`telegram_api_${code}`, code >= 500 || body.ok !== false, retryAfter);
  };
}
