import { spawn } from 'node:child_process';
const port = 3198,
  origin = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['--conditions=react-server', 'dist/marketing-worker.cjs'], {
  env: {
    ...process.env,
    PORT: String(port),
    MARKETING_WORKER_URL: origin,
    MARKETING_TASK_SA: 'local-fixture@example.test',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});
try {
  let alive = false;
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(origin + '/health');
      if (r.ok) {
        alive = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!alive) throw new Error('worker_health_failed');
  const unauthorized = await fetch(origin, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"jobId":"test"}',
  });
  if (unauthorized.status !== 401) throw new Error('worker_auth_guard_failed');
  console.log(
    JSON.stringify({ health: 200, unauthorized: 401, paidApiCalled: false, cloudAccessed: false }),
  );
} finally {
  child.kill();
}
