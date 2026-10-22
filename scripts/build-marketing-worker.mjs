import { build } from 'esbuild';
await build({
  entryPoints: ['services/marketing-worker/server.mjs'],
  outfile: 'dist/marketing-worker.cjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  conditions: ['react-server'],
  packages: 'external',
  external: ['server-only'],
  tsconfig: 'tsconfig.json',
});
console.log('Built dist/marketing-worker.cjs (no cloud resources created).');
