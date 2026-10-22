import { telegramConfig } from '@/lib/server/telegram-config';
import { REPORT_CRON_UTC, REPORT_TIMEZONE } from '@/lib/telegram-job';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET() {
  const config = telegramConfig();
  return Response.json({
    configured: config.missing.length === 0,
    sendsEnabled: config.enabled && config.missing.length === 0,
    missing: config.missing,
    time: '07:00', timeZone: REPORT_TIMEZONE, cronUtc: REPORT_CRON_UTC,
    // A local config check cannot prove that a production scheduler was deployed.
    schedulerVerified: false,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
