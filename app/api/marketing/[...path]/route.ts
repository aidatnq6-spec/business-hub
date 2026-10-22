import { handleMarketing } from '@/lib/server/marketing/api';
export const runtime = 'nodejs';
type Params = { params: Promise<{ path: string[] }> };
async function handle(request: Request, { params }: Params) {
  return handleMarketing(request, (await params).path);
}
export { handle as GET, handle as POST, handle as PATCH };
export function HEAD() {
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
