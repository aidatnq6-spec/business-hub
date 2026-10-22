import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/firestore-marketing.rules.test.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
