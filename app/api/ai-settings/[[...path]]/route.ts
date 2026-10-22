import { handleAiSettings } from '@/lib/server/ai-settings/api';
export const runtime = 'nodejs';
type Params = { params: Promise<{ path?: string[] }> };
async function handle(request: Request, { params }: Params) {
  return handleAiSettings(request, (await params).path ?? []);
}
export { handle as GET, handle as PUT, handle as DELETE, handle as POST, handle as PATCH };
