import { createServer } from 'node:http';
import { runJob } from '../../lib/server/marketing/runner.ts';
import { verifyGoogle } from '../../lib/server/marketing/auth.ts';
import { ownerContext } from '../../lib/server/firebase-admin.ts';
import { required } from '../../lib/server/marketing/config.ts';
import { idSchema } from '../../lib/marketing/types.ts';
import { renderVideo, probeMedia, composeImage } from './render.mjs';
createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200);
    res.end('ok');
    return;
  }
  try {
    if (req.method !== 'POST' || req.url !== '/') {
      res.writeHead(404);
      res.end();
      return;
    }
    const request = new Request(required('MARKETING_WORKER_URL'), {
      headers: { authorization: req.headers.authorization ?? '' },
    });
    await verifyGoogle(request, required('MARKETING_TASK_SA'), required('MARKETING_WORKER_URL'));
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (Buffer.byteLength(raw) > 4096) throw new Error('marketing_input_invalid');
    }
    const value = JSON.parse(raw);
    const id = idSchema.parse(value.jobId);
    const result = await runJob(await ownerContext(), id, renderVideo, probeMedia, composeImage);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === 'marketing_unauthorized';
    res.writeHead(unauthorized ? 401 : 503, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: unauthorized ? 'marketing_unauthorized' : 'marketing_worker_unavailable',
      }),
    );
  }
}).listen(Number(process.env.PORT || 8080), '0.0.0.0');
