import 'server-only';
import { createHash } from 'node:crypto';
import type { Context } from '../marketing/store';
export function requireOrigin(request: Request) {
  const allowed = [
    process.env.AI_SETTINGS_ORIGIN,
    process.env.MARKETING_ORIGIN,
    process.env.VERCEL_PROJECT_PRODUCTION_URL &&
      `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
  ].filter(Boolean);
  if (process.env.NODE_ENV !== 'production')
    allowed.push('http://localhost:3000', 'http://127.0.0.1:3000');
  const origin = request.headers.get('origin');
  if (
    !origin ||
    !allowed.some((value) => {
      try {
        return new URL(value!).origin === origin;
      } catch {
        return false;
      }
    })
  )
    throw new Error('ai_origin_forbidden');
}
export async function readBody(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
    throw new Error('ai_content_type_invalid');
  if (Number(request.headers.get('content-length')) > 8192) throw new Error('ai_body_too_large');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('ai_input_invalid');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        throw new Error('ai_body_too_large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('ai_input_invalid');
  }
}
export async function rateLimit(c: Context, action: 'mutation' | 'check', now = Date.now()) {
  const ref = c.db.collection('privateAiRateLimits').doc(
    createHash('sha256')
      .update(JSON.stringify([c.uid, action]))
      .digest('hex'),
  );
  await c.db.runTransaction(async (tx) => {
    const old = (await tx.get(ref)).data(),
      start =
        typeof old?.start === 'number' && now >= old.start && now - old.start < 60000
          ? old.start
          : now;
    const count = start === old?.start ? Number(old.count ?? 0) : 0;
    if (count >= (action === 'check' ? 5 : 10)) throw new Error('ai_rate_limited');
    tx.set(ref, { start, count: count + 1 });
  });
}
