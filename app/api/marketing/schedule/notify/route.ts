import { scheduleHandler } from '@/lib/server/marketing/daily';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  return scheduleHandler(request, 'notify');
}
export function HEAD() {
  return new Response(null, { status: 204 });
}
