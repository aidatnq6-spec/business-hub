import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { telegramConfig } from '@/lib/server/telegram-config';
import { runTelegramReport } from '@/lib/telegram-job';
import { telegramSender } from '@/lib/telegram-transport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const headers = { 'Cache-Control': 'no-store' };
export async function GET(request: Request) {
  const config = telegramConfig();
  if (!config.cronSecret || config.cronSecret.length < 32)
    return Response.json({ error: 'cron_not_configured' }, { status: 503, headers });
  const supplied = request.headers.get('authorization') ?? '';
  const hash = (value: string) => createHash('sha256').update(value).digest();
  if (!timingSafeEqual(hash(supplied), hash(`Bearer ${config.cronSecret}`)))
    return Response.json({ error: 'unauthorized' }, { status: 401, headers });
  if (!config.enabled || config.missing.length)
    return Response.json({ error: 'telegram_report_not_configured' }, { status: 503, headers });
  try {
    const [{ ownerContext }, { telegramStore }] = await Promise.all([
      import('@/lib/server/firebase-admin'),
      import('@/lib/server/telegram-store'),
    ]);
    const { db, uid } = await ownerContext();
    const result = await runTelegramReport({
      store: telegramStore(db, uid),
      send: telegramSender(config.token!, config.chatId!),
      destination: createHash('sha256').update(config.chatId!).digest('hex'),
      attempt: randomUUID(),
    });
    const status =
      result.status === 'uncertain'
        ? 409
        : result.status === 'failed'
          ? 502
          : result.status === 'backoff' || result.status === 'busy'
            ? 503
            : 200;
    return Response.json(result, { status, headers });
  } catch {
    // SDK errors can contain sensitive URLs/credentials; return only a stable code.
    return Response.json({ error: 'telegram_report_failed' }, { status: 500, headers });
  }
}
export const POST = GET;
// Next otherwise dispatches HEAD through GET; health checks must never send messages.
export function HEAD() {
  return new Response(null, { status: 204, headers });
}
