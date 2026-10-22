import 'server-only';
import { googleToken } from './auth';
import { required } from './config';
import { collection, type Context } from './store';
export async function flushOutbox(c: Context) {
  const pending = await collection(c, 'marketingOutbox')
    .where('state', '==', 'pending')
    .limit(20)
    .get();
  if (pending.empty) return { pending: 0, enqueued: 0 };
  const token = await googleToken(),
    queue = required('MARKETING_QUEUE'),
    url = required('MARKETING_WORKER_URL');
  let enqueued = 0;
  for (const doc of pending.docs) {
    const job = await collection(c, 'marketingJobs').doc(doc.id).get();
    const attempt = Number(job.data()?.attempts ?? 0);
    const response = await fetch(`https://cloudtasks.googleapis.com/v2/${queue}/tasks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: {
          name: `${queue}/tasks/mkt-${doc.id}-${attempt}`,
          dispatchDeadline: '900s',
          httpRequest: {
            httpMethod: 'POST',
            url,
            oidcToken: { serviceAccountEmail: required('MARKETING_TASK_SA'), audience: url },
            headers: { 'Content-Type': 'application/json' },
            body: Buffer.from(JSON.stringify({ jobId: doc.id })).toString('base64'),
          },
        },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok && response.status !== 409) throw new Error('marketing_queue_unavailable');
    await doc.ref.update({ state: 'enqueued', updatedAt: new Date().toISOString() });
    enqueued++;
  }
  return { pending: pending.size, enqueued };
}
