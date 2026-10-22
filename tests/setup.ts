import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
// Node 25 exposes a partial global Web Storage implementation to worker processes.
// Install deterministic browser-compatible storage for isolated component tests.
function storage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, String(value));
    },
  };
}
for (const name of ['localStorage', 'sessionStorage'] as const) {
  const value = storage();
  Object.defineProperty(window, name, { value, configurable: true });
  Object.defineProperty(globalThis, name, { value, configurable: true });
}
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
